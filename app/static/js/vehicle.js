// vehicle.js - Vehicle visualization and movement

class VehicleModel {
    constructor(scene) {
        if (!scene) {
            throw new Error('Scene is required for VehicleModel');
        }
        
        console.log('Initializing VehicleModel...');
        this.scene = scene;
        
        // Vehicle mesh
        this.vehicleMesh = null;
        
        // Vehicle properties
        this.position = { x: 0, y: 0, z: 0 };
        this.heading = 0; // in degrees
        this.speed = 0;
        this.isEgo = false;
        
        // Vehicle dimensions
        this.length = 4.5; // meters
        this.width = 2.0; // meters
        this.height = 1.5; // meters
        
        // Create vehicle representation
        this.createVehicleModel();
        
        // Add helper visuals
        this.createHelpers();
        
        console.log('VehicleModel initialized successfully');
    }
    
    createVehicleModel() {
        try {
            // Create vehicle geometry
            const geometry = new THREE.BoxGeometry(this.length, this.height, this.width);
            
            // Create material with different colors for ego and other vehicles
            const material = new THREE.MeshPhongMaterial({
                color: this.isEgo ? 0xff0000 : 0x0000ff, // Red for ego, blue for others
                transparent: true,
                opacity: 0.8
            });
            
            this.vehicleMesh = new THREE.Mesh(geometry, material);
            this.vehicleMesh.castShadow = true;
            this.vehicleMesh.receiveShadow = true;
            
            // Add vehicle to scene
            this.scene.add(this.vehicleMesh);
            
            // Set initial position
            this.updatePosition(0, 0, 0, 0);
        } catch (error) {
            console.error('Error creating vehicle model:', error);
            throw error;
        }
    }

    setEgoVehicle(isEgo) {
        this.isEgo = isEgo;
        if (this.vehicleMesh) {
            this.vehicleMesh.material.color.setHex(isEgo ? 0xff0000 : 0x0000ff);
        }
    }

    updateSpeed(speed) {
        this.speed = speed;
    }

    dispose() {
        if (this.vehicleMesh) {
            this.scene.remove(this.vehicleMesh);
            this.vehicleMesh.geometry.dispose();
            this.vehicleMesh.material.dispose();
        }
        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.material.dispose();
        }
    }
    
    // Create a simple 3D model of a vehicle
    // createVehicleModel() {
    //     // Group to hold all vehicle parts
    //     this.vehicleMesh = new THREE.Group();
        
    //     // Vehicle body
    //     const bodyGeometry = new THREE.BoxGeometry(this.length, this.height, this.width);
    //     const bodyMaterial = new THREE.MeshStandardMaterial({
    //         color: 0x3366cc, // Blue
    //         roughness: 0.5,
    //         metalness: 0.7
    //     });
        
    //     const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    //     bodyMesh.castShadow = true;
    //     bodyMesh.position.y = this.height / 2 + 0.1; // Slightly above ground
    //     this.vehicleMesh.add(bodyMesh);
        
    //     // Vehicle windows (top part)
    //     const windowGeometry = new THREE.BoxGeometry(this.length * 0.6, this.height * 0.4, this.width * 0.8);
    //     const windowMaterial = new THREE.MeshStandardMaterial({
    //         color: 0x111111, // Dark gray
    //         roughness: 0.1,
    //         metalness: 0.9,
    //         transparent: true,
    //         opacity: 0.7
    //     });
        
    //     const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
    //     windowMesh.position.y = this.height * 0.7;
    //     windowMesh.position.z = 0;
    //     windowMesh.position.x = -this.length * 0.1; // Slightly towards the back
    //     this.vehicleMesh.add(windowMesh);
        
    //     // Wheels
    //     this.createWheels();
        
    //     // Add direction indicator (arrow)
    //     this.createDirectionIndicator();
        
    //     // Add vehicle to scene
    //     this.scene.add(this.vehicleMesh);
    // }
    
    // Create wheels for the vehicle
    createWheels() {
        const wheelRadius = 0.35;
        const wheelThickness = 0.2;
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111, // Black
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Rotate wheel geometry to align with vehicle
        wheelGeometry.rotateZ(Math.PI / 2);
        
        // Position of wheels relative to vehicle center
        const wheelPositions = [
            { x: this.length / 3, y: wheelRadius, z: this.width / 2 + wheelThickness / 2 }, // Front right
            { x: this.length / 3, y: wheelRadius, z: -(this.width / 2 + wheelThickness / 2) }, // Front left
            { x: -this.length / 3, y: wheelRadius, z: this.width / 2 + wheelThickness / 2 }, // Rear right
            { x: -this.length / 3, y: wheelRadius, z: -(this.width / 2 + wheelThickness / 2) } // Rear left
        ];
        
        // Create wheels and add to vehicle
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            this.vehicleMesh.add(wheel);
        });
    }
    
    // Create a direction indicator (arrow) to show vehicle heading
    createDirectionIndicator() {
        // Create an arrow pointing in the forward direction
        const arrowLength = this.length / 2;
        const arrowHeadLength = arrowLength * 0.3;
        const arrowHeadWidth = arrowLength * 0.2;
        
        const direction = new THREE.Vector3(1, 0, 0); // Forward direction (X-axis)
        const origin = new THREE.Vector3(0, this.height * 0.7, 0); // Above the car
        
        const arrowHelper = new THREE.ArrowHelper(
            direction, 
            origin,
            arrowLength,
            0xff0000, // Red color
            arrowHeadLength,
            arrowHeadWidth
        );
        
        this.vehicleMesh.add(arrowHelper);
    }
    
    // Create helpers for visualization (path trajectory, etc.)
    createHelpers() {
        // Path trajectory visualization
        const trajectoryGeometry = new THREE.BufferGeometry();
        const trajectoryMaterial = new THREE.LineBasicMaterial({
            color: 0xff8800, // Orange
            linewidth: 2
        });
        
        // Start with a single point (current position)
        const trajectoryPoints = [
            new THREE.Vector3(0, 0.1, 0) // Slightly above ground
        ];
        
        trajectoryGeometry.setFromPoints(trajectoryPoints);
        
        this.trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
        this.scene.add(this.trajectoryLine);
        
        // Trajectory points array for updating
        this.trajectoryPoints = trajectoryPoints;
        this.maxTrajectoryPoints = 100; // Maximum number of points to store
    }
    
    // Update vehicle position based on received data
    updatePosition(x, y, z = 0, heading) {
        // Store previous position
        const prevX = this.position.x;
        const prevY = this.position.y;
        const prevZ = this.position.z;
        
        // Update position
        this.position = { x, y, z };
        this.heading = heading;
        
        // Apply position to mesh
        this.vehicleMesh.position.set(x, z, -y); // Note: Y and Z are swapped due to coordinate system
        
        // Apply rotation to mesh (convert heading to radians)
        // Note: In OpenDRIVE, heading is measured counter-clockwise from X-axis
        // In Three.js, we rotate around Y-axis (up) in the opposite direction
        const headingRad = -heading * (Math.PI / 180);
        this.vehicleMesh.rotation.y = headingRad;
        
        // Update trajectory
        this.updateTrajectory(x, y, z);
    }
    
    // Update the trajectory visualization
    updateTrajectory(x, y, z) {
        // Add new point to trajectory
        this.trajectoryPoints.push(new THREE.Vector3(x, z + 0.1, -y));
        
        // Limit the number of points
        if (this.trajectoryPoints.length > this.maxTrajectoryPoints) {
            this.trajectoryPoints.shift(); // Remove oldest point
        }
        
        // Update trajectory line geometry
        const geometry = new THREE.BufferGeometry().setFromPoints(this.trajectoryPoints);
        this.trajectoryLine.geometry.dispose();
        this.trajectoryLine.geometry = geometry;
    }
    
    // Set vehicle visibility
    setVisible(visible) {
        this.vehicleMesh.visible = visible;
        this.trajectoryLine.visible = visible;
    }

    // Update method called every frame
    update() {
        // Add any per-frame updates here
        // For example, you could add smooth interpolation of position/rotation
        // or update any dynamic effects
    }
}