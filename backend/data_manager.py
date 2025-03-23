import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import threading

logger = logging.getLogger("data-manager")

class DataManager:
    def __init__(self, data_file_path: str):
        self.data_file_path = data_file_path
        self.lock = threading.Lock()
        self.cache = None
        self._ensure_data_file_exists()
        self.load_data()  # Initial load into cache

    def _ensure_data_file_exists(self):
        directory = os.path.dirname(self.data_file_path)
        if not os.path.exists(directory):
            os.makedirs(directory)
        if not os.path.exists(self.data_file_path):
            self.reset_data()  # Use reset_data to initialize

    def reset_data(self) -> bool:
        """Reset the security_data.json file to an initial empty state."""
        initial_data = {
            "stats": {
                "total_threats": 0,
                "blocked_attacks": 0,
                "network_traffic": "0 MB",
                "active_users": 0
            },
            "threats": [],
            "firewall_rules": [],
            "system_health": {
                "cpu_usage": 0,
                "memory_usage": 0,
                "disk_usage": 0,
                "network_usage": 0
            },
            "alerts": [],
            "scans": []
        }
        success = self.save_data(initial_data)
        if success:
            logger.info(f"Reset {self.data_file_path} to initial state")
        else:
            logger.error(f"Failed to reset {self.data_file_path}")
        return success

    def load_data(self, update_stats=True) -> Dict[str, Any]:
        if self.cache is not None and not update_stats:
            return self.cache.copy()
        try:
            with self.lock:
                with open(self.data_file_path, 'r') as f:
                    data = json.load(f)
                    if update_stats:
                        threats = data.get("threats", [])
                        firewall_rules = data.get("firewall_rules", [])
                        stats = data.get("stats", {})
                        stats["total_threats"] = len(threats)  # Raw total
                        stats["blocked_attacks"] = len(firewall_rules)
                        data["stats"] = stats
                    self.cache = data
                    return data.copy()
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Error loading data: {str(e)}")
            return {}

    def save_data(self, data: Dict[str, Any]) -> bool:
        success = self._save_to_file(data)
        if success:
            self.cache = data.copy()
        return success

    def _save_to_file(self, data: Dict[str, Any]) -> bool:
        try:
            with self.lock:
                with open(self.data_file_path, 'w') as f:
                    json.dump(data, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving data: {str(e)}")
            return False

    def update_stats(self, stats: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        data["stats"] = {**data.get("stats", {}), **stats}
        return self.save_data(data)

    def add_threat(self, threat: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        if "timestamp" not in threat:
            threat["timestamp"] = datetime.now().isoformat()
        if "id" not in threat:
            threat["id"] = f"threat-{len(data.get('threats', [])) + 1}"

        threats = data.get("threats", [])
        if not any(t["id"] == threat["id"] for t in threats):
            threats.append(threat)
            data["threats"] = threats
            return self.save_data(data)
        return False

    def update_threat(self, threat_id: str, updates: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        threats = data.get("threats", [])
        for i, threat in enumerate(threats):
            if threat.get("id") == threat_id:
                threats[i] = {**threat, **updates}
                data["threats"] = threats
                return self.save_data(data)
        return False

    def add_firewall_rule(self, rule: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        if "timestamp" not in rule:
            rule["timestamp"] = datetime.now().isoformat()
        if "id" not in rule:
            rule["id"] = f"rule-{len(data.get('firewall_rules', [])) + 1}"

        rules = data.get("firewall_rules", [])
        if not any(r["source_ip"] == rule["source_ip"] for r in rules):
            rules.append(rule)
            data["firewall_rules"] = rules
            return self.save_data(data)
        return False

    def remove_firewall_rule(self, rule_id_or_ip: str) -> bool:
        data = self.load_data(update_stats=False)
        rules = data.get("firewall_rules", [])
        for i, rule in enumerate(rules):
            if rule.get("id") == rule_id_or_ip or rule.get("source_ip") == rule_id_or_ip:
                rules.pop(i)
                data["firewall_rules"] = rules
                return self.save_data(data)
        return False

    def add_alert(self, alert: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        if "timestamp" not in alert:
            alert["timestamp"] = datetime.now().isoformat()
        if "id" not in alert:
            alert["id"] = f"alert-{len(data.get('alerts', [])) + 1}"

        alerts = data.get("alerts", [])
        alerts.append(alert)
        data["alerts"] = alerts
        return self.save_data(data)

    def update_system_health(self, health_data: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        data["system_health"] = {**data.get("system_health", {}), **health_data}
        return self.save_data(data)

    def add_scan(self, scan: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        if "timestamp" not in scan:
            scan["timestamp"] = datetime.now().isoformat()
        if "id" not in scan:
            scan["id"] = f"scan-{len(data.get('scans', [])) + 1}"

        scans = data.get("scans", [])
        scans.append(scan)
        data["scans"] = scans
        return self.save_data(data)

    def update_scan(self, scan_id: str, updates: Dict[str, Any]) -> bool:
        data = self.load_data(update_stats=False)
        scans = data.get("scans", [])
        for i, scan in enumerate(scans):
            if scan.get("id") == scan_id:
                scans[i] = {**scan, **updates}
                data["scans"] = scans
                return self.save_data(data)
        return False