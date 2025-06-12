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
import aiohttp

logger = logging.getLogger("security-monitor")

class SecurityMonitor:
    def __init__(self, data_manager):
        self.data_manager = data_manager
        self.network_interface = self._get_default_interface()
        self.local_ip = self._get_local_ip()
        self.packet_counts = {}
        self.reported_threats = {}  # Tracks reported threats
        self.detection_attempts = {}  # Tracks detection attempts for re-evaluation
        self.websocket_manager = None
        self.loop = asyncio.get_event_loop()
        self.is_locked_down = False
        self.ml_api_url = "https://6433-34-16-197-255.ngrok-free.app/predict"  # Latest ngrok URL
        self.session = None
        logger.info(f"All network interfaces: {psutil.net_if_addrs()}")
        logger.info(f"Initialized with interface: {self.network_interface}, local IP: {self.local_ip}, ML API: {self.ml_api_url}")

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

    async def start_live_monitoring(self):
        logger.info(f"Starting live monitoring on {self.network_interface} for {self.local_ip}")
        async with aiohttp.ClientSession() as session:
            self.session = session
            try:
                await asyncio.get_event_loop().run_in_executor(None, self._sniff_packets_continuously)
            except Exception as e:
                logger.error(f"Error starting live monitoring: {str(e)}")

    def _sniff_packets_continuously(self):
        while True:
            if self.is_locked_down:
                logger.info("System in lockdown, pausing packet sniffing")
                time.sleep(5)
                continue
            try:
                logger.info(f"Starting packet sniffing on {self.network_interface} with filter 'dst host {self.local_ip}'")
                sniff(
                    iface=self.network_interface,
                    prn=self._analyze_packet,
                    filter=f"dst host {self.local_ip}",
                    store=0,
                    timeout=300
                )
                logger.info("Sniffing stopped, restarting after timeout or interruption")
            except Exception as e:
                logger.error(f"Error sniffing packets on {self.network_interface}: {str(e)}. Retrying in 5 seconds...")
                time.sleep(5)

    def _extract_features(self, pkt, stats: Dict[str, Any]) -> Dict[str, float]:
        """Extract features matching the Colab model with capped values."""
        try:
            current_time = time.time()
            time_span = current_time - stats["last_reset"] if stats["times"] else 0.001
            packet_rate = min(len(stats["times"]) / time_span, 1000)
            unique_ports = min(len(stats["ports"]), 100)
            syn_count = min(sum(stats["syn_counts"].values()), 100)
            icmp_count = min(len(stats["icmp_times"]), 100)

            is_tcp = 1 if TCP in pkt else 0
            is_udp = 1 if UDP in pkt else 0
            is_icmp = 1 if pkt.haslayer(ICMP) else 0
            is_syn = 1 if TCP in pkt and pkt[TCP].flags == "S" else 0

            features = {
                "packet_rate": packet_rate,
                "unique_ports": unique_ports,
                "syn_count": syn_count,
                "icmp_count": icmp_count,
                "is_tcp": is_tcp,
                "is_udp": is_udp,
                "is_icmp": is_icmp,
                "is_syn": is_syn
            }
            logger.debug(f"Extracted features: {features}")
            return features
        except Exception as e:
            logger.error(f"Error extracting features: {str(e)}")
            return {key: 0 for key in ["packet_rate", "unique_ports", "syn_count", "icmp_count", "is_tcp", "is_udp", "is_icmp", "is_syn"]}

    async def _predict_with_ml(self, features: Dict[str, float]) -> Optional[Dict[str, float]]:
        try:
            logger.info(f"Sending request to ML API: {self.ml_api_url} with features: {features}")
            async with self.session.post(self.ml_api_url, json=features) as response:
                logger.info(f"ML API response status: {response.status}")
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"ML API response: {result}")
                    return {"prediction": result["prediction"], "probability": result["probability"]}
                else:
                    logger.error(f"ML API returned status {response.status}: {await response.text()}")
                    return None
        except Exception as e:
            logger.error(f"Error calling ML API: {str(e)}")
            return None

    def _analyze_packet(self, pkt):
        if self.is_locked_down:
            logger.debug("Ignoring packet: system is in lockdown")
            return
        try:
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
                    "times": deque(maxlen=500),  # Increased to handle larger attacks
                    "ports": defaultdict(int),
                    "syn_counts": defaultdict(int),
                    "icmp_times": deque(maxlen=500),
                    "packet_count": 0,
                    "last_reset": current_time
                }

            stats = self.packet_counts[src_ip]
            stats["times"].append(current_time)
            stats["packet_count"] += 1
            if TCP in pkt or UDP in pkt:
                stats["ports"][pkt[TCP].dport if TCP in pkt else pkt[UDP].dport] += 1
            if TCP in pkt and pkt[TCP].flags == "S":
                stats["syn_counts"][pkt[TCP].dport] += 1
            if pkt.haslayer(ICMP) and pkt[ICMP].type == 8:
                stats["icmp_times"].append(current_time)

            if current_time - stats["last_reset"] > 300:
                stats["times"].clear()
                stats["ports"].clear()
                stats["syn_counts"].clear()
                stats["icmp_times"].clear()
                stats["last_reset"] = current_time
                logger.debug(f"Reset counters for {src_ip} due to inactivity")

            # Rule-based detection first
            threat_key = None
            threat_type = None
            severity = "medium"
            details = ""

            # DDoS
            if len(stats["times"]) > 5:
                time_span = stats["times"][-1] - stats["times"][0]
                packet_rate = len(stats["times"]) / (time_span if time_span > 0 else 1)
                threat_key = f"{src_ip}:DDoS"
                if packet_rate > 10 and time_span > 5:
                    threat_type = "DDoS"
                    severity = "high"
                    details = f"Sustained rate: {packet_rate:.2f} pps over {time_span:.1f}s"

            # Port Scan
            if TCP in pkt or UDP in pkt:
                threat_key = f"{src_ip}:PortScan"
                if len(stats["ports"]) > 3 and len(stats["times"]) > 1:
                    time_span = stats["times"][-1] - stats["times"][0]
                    if time_span < 3:
                        threat_type = "Port Scan"
                        details = f"Hit {len(stats['ports'])} ports in {time_span:.1f}s"

            # Brute Force
            if TCP in pkt and pkt[TCP].flags == "S":
                port = pkt[TCP].dport
                threat_key = f"{src_ip}:BruteForce:{port}"
                if stats["syn_counts"][port] > 5 and len(stats["times"]) > 1:
                    time_span = stats["times"][-1] - stats["times"][0]
                    if time_span < 5:
                        threat_type = "Brute Force"
                        details = f"{stats['syn_counts'][port]} SYNs to port {port} in {time_span:.1f}s"

            # ICMP Flood
            if pkt.haslayer(ICMP) and pkt[ICMP].type == 8:
                threat_key = f"{src_ip}:ICMPFlood"
                icmp_len = len(stats["icmp_times"])
                time_span = stats["icmp_times"][-1] - stats["icmp_times"][0] if icmp_len > 1 else 0
                logger.debug(f"ICMP stats for {src_ip}: len={icmp_len}, time_span={time_span:.2f}s")
                if icmp_len > 10 and time_span < 3:
                    threat_type = "ICMP Flood"
                    details = f"{icmp_len} pings in {time_span:.1f}s"

            # If a threat is detected by rules, proceed with evaluation
            if threat_type:
                # Check if this threat was previously reported
                if threat_key in self.reported_threats:
                    logger.debug(f"Threat {threat_key} already reported, skipping")
                    return

                # Check if we've recently attempted to detect this threat
                if threat_key in self.detection_attempts:
                    last_attempt_time = self.detection_attempts[threat_key]["time"]
                    if current_time - last_attempt_time < 30:  # 30-second window for re-evaluation
                        logger.debug(f"Recent detection attempt for {threat_key}, skipping")
                        return
                    else:
                        logger.debug(f"Re-evaluating {threat_key} after {current_time - last_attempt_time:.1f}s")

                features = self._extract_features(pkt, stats)
                logger.debug(f"Extracted features for {src_ip}: {features}")
                if self.session:
                    prediction = asyncio.run_coroutine_threadsafe(self._predict_with_ml(features), self.loop).result()
                    logger.debug(f"ML Prediction for {src_ip}: {prediction}")
                    if prediction and prediction["prediction"] == 1 and prediction["probability"] >= 0.01:  # Keep threshold low for now
                        severity = "high" if prediction["probability"] >= 0.5 else "medium"
                        details += f" (ML prob: {prediction['probability']:.2f})"
                        threat = self._create_threat(src_ip, threat_type, severity, details)
                        self._report_threat(threat, threat_key)
                    else:
                        logger.debug(f"ML rejected threat from {src_ip}: {prediction}")
                        # Log the detection attempt but do not add to reported_threats
                        self.detection_attempts[threat_key] = {"time": current_time}
                else:
                    # No ML, use rule-based only
                    threat = self._create_threat(src_ip, threat_type, severity, details)
                    self._report_threat(threat, threat_key)

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
            stats["total_threats"] = len(data.get("threats", []))
            stats["blocked_attacks"] = len(data.get("firewall_rules", []))
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
            self.detection_attempts = {
                k: v for k, v in self.detection_attempts.items()
                if current_time - v["time"] < 300
            }
            logger.debug("Cleaned up old packet counts, reported threats, and detection attempts")
        except Exception as e:
            logger.error(f"Error cleaning up threats: {str(e)}")

    def reset_monitoring(self):
        try:
            self.packet_counts.clear()
            self.reported_threats.clear()
            self.detection_attempts.clear()
            logger.info("Monitoring reset, restarting packet sniffing")
        except Exception as e:
            logger.error(f"Error resetting monitoring: {str(e)}")

    def set_lockdown_state(self, is_locked: bool):
        self.is_locked_down = is_locked
        logger.info(f"Lockdown state updated to: {is_locked}")

    def get_current_stats(self) -> Dict[str, Any]:
        try:
            data = self.data_manager.load_data()
            threats = data.get("threats", [])
            firewall_rules = data.get("firewall_rules", [])
            stats = {
                "total_threats": len(threats),
                "blocked_attacks": len(firewall_rules),
                "network_traffic": f"{(psutil.net_io_counters().bytes_sent + psutil.net_io_counters().bytes_recv) / 1024 / 1024/10:.1f} MB",
                "active_users": len(psutil.users())
            }
            self.data_manager.update_stats(stats)
            return stats
        except Exception as e:
            logger.error(f"Error getting stats: {str(e)}")
            return {"total_threats": 0, "blocked_attacks": 0, "network_traffic": "0 MB", "active_users": 0}

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