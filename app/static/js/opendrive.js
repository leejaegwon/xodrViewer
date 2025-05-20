// opendrive.js - OpenDRIVE parser and renderer

class OpenDriveRenderer {
    constructor(scene) {
        if (!scene) {
            throw new Error('Scene is required for OpenDriveRenderer');
        }
        
        console.log('Initializing OpenDriveRenderer...');
        this.scene = scene;
        
        // Create groups for different elements
        this.group = {
            road: new THREE.Group(),
            referenceLine: new THREE.Group(),
            signal: new THREE.Group()
        };
        
        // Add groups to scene
        this.scene.add(this.group.road);
        this.scene.add(this.group.referenceLine);
        this.scene.add(this.group.signal);
        
        // Material definitions
        this.roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,  // Dark gray
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        
        this.roadMarkMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,  // White
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        this.referenceLineMaterial = new THREE.LineBasicMaterial({
            color: 0x0000ff,  // Blue
            linewidth: 2
        });
        
        // Check if XMLParser is available
        if (typeof XMLParser === 'undefined') {
            throw new Error('XMLParser is not loaded. Please include fast-xml-parser.min.js');
        }
        
        // XmlParser instance (using fast-xml-parser)
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            allowBooleanAttributes: true
        });
        
        console.log('OpenDriveRenderer initialized successfully');
    }
    
    // Load OpenDRIVE data from XML string
    loadFromXML(xmlData) {
        // Clear existing road meshes
        this.clearScene();
        
        try {
            // Parse XML data to JSON
            const jsonObj = this.parser.parse(xmlData);
            
            // Process the OpenDRIVE data
            this.processOpenDriveData(jsonObj);
        } catch (error) {
            console.error('Error parsing OpenDRIVE XML:', error);
            throw error;
        }
    }
    
    // Process the parsed OpenDRIVE data
    processOpenDriveData(data) {
        // Check if the data has the expected structure
        if (!data.OpenDRIVE) {
            console.error('Invalid OpenDRIVE format: Missing OpenDRIVE root element');
            return;
        }
        
        const openDrive = data.OpenDRIVE;
        
        // Process roads
        if (openDrive.road && Array.isArray(openDrive.road)) {
            openDrive.road.forEach(road => this.processRoad(road));
        } else if (openDrive.road) {
            // Handle case when there's only one road
            this.processRoad(openDrive.road);
        }
        
        // Process junctions if they exist
        if (openDrive.junction) {
            if (Array.isArray(openDrive.junction)) {
                openDrive.junction.forEach(junction => this.processJunction(junction));
            } else {
                this.processJunction(openDrive.junction);
            }
        }
    }
    
    // Process a road from OpenDRIVE data
    processRoad(road) {
        // Extract road ID and length
        const roadId = road['@_id'] || road.id || 'unknown';
        const roadLength = parseFloat(road['@_length'] || road.length || 0);
        
        console.log(`Processing road: ${roadId}, length: ${roadLength}`);
        
        // Process plan view (reference line)
        this.processRoadPlanView(road, roadId);
        
        // Process lanes
        this.processRoadLanes(road, roadId);
        
        // Process road objects like signs, signals, etc.
        this.processRoadObjects(road, roadId);
    }
    
    // Process the plan view of a road (reference line)
    processRoadPlanView(road, roadId) {
        if (!road.planView) return;
        
        const planView = road.planView;
        const geometries = planView.geometry ? 
            (Array.isArray(planView.geometry) ? planView.geometry : [planView.geometry]) : [];
        
        // For reference line visualization
        const referenceLinePoints = [];
        
        // Process each geometry element
        geometries.forEach(geometry => {
            const s = parseFloat(geometry['@_s'] || geometry.s || 0);
            const x = parseFloat(geometry['@_x'] || geometry.x || 0);
            const y = parseFloat(geometry['@_y'] || geometry.y || 0);
            const hdg = parseFloat(geometry['@_hdg'] || geometry.hdg || 0);
            const length = parseFloat(geometry['@_length'] || geometry.length || 0);
            
            // Add start point to reference line
            referenceLinePoints.push(new THREE.Vector3(x, 0, -y));
            
            // Handle different geometry types
            if (geometry.line) {
                // Straight line section
                this.processStraightLine(s, x, y, hdg, length, referenceLinePoints);
            } else if (geometry.arc) {
                // Arc section
                const curvature = parseFloat(geometry.arc['@_curvature'] || geometry.arc.curvature || 0);
                this.processArc(s, x, y, hdg, length, curvature, referenceLinePoints);
            } else if (geometry.spiral) {
                // Spiral section - approximate with line segments
                const curvStart = parseFloat(geometry.spiral['@_curvStart'] || geometry.spiral.curvStart || 0);
                const curvEnd = parseFloat(geometry.spiral['@_curvEnd'] || geometry.spiral.curvEnd || 0);
                this.processSpiral(s, x, y, hdg, length, curvStart, curvEnd, referenceLinePoints);
            } else {
                console.warn(`Unsupported geometry type in road ${roadId}`);
            }
        });
        
        // Create and add the reference line to the scene
        if (referenceLinePoints.length > 1) {
            const geometry = new THREE.BufferGeometry().setFromPoints(referenceLinePoints);
            const line = new THREE.Line(geometry, this.referenceLineMaterial);
            line.userData.type = 'referenceLine';
            line.userData.roadId = roadId;
            
            this.group.referenceLine.add(line);
        }
    }
    
    // Process a straight line section of the road
    processStraightLine(s, x, y, hdg, length, points) {
        const segments = Math.max(1, Math.ceil(length / 5)); // One point every 5 meters
        const dx = Math.cos(hdg);
        const dy = Math.sin(hdg);
        
        for (let i = 1; i <= segments; i++) {
            const ratio = i / segments;
            const segmentLength = length * ratio;
            const newX = x + dx * segmentLength;
            const newY = y + dy * segmentLength;
            
            // Add point to reference line (note the negation of Y for THREE.js coordinate system)
            points.push(new THREE.Vector3(newX, 0, -newY));
        }
    }
    
    // Process an arc section of the road
    processArc(s, x, y, hdg, length, curvature, points) {
        if (Math.abs(curvature) < 1e-10) {
            // If curvature is close to zero, treat as straight line
            this.processStraightLine(s, x, y, hdg, length, points);
            return;
        }
        
        const radius = 1 / Math.abs(curvature);
        const totalAngle = length * curvature;
        const segments = Math.max(10, Math.ceil(Math.abs(totalAngle) * 10)); // More segments for sharper curves
        
        // Calculate circle center
        const centerX = x - Math.sin(hdg) * radius * Math.sign(curvature);
        const centerY = y + Math.cos(hdg) * radius * Math.sign(curvature);
        
        for (let i = 1; i <= segments; i++) {
            const ratio = i / segments;
            const angle = hdg + totalAngle * ratio;
            
            const newX = centerX + Math.sin(angle) * radius * Math.sign(curvature);
            const newY = centerY - Math.cos(angle) * radius * Math.sign(curvature);
            
            // Add point to reference line
            points.push(new THREE.Vector3(newX, 0, -newY));
        }
    }
    
    // Process a spiral section of the road (approximation)
    processSpiral(s, x, y, hdg, length, curvStart, curvEnd, points) {
        // Simplification: Approximate spiral with multiple arcs
        const segments = 10;
        let currentX = x;
        let currentY = y;
        let currentHdg = hdg;
        
        for (let i = 0; i < segments; i++) {
            const segmentLength = length / segments;
            const segmentS = s + (i * segmentLength);
            const ratio = i / segments;
            
            // Linear interpolation of curvature
            const currentCurvature = curvStart + (curvEnd - curvStart) * ratio;
            
            // Process this segment as an arc
            const arcPoints = [];
            this.processArc(segmentS, currentX, currentY, currentHdg, segmentLength, currentCurvature, arcPoints);
            
            // Add all points except the first (to avoid duplicates)
            if (arcPoints.length > 0) {
                for (let j = 1; j < arcPoints.length; j++) {
                    points.push(arcPoints[j]);
                }
                
                // Update current position and heading for next segment
                if (arcPoints.length > 1) {
                    const lastPoint = arcPoints[arcPoints.length - 1];
                    currentX = lastPoint.x;
                    currentY = -lastPoint.z; // Note the sign change due to THREE.js coordinate system
                    
                    // Approximate new heading (not accurate for spirals but sufficient for visualization)
                    if (arcPoints.length > 2) {
                        const secondLastPoint = arcPoints[arcPoints.length - 2];
                        const dx = lastPoint.x - secondLastPoint.x;
                        const dy = -lastPoint.z - (-secondLastPoint.z);
                        currentHdg = Math.atan2(dy, dx);
                    }
                }
            }
        }
    }
    
    // Process road lanes
    processRoadLanes(road, roadId) {
        if (!road.lanes || !road.lanes.laneSection) return;
        
        const laneSections = Array.isArray(road.lanes.laneSection) ? 
            road.lanes.laneSection : [road.lanes.laneSection];
        
        laneSections.forEach(laneSection => {
            const sectionS = parseFloat(laneSection['@_s'] || laneSection.s || 0);
            
            // Process center lane (usually just reference line)
            if (laneSection.center && laneSection.center.lane) {
                this.processLane(road, roadId, laneSection.center.lane, sectionS, 0);
            }
            
            // Process left lanes (usually positive IDs)
            if (laneSection.left && laneSection.left.lane) {
                const leftLanes = Array.isArray(laneSection.left.lane) ? 
                    laneSection.left.lane : [laneSection.left.lane];
                    
                leftLanes.forEach(lane => {
                    this.processLane(road, roadId, lane, sectionS, 1);
                });
            }
            
            // Process right lanes (usually negative IDs)
            if (laneSection.right && laneSection.right.lane) {
                const rightLanes = Array.isArray(laneSection.right.lane) ? 
                    laneSection.right.lane : [laneSection.right.lane];
                    
                rightLanes.forEach(lane => {
                    this.processLane(road, roadId, lane, sectionS, -1);
                });
            }
        });
    }
    
    // Process a single lane
    processLane(road, roadId, lane, sectionS, side) {
        const laneId = lane['@_id'] || lane.id || '0';
        const laneType = lane['@_type'] || lane.type || 'driving';
        
        // Skip certain lane types for simplicity in this implementation
        if (['none', 'median'].includes(laneType)) {
            return;
        }
        
        // Get lane width at start and end
        const width = this.getLaneWidth(lane, sectionS);
        
        // Generate lane mesh based on reference line and width
        this.generateLaneMesh(road, roadId, laneId, sectionS, side, width, laneType);
        
        // Process lane markings if they exist
        if (lane.roadMark) {
            const roadMarks = Array.isArray(lane.roadMark) ? lane.roadMark : [lane.roadMark];
            roadMarks.forEach(roadMark => {
                this.processRoadMark(road, roadId, laneId, sectionS, side, width, roadMark);
            });
        }
    }
    
    // Get lane width at a specific station
    getLaneWidth(lane, s) {
        if (!lane.width) return 3.5; // Default lane width
        
        const widths = Array.isArray(lane.width) ? lane.width : [lane.width];
        
        // Find the width definition that applies at this station
        for (const width of widths) {
            const sOffset = parseFloat(width['@_sOffset'] || width.sOffset || 0);
            if (sOffset <= s) {
                const a = parseFloat(width['@_a'] || width.a || 3.5);
                const b = parseFloat(width['@_b'] || width.b || 0);
                const c = parseFloat(width['@_c'] || width.c || 0);
                const d = parseFloat(width['@_d'] || width.d || 0);
                
                // Calculate polynomial width
                const ds = s - sOffset;
                return a + b * ds + c * ds * ds + d * ds * ds * ds;
            }
        }
        
        return 3.5; // Default lane width if no width definition applies
    }
    
    // Generate a mesh for a lane
    generateLaneMesh(road, roadId, laneId, sectionS, side, width, laneType) {
        // This is a simplified implementation that creates a flat rectangle for each lane
        // A full implementation would follow the reference line and create proper lane geometry
        
        // For simplicity, get reference line points
        const referenceLine = this.group.referenceLine.children.find(child => child.userData.type === 'referenceLine' && child.userData.roadId === roadId);
        if (!referenceLine) return;
        
        const refPoints = referenceLine.geometry.attributes.position.array;
        const vertices = [];
        const indices = [];
        
        // Create lane mesh by offsetting reference line points
        for (let i = 0; i < refPoints.length; i += 3) {
            const x = refPoints[i];
            const y = refPoints[i + 1]; // Usually 0 (flat road)
            const z = refPoints[i + 2];
            
            // Get direction vector to next point (or from previous if last point)
            let dirX, dirZ;
            if (i + 3 < refPoints.length) {
                dirX = refPoints[i + 3] - x;
                dirZ = refPoints[i + 5] - z;
            } else if (i - 3 >= 0) {
                dirX = x - refPoints[i - 3];
                dirZ = z - refPoints[i - 3 + 2];
            } else {
                // Skip if can't determine direction
                continue;
            }
            
            // Normalize direction vector
            const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
            dirX /= length;
            dirZ /= length;
            
            // Perpendicular vector (right side of road)
            const perpX = -dirZ;
            const perpZ = dirX;
            
            // Add vertices for both sides of the lane
            const offset = width * Math.abs(parseInt(laneId));
            vertices.push(
                x + perpX * offset * side, y + 0.02, z + perpZ * offset * side, // Outer edge
                x, y + 0.01, z // Reference line
            );
            
            // Add faces (triangles) for the lane surface
            if (i > 0 && i + 3 < refPoints.length) {
                const vertexIdx = (i / 3) * 2;
                indices.push(
                    vertexIdx - 2, vertexIdx, vertexIdx - 1, // First triangle
                    vertexIdx - 1, vertexIdx, vertexIdx + 1  // Second triangle
                );
            }
        }
        
        // Create geometry and mesh
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        // Choose material based on lane type
        let material = this.roadMaterial;
        if (laneType === 'shoulder') {
            material = new THREE.MeshStandardMaterial({
                color: 0x555555, // Darker gray
                roughness: 0.9,
                metalness: 0.1
            });
        } else if (laneType === 'sidewalk') {
            material = new THREE.MeshStandardMaterial({
                color: 0xcccccc, // Light gray
                roughness: 0.7,
                metalness: 0.1
            });
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.userData = {
            type: 'lane',
            roadId,
            laneId,
            laneType
        };
        
        this.group.road.add(mesh);
    }
    
    // Process road markings
    processRoadMark(road, roadId, laneId, sectionS, side, width, roadMark) {
        const markType = roadMark['@_type'] || roadMark.type || 'solid';
        const markColor = roadMark['@_color'] || roadMark.color || 'white';
        const markWidth = parseFloat(roadMark['@_width'] || roadMark.width || 0.15);
        
        // Skip certain mark types for simplicity
        if (['none', 'curb'].includes(markType)) {
            return;
        }
        
        // For simplicity, we'll just create a thin rectangle above the lane edge
        const referenceLine = this.group.referenceLine.children.find(child => child.userData.type === 'referenceLine' && child.userData.roadId === roadId);
        if (!referenceLine) return;
        
        const refPoints = referenceLine.geometry.attributes.position.array;
        const vertices = [];
        const indices = [];
        
        // Create marking mesh similar to lane mesh but thinner
        for (let i = 0; i < refPoints.length; i += 3) {
            const x = refPoints[i];
            const y = refPoints[i + 1]; // Usually 0 (flat road)
            const z = refPoints[i + 2];
            
            // Get direction vector
            let dirX, dirZ;
            if (i + 3 < refPoints.length) {
                dirX = refPoints[i + 3] - x;
                dirZ = refPoints[i + 5] - z;
            } else if (i - 3 >= 0) {
                dirX = x - refPoints[i - 3];
                dirZ = z - refPoints[i - 3 + 2];
            } else {
                continue;
            }
            
            // Normalize direction vector
            const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
            dirX /= length;
            dirZ /= length;
            
            // Perpendicular vector
            const perpX = -dirZ;
            const perpZ = dirX;
            
            // Lane offset
            const laneOffset = width * Math.abs(parseInt(laneId));
            
            // For solid lines, add vertices for both sides of the marking
            if (markType === 'solid') {
                vertices.push(
                    x + perpX * (laneOffset + markWidth/2) * side, y + 0.03, z + perpZ * (laneOffset + markWidth/2) * side,
                    x + perpX * (laneOffset - markWidth/2) * side, y + 0.03, z + perpZ * (laneOffset - markWidth/2) * side
                );
                
                // Add faces (triangles) for the marking surface
                if (i > 0 && i + 3 < refPoints.length) {
                    const vertexIdx = (i / 3) * 2;
                    indices.push(
                        vertexIdx - 2, vertexIdx, vertexIdx - 1, // First triangle
                        vertexIdx - 1, vertexIdx, vertexIdx + 1  // Second triangle
                    );
                }
            } 
            // For dashed lines, add vertices only for certain segments
            else if (markType === 'broken') {
                // Add dashes every 3 meters with 6 meter spacing
                const dashLength = 3;
                const dashSpacing = 6;
                const totalLength = dashLength + dashSpacing;
                
                // Calculate position along reference line
                let s = 0;
                if (i > 0) {
                    for (let j = 3; j <= i; j += 3) {
                        const dx = refPoints[j] - refPoints[j - 3];
                        const dz = refPoints[j + 2] - refPoints[j - 3 + 2];
                        s += Math.sqrt(dx * dx + dz * dz);
                    }
                }
                
                // Only add vertices for dash segments
                const segment = Math.floor(s / totalLength);
                const localS = s - segment * totalLength;
                
                if (localS < dashLength) {
                    vertices.push(
                        x + perpX * (laneOffset + markWidth/2) * side, y + 0.03, z + perpZ * (laneOffset + markWidth/2) * side,
                        x + perpX * (laneOffset - markWidth/2) * side, y + 0.03, z + perpZ * (laneOffset - markWidth/2) * side
                    );
                    
                    // Add faces (triangles) for the marking surface
                    if (i > 0 && i + 3 < refPoints.length && vertices.length >= 6) {
                        const vertexIdx = vertices.length / 3 - 2;
                        indices.push(
                            vertexIdx - 2, vertexIdx, vertexIdx - 1, // First triangle
                            vertexIdx - 1, vertexIdx, vertexIdx + 1  // Second triangle
                        );
                    }
                }
            }
        }
        
        // Create geometry and mesh
        if (vertices.length > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            
            // Choose material based on mark color
            let material = this.roadMarkMaterial;
            if (markColor === 'yellow') {
                material = new THREE.MeshStandardMaterial({
                    color: 0xffcc00,
                    roughness: 0.3,
                    metalness: 0.1
                });
            }
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.userData = {
                type: 'roadMark',
                roadId,
                laneId,
                markType
            };
            
            this.group.road.add(mesh);
        }
    }
    
    // Process road objects (signs, signals, etc.)
    processRoadObjects(road, roadId) {
        // Process road signals if they exist
        if (road.signals && road.signals.signal) {
            const signals = Array.isArray(road.signals.signal) ? 
                road.signals.signal : [road.signals.signal];
            
            signals.forEach(signal => {
                this.processSignal(road, roadId, signal);
            });
        }
        
        // Process road objects if they exist
        if (road.objects && road.objects.object) {
            const objects = Array.isArray(road.objects.object) ? 
                road.objects.object : [road.objects.object];
            
            objects.forEach(object => {
                this.processObject(road, roadId, object);
            });
        }
    }
    
    // Process a road signal
    processSignal(road, roadId, signal) {
        // Implementation simplified for this example
        // In a full implementation, we would create 3D models for each signal type
        console.log(`Signal in road ${roadId}: ${signal['@_id'] || 'unknown'}`);
    }
    
    // Process a road object
    processObject(road, roadId, object) {
        // Implementation simplified for this example
        // In a full implementation, we would create 3D models for each object type
        console.log(`Object in road ${roadId}: ${object['@_id'] || 'unknown'}`);
    }
    
    // Process a junction
    processJunction(junction) {
        const junctionId = junction['@_id'] || junction.id || 'unknown';
        console.log(`Processing junction: ${junctionId}`);
        
        // In a full implementation, we would create proper connection geometry
        // For this example, we'll rely on the roads that refer to this junction
    }
    
    // Clear all road-related meshes from the scene
    clearScene() {
        // Clear all groups
        Object.values(this.group).forEach(group => {
            while(group.children.length > 0) {
                const child = group.children[0];
                group.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    }
    
    // Toggle visibility of reference lines
    setReferenceLinesVisible(visible) {
        this.group.referenceLine.visible = visible;
    }
}