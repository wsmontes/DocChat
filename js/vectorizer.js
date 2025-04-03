class Vectorizer {
    constructor() {
        this.model = null;
        this.modelType = 'universal-sentence-encoder';
        this.isReady = false;
        this.readyPromise = null;
        this.cachedModels = {};
        this.modelStatusElement = document.getElementById('modelStatus');
        this.modelStatusMessage = document.getElementById('modelStatusMessage');
    }
    
    showModelStatus(message) {
        if (this.modelStatusElement && this.modelStatusMessage) {
            this.modelStatusMessage.textContent = message;
            this.modelStatusElement.classList.remove('d-none');
        }
    }
    
    hideModelStatus() {
        if (this.modelStatusElement) {
            this.modelStatusElement.classList.add('d-none');
        }
    }
    
    async loadModel(modelType = 'universal-sentence-encoder') {
        // Check if we already have this model cached
        if (this.cachedModels[modelType]) {
            this.model = this.cachedModels[modelType];
            this.modelType = modelType;
            this.isReady = true;
            return Promise.resolve();
        }
        
        this.modelType = modelType;
        this.isReady = false;
        this.showModelStatus('Loading embeddings model, please wait...');
        
        this.readyPromise = new Promise(async (resolve, reject) => {
            try {
                console.log(`Loading model: ${modelType}`);
                
                if (modelType === 'universal-sentence-encoder') {
                    // First try to load from the TF models directly (more reliable)
                    try {
                        this.model = await use.load();
                        console.log('Loaded model using @tensorflow-models/universal-sentence-encoder');
                    } catch (err) {
                        console.warn('Failed to load from TF models, trying TF Hub:', err);
                        // Fallback to TF Hub if needed
                        this.model = await tf.loadGraphModel(
                            'https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder/1/model.json',
                            { fromTFHub: true }
                        );
                    }
                } else {
                    throw new Error(`Unknown model type: ${modelType}`);
                }
                
                // Cache the model for future use
                this.cachedModels[modelType] = this.model;
                this.isReady = true;
                console.log('Model loaded successfully');
                this.hideModelStatus();
                resolve();
            } catch (error) {
                console.error('Error loading model:', error);
                this.showModelStatus(`Error loading model: ${error.message}. Retrying...`);
                
                // Try one more time with a delay
                setTimeout(async () => {
                    try {
                        if (modelType === 'universal-sentence-encoder') {
                            // Last resort - try loading a different version
                            this.model = await tf.loadGraphModel(
                                'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder/model.json'
                            );
                            
                            // Cache the model
                            this.cachedModels[modelType] = this.model;
                            this.isReady = true;
                            console.log('Model loaded successfully on retry');
                            this.hideModelStatus();
                            resolve();
                        } else {
                            reject(error);
                        }
                    } catch (retryError) {
                        console.error('Error loading model on retry:', retryError);
                        this.showModelStatus(`Failed to load model: ${retryError.message}`);
                        reject(retryError);
                    }
                }, 2000);
            }
        });
        
        return this.readyPromise;
    }
    
    async waitForReady() {
        if (this.isReady) return Promise.resolve();
        if (!this.readyPromise) {
            this.readyPromise = this.loadModel();
        }
        return this.readyPromise;
    }
    
    async vectorize(text) {
        await this.waitForReady();
        
        if (this.modelType === 'universal-sentence-encoder') {
            // Handle differently based on model source
            if (this.model.embed) {
                // This is the @tensorflow-models/universal-sentence-encoder model
                const embeddings = await this.model.embed([text]);
                const result = await embeddings.array();
                embeddings.dispose(); // Properly dispose tensors
                return result[0]; // Return the first (and only) embedding
            } else {
                // This is the TF Hub model
                return tf.tidy(() => {
                    const embeddings = this.model.predict(tf.tensor([text]));
                    return Array.from(embeddings.dataSync());
                });
            }
        } else {
            throw new Error(`Vectorization not implemented for model type: ${this.modelType}`);
        }
    }
    
    async vectorizeBatch(texts, progressCallback = null) {
        await this.waitForReady();
        
        const results = [];
        const batchSize = 16; // Process 16 items at a time
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            
            // Process batch
            let batchResults;
            
            if (this.modelType === 'universal-sentence-encoder') {
                if (this.model.embed) {
                    // @tensorflow-models/universal-sentence-encoder model
                    const embeddings = await this.model.embed(batch);
                    batchResults = await embeddings.array();
                    embeddings.dispose(); // Properly dispose tensors
                } else {
                    // TF Hub model
                    batchResults = await tf.tidy(() => {
                        const embeddings = this.model.predict(tf.tensor(batch));
                        // Convert to regular arrays
                        return Array.from(embeddings.dataSync())
                            .reduce((arr, val, i) => {
                                const index = Math.floor(i / embeddings.shape[1]);
                                if (!arr[index]) arr[index] = [];
                                arr[index].push(val);
                                return arr;
                            }, []);
                    });
                }
            } else {
                throw new Error(`Batch vectorization not implemented for model type: ${this.modelType}`);
            }
            
            results.push(...batchResults);
            
            // Report progress
            if (progressCallback) {
                const progress = (i + batchSize) / texts.length;
                progressCallback(Math.min(progress, 1));
            }
            
            // Run garbage collection if available
            if (window.gc) window.gc();
            
            // Small delay to avoid UI freezes
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return results;
    }
    
    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vec1 - First vector
     * @param {Array<number>} vec2 - Second vector
     * @returns {number} Cosine similarity (0-1)
     */
    cosineSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let vec1Magnitude = 0;
        let vec2Magnitude = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            vec1Magnitude += vec1[i] * vec1[i];
            vec2Magnitude += vec2[i] * vec2[i];
        }
        
        vec1Magnitude = Math.sqrt(vec1Magnitude);
        vec2Magnitude = Math.sqrt(vec2Magnitude);
        
        return dotProduct / (vec1Magnitude * vec2Magnitude);
    }
}

const vectorizer = new Vectorizer();
