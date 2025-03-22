import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import threading

logger = logging.getLogger("data-manager")

class DataManager:
    """Manages centralized data storage for the security dashboard"""
    
    def __init__(self, data_file_path: str):
        self.data_file_path = data_file_path
        self.lock = threading.Lock()
        self._ensure_data_file_exists()
        
    def _ensure_data_file_exists(self):
        """Create data file and directory if they don't exist"""
        directory = os.path.dirname(self.data_file_path)
        if not os.path.exists(directory):
            os.makedirs(directory)
            
        if not os.path.exists(self.data_file_path):
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
            self.save_data(initial_data)
            
    def load_data(self) -> Dict[str, Any]:
        """Load data from the JSON file"""
        try:
            with self.lock:
                with open(self.data_file_path, 'r') as f:
                    return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Error loading data: {str(e)}")
            return {}
            
    def save_data(self, data: Dict[str, Any]) -> bool:
        """Save data to the JSON file"""
        try:
            with self.lock:
                with open(self.data_file_path, 'w') as f:
                    json.dump(data, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving data: {str(e)}")
            return False
            
    def update_stats(self, stats: Dict[str, Any]) -> bool:
        """Update the statistics section of the data"""
        data = self.load_data()
        data["stats"] = {**data.get("stats", {}), **stats}
        return self.save_data(data)
        
    def add_threat(self, threat: Dict[str, Any]) -> bool:
        """Add a new threat to the data"""
        data = self.load_data()
        
        # Ensure threat has a timestamp
        if "timestamp" not in threat:
            threat["timestamp"] = datetime.now().isoformat()
            
        # Add unique ID if not present
        if "id" not in threat:
            threat["id"] = f"threat-{len(data.get('threats', []))+1}"
            
        # Add the threat to the list
        threats = data.get("threats", [])
        threats.append(threat)
        data["threats"] = threats
        
        # Update total threats count
        stats = data.get("stats", {})
        stats["total_threats"] = stats.get("total_threats", 0) + 1
        if threat.get("status") == "blocked":
            stats["blocked_attacks"] = stats.get("blocked_attacks", 0) + 1
        data["stats"] = stats
        
        return self.save_data(data)
        
    def update_threat(self, threat_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing threat"""
        data = self.load_data()
        threats = data.get("threats", [])
        
        for i, threat in enumerate(threats):
            if threat.get("id") == threat_id:
                # If status changed from detected to blocked, update blocked count
                if threat.get("status") == "detected" and updates.get("status") == "blocked":
                    stats = data.get("stats", {})
                    stats["blocked_attacks"] = stats.get("blocked_attacks", 0) + 1
                    data["stats"] = stats
                
                # Update the threat
                threats[i] = {**threat, **updates}
                data["threats"] = threats
                return self.save_data(data)
                
        return False
        
    def add_firewall_rule(self, rule: Dict[str, Any]) -> bool:
        """Add a new firewall rule"""
        data = self.load_data()
        
        # Ensure rule has a timestamp
        if "timestamp" not in rule:
            rule["timestamp"] = datetime.now().isoformat()
            
        # Add unique ID if not present
        if "id" not in rule:
            rule["id"] = f"rule-{len(data.get('firewall_rules', []))+1}"
            
        # Add the rule to the list
        rules = data.get("firewall_rules", [])
        rules.append(rule)
        data["firewall_rules"] = rules
        
        return self.save_data(data)
        
    def remove_firewall_rule(self, rule_id_or_ip: str) -> bool:
        """Remove a firewall rule by ID or IP"""
        data = self.load_data()
        rules = data.get("firewall_rules", [])
        
        # Find the rule by ID or source IP
        for i, rule in enumerate(rules):
            if rule.get("id") == rule_id_or_ip or rule.get("source_ip") == rule_id_or_ip:
                rules.pop(i)
                data["firewall_rules"] = rules
                return self.save_data(data)
                
        return False
        
    def add_alert(self, alert: Dict[str, Any]) -> bool:
        """Add a new alert"""
        data = self.load_data()
        
        # Ensure alert has a timestamp
        if "timestamp" not in alert:
            alert["timestamp"] = datetime.now().isoformat()
            
        # Add unique ID if not present
        if "id" not in alert:
            alert["id"] = f"alert-{len(data.get('alerts', []))+1}"
            
        # Add the alert to the list
        alerts = data.get("alerts", [])
        alerts.append(alert)
        data["alerts"] = alerts
        
        return self.save_data(data)
        
    def update_system_health(self, health_data: Dict[str, Any]) -> bool:
        """Update system health metrics"""
        data = self.load_data()
        data["system_health"] = {**data.get("system_health", {}), **health_data}
        return self.save_data(data)
        
    def add_scan(self, scan: Dict[str, Any]) -> bool:
        """Add a new scan record"""
        data = self.load_data()
        
        # Ensure scan has a timestamp
        if "timestamp" not in scan:
            scan["timestamp"] = datetime.now().isoformat()
            
        # Add unique ID if not present
        if "id" not in scan:
            scan["id"] = f"scan-{len(data.get('scans', []))+1}"
            
        # Add the scan to the list
        scans = data.get("scans", [])
        scans.append(scan)
        data["scans"] = scans
        
        return self.save_data(data)
        
    def update_scan(self, scan_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing scan"""
        data = self.load_data()
        scans = data.get("scans", [])
        
        for i, scan in enumerate(scans):
            if scan.get("id") == scan_id:
                scans[i] = {**scan, **updates}
                data["scans"] = scans
                return self.save_data(data)
                
        return False

