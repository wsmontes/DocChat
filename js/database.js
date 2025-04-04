class DocumentDatabase {
    constructor() {
        this.dbName = 'documentQA';
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        this.readyPromise = this.initDatabase();
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            // Check if IndexedDB is available
            if (!window.indexedDB) {
                console.error('IndexedDB not supported in this browser');
                reject(new Error('IndexedDB is not supported in this browser.'));
                return;
            }

            // Check if running on GitHub Pages
            const isGitHubPages = window.location.hostname.includes('github.io');
            if (isGitHubPages) {
                console.log('Running on GitHub Pages - adding extra safeguards for IndexedDB');
            }
            
            try {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Create document store
                    if (!db.objectStoreNames.contains('documents')) {
                        const docStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
                        docStore.createIndex('title', 'title', { unique: false });
                        docStore.createIndex('dateProcessed', 'dateProcessed', { unique: false });
                    }
                    
                    // Create chunks store
                    if (!db.objectStoreNames.contains('chunks')) {
                        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
                        chunkStore.createIndex('documentId', 'documentId', { unique: false });
                        chunkStore.createIndex('embedding', 'embedding', { unique: false });
                    }
                    
                    // Create metadata store
                    if (!db.objectStoreNames.contains('metadata')) {
                        const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
                    }
                };
                
                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    this.isReady = true;
                    
                    // On GitHub Pages, verify connection with a simple test
                    if (isGitHubPages) {
                        try {
                            const testTx = this.db.transaction(['metadata'], 'readonly');
                            testTx.oncomplete = () => {
                                console.log('IndexedDB connection verified');
                            };
                        } catch (e) {
                            console.warn('IndexedDB test transaction failed:', e);
                        }
                    }
                    
                    resolve();
                };
                
                request.onerror = (event) => {
                    console.error('IndexedDB error:', event.target.error);
                    reject(event.target.error);
                };
                
                // Add timeout for GitHub Pages to prevent hanging
                if (isGitHubPages) {
                    setTimeout(() => {
                        if (!this.isReady) {
                            const error = new Error('IndexedDB initialization timed out');
                            console.error(error);
                            reject(error);
                        }
                    }, 5000); // 5 second timeout
                }
            } catch (error) {
                console.error('Error during IndexedDB initialization:', error);
                reject(error);
            }
        });
    }
    
    async waitForReady() {
        if (this.isReady) return Promise.resolve();
        return this.readyPromise;
    }
    
    /**
     * Store a document and its chunks
     * @param {Object} document - Document metadata
     * @param {Array<Object>} chunks - Document chunks with embeddings
     * @returns {Promise<number>} ID of the stored document
     */
    async storeDocument(document, chunks) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents', 'chunks', 'metadata'], 'readwrite');
            const docStore = transaction.objectStore('documents');
            const chunkStore = transaction.objectStore('chunks');
            const metaStore = transaction.objectStore('metadata');
            
            let documentId = null;
            
            // Store document
            const docRequest = docStore.add(document);
            docRequest.onsuccess = (event) => {
                documentId = event.target.result;
                
                // Store chunks with document reference
                chunks.forEach(chunk => {
                    chunk.documentId = documentId;
                    chunkStore.add(chunk);
                });
            };
            
            // Update metadata
            metaStore.put({ key: 'lastUpdate', value: new Date().toISOString() });
            metaStore.put({ key: 'documentCount', value: 1, operation: 'increment' });
            metaStore.put({ key: 'chunkCount', value: chunks.length, operation: 'increment' });
            
            transaction.oncomplete = () => {
                resolve(documentId);
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Import a document with pre-calculated embeddings
     * @param {Object} exportData - Exported document data with embeddings
     * @returns {Promise<number>} ID of the imported document
     */
    async importDocument(exportData) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            try {
                // Validate the import data structure
                if (!exportData.metadata || !exportData.chunks || !Array.isArray(exportData.chunks)) {
                    throw new Error('Invalid import data format');
                }
                
                const transaction = this.db.transaction(['documents', 'chunks', 'metadata'], 'readwrite');
                const docStore = transaction.objectStore('documents');
                const chunkStore = transaction.objectStore('chunks');
                const metaStore = transaction.objectStore('metadata');
                
                let documentId = null;
                
                // Ensure we have a fresh dateProcessed
                const metadata = {
                    ...exportData.metadata,
                    dateProcessed: new Date().toISOString(),
                    imported: true
                };
                
                // Store document
                const docRequest = docStore.add(metadata);
                docRequest.onsuccess = (event) => {
                    documentId = event.target.result;
                    
                    // Store chunks with document reference
                    exportData.chunks.forEach(chunk => {
                        // Ensure each chunk references the new document ID
                        chunkStore.add({
                            ...chunk,
                            documentId: documentId
                        });
                    });
                };
                
                // Update metadata
                metaStore.put({ key: 'lastUpdate', value: new Date().toISOString() });
                metaStore.put({ key: 'documentCount', value: 1, operation: 'increment' });
                metaStore.put({ key: 'chunkCount', value: exportData.chunks.length, operation: 'increment' });
                
                transaction.oncomplete = () => {
                    resolve(documentId);
                };
                
                transaction.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Export a document with all its chunks and embeddings
     * @param {number} documentId - Document ID
     * @returns {Promise<Object>} Document data with chunks and embeddings
     */
    async exportDocument(documentId) {
        await this.waitForReady();
        
        try {
            // Get the document
            const document = await this.getDocument(documentId);
            if (!document) {
                throw new Error('Document not found');
            }
            
            // Get all chunks for this document
            const chunks = await this.getDocumentChunks(documentId);
            
            // Create the export object
            return {
                metadata: document,
                chunks: chunks,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
        } catch (error) {
            console.error('Error exporting document:', error);
            throw error;
        }
    }
    
    /**
     * Delete a document and all its chunks
     * @param {number} documentId - Document ID
     * @returns {Promise<void>}
     */
    async deleteDocument(documentId) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents', 'chunks', 'metadata'], 'readwrite');
            const docStore = transaction.objectStore('documents');
            const chunkStore = transaction.objectStore('chunks');
            
            // Get chunk count first
            let chunkCount = 0;
            const countIndex = chunkStore.index('documentId');
            const countRequest = countIndex.count(IDBKeyRange.only(documentId));
            
            countRequest.onsuccess = () => {
                chunkCount = countRequest.result;
                
                // Delete document
                docStore.delete(documentId);
                
                // Delete all chunks for this document
                const index = chunkStore.index('documentId');
                const chunkRequest = index.openKeyCursor(IDBKeyRange.only(documentId));
                
                chunkRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        chunkStore.delete(cursor.primaryKey);
                        cursor.continue();
                    }
                };
                
                transaction.oncomplete = () => {
                    resolve();
                };
                
                transaction.onerror = (event) => {
                    reject(event.target.error);
                };
            };
        });
    }
    
    /**
     * Find similar chunks to a query embedding across multiple documents
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum number of results
     * @param {Array<number>|number|null} documentIds - Optional document ID(s) to search within
     * @returns {Promise<Array<Object>>} Similar chunks
     */
    async findSimilarChunks(queryEmbedding, limit = 5, documentIds = null) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks', 'documents'], 'readonly');
            const chunkStore = transaction.objectStore('chunks');
            const docStore = transaction.objectStore('documents');
            const allChunks = [];
            const documentTitles = {};
            
            // Convert documentIds to array if it's a single ID
            let docIdArray = documentIds;
            if (documentIds !== null && !Array.isArray(documentIds)) {
                docIdArray = [documentIds];
            }
            
            // Use the cursor to get all chunks
            const chunkCursor = chunkStore.openCursor();
                
            chunkCursor.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Only add chunk if it belongs to one of our documents or we're not filtering
                    if (docIdArray === null || docIdArray.includes(cursor.value.documentId)) {
                        allChunks.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    if (allChunks.length === 0) {
                        resolve([]);
                        return;
                    }
                    
                    // Get document titles for all chunks
                    const docIds = [...new Set(allChunks.map(chunk => chunk.documentId))];
                    let loadedCount = 0;
                    
                    docIds.forEach(id => {
                        const docRequest = docStore.get(id);
                        docRequest.onsuccess = () => {
                            if (docRequest.result) {
                                documentTitles[id] = docRequest.result.title || `Document ${id}`;
                            }
                            loadedCount++;
                            
                            // When all titles are loaded, calculate similarities
                            if (loadedCount === docIds.length) {
                                // Calculate similarity for all chunks
                                const similarities = allChunks.map(chunk => {
                                    const similarity = vectorizer.cosineSimilarity(queryEmbedding, chunk.embedding);
                                    return { 
                                        ...chunk, 
                                        similarity,
                                        documentTitle: documentTitles[chunk.documentId] || `Document ${chunk.documentId}`
                                    };
                                });
                                
                                // Group results by document to ensure balanced representation
                                const docResults = {};
                                docIdArray?.forEach(id => {
                                    docResults[id] = [];
                                });
                                
                                // Sort chunks by document and by similarity
                                similarities.forEach(chunk => {
                                    const docId = chunk.documentId;
                                    if (docIdArray === null || docIdArray.includes(docId)) {
                                        if (!docResults[docId]) {
                                            docResults[docId] = [];
                                        }
                                        docResults[docId].push(chunk);
                                    }
                                });
                                
                                // Sort each document's chunks by similarity
                                Object.values(docResults).forEach(chunks => {
                                    chunks.sort((a, b) => b.similarity - a.similarity);
                                });
                                
                                // Determine number of results to take from each document
                                const docsCount = Object.keys(docResults).length;
                                const perDocLimit = Math.max(1, Math.ceil(limit / docsCount));
                                
                                // Take top results from each document
                                const balancedResults = [];
                                Object.values(docResults).forEach(chunks => {
                                    balancedResults.push(...chunks.slice(0, perDocLimit));
                                });
                                
                                // Sort all results by similarity and take top ones
                                balancedResults.sort((a, b) => b.similarity - a.similarity);
                                
                                // Return top results, with a slight preference for balance
                                resolve(balancedResults.slice(0, limit));
                            }
                        };
                        
                        docRequest.onerror = (event) => {
                            console.error('Error loading document title:', event);
                            loadedCount++;
                            // Continue with other titles if one fails
                        };
                    });
                }
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get all chunks for a document by document ID
     * @param {number} documentId - Document ID
     * @returns {Promise<Array<Object>>} All chunks for the document
     */
    async getAllChunks(documentId) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readonly');
            const chunkStore = transaction.objectStore('chunks');
            const chunks = [];
            
            const index = chunkStore.index('documentId');
            index.openCursor(IDBKeyRange.only(documentId)).onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    chunks.push(cursor.value);
                    cursor.continue();
                }
            };
            
            transaction.oncomplete = () => {
                resolve(chunks);
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get a document by ID
     * @param {number} id - Document ID
     * @returns {Promise<Object>} Document metadata
     */
    async getDocument(id) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const docStore = transaction.objectStore('documents');
            
            const request = docStore.get(id);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get all document chunks
     * @param {number} documentId - Document ID
     * @returns {Promise<Array<Object>>} Document chunks
     */
    async getDocumentChunks(documentId) {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readonly');
            const chunkStore = transaction.objectStore('chunks');
            const chunks = [];
            
            const index = chunkStore.index('documentId');
            index.openCursor(IDBKeyRange.only(documentId)).onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    chunks.push(cursor.value);
                    cursor.continue();
                }
            };
            
            transaction.oncomplete = () => {
                resolve(chunks);
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get all documents
     * @returns {Promise<Array<Object>>} All documents
     */
    async getAllDocuments() {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const docStore = transaction.objectStore('documents');
            const documents = [];
            
            docStore.openCursor().onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    documents.push(cursor.value);
                    cursor.continue();
                }
            };
            
            transaction.oncomplete = () => {
                resolve(documents);
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get database statistics
     * @returns {Promise<Object>} Database statistics
     */
    async getStats() {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents', 'chunks', 'metadata'], 'readonly');
            const docStore = transaction.objectStore('documents');
            const chunkStore = transaction.objectStore('chunks');
            const metaStore = transaction.objectStore('metadata');
            const stats = {};
            
            const docCountRequest = docStore.count();
            docCountRequest.onsuccess = () => {
                stats.documentCount = docCountRequest.result;
            };
            
            const chunkCountRequest = chunkStore.count();
            chunkCountRequest.onsuccess = () => {
                stats.chunkCount = chunkCountRequest.result;
            };
            
            const lastUpdateRequest = metaStore.get('lastUpdate');
            lastUpdateRequest.onsuccess = () => {
                if (lastUpdateRequest.result) {
                    stats.lastUpdate = lastUpdateRequest.result.value;
                }
            };
            
            transaction.oncomplete = () => {
                resolve(stats);
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Clear all data
     * @returns {Promise<void>}
     */
    async clearDatabase() {
        await this.waitForReady();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['documents', 'chunks', 'metadata'], 'readwrite');
            const docStore = transaction.objectStore('documents');
            const chunkStore = transaction.objectStore('chunks');
            const metaStore = transaction.objectStore('metadata');
            
            docStore.clear();
            chunkStore.clear();
            metaStore.clear();
            
            transaction.oncomplete = () => {
                resolve();
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

const docDB = new DocumentDatabase();
