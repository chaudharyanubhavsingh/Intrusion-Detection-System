import logging
import asyncio
import uuid
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import psutil
import socket
from scapy.all import sniff, IP, TCP, UDP, ICMP  # Core Scapy imports

logger = logging.getLogger("security-monitor")

class SecurityMonitor:
    """Monitors system security and detects unique suspicious threats targeting this device in real-time"""
    
    def __init__(self, data_manager):
        self.data_manager = data_manager
        self.network_interface = self._get_default_interface()
        self.local_ip = self._get_local_ip()
        self.packet_counts = {}  # Track packet stats per IP
        self.reported_threats = {}  # Avoid duplicate reporting
        self.websocket_manager = None  # Set by main.py for broadcasting
        self.loop = asyncio.get_event_loop()  # Store main event loop
        logger.info(f"Initialized with interface: {self.network_interface}, local IP: {self.local_ip}")

    def _get_default_interface(self) -> str:
        """Get the default network interface with active traffic (Windows-compatible)"""
        try:
            net_io = psutil.net_io_counters(pernic=True)
            for iface, stats in net_io.items():
                if "Loopback" not in iface and stats.bytes_sent + stats.bytes_recv > 0:
                    logger.info(f"Selected active interface: {iface} (sent: {stats.bytes_sent}, recv: {stats.bytes_recv})")
                    return iface
            logger.warning("No active interfaces found, defaulting to 'Ethernet'")
            return "Ethernet"
        except Exception as e:
            logger.error(f"Failed to get default interface: {str(e)}")
            return "Ethernet"

    def _get_local_ip(self) -> str:
        """Get the accurate local IP address of this device"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            logger.info(f"Detected local IP: {local_ip}")
            return local_ip
        except Exception as e:
            logger.error(f"Failed to get local IP: {str(e)}")
            return "127.0.0.1"

    def get_current_stats(self) -> Dict[str, Any]:
        """Get current security statistics with real data"""
        data = self.data_manager.load_data()
        stats = data.get("stats", {"total_threats": 0, "blocked_attacks": 0})
        net_io = psutil.net_io_counters()
        stats.update({
            "network_traffic": f"{(net_io.bytes_sent + net_io.bytes_recv) / 1024 / 1024:.1f} MB",
            "active_users": len(psutil.users())
        })
        self.data_manager.update_stats(stats)
        return stats

    async def start_live_monitoring(self):
        """Start continuous packet sniffing for real-time threat detection"""
        logger.info(f"Starting live monitoring on {self.network_interface} for {self.local_ip}")
        await asyncio.get_event_loop().run_in_executor(None, self._sniff_packets_continuously)

    def _sniff_packets_continuously(self):
        """Continuously sniff packets and analyze for threats"""
        try:
            logger.info("Starting packet sniffing...")
            sniff(
                iface=self.network_interface,
                prn=self._analyze_packet,
                filter=f"dst host {self.local_ip}",  # Only traffic to this host
                store=0
            )
        except Exception as e:
            logger.error(f"Error sniffing packets on {self.network_interface}: {str(e)}")

    def _analyze_packet(self, pkt):
        """Analyze each packet in real-time for suspicious activity"""
        if IP not in pkt or pkt[IP].dst != self.local_ip:
            return

        src_ip = pkt[IP].src
        current_time = time.time()

        # Initialize tracking for this IP if new
        if src_ip not in self.packet_counts:
            self.packet_counts[src_ip] = {
                "times": [],  # Timestamps for rate calculation
                "ports": set(),  # Unique ports targeted
                "syn_count": 0,  # SYN packets for brute force
                "packet_count": 0,  # Total packets
                "icmp_count": 0  # ICMP packets for flood detection
            }

        stats = self.packet_counts[src_ip]
        stats["times"].append(current_time)
        stats["times"] = [t for t in stats["times"] if current_time - t < 10]  # 10-second window
        stats["packet_count"] += 1

        # Calculate packet rate (packets per second)
        packet_rate = len(stats["times"]) / 10

        # DDoS Detection: High packet rate (>100 packets/sec)
        threat_key = f"{src_ip}:DDoS"
        if packet_rate > 100 and threat_key not in self.reported_threats:
            threat = self._create_threat(src_ip, "DDoS", "high", f"Packet rate: {packet_rate:.2f} pps")
            self._report_threat(threat, threat_key)
            return

        # Port Scan Detection: Multiple unique ports (>5) in short time
        if TCP in pkt or UDP in pkt:
            port = pkt[TCP].dport if TCP in pkt else pkt[UDP].dport
            stats["ports"].add(port)
            threat_key = f"{src_ip}:PortScan"
            if len(stats["ports"]) > 5 and threat_key not in self.reported_threats:
                threat = self._create_threat(src_ip, "Port Scan", "medium", f"Ports targeted: {len(stats['ports'])}")
                self._report_threat(threat, threat_key)
                return

        # Brute Force Detection: High SYN rate (>20 in 10 seconds)
        if TCP in pkt and pkt[TCP].flags == "S":
            stats["syn_count"] += 1
            threat_key = f"{src_ip}:BruteForce"
            if stats["syn_count"] > 20 and threat_key not in self.reported_threats:
                threat = self._create_threat(src_ip, "Brute Force", "medium", f"SYN attempts: {stats['syn_count']}")
                self._report_threat(threat, threat_key)
                return

        # ICMP Flood Detection: High ICMP rate (>50 in 10 seconds)
        if pkt.haslayer("ICMP") and pkt[ICMP].type == 8:  # Echo Request (ping)
            stats["icmp_count"] += 1
            threat_key = f"{src_ip}:ICMPFlood"
            if stats["icmp_count"] > 50 and threat_key not in self.reported_threats:
                threat = self._create_threat(src_ip, "ICMP Flood", "medium", f"ICMP requests: {stats['icmp_count']}")
                self._report_threat(threat, threat_key)
                return

        # Periodic cleanup (every 60 seconds)
        if int(current_time) % 60 == 0:
            self._cleanup_packet_counts(current_time)

    def _create_threat(self, src_ip: str, threat_type: str, severity: str, details: str) -> Dict[str, Any]:
        """Create a threat object"""
        return {
            "id": f"threat-{uuid.uuid4().hex[:8]}",
            "source": src_ip,
            "destination": self.local_ip,
            "type": threat_type,
            "severity": severity,
            "status": "detected",
            "timestamp": datetime.now().isoformat(),
            "details": details
        }

    def _report_threat(self, threat: Dict[str, Any], threat_key: str):
        """Report a detected threat immediately via WebSocket"""
        self.reported_threats[threat_key] = time.time()
        self.data_manager.add_threat(threat)
        if self.websocket_manager:
            try:
                self.loop.call_soon_threadsafe(
                    lambda: asyncio.ensure_future(
                        self.websocket_manager.broadcast({
                            "type": "active_threats",
                            "data": {"threats": [threat]}
                        })
                    )
                )
                logger.info(f"Threat broadcasted via WebSocket: {threat['type']} from {threat['source']}")
            except Exception as e:
                logger.error(f"Failed to broadcast threat: {str(e)}")
        else:
            logger.warning("No WebSocket manager available to broadcast threat")
        logger.info(f"Detected and reported {threat['type']} from {threat['source']}, ID: {threat['id']}")

    def _cleanup_packet_counts(self, current_time: float):
        """Remove stale packet data (older than 5 minutes)"""
        self.packet_counts = {
            ip: stats for ip, stats in self.packet_counts.items()
            if current_time - stats["times"][-1] < 300
        }
        self.reported_threats = {
            k: v for k, v in self.reported_threats.items()
            if current_time - v < 300
        }

    def get_recent_threats(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the most recent threats"""
        data = self.data_manager.load_data()
        threats = data.get("threats", [])
        return sorted(threats, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]

    def get_active_threats(self) -> List[Dict[str, Any]]:
        """Get currently active threats (detected but not blocked)"""
        data = self.data_manager.load_data()
        threats = data.get("threats", [])
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        return [threat for threat in threats if threat.get("status") == "detected" and threat.get("timestamp", "") > one_hour_ago]