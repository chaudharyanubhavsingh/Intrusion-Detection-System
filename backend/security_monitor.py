import logging
import asyncio
import uuid
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import psutil
import socket
from scapy.all import sniff, IP, TCP, UDP, ICMP
from collections import deque, defaultdict

logger = logging.getLogger("security-monitor")

class SecurityMonitor:
    def __init__(self, data_manager):
        self.data_manager = data_manager
        self.network_interface = self._get_default_interface()
        self.local_ip = self._get_local_ip()
        self.packet_counts = {}  # Per-source tracking
        self.reported_threats = {}
        self.websocket_manager = None
        self.loop = asyncio.get_event_loop()
        logger.info(f"All network interfaces: {psutil.net_if_addrs()}")
        logger.info(f"Initialized with interface: {self.network_interface}, local IP: {self.local_ip}")

    def _get_default_interface(self) -> str:
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
        try:
            data = self.data_manager.load_data()
            threats = data.get("threats", [])
            firewall_rules = data.get("firewall_rules", [])
            stats = {
                "total_threats": len(threats) + len(firewall_rules),
                "blocked_attacks": len(firewall_rules),
                "network_traffic": f"{(psutil.net_io_counters().bytes_sent + psutil.net_io_counters().bytes_recv) / 1024 / 1024:.1f} MB",
                "active_users": len(psutil.users())
            }
            self.data_manager.update_stats(stats)
            return stats
        except Exception as e:
            logger.error(f"Error getting stats: {str(e)}")
            return {"total_threats": 0, "blocked_attacks": 0, "network_traffic": "0 MB", "active_users": 0}

    async def start_live_monitoring(self):
        logger.info(f"Starting live monitoring on {self.network_interface} for {self.local_ip}")
        try:
            await asyncio.get_event_loop().run_in_executor(None, self._sniff_packets_continuously)
        except Exception as e:
            logger.error(f"Error starting live monitoring: {str(e)}")

    def _sniff_packets_continuously(self):
        while True:
            try:
                logger.info(f"Starting packet sniffing on {self.network_interface} with filter 'dst host {self.local_ip}'")
                sniff(
                    iface=self.network_interface,
                    prn=self._analyze_packet,
                    filter=f"dst host {self.local_ip}",
                    store=0,
                    timeout=300  # 5 minutes, per your last tweak
                )
                logger.info("Sniffing stopped, restarting after timeout or interruption")
            except Exception as e:
                logger.error(f"Error sniffing packets on {self.network_interface}: {str(e)}. Retrying in 5 seconds...")
                time.sleep(5)

    def _analyze_packet(self, pkt):
        try:
            logger.debug(f"Raw packet: {pkt.summary()}")
            if IP not in pkt:
                logger.debug("No IP layer in packet")
                return

            src_ip = pkt[IP].src
            dst_ip = pkt[IP].dst
            logger.debug(f"Packet from {src_ip} to {dst_ip}")

            if dst_ip != self.local_ip:
                logger.debug(f"Packet ignored: dst {dst_ip} != {self.local_ip}")
                return

            current_time = time.time()

            if src_ip not in self.packet_counts:
                self.packet_counts[src_ip] = {
                    "times": deque(maxlen=50),  # Larger window for sustained checks
                    "ports": defaultdict(int),  # Count port hits
                    "syn_counts": defaultdict(int),  # Per-port SYN counts
                    "icmp_times": deque(maxlen=50),
                    "packet_count": 0,
                    "last_reset": current_time
                }

            stats = self.packet_counts[src_ip]
            stats["times"].append(current_time)
            stats["packet_count"] += 1

            # Reset if inactive for 5 minutes
            if current_time - stats["last_reset"] > 300:
                stats["times"].clear()
                stats["ports"].clear()
                stats["syn_counts"].clear()
                stats["icmp_times"].clear()
                stats["last_reset"] = current_time
                logger.debug(f"Reset counters for {src_ip} due to inactivity")

            # DDoS: >20 pps sustained over 10+ seconds
            if len(stats["times"]) > 10:  # At least 10 packets
                time_span = stats["times"][-1] - stats["times"][0]
                packet_rate = len(stats["times"]) / (time_span if time_span > 0 else 1)
                threat_key = f"{src_ip}:DDoS"
                if packet_rate > 20 and time_span > 10 and threat_key not in self.reported_threats:
                    threat = self._create_threat(src_ip, "DDoS", "high", f"Sustained rate: {packet_rate:.2f} pps over {time_span:.1f}s")
                    self._report_threat(threat, threat_key)

            # Port Scan: >5 unique ports in <5 seconds
            if TCP in pkt or UDP in pkt:
                port = pkt[TCP].dport if TCP in pkt else pkt[UDP].dport
                stats["ports"][port] += 1
                threat_key = f"{src_ip}:PortScan"
                if len(stats["ports"]) > 5 and len(stats["times"]) > 1:
                    time_span = stats["times"][-1] - stats["times"][0]
                    if time_span < 5 and threat_key not in self.reported_threats:
                        threat = self._create_threat(src_ip, "Port Scan", "medium", f"Hit {len(stats['ports'])} ports in {time_span:.1f}s")
                        self._report_threat(threat, threat_key)

            # Brute Force: >10 SYNs to same port in <10 seconds
            if TCP in pkt and pkt[TCP].flags == "S":
                port = pkt[TCP].dport
                stats["syn_counts"][port] += 1
                threat_key = f"{src_ip}:BruteForce:{port}"
                if stats["syn_counts"][port] > 10 and len(stats["times"]) > 1:
                    time_span = stats["times"][-1] - stats["times"][0]
                    if time_span < 10 and threat_key not in self.reported_threats:
                        threat = self._create_threat(src_ip, "Brute Force", "medium", f"{stats['syn_counts'][port]} SYNs to port {port} in {time_span:.1f}s")
                        self._report_threat(threat, threat_key)

            # ICMP Flood: >20 pings in <5 seconds
            if pkt.haslayer(ICMP) and pkt[ICMP].type == 8:
                stats["icmp_times"].append(current_time)
                threat_key = f"{src_ip}:ICMPFlood"
                if len(stats["icmp_times"]) > 20 and len(stats["icmp_times"]) > 1:
                    time_span = stats["icmp_times"][-1] - stats["icmp_times"][0]
                    if time_span < 5 and threat_key not in self.reported_threats:
                        threat = self._create_threat(src_ip, "ICMP Flood", "medium", f"{len(stats['icmp_times'])} pings in {time_span:.1f}s")
                        self._report_threat(threat, threat_key)

            # Cleanup every minute
            if int(current_time) % 60 == 0:
                self._cleanup_threats(current_time)

        except Exception as e:
            logger.error(f"Error analyzing packet: {str(e)}")

    def _create_threat(self, src_ip: str, threat_type: str, severity: str, details: str) -> Dict[str, Any]:
        try:
            threat = {
                "id": f"threat-{uuid.uuid4().hex[:8]}",
                "source": src_ip,
                "destination": self.local_ip,
                "type": threat_type,
                "severity": severity,
                "status": "detected",
                "timestamp": datetime.now().isoformat(),
                "details": details
            }
            logger.info(f"Created threat: {threat}")
            return threat
        except Exception as e:
            logger.error(f"Error creating threat: {str(e)}")
            return {}

    def _report_threat(self, threat: Dict[str, Any], threat_key: str):
        try:
            self.reported_threats[threat_key] = time.time()
            self.data_manager.add_threat(threat)
            data = self.data_manager.load_data()
            stats = data.get("stats", {})
            stats["total_threats"] = len(data.get("threats", [])) + len(data.get("firewall_rules", []))
            self.data_manager.update_stats(stats)

            if self.websocket_manager is None:
                logger.warning("WebSocket manager is None. Cannot broadcast threat.")
            else:
                logger.debug(f"Attempting to broadcast threat: {threat}")
                asyncio.run_coroutine_threadsafe(
                    self.websocket_manager.broadcast({
                        "type": "threat_update",
                        "data": {
                            "threat": threat,
                            "stats": stats
                        }
                    }),
                    self.loop
                )
                logger.info(f"Threat broadcasted: {threat['type']} from {threat['source']}")
        except Exception as e:
            logger.error(f"Failed to report threat: {str(e)}")

    def _cleanup_threats(self, current_time: float):
        try:
            self.packet_counts = {
                ip: stats for ip, stats in self.packet_counts.items()
                if current_time - stats["last_reset"] < 300
            }
            self.reported_threats = {
                k: v for k, v in self.reported_threats.items()
                if current_time - v < 300
            }
            logger.debug("Cleaned up old packet counts and threats")
        except Exception as e:
            logger.error(f"Error cleaning up threats: {str(e)}")

    def get_recent_threats(self, limit: int = 10) -> List[Dict[str, Any]]:
        try:
            data = self.data_manager.load_data()
            threats = data.get("threats", [])
            return sorted(threats, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
        except Exception as e:
            logger.error(f"Error getting recent threats: {str(e)}")
            return []

    def get_active_threats(self) -> List[Dict[str, Any]]:
        try:
            data = self.data_manager.load_data()
            threats = data.get("threats", [])
            one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
            return [threat for threat in threats if threat.get("status") == "detected" and threat.get("timestamp", "") > one_hour_ago]
        except Exception as e:
            logger.error(f"Error getting active threats: {str(e)}")
            return []