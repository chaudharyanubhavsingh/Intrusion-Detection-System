from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
import asyncio
import logging
from datetime import datetime
from pydantic import BaseModel

from security_monitor import SecurityMonitor
from firewall_manager import FirewallManager
from data_manager import DataManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("cybersecurity-backend")

app = FastAPI(title="Cybersecurity Dashboard Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_manager = DataManager("data/security_data.json")
security_monitor = SecurityMonitor(data_manager)
firewall_manager = FirewallManager(data_manager, container_name="demo_firewall")

class FirewallRule(BaseModel):
    source_ip: str
    destination_ip: Optional[str] = None
    port: Optional[int] = None
    protocol: Optional[str] = None
    action: str
    reason: Optional[str] = None

class WebSocketManager:
    def __init__(self):
        self.clients: Dict[str, WebSocket] = {}
        self.max_clients = 10

    async def connect(self, websocket: WebSocket, client_id: str):
        if client_id in self.clients:
            await self.clients[client_id].close(code=1008, reason="Replaced by new connection")
            del self.clients[client_id]
        if len(self.clients) >= self.max_clients:
            await websocket.close(code=1013, reason="Too many clients")
            logger.warning(f"Rejected {client_id}: Max clients reached")
            return False
        await websocket.accept()
        self.clients[client_id] = websocket
        logger.info(f"Connected {client_id}. Total: {len(self.clients)}")
        return True

    async def disconnect(self, client_id: str):
        if client_id in self.clients:
            del self.clients[client_id]
            logger.info(f"Disconnected {client_id}. Remaining: {len(self.clients)}")

    async def broadcast(self, message: Dict[str, Any]):
        disconnected = []
        for client_id, ws in self.clients.items():
            try:
                await ws.send_json(message)
                logger.debug(f"Sent message to {client_id}: {message}")
            except Exception as e:
                logger.error(f"Failed to send to {client_id}: {str(e)}")
                disconnected.append(client_id)
        for client_id in disconnected:
            await self.disconnect(client_id)

    async def heartbeat(self):
        while True:
            await asyncio.sleep(5)
            if self.clients:
                await self.broadcast({"type": "heartbeat"})
                logger.debug("Heartbeat sent")

websocket_manager = WebSocketManager()

@app.on_event("startup")
async def startup_event():
    security_monitor.websocket_manager = websocket_manager
    logger.info("WebSocket manager linked to SecurityMonitor")
    asyncio.create_task(security_monitor.start_live_monitoring())
    asyncio.create_task(websocket_manager.heartbeat())

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    if not await websocket_manager.connect(websocket, client_id):
        return
    try:
        initial_data = {
            "type": "initial_data",
            "data": {
                "stats": security_monitor.get_current_stats(),
                "threats": security_monitor.get_recent_threats(),
                "firewall_rules": firewall_manager.get_rules()
            }
        }
        await websocket.send_json(initial_data)
        logger.info(f"Initial data sent to {client_id}")

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
                if data.get("type") == "pong":
                    continue
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                raise
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {client_id}")
    except Exception as e:
        logger.error(f"Error with {client_id}: {str(e)}")
    finally:
        await websocket_manager.disconnect(client_id)

@app.get("/")
async def root():
    return {"message": "Cybersecurity Dashboard API is running"}

@app.get("/stats")
async def get_stats():
    return security_monitor.get_current_stats()

@app.get("/firewall/rules")
async def get_firewall_rules():
    return firewall_manager.get_rules()

@app.post("/firewall/rules")
async def add_firewall_rule(rule: FirewallRule):
    success = firewall_manager.add_rule(rule.model_dump())
    if success:
        data = data_manager.load_data()
        stats = {
            "total_threats": len(data.get("threats", [])) + len(firewall_manager.get_rules()),
            "blocked_attacks": len(firewall_manager.get_rules()),
            "network_traffic": security_monitor.get_current_stats()["network_traffic"],
            "active_users": security_monitor.get_current_stats()["active_users"]
        }
        data_manager.update_stats(stats)
        await websocket_manager.broadcast({
            "type": "firewall_update",
            "data": {
                "action": rule.action,
                "ip": rule.source_ip,
                "destination_ip": rule.destination_ip,
                "reason": rule.reason,
                "stats": stats
            }
        })
        return {"success": True, "message": "Rule added successfully"}
    raise HTTPException(status_code=400, detail="Failed to add firewall rule")

@app.delete("/firewall/rules/{ip}")
async def delete_firewall_rule(ip: str):
    data = data_manager.load_data()
    threats = data.get("threats", [])
    firewall_rules = data.get("firewall_rules", [])
    rule_to_remove = next((r for r in firewall_rules if r["source_ip"] == ip), None)
    
    success = firewall_manager.remove_rule(ip)
    if success:
        data = data_manager.load_data()
        stats = {
            "total_threats": len(data.get("threats", [])) + len(firewall_manager.get_rules()),
            "blocked_attacks": len(firewall_manager.get_rules()),
            "network_traffic": security_monitor.get_current_stats()["network_traffic"],
            "active_users": security_monitor.get_current_stats()["active_users"]
        }
        data_manager.update_stats(stats)
        
        threat_to_update = next((t for t in threats if t["source"] == ip), None)
        if threat_to_update:
            threat_to_update["status"] = "detected"
        
        await websocket_manager.broadcast({
            "type": "firewall_update",
            "data": {
                "action": "unblock",
                "ip": ip,
                "destination_ip": rule_to_remove["destination_ip"] if rule_to_remove else None,
                "stats": stats,
                "threat": threat_to_update
            }
        })
        return {"success": True, "message": f"Rule for IP {ip} deleted"}
    raise HTTPException(status_code=404, detail=f"Rule for IP {ip} not found")

@app.get("/api/threats/recent")
async def get_recent_threats():
    threats = security_monitor.get_recent_threats(limit=10)
    logger.info("Returning recent threats via API")
    return threats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)