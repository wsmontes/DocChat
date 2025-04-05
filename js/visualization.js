class VectorVisualizer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.points = null;
        this.texts = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoverLabel = document.createElement('div');
        this.animationFrame = null;
        this.initialized = false;
        this.colorScheme = [
            '#4285F4', '#EA4335', '#FBBC05', '#34A853', // Google colors
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', // Flat UI colors
            '#9b59b6', '#1abc9c', '#d35400', '#c0392b'  // More variety
        ];
        
        // Initialize hover label styles
        this.setupHoverLabel();
    }
    
    setupHoverLabel() {
        this.hoverLabel.className = 'vector-hover-label';
        this.hoverLabel.style.position = 'absolute';
        this.hoverLabel.style.padding = '8px 12px';
        this.hoverLabel.style.backgroundColor = 'rgba(0,0,0,0.75)';
        this.hoverLabel.style.color = 'white';
        this.hoverLabel.style.borderRadius = '4px';
        this.hoverLabel.style.fontSize = '14px';
        this.hoverLabel.style.pointerEvents = 'none';
        this.hoverLabel.style.zIndex = '1000';
        this.hoverLabel.style.display = 'none';
        this.hoverLabel.style.maxWidth = '300px';
        this.hoverLabel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        this.hoverLabel.style.transition = 'opacity 0.15s ease';
        document.body.appendChild(this.hoverLabel);
    }
    
    initializeVisualization(container) {
        if (this.initialized) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight || 400;
        
        // Create scene, camera, renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f9fa); // Light gray background
        
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.z = 2;
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        container.appendChild(this.renderer.domElement);
        
        // Add controls for better usability
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.5;
        
        // Add grid and axes for reference
        this.addGridAndAxes();
        
        // Add event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        container.addEventListener('mousemove', this.onMouseMove.bind(this));
        
        // Begin animation loop
        this.animate();
        
        this.initialized = true;
        
        // Add simple loading indicator
        this.showLoadingIndicator(container);
    }
    
    showLoadingIndicator(container) {
        const loader = document.createElement('div');
        loader.className = 'vector-loader';
        loader.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        text-align: center; background: rgba(255,255,255,0.9); padding: 20px; 
                        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #f3f3f3; 
                            border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div style="margin-top: 12px; color: #333; font-weight: 500;">Loading vector space...</div>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
        loader.style.position = 'absolute';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100%';
        loader.style.height = '100%';
        loader.style.zIndex = '10';
        container.appendChild(loader);
        
        // Store reference to remove it later
        this.loader = loader;
    }
    
    addGridAndAxes() {
        // Add subtle grid for better spatial orientation
        const gridHelper = new THREE.GridHelper(2, 20, 0xd0d0d0, 0xe0e0e0);
        gridHelper.position.y = -1;
        this.scene.add(gridHelper);
        
        // Add axes labels
        const createLabel = (text, position, color) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.set(0.2, 0.1, 1);
            return sprite;
        };
        
        this.scene.add(createLabel('X', new THREE.Vector3(1.2, 0, 0), '#d63031'));
        this.scene.add(createLabel('Y', new THREE.Vector3(0, 1.2, 0), '#00b894'));
        this.scene.add(createLabel('Z', new THREE.Vector3(0, 0, 1.2), '#0984e3'));
    }
    
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        const container = this.renderer.domElement.parentElement;
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    onMouseMove(event) {
        if (!this.renderer || !this.points || !this.texts) return;
        
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObject(this.points);
        
        // Clear previous hover state
        this.hoverLabel.style.display = 'none';
        
        if (intersects.length > 0) {
            // Get the first intersected point
            const intersect = intersects[0];
            const index = intersect.index;
            
            // Get the text for this point
            if (this.texts && index < this.texts.length) {
                // Show label near the cursor
                this.hoverLabel.textContent = this.texts[index].substring(0, 150) + 
                                            (this.texts[index].length > 150 ? '...' : '');
                this.hoverLabel.style.display = 'block';
                this.hoverLabel.style.left = `${event.clientX + 10}px`;
                this.hoverLabel.style.top = `${event.clientY + 10}px`;
                
                // Check if label is out of viewport and adjust
                const labelRect = this.hoverLabel.getBoundingClientRect();
                if (labelRect.right > window.innerWidth) {
                    this.hoverLabel.style.left = `${event.clientX - labelRect.width - 10}px`;
                }
                if (labelRect.bottom > window.innerHeight) {
                    this.hoverLabel.style.top = `${event.clientY - labelRect.height - 10}px`;
                }
            }
        }
    }
    
    animate() {
        this.animationFrame = requestAnimationFrame(this.animate.bind(this));
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    visualizeVectors(vectors, texts) {
        if (!this.scene || !this.initialized) return;
        
        // Get min and max values for normalization
        const minValues = [Infinity, Infinity, Infinity];
        const maxValues = [-Infinity, -Infinity, -Infinity];
        
        for (const vector of vectors) {
            for (let j = 0; j < 3; j++) {
                minValues[j] = Math.min(minValues[j], vector[j]);
                maxValues[j] = Math.max(maxValues[j], vector[j]);
            }
        }
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(vectors.length * 3);
        
        for (let i = 0; i < vectors.length; i++) {
            for (let j = 0; j < 3; j++) {
                const normalized = (vectors[i][j] - minValues[j]) / (maxValues[j] - minValues[j]) * 2 - 1;
                positions[i * 3 + j] = normalized;
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create colors based on vector clusters using a better color scheme
        const colors = new Float32Array(vectors.length * 3);
        for (let i = 0; i < vectors.length; i++) {
            // Improved clustering method for better visual distinction
            let clusterIndex = Math.abs(Math.round(vectors[i].reduce((acc, val) => acc + val, 0) * 100)) % this.colorScheme.length;
            
            // Convert hex color to RGB
            const color = new THREE.Color(this.colorScheme[clusterIndex]);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create improved material with better visibility and hover effects
        const material = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            depthWrite: false,
            vertexAlpha: true
        });
        
        // Create points
        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);
        
        // Set camera to view all points
        this.fitCameraToPoints();
        
        // Store original texts for tooltips
        this.texts = texts;
        
        // Remove loading indicator
        if (this.loader) {
            this.loader.remove();
            this.loader = null;
        }
        
        // Add legend to help user understand the visualization
        this.addLegend();
    }
    
    fitCameraToPoints() {
        if (!this.points) return;
        
        // Get the bounding box of all points
        const box = new THREE.Box3().setFromObject(this.points);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Set the camera to view all points with some padding
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;
        
        this.camera.position.x = center.x;
        this.camera.position.y = center.y;
        this.camera.position.z = center.z + distance;
        
        // Look at the center of the points
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();
        
        // Update controls target
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    }
    
    addLegend() {
        const container = this.renderer.domElement.parentElement;
        if (!container) return;
        
        let legend = document.createElement('div');
        legend.className = 'vector-visualization-legend';
        legend.style.position = 'absolute';
        legend.style.bottom = '10px';
        legend.style.right = '10px';
        legend.style.background = 'rgba(255, 255, 255, 0.85)';
        legend.style.padding = '8px 12px';
        legend.style.borderRadius = '6px';
        legend.style.fontSize = '12px';
        legend.style.color = '#333';
        legend.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
        legend.style.maxWidth = '200px';
        legend.style.zIndex = '5';
        
        legend.innerHTML = `
            <div style="margin-bottom: 6px; font-weight: 600;">Vector Space</div>
            <div style="margin-bottom: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #d63031; border-radius: 50%; margin-right: 6px;"></span> X axis</div>
            <div style="margin-bottom: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #00b894; border-radius: 50%; margin-right: 6px;"></span> Y axis</div>
            <div style="margin-bottom: 6px;"><span style="display: inline-block; width: 10px; height: 10px; background: #0984e3; border-radius: 50%; margin-right: 6px;"></span> Z axis</div>
            <div style="font-style: italic; font-size: 11px;">Mouse over points to see text</div>
        `;
        
        container.appendChild(legend);
    }
    
    cleanup() {
        // Clean up to prevent memory leaks
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        
        if (this.renderer && this.renderer.domElement) {
            const container = this.renderer.domElement.parentElement;
            if (container) {
                container.removeEventListener('mousemove', this.onMouseMove.bind(this));
            }
            
            // Remove render element from DOM
            if (this.renderer.domElement.parentElement) {
                this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
            }
        }
        
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Remove hover label
        if (this.hoverLabel.parentElement) {
            this.hoverLabel.parentElement.removeChild(this.hoverLabel);
        }
        
        // Dispose of Three.js resources
        if (this.points) {
            this.scene.remove(this.points);
            this.points.geometry.dispose();
            this.points.material.dispose();
        }
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.points = null;
        this.initialized = false;
    }
}
