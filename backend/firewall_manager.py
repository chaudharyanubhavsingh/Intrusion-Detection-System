import logging
import subprocess
import platform
import random
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("firewall-manager")

class FirewallManager:
    """Manages firewall rules within a Docker container"""
    
    def __init__(self, data_manager, container_name: str = "demo_firewall"):
        self.data_manager = data_manager
        self.container_name = container_name
        self._check_container_status()

    def _check_container_status(self) -> None:
        """Check if the Docker container is running"""
        try:
            result = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Running}}", self.container_name],
                capture_output=True,
                text=True,
                check=True
            )
            if result.stdout.strip() != "true":
                logger.error(f"Container '{self.container_name}' is not running.")
                raise RuntimeError(f"Container '{self.container_name}' is not running.")
            logger.info(f"Container '{self.container_name}' is running.")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to check container status: {str(e)}")
            raise RuntimeError(f"Cannot access container '{self.container_name}': {str(e)}")

    def _execute_iptables_command(self, command: List[str]) -> bool:
        """Execute an iptables command inside the Docker container"""
        docker_cmd = ["docker", "exec", self.container_name, "iptables"] + command
        try:
            subprocess.run(docker_cmd, check=True, capture_output=True, text=True)
            logger.info(f"Executed iptables command: {' '.join(docker_cmd)}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to execute iptables command: {str(e)}")
            return False

    def _rule_exists(self, source_ip: str, action: str) -> bool:
        """Check if a rule with the given source IP and action already exists in iptables"""
        try:
            result = subprocess.run(
                ["docker", "exec", self.container_name, "iptables", "-L", "INPUT", "-n", "--line-numbers"],
                capture_output=True,
                text=True,
                check=True
            )
            target = "ACCEPT" if action in ("allow", "accept") else "DROP"
            for line in result.stdout.splitlines():
                if source_ip in line and target in line and not line.startswith("Chain") and not line.startswith("num"):
                    return True
            return False
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to check existing rules: {str(e)}")
            return False

    def _remove_conflicting_rule(self, source_ip: str, conflicting_action: str) -> bool:
        """Remove a conflicting rule for the same source IP"""
        conflicting_target = "ACCEPT" if conflicting_action in ("allow", "accept") else "DROP"
        iptables_cmd = ["-D", "INPUT", "-s", source_ip, "-j", conflicting_target]
        return self._execute_iptables_command(iptables_cmd)

    def get_rules(self) -> List[Dict[str, Any]]:
        """Get current firewall rules from the data store"""
        data = self.data_manager.load_data()
        return data.get("firewall_rules", [])

    def add_rule(self, rule: Dict[str, Any]) -> bool:
        """Add a new firewall rule to the Docker container, avoiding conflicts"""
        # Validate the rule
        if "source_ip" not in rule or "action" not in rule:
            logger.error("Invalid firewall rule: missing required fields")
            return False

        # Add timestamp and ID if not present
        if "timestamp" not in rule:
            rule["timestamp"] = datetime.now().isoformat()
        if "id" not in rule:
            rule["id"] = f"rule-{random.randint(1000, 9999)}"

        # Normalize action
        action = rule["action"].lower()
        if action in ("block", "drop"):
            iptables_cmd = ["-A", "INPUT", "-s", rule["source_ip"], "-j", "DROP"]
            normalized_action = "block"
            conflicting_action = "allow"
        elif action in ("allow", "accept"):
            iptables_cmd = ["-A", "INPUT", "-s", rule["source_ip"], "-j", "ACCEPT"]
            normalized_action = "allow"
            conflicting_action = "block"
        else:
            logger.error(f"Unsupported action: {rule['action']}")
            return False

        # Check for conflicting rule and remove it if it exists
        if self._rule_exists(rule["source_ip"], conflicting_action):
            logger.info(f"Removing conflicting {conflicting_action} rule for {rule['source_ip']}")
            if not self._remove_conflicting_rule(rule["source_ip"], conflicting_action):
                logger.error(f"Failed to remove conflicting rule for {rule['source_ip']}")
                return False
            # Also remove from data store
            self.data_manager.remove_firewall_rule(rule["source_ip"])

        # Avoid duplicate rule
        if self._rule_exists(rule["source_ip"], normalized_action):
            logger.info(f"Rule already exists: {normalized_action} for {rule['source_ip']}")
            return True  # Rule already applied, no need to add again

        # Execute the iptables command in the container
        iptables_success = self._execute_iptables_command(iptables_cmd)
        if not iptables_success:
            logger.error(f"Failed to apply rule to iptables: {rule}")
            return False

        # Update rule with normalized action
        rule["action"] = normalized_action

        # Add to data store
        data_success = self.data_manager.add_firewall_rule(rule)
        if not data_success:
            logger.error(f"Failed to save rule to data store: {rule}")
            # Optionally rollback iptables change here if desired
            return False

        if normalized_action == "block":
            self._update_threat_status(rule["source_ip"], "blocked")

        logger.info(f"Successfully added rule: {rule}")
        return True

    def remove_rule(self, rule_id_or_ip: str) -> bool:
        """Remove a firewall rule by ID or IP from the Docker container"""
        data = self.data_manager.load_data()
        rules = data.get("firewall_rules", [])
        
        for rule in rules:
            if rule.get("id") == rule_id_or_ip or rule.get("source_ip") == rule_id_or_ip:
                source_ip = rule["source_ip"]
                action = rule["action"].lower()
                target = "DROP" if action in ("block", "drop") else "ACCEPT"
                iptables_cmd = ["-D", "INPUT", "-s", source_ip, "-j", target]
                success = self._execute_iptables_command(iptables_cmd)
                if success:
                    logger.info(f"Removed firewall rule for: {rule_id_or_ip}")
                    return self.data_manager.remove_firewall_rule(rule_id_or_ip)
                return False
        
        logger.warning(f"No rule found for ID or IP: {rule_id_or_ip}")
        return False

    def _update_threat_status(self, ip: str, status: str) -> None:
        """Update the status of threats from a specific IP"""
        data = self.data_manager.load_data()
        threats = data.get("threats", [])
        
        for threat in threats:
            if threat.get("source") == ip and threat.get("status") != status:
                self.data_manager.update_threat(threat["id"], {"status": status})

    def apply_rules(self) -> bool:
        """Apply all stored rules to the Docker container firewall"""
        # Clear existing rules
        self._execute_iptables_command(["-F", "INPUT"])
        
        # Re-apply all rules from the data store
        rules = self.get_rules()
        for rule in rules:
            action = rule["action"].lower()
            if action in ("block", "drop"):
                iptables_cmd = ["-A", "INPUT", "-s", rule["source_ip"], "-j", "DROP"]
            elif action in ("allow", "accept"):
                iptables_cmd = ["-A", "INPUT", "-s", rule["source_ip"], "-j", "ACCEPT"]
            else:
                continue
            self._execute_iptables_command(iptables_cmd)
        
        logger.info(f"Applied {len(rules)} firewall rules to container")
        return True

    def get_firewall_status(self) -> Dict[str, Any]:
        """Get the current status of the firewall in the Docker container"""
        try:
            result = subprocess.run(
                ["docker", "exec", self.container_name, "iptables", "-L", "INPUT", "-n", "--line-numbers"],
                capture_output=True,
                text=True,
                check=True
            )
            rule_count = len([line for line in result.stdout.splitlines() if line.strip() and not line.startswith("Chain") and not line.startswith("num")])
            return {
                "active": True,
                "mode": "automatic",
                "last_updated": datetime.now().isoformat(),
                "rule_count": rule_count
            }
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to get firewall status: {str(e)}")
            return {"active": False, "error": str(e)}