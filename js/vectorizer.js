/**
 * Vectorizer class for generating text embeddings
 * Provides a memory-efficient implementation for converting text to vector embeddings
 */
class Vectorizer {
    constructor() {
        this.model = null;
        this.modelLoading = null;
        this.isModelLoaded = false;
        
        // Add fallback if memory manager isn't loaded yet
        if (typeof TensorflowMemoryManager === 'undefined' || typeof memoryManager === 'undefined') {
            console.warn('Memory manager not found, creating fallback instance');
            this.memoryManager = {
                runWithMemoryManagement: async (operation) => {
                    // Simple fallback implementation
                    try {
                        return await operation();
                    } finally {
                        // Try basic cleanup
                        if (typeof tf !== 'undefined' && tf.engine) {
                            try {
                                tf.engine().endScope();
                            } catch (e) {
                                console.warn('Fallback cleanup error:', e);
                            }
                        }
                    }
                }
            };
        } else {
            this.memoryManager = memoryManager;
        }
    }

    /**
     * Load the Universal Sentence Encoder model
     * @returns {Promise<void>}
     */
    async loadModel() {
        // Return existing model if already loaded
        if (this.isModelLoaded && this.model) {
            return;
        }

        // Return existing promise if already loading
        if (this.modelLoading) {
            return this.modelLoading;
        }

        // Show loading status in UI
        this.showModelLoadingStatus(true, 'Loading text embedding model...');

        try {
            // Start loading with a timeout for error handling
            const loadPromise = new Promise(async (resolve, reject) => {
                try {
                    // Set a timeout to catch hanging model loads
                    const timeout = setTimeout(() => {
                        reject(new Error('Model loading timed out after 30 seconds'));
                    }, 30000);

                    // Load the model
                    console.log('Loading Universal Sentence Encoder model...');
                    const model = await use.load();
                    clearTimeout(timeout);
                    
                    console.log('Model loaded successfully');
                    resolve(model);
                } catch (error) {
                    reject(error);
                }
            });

            this.modelLoading = loadPromise;
            this.model = await loadPromise;
            this.isModelLoaded = true;
            
            // Update UI when model is loaded
            this.showModelLoadingStatus(false, 'Text embedding model loaded!');
            
            // Cleanup
            this.modelLoading = null;
            return this.model;
        } catch (error) {
            console.error('Error loading text embedding model:', error);
            this.showModelLoadingStatus(true, 'Error loading model. Retrying...');
            this.modelLoading = null;
            throw error;
        }
    }

    /**
     * Show or hide model loading status in the UI
     * @param {boolean} isLoading - Whether the model is loading
     * @param {string} message - Status message to display
     */
    showModelLoadingStatus(isLoading, message = '') {
        const modelStatusEl = document.getElementById('modelStatus');
        const modelStatusMessageEl = document.getElementById('modelStatusMessage');
        
        if (!modelStatusEl || !modelStatusMessageEl) return;
        
        if (isLoading) {
            modelStatusMessageEl.textContent = message;
            const toast = new bootstrap.Toast(modelStatusEl);
            toast.show();
        } else {
            // Hide after a short delay to show completion message
            modelStatusMessageEl.textContent = message;
            setTimeout(() => {
                const toast = bootstrap.Toast.getInstance(modelStatusEl);
                if (toast) toast.hide();
            }, 1500);
        }
    }

    /**
     * Vectorize a single text string
     * @param {string} text - Text to vectorize
     * @returns {Promise<Float32Array>} Embedding vector
     */
    async vectorize(text) {
        if (!text) return new Float32Array(512).fill(0);
        
        // Ensure model is loaded
        await this.loadModel();
        
        try {
            // Use memory management to prevent leaks
            return await this.memoryManager.runWithMemoryManagement(async () => {
                const embeddings = await this.model.embed([text]);
                // Get data from tensor and dispose immediately
                const data = await embeddings.array();
                tf.dispose(embeddings);
                
                // Return the first (and only) embedding
                return data[0];
            });
        } catch (error) {
            console.error('Error generating embedding:', error);
            // Return zero vector as fallback
            return new Float32Array(512).fill(0);
        }
    }

    /**
     * Vectorize a batch of texts with progress reporting
     * @param {string[]} texts - Array of text strings to vectorize
     * @param {Function} [progressCallback] - Optional callback for progress updates
     * @returns {Promise<Float32Array[]>} Array of embedding vectors
     */
    async vectorizeBatch(texts, progressCallback = null) {
        if (!texts || texts.length === 0) return [];
        
        // Ensure model is loaded
        await this.loadModel();
        
        // Determine batch size based on text length
        const avgTextLength = texts.reduce((sum, text) => sum + (text?.length || 0), 0) / texts.length;
        // Adjust batch size dynamically - smaller batches for longer texts
        const batchSize = avgTextLength > 5000 ? 8 : avgTextLength > 1000 ? 16 : 32;
        
        const results = [];
        const totalBatches = Math.ceil(texts.length / batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            // Report progress if callback provided
            if (progressCallback) {
                const progress = batchIndex / totalBatches;
                progressCallback(progress);
            }
            
            const startIdx = batchIndex * batchSize;
            const endIdx = Math.min(startIdx + batchSize, texts.length);
            const batchTexts = texts.slice(startIdx, endIdx);
            
            try {
                // Process batch with memory management
                const batchResults = await this.memoryManager.runWithMemoryManagement(async () => {
                    const embeddings = await this.model.embed(batchTexts);
                    const data = await embeddings.array();
                    tf.dispose(embeddings);
                    return data;
                });
                
                results.push(...batchResults);
                
                // Introduce small delay to keep UI responsive for large batches
                if (totalBatches > 5 && batchIndex < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            } catch (error) {
                console.error(`Error in batch ${batchIndex}:`, error);
                // Add zero vectors for the failed batch
                for (let i = 0; i < batchTexts.length; i++) {
                    results.push(new Float32Array(512).fill(0));
                }
            }
        }
        
        // Final progress update
        if (progressCallback) {
            progressCallback(1.0);
        }
        
        return results;
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Float32Array|number[]} vec1 - First vector
     * @param {Float32Array|number[]} vec2 - Second vector
     * @returns {number} Similarity score (0-1)
     */
    cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) {
            return 0;
        }

        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            mag1 += vec1[i] * vec1[i];
            mag2 += vec2[i] * vec2[i];
        }

        mag1 = Math.sqrt(mag1);
        mag2 = Math.sqrt(mag2);

        if (mag1 === 0 || mag2 === 0) return 0;
        
        return dotProduct / (mag1 * mag2);
    }

    /**
     * Find most similar vectors to a query vector
     * @param {Float32Array|number[]} queryVec - Query vector
     * @param {Array<{embedding: Float32Array|number[], ...}>} items - Array of items with embeddings
     * @param {number} topK - Number of results to return
     * @returns {Array<{...Object, similarity: number}>} Top K similar items with similarity scores
     */
    findMostSimilar(queryVec, items, topK = 5) {
        if (!queryVec || !items || items.length === 0) {
            return [];
        }

        // Calculate similarities
        const withSimilarities = items.map(item => ({
            ...item,
            similarity: this.cosineSimilarity(queryVec, item.embedding)
        }));

        // Sort by similarity (descending)
        withSimilarities.sort((a, b) => b.similarity - a.similarity);

        // Return top K results
        return withSimilarities.slice(0, topK);
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.model && typeof this.model.dispose === 'function') {
            this.model.dispose();
        }
        this.model = null;
        this.isModelLoaded = false;
    }
}

// Initialize global instance - wrap in try/catch for safety
try {
    const vectorizer = new Vectorizer();
    // Make globally available
    window.vectorizer = vectorizer;
} catch (error) {
    console.error('Error initializing vectorizer:', error);
    // Create minimal fallback implementation
    window.vectorizer = {
        async loadModel() { 
            console.warn('Using fallback vectorizer (non-functional)'); 
            return null; 
        },
        async vectorize() { return new Float32Array(512).fill(0); },
        async vectorizeBatch(texts) { 
            return Array(texts.length).fill().map(() => new Float32Array(512).fill(0)); 
        },
        cosineSimilarity() { return 0; },
        findMostSimilar() { return []; }
    };
}
