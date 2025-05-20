import asyncio
import uvicorn
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request
import os
from app.tcp_server import TCPServer

# Initialize FastAPI app
app = FastAPI(title="OpenDRIVE Visualization")
# change this
# Setup static files and templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Create connection manager for WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Connection might have been closed
                pass

# Initialize connection manager
manager = ConnectionManager()

# Initialize TCP Server
tcp_server = TCPServer("0.0.0.0", 5000)  # Listen on all interfaces, port 5000

# Register a callback to forward vehicle data to WebSocket clients
async def forward_vehicle_data(data):
    await manager.broadcast(json.dumps(data))

tcp_server.set_data_callback(forward_vehicle_data)

# Define routes
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """
    Serve the main page with the OpenDRIVE visualization
    """
    # index_claude.html is the new page with the OpenDRIVE visualization
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time vehicle data updates
    """
    await manager.connect(websocket)
    try:
        # Keep connection open
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.on_event("startup")
async def startup_event():
    """
    Start the TCP server when the FastAPI app starts
    """
    asyncio.create_task(tcp_server.start())

@app.on_event("shutdown")
async def shutdown_event():
    """
    Stop the TCP server when the FastAPI app stops
    """
    await tcp_server.stop()

# Run the application
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)