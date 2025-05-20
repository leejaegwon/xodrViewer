import asyncio
import json
import logging
import math

class TCPServer:
    """
    TCP/IP Server for receiving vehicle data
    """
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.server = None
        self.data_callback = None
        self.is_running = False
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Mock vehicle data for simulation when no real data is available
        self.mock_mode = True
        self.mock_position = {"x": 0, "y": 0, "z": 0, "heading": 0, "speed": 0}
        self.mock_task = None

    def set_data_callback(self, callback):
        """
        Set a callback function to be called when vehicle data is received
        """
        self.data_callback = callback

    async def handle_client(self, reader, writer):
        """
        Handle a client connection
        """
        addr = writer.get_extra_info('peername')
        self.logger.info(f"Client connected: {addr}")
        
        # Disable mock mode when a real client connects
        self.mock_mode = False
        if self.mock_task:
            self.mock_task.cancel()
            self.mock_task = None
            
        try:
            while self.is_running:
                # Read data from TCP client (vehicle data)
                data = await reader.read(1024)
                if not data:
                    break
                
                # Try to parse as JSON
                try:
                    vehicle_data = json.loads(data.decode())
                    self.logger.info(f"Received vehicle data: {vehicle_data}")
                    
                    # Call the callback with the received data
                    if self.data_callback:
                        await self.data_callback(vehicle_data)
                except json.JSONDecodeError:
                    self.logger.error("Received invalid JSON data")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.logger.error(f"Error handling client: {e}")
        finally:
            writer.close()
            await writer.wait_closed()
            self.logger.info(f"Client disconnected: {addr}")
            
            # Re-enable mock mode when all clients disconnect
            self.mock_mode = True
            if self.is_running:
                self.mock_task = asyncio.create_task(self.generate_mock_data())

    async def generate_mock_data(self):
        """
        Generate mock vehicle data for simulation
        """
        try:
            while self.is_running and self.mock_mode:
                # Simulate vehicle movement along a circular path
                radius = 20.0  # meters
                angular_speed = 0.02  # radians per update
                
                # Update angle
                self.mock_position["heading"] += angular_speed * 180 / 3.14159  # Convert to degrees
                if self.mock_position["heading"] > 360:
                    self.mock_position["heading"] -= 360
                
                # Calculate new position
                angle_rad = self.mock_position["heading"] * 3.14159 / 180
                self.mock_position["x"] = radius * math.cos(angle_rad)
                self.mock_position["y"] = radius * math.sin(angle_rad)
                self.mock_position["z"] = 0.0
                
                # Set constant speed
                self.mock_position["speed"] = 5.0  # meters per second
                
                # Create vehicle data with ID and ego flag
                vehicle_data = {
                    "id": "ego_vehicle",
                    "isEgo": True,
                    "x": self.mock_position["x"],
                    "y": self.mock_position["y"],
                    "z": self.mock_position["z"],
                    "heading": self.mock_position["heading"],
                    "speed": self.mock_position["speed"]
                }
                
                # Send mock data via callback
                if self.data_callback:
                    await self.data_callback(vehicle_data)
                
                # Wait before sending next update
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.logger.error(f"Error generating mock data: {e}")

    async def start(self):
        """
        Start the TCP server
        """
        self.is_running = True
        self.server = await asyncio.start_server(
            self.handle_client, self.host, self.port
        )
        
        # Start mock data generator
        self.mock_task = asyncio.create_task(self.generate_mock_data())
        
        self.logger.info(f"TCP Server started on {self.host}:{self.port}")
        
        async with self.server:
            await self.server.serve_forever()

    async def stop(self):
        """
        Stop the TCP server
        """
        self.is_running = False
        
        if self.mock_task:
            self.mock_task.cancel()
            self.mock_task = None
            
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.logger.info("TCP Server stopped")