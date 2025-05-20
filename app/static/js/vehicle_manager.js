// VehicleManager class to handle multiple vehicles
class VehicleManager {
    constructor(scene) {
        this.scene = scene;
        this.vehicles = new Map(); // Map of vehicle ID to VehicleModel
        this.egoVehicle = null; // Reference to the ego vehicle
    }

    // Create or update a vehicle
    updateVehicle(vehicleData) {
        const { id, isEgo, x, y, z, heading, speed } = vehicleData;
        
        // Create new vehicle if it doesn't exist
        if (!this.vehicles.has(id)) {
            const vehicle = new VehicleModel(this.scene);
            this.vehicles.set(id, vehicle);
            
            // Set as ego vehicle if specified
            if (isEgo) {
                this.egoVehicle = vehicle;
                vehicle.setEgoVehicle(true);
            }
        }

        // Update vehicle position and properties
        const vehicle = this.vehicles.get(id);
        vehicle.updatePosition(x, y, z, heading);
        vehicle.updateSpeed(speed);
    }

    // Remove a vehicle
    removeVehicle(id) {
        if (this.vehicles.has(id)) {
            const vehicle = this.vehicles.get(id);
            vehicle.dispose();
            this.vehicles.delete(id);
            
            if (this.egoVehicle === vehicle) {
                this.egoVehicle = null;
            }
        }
    }

    // Update all vehicles
    update() {
        for (const vehicle of this.vehicles.values()) {
            vehicle.update();
        }
    }

    // Set visibility for all vehicles
    setVisible(visible) {
        for (const vehicle of this.vehicles.values()) {
            vehicle.setVisible(visible);
        }
    }
} 