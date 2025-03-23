import logging
import subprocess
import random
import time  # Added import for time.sleep
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("firewall-manager")

class FirewallManager:
    def __init__(self, data_manager, container_name: str = "demo_firewall"):
        self.data_manager = data_manager
        self.container_name = container_name
        self._check_container_status()

    def _check_container_status(self) -> None:
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

    def _execute_iptables_command(self, command: List[str], retries=3) -> bool:
        docker_cmd = ["docker", "exec", self.container_name, "iptables"] + command
        for attempt in range(retries):
            try:
                result = subprocess.run(docker_cmd, check=True, capture_output=True, text=True)
                logger.info(f"Executed iptables command: {' '.join(docker_cmd)}")
                return True
            except subprocess.CalledProcessError as e:
                logger.error(f"Attempt {attempt + 1} failed: {str(e)} - {e.stderr}")
                if "Bad rule" in e.stderr or "does a matching rule exist" in e.stderr:
                    # Rule doesn’t exist, treat as success for deletion
                    if "-D" in command:
                        logger.info(f"No rule to delete in iptables for {command}, treating as success")
                        return True
                if attempt + 1 == retries:
                    return False
                time.sleep(1)  # Now works with time imported
        return False

    def _rule_exists(self, source_ip: str, action: str) -> bool:
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
        conflicting_target = "ACCEPT" if conflicting_action in ("allow", "accept") else "DROP"
        iptables_cmd = ["-D", "INPUT", "-s", source_ip, "-j", conflicting_target]
        return self._execute_iptables_command(iptables_cmd)

    def get_rules(self) -> List[Dict[str, Any]]:
        data = self.data_manager.load_data(update_stats=False)
        return data.get("firewall_rules", [])

    def add_rule(self, rule: Dict[str, Any]) -> bool:
        if "source_ip" not in rule or "action" not in rule:
            logger.error("Invalid firewall rule: missing required fields")
            return False

        if "timestamp" not in rule:
            rule["timestamp"] = datetime.now().isoformat()
        if "id" not in rule:
            rule["id"] = f"rule-{random.randint(1000, 9999)}"

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

        if self._rule_exists(rule["source_ip"], conflicting_action):
            logger.info(f"Removing conflicting {conflicting_action} rule for {rule['source_ip']}")
            if not self._remove_conflicting_rule(rule["source_ip"], conflicting_action):
                logger.error(f"Failed to remove conflicting rule for {rule['source_ip']}")
                return False
            self.data_manager.remove_firewall_rule(rule["source_ip"])

        if self._rule_exists(rule["source_ip"], normalized_action):
            logger.info(f"Rule already exists: {normalized_action} for {rule['source_ip']}")
            return True

        iptables_success = self._execute_iptables_command(iptables_cmd)
        if not iptables_success:
            logger.error(f"Failed to apply rule to iptables: {rule}")
            return False

        rule["action"] = normalized_action
        data_success = self.data_manager.add_firewall_rule(rule)
        if not data_success:
            logger.error(f"Failed to save rule to data store: {rule}")
            return False

        logger.info(f"Successfully added rule: {rule}")
        return True

    def remove_rule(self, rule_id_or_ip: str) -> bool:
        data = self.data_manager.load_data(update_stats=False)
        rules = data.get("firewall_rules", [])
        
        rule_to_remove = next((r for r in rules if r.get("id") == rule_id_or_ip or r.get("source_ip") == rule_id_or_ip), None)
        if not rule_to_remove:
            logger.warning(f"No rule found in data store for ID or IP: {rule_id_or_ip}")
            if self._rule_exists(rule_id_or_ip, "block"):
                iptables_cmd = ["-D", "INPUT", "-s", rule_id_or_ip, "-j", "DROP"]
                iptables_success = self._execute_iptables_command(iptables_cmd)
                if iptables_success:
                    logger.info(f"Removed orphaned iptables rule for IP: {rule_id_or_ip}")
                    return True
            # If no rule in data or iptables, treat as success (idempotent)
            logger.info(f"No rule to remove for {rule_id_or_ip}, treating as success")
            return True

        source_ip = rule_to_remove["source_ip"]
        action = rule_to_remove["action"].lower()
        target = "DROP" if action in ("block", "drop") else "ACCEPT"
        iptables_cmd = ["-D", "INPUT", "-s", source_ip, "-j", target]
        
        iptables_success = self._execute_iptables_command(iptables_cmd)
        if not iptables_success:
            logger.error(f"Failed to remove iptables rule for {source_ip}")
            return False

        data_success = self.data_manager.remove_firewall_rule(source_ip)
        if not data_success:
            logger.error(f"Failed to remove rule from data store for {source_ip}")
            return False

        logger.info(f"Successfully removed rule for: {source_ip}")
        return True

    def apply_rules(self) -> bool:
        self._execute_iptables_command(["-F", "INPUT"])
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