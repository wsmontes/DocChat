class VectorVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.points = null;
        this.tooltips = [];
        
        // Initialize 3D scene
        this.initScene();
    }
    
    initScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.z = 5;
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Use proper OrbitControls if available, otherwise degrade gracefully
        if (typeof THREE.OrbitControls === 'function') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        } else {
            console.warn('THREE.OrbitControls not found. Camera controls will be limited.');
            // Create a minimal controls object to avoid errors
            this.controls = {
                update: function() {},
                target: new THREE.Vector3()
            };
            
            // Add basic mouse rotation as fallback
            let isDragging = false;
            let previousMousePosition = { x: 0, y: 0 };
            
            this.container.addEventListener('mousedown', (e) => {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });
            
            this.container.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaMove = {
                        x: e.clientX - previousMousePosition.x,
                        y: e.clientY - previousMousePosition.y
                    };
                    
                    // Rotate camera based on mouse movement
                    this.camera.position.x += deltaMove.x * 0.01;
                    this.camera.position.y -= deltaMove.y * 0.01;
                    
                    previousMousePosition = { x: e.clientX, y: e.clientY };
                }
            });
            
            this.container.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            // Add mouse wheel zoom
            this.container.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.camera.position.z += e.deltaY * 0.01;
            });
        }
        
        // Start animation loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    visualizeVectors(vectors, texts) {
        // Clear previous points
        if (this.points) {
            this.scene.remove(this.points);
        }
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        
        // Convert vectors to normalized positions (-1 to 1 range)
        const positions = new Float32Array(vectors.length * 3);
        
        // Find min/max for normalization
        let minValues = [Infinity, Infinity, Infinity];
        let maxValues = [-Infinity, -Infinity, -Infinity];
        
        for (let i = 0; i < vectors.length; i++) {
            for (let j = 0; j < 3; j++) {
                minValues[j] = Math.min(minValues[j], vectors[i][j]);
                maxValues[j] = Math.max(maxValues[j], vectors[i][j]);
            }
        }
        
        // Normalize and set positions
        for (let i = 0; i < vectors.length; i++) {
            for (let j = 0; j < 3; j++) {
                const normalized = (vectors[i][j] - minValues[j]) / (maxValues[j] - minValues[j]) * 2 - 1;
                positions[i * 3 + j] = normalized;
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create colors based on vector clusters (using a simple hashing)
        const colors = new Float32Array(vectors.length * 3);
        for (let i = 0; i < vectors.length; i++) {
            // Simple hash from the vector to RGB color
            const hash = Math.abs(vectors[i].reduce((acc, val) => acc + val, 0));
            const r = (hash % 255) / 255;
            const g = ((hash * 33) % 255) / 255;
            const b = ((hash * 747) % 255) / 255;
            
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create material
        const material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        // Create points
        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);
        
        // Set camera to view all points
        this.fitCameraToPoints();
        
        // Store original texts for tooltips
        this.texts = texts;
    }
    
    fitCameraToPoints() {
        if (!this.points) return;
        
        // Get bounding box
        const box = new THREE.Box3().setFromObject(this.points);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Set camera position
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Set camera to look at center of points
        this.camera.position.z = cameraZ * 1.5;
        this.controls.target = center;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }
    
    highlightPoints(indices) {
        if (!this.points) return;
        
        // Reset all points
        const colors = this.points.geometry.attributes.color;
        
        // Set highlighted points
        for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            colors.array[index * 3] = 1.0;      // Red
            colors.array[index * 3 + 1] = 0.1;  // Green
            colors.array[index * 3 + 2] = 0.1;  // Blue
        }
        
        colors.needsUpdate = true;
    }
}
