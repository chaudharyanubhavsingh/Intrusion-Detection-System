from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import json
import asyncio
import os
import logging
from datetime import datetime
from pydantic import BaseModel

from security_monitor import SecurityMonitor
from firewall_manager import FirewallManager
from data_manager import DataManager

# Configure logging with INFO level (DEBUG was too verbose)
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

os.makedirs("data", exist_ok=True)

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

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        logger.info(f"Broadcasting message: {message}")
        disconnected_websockets = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                logger.info(f"Message sent to {connection.client}")
            except Exception as e:
                logger.error(f"Error sending message to {connection.client}: {str(e)}")
                disconnected_websockets.append(connection)
        
        for ws in disconnected_websockets:
            self.disconnect(ws)

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    security_monitor.websocket_manager = manager
    logger.info("WebSocket manager linked to SecurityMonitor")
    asyncio.create_task(security_monitor.start_live_monitoring())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        logger.info(f"WebSocket connection accepted from {websocket.client.host}:{websocket.client.port}")
        initial_data = {
            "type": "initial_data",
            "data": {
                "stats": security_monitor.get_current_stats(),
                "threats": security_monitor.get_recent_threats(),
                "firewall_rules": firewall_manager.get_rules()
            }
        }
        await websocket.send_json(initial_data)
        logger.info(f"Initial data sent to {websocket.client.host}:{websocket.client.port}")
        
        while True:
            try:
                await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                logger.info(f"Sent ping to {websocket.client.host}:{websocket.client.port}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected from {websocket.client.host}:{websocket.client.port}")
    except Exception as e:
        logger.error(f"WebSocket error with {websocket.client.host}:{websocket.client.port}: {str(e)}")
        manager.disconnect(websocket)

# REST API Endpoints
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
        await manager.broadcast({
            "type": "firewall_update",
            "data": {"action": rule.action, "ip": rule.source_ip, "reason": rule.reason}
        })
        return {"success": True, "message": "Rule added successfully"}
    raise HTTPException(status_code=400, detail="Failed to add firewall rule")

@app.delete("/firewall/rules/{ip}")
async def delete_firewall_rule(ip: str):
    success = firewall_manager.remove_rule(ip)
    if success:
        await manager.broadcast({
            "type": "firewall_update",
            "data": {"action": "unblock", "ip": ip}
        })
        return {"success": True, "message": f"Rule for IP {ip} deleted"}
    raise HTTPException(status_code=404, detail="Rule not found")

@app.get("/api/threats/recent")
async def get_recent_threats():
    threats = security_monitor.get_recent_threats(limit=10)
    logger.info("Returning recent threats via API")
    return threats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)