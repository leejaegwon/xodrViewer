// main.js - Main application logic for OpenDRIVE visualization

// Global variables
let scene, camera, renderer, controls;
let openDriveRenderer;
let vehicleManager;
let websocket;
let isVehicleVisible = true;
let isReferenceLinesVisible = true;

// Initialize the application
function init() {
    try {
        console.log('Initializing application...');
        
        // Initialize Three.js scene
        initThreeJS();
        
        // Initialize OpenDRIVE rendering
        openDriveRenderer = new OpenDriveRenderer(scene);
        
        // Initialize vehicle manager
        vehicleManager = new VehicleManager(scene);
        
        // Set up WebSocket connection for vehicle data
        initWebSocket();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial OpenDRIVE file
        loadOpenDriveFile('sample.xodr');
        
        // Start rendering loop
        animate();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Initialize Three.js scene, camera, renderer, and controls
function initThreeJS() {
    try {
        console.log('Initializing Three.js...');
        
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Sky blue background
        
        // Create camera
        camera = new THREE.PerspectiveCamera(
            75, // Field of view
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
        camera.position.set(0, 50, 50); // Position the camera higher and further back
        camera.lookAt(0, 0, 0);
        
        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const container = document.getElementById('visualization-container');
        if (!container) {
            throw new Error('Visualization container not found');
        }
        container.appendChild(renderer.domElement);
        
        // Create orbit controls for camera manipulation
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 10;
        controls.maxDistance = 200;
        controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground
        
        // Add lighting
        addLights();
        
        // Add ground plane
        addGroundPlane();
        
        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);
        
        console.log('Three.js initialized successfully');
    } catch (error) {
        console.error('Error initializing Three.js:', error);
        throw error;
    }
}

// Add lights to the scene
function addLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    
    // Add directional light to scene
    scene.add(directionalLight);
}

// Add a ground plane to the scene
function addGroundPlane() {
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a472a, // Dark green
        roughness: 0.8,
        metalness: 0.2
    });
    
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    groundMesh.receiveShadow = true;
    groundMesh.position.y = -0.1; // Slightly below the road surface
    
    scene.add(groundMesh);
}

// Initialize WebSocket connection
function initWebSocket() {
    // Get the correct WebSocket URL based on the current page
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = function(event) {
        console.log('WebSocket connection established');
    };
    
    websocket.onmessage = function(event) {
        // Parse vehicle data
        const vehicleData = JSON.parse(event.data);
        
        // Update vehicle in the manager
        vehicleManager.updateVehicle(vehicleData);
        
        // Update UI display if it's the ego vehicle
        if (vehicleData.isEgo) {
            updateVehicleInfoDisplay(vehicleData);
        }
    };
    
    websocket.onclose = function(event) {
        console.log('WebSocket connection closed');
        // Try to reconnect after a delay
        setTimeout(initWebSocket, 2000);
    };
    
    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

// Update vehicle information display in UI
function updateVehicleInfoDisplay(data) {
    document.getElementById('pos-x').textContent = data.x.toFixed(2);
    document.getElementById('pos-y').textContent = data.y.toFixed(2);
    document.getElementById('pos-z').textContent = (data.z || 0).toFixed(2);
    document.getElementById('heading').textContent = data.heading.toFixed(2);
    document.getElementById('speed').textContent = (data.speed || 0).toFixed(2);
}

// Load OpenDRIVE file
function loadOpenDriveFile(filename) {
    fetch(`/static/xodr/${filename}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(xmlData => {
            // Parse and render OpenDRIVE data
            openDriveRenderer.loadFromXML(xmlData);
        })
        .catch(error => {
            console.error('Error loading OpenDRIVE file:', error);
            alert(`Failed to load OpenDRIVE file: ${error.message}`);
        });
}

// Set up event listeners
function setupEventListeners() {
    // Toggle reference lines
    document.getElementById('toggleReferenceLines').addEventListener('click', () => {
        isReferenceLinesVisible = !isReferenceLinesVisible;
        openDriveRenderer.setReferenceLinesVisible(isReferenceLinesVisible);
    });
    
    // Toggle vehicle visibility
    document.getElementById('toggleVehicle').addEventListener('click', () => {
        isVehicleVisible = !isVehicleVisible;
        vehicleManager.setVisible(isVehicleVisible);
    });
    
    // OpenDRIVE file selector
    document.getElementById('xodrSelector').addEventListener('change', (e) => {
        loadOpenDriveFile(e.target.value);
    });
}

// Handle window resize
function onWindowResize() {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update all vehicles
    if (vehicleManager) {
        vehicleManager.update();
    }
    
    // Update controls
    controls.update();
    
    // Render the scene
    renderer.render(scene, camera);
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting initialization...');
    init();
});