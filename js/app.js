document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseButton = document.getElementById('browseButton');
    const uploadSection = document.getElementById('uploadSection');
    const processingSection = document.getElementById('processingSection');
    const processingProgress = document.getElementById('processingProgress');
    const processingStatus = document.getElementById('processingStatus');
    const chatSection = document.getElementById('chatSection');
    const documentInfo = document.getElementById('documentInfo');
    const vectorStats = document.getElementById('vectorStats');
    const chatMessages = document.getElementById('chatMessages');
    const userQuestion = document.getElementById('userQuestion');
    const askButton = document.getElementById('askButton');
    const newDocumentBtn = document.getElementById('newDocumentBtn');
    const configApiButton = document.getElementById('configApiButton');
    const apiKeyModal = new bootstrap.Modal(document.getElementById('apiKeyModal'));
    const apiKeyInput = document.getElementById('apiKeyInput');
    const modelSelect = document.getElementById('modelSelect');
    const saveApiKey = document.getElementById('saveApiKey');
    
    // Add new DOM elements
    const libraryButton = document.getElementById('libraryButton');
    const libraryButton2 = document.getElementById('libraryButton2');
    const librarySection = document.getElementById('librarySection');
    const documentList = document.getElementById('documentList');
    const noDocumentsMessage = document.getElementById('noDocumentsMessage');
    const newDocumentBtn2 = document.getElementById('newDocumentBtn2');
    const exportEmbeddingsBtn = document.getElementById('exportEmbeddingsBtn');
    const importEmbeddingsBtn = document.getElementById('importEmbeddingsBtn');
    const importEmbeddingsModal = new bootstrap.Modal(document.getElementById('importEmbeddingsModal'));
    const embeddingsFileInput = document.getElementById('embeddingsFileInput');
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    
    // App state
    let isProcessingFile = false;
    let currentDocument = null;
    let initialized = false;
    let messageIdCounter = 0;
    // Add conversation history tracker
    let conversationHistory = [];
    
    // Setup event listeners
    function setupEventListeners() {
        // File drag & drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('highlight');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('highlight');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('highlight');
            
            if (isProcessingFile) return;
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });
        
        // Click handler for dropzone
        dropZone.addEventListener('click', (e) => {
            if (!e.target.closest('#browseButton')) {
                fileInput.click();
            }
        });
        
        // Browse button handler
        browseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        
        // File input change handler
        fileInput.addEventListener('change', (e) => {
            if (isProcessingFile) return;
            
            if (fileInput.files.length > 0) {
                processFile(fileInput.files[0]);
            }
        });
        
        // Ask question button
        askButton.addEventListener('click', () => {
            sendQuestion();
        });
        
        // Enter key in question input
        userQuestion.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendQuestion();
            }
        });
        
        // New document button
        newDocumentBtn.addEventListener('click', () => {
            showUploadSection();
        });
        
        // API key configuration
        configApiButton.addEventListener('click', () => {
            apiKeyInput.value = llmConnector.apiKey || '';
            modelSelect.value = llmConnector.model || 'gpt-3.5-turbo';
            apiKeyModal.show();
        });
        
        saveApiKey.addEventListener('click', () => {
            llmConnector.setApiKey(apiKeyInput.value.trim());
            llmConnector.setModel(modelSelect.value);
            apiKeyModal.hide();
            
            // Add confirmation message if an API key was provided
            if (llmConnector.isApiConfigured()) {
                addSystemMessage('API key saved. You can now ask questions about your document.');
            }
        });
        
        // Library buttons
        libraryButton.addEventListener('click', () => {
            showLibrarySection();
        });
        
        libraryButton2.addEventListener('click', () => {
            showLibrarySection();
        });
        
        newDocumentBtn2.addEventListener('click', () => {
            showUploadSection();
        });
        
        // Export embeddings button
        exportEmbeddingsBtn.addEventListener('click', async () => {
            if (!currentDocument) return;
            
            try {
                await exportDocumentEmbeddings(currentDocument.id);
            } catch (error) {
                console.error('Error exporting embeddings:', error);
                addErrorMessage(`Error exporting embeddings: ${error.message}`);
            }
        });
        
        // Import embeddings button
        importEmbeddingsBtn.addEventListener('click', () => {
            embeddingsFileInput.value = ''; // Reset the file input
            importEmbeddingsModal.show();
        });
        
        // Confirm import button
        confirmImportBtn.addEventListener('click', async () => {
            if (embeddingsFileInput.files.length === 0) {
                alert('Please select a file to import.');
                return;
            }
            
            try {
                const file = embeddingsFileInput.files[0];
                await importDocumentEmbeddings(file);
                importEmbeddingsModal.hide();
            } catch (error) {
                console.error('Error importing embeddings:', error);
                alert(`Error importing embeddings: ${error.message}`);
            }
        });
        
        // Clear chat button
        const clearChatBtn = document.getElementById('clearChatBtn');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', clearChat);
        }
    }
    
    // Process the uploaded file
    async function processFile(file) {
        if (isProcessingFile) return;
        
        // Check if file is too large (add a warning for extremely large files)
        const MAX_FILE_SIZE_WARNING = 50 * 1024 * 1024; // 50MB
        const MAX_FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB
        
        if (file.size > MAX_FILE_SIZE_LIMIT) {
            alert(`File is too large (${(file.size/1024/1024).toFixed(2)} MB). Maximum file size is ${MAX_FILE_SIZE_LIMIT/1024/1024} MB.`);
            return;
        }
        
        if (file.size > MAX_FILE_SIZE_WARNING) {
            const confirm = window.confirm(
                `This file is very large (${(file.size/1024/1024).toFixed(2)} MB) and may take a while to process. ` +
                `For best performance, consider splitting it into smaller files. ` +
                `\n\nDo you want to continue?`
            );
            if (!confirm) return;
        }
        
        // Check if file type is supported
        if (!documentProcessor.isFileSupported(file)) {
            alert('Unsupported file type. Please upload a text, Markdown, HTML, PDF, or CSV file.');
            return;
        }
        
        isProcessingFile = true;
        showProcessingSection();
        
        // Ensure UI is updated before starting intensive processing
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
            // Step 1: Extract text from file
            console.log(`Processing file: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`);
            updateProcessingStatus(0.1, 'Extracting text from document...');
            
            // Set timeout for very large files to prevent browser from showing "page unresponsive" dialog
            let extractionTimeout;
            if (file.size > 20 * 1024 * 1024) { // For files > 20MB
                const extractionPrompt = document.createElement('div');
                extractionPrompt.className = 'extraction-prompt';
                extractionPrompt.innerHTML = `
                    <div class="alert alert-info" style="position: fixed; bottom: 20px; right: 20px; max-width: 400px; z-index: 9999;">
                        <p><b>Processing large file...</b></p>
                        <p>This may take a while depending on your device's capabilities.</p>
                        <div class="progress mb-2">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
                        </div>
                        <p class="small text-muted">The browser may appear unresponsive during processing.</p>
                    </div>
                `;
                document.body.appendChild(extractionPrompt);
                
                extractionTimeout = setTimeout(() => {
                    // Update the prompt after 10 seconds for very large files
                    extractionPrompt.querySelector('p:first-child').innerHTML = 
                        `<b>Still working...</b> Processing a ${(file.size/1024/1024).toFixed(1)}MB file`;
                }, 10000);
            }
            
            // Extract text with improved progress reporting
            const text = await documentProcessor.extractTextFromFile(file, (progress, message) => {
                updateProcessingStatus(progress, message);
                // Ensure UI is updated by forcing a reflow
                void document.body.offsetHeight;
            });
            
            // Clean up extraction prompt if it exists
            if (extractionTimeout) {
                clearTimeout(extractionTimeout);
                const prompt = document.querySelector('.extraction-prompt');
                if (prompt) prompt.remove();
            }
            
            if (!text || text.trim().length === 0) {
                throw new Error('No text content found in the document.');
            }
            
            console.log(`Text extraction complete. Extracted ${text.length} characters`);
            
            // Log the first and last 100 characters to verify complete extraction
            console.log(`Text begins with: "${text.substring(0, 100)}..."`);
            console.log(`Text ends with: "...${text.substring(text.length - 100)}"`);
            
            // Step 2: Extract metadata
            updateProcessingStatus(0.5, 'Analyzing document...');
            const metadata = documentProcessor.extractMetadata(text, file);
            
            // Step 3: Chunk the document with intermediate UI updates
            updateProcessingStatus(0.6, 'Chunking document...');
            
            // For large texts, split the chunking process to allow UI updates
            let chunks;
            if (text.length > 1000000) { // For texts > 1MB
                updateProcessingStatus(0.6, 'Breaking down large document...');
                // Yield to the UI thread before starting chunking
                await new Promise(resolve => setTimeout(resolve, 50));
                chunks = await documentProcessor.chunkDocument(text, (progress, message) => {
                    // Map the chunking progress (0.6-0.7) to overall progress
                    const overallProgress = 0.6 + (progress - 0.4) * 0.1;
                    updateProcessingStatus(overallProgress, message);
                });
            } else {
                chunks = await documentProcessor.chunkDocument(text, updateProcessingStatus);
            }
            
            // Step 4: Vectorize chunks with better progress indication
            updateProcessingStatus(0.7, 'Preparing to generate embeddings...');
            
            // Yield to UI thread before starting vectorization
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const chunkTexts = chunks.map(chunk => chunk.text);
            
            // Ensure the vectorizer model is loaded
            updateProcessingStatus(0.71, 'Loading vectorization model...');
            await vectorizer.loadModel();
            
            // Generate embeddings with chunked processing for large datasets
            updateProcessingStatus(0.75, 'Generating embeddings...');
            
            let embeddings;
            const CHUNKS_PER_BATCH = 20; // Process 20 chunks at a time to prevent freezing
            
            if (chunkTexts.length > CHUNKS_PER_BATCH) {
                // For many chunks, process in batches to keep UI responsive
                embeddings = [];
                const totalBatches = Math.ceil(chunkTexts.length / CHUNKS_PER_BATCH);
                
                for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                    // Yield to UI between batches
                    if (batchIndex > 0) {
                        await new Promise(resolve => setTimeout(resolve, 30));
                    }
                    
                    const start = batchIndex * CHUNKS_PER_BATCH;
                    const end = Math.min(start + CHUNKS_PER_BATCH, chunkTexts.length);
                    const batchTexts = chunkTexts.slice(start, end);
                    
                    updateProcessingStatus(
                        0.75 + 0.2 * (batchIndex / totalBatches),
                        `Generating embeddings (batch ${batchIndex + 1}/${totalBatches})...`
                    );
                    
                    const batchEmbeddings = await vectorizer.vectorizeBatch(batchTexts);
                    embeddings.push(...batchEmbeddings);
                }
            } else {
                // For fewer chunks, process all at once
                embeddings = await vectorizer.vectorizeBatch(chunkTexts, (progress) => {
                    const overallProgress = 0.75 + (progress * 0.2);
                    updateProcessingStatus(overallProgress, 'Generating embeddings...');
                });
            }
            
            // Step 5: Prepare vectorized chunks
            updateProcessingStatus(0.95, 'Finalizing document processing...');
            const vectorizedChunks = chunks.map((chunk, index) => ({
                ...chunk,
                embedding: embeddings[index],
            }));
            
            // Step 6: Store in database
            updateProcessingStatus(0.98, 'Saving to database...');
            const documentId = await docDB.storeDocument(metadata, vectorizedChunks);
            metadata.id = documentId;
            
            // Update current document
            currentDocument = metadata;
            
            // Show chat interface
            updateProcessingStatus(1, 'Done!');
            showChatSection();
            updateDocumentInfo(metadata);
            
            // Add system message
            addSystemMessage(`I've analyzed the document "${metadata.title}"! Ask me anything about it.`);
            
            // Check if API key is configured, if not, prompt user
            if (!llmConnector.isApiConfigured()) {
                setTimeout(() => {
                    addSystemMessage('Please configure your API key to start asking questions.');
                    apiKeyModal.show();
                }, 1000);
            }
            
        } catch (error) {
            console.error('Error processing document:', error);
            addErrorMessage(`Error processing document: ${error.message}`);
            showUploadSection();
        } finally {
            isProcessingFile = false;
            
            // Perform garbage collection after processing large files
            if (window.gc) {
                try {
                    window.gc();
                } catch (e) {
                    console.log('Manual garbage collection not supported');
                }
            }
        }
    }
    
    // Update the processing status and progress bar
    function updateProcessingStatus(progress, message) {
        processingProgress.style.width = `${Math.round(progress * 100)}%`;
        processingStatus.textContent = message;
    }
    
    // Show the upload section
    function showUploadSection() {
        uploadSection.classList.remove('d-none');
        processingSection.classList.add('d-none');
        chatSection.classList.add('d-none');
        librarySection.classList.add('d-none');
    }
    
    // Show the processing section
    function showProcessingSection() {
        uploadSection.classList.add('d-none');
        processingSection.classList.remove('d-none');
        chatSection.classList.add('d-none');
        librarySection.classList.add('d-none');
        processingProgress.style.width = '0%';
        processingStatus.textContent = 'Analyzing document...';
    }
    
    // Show the chat section
    function showChatSection() {
        uploadSection.classList.add('d-none');
        processingSection.classList.add('d-none');
        chatSection.classList.remove('d-none');
        librarySection.classList.add('d-none');
    }
    
    // Show the library section
    async function showLibrarySection() {
        uploadSection.classList.add('d-none');
        processingSection.classList.add('d-none');
        chatSection.classList.add('d-none');
        librarySection.classList.remove('d-none');
        
        // Load and display documents
        await loadDocumentLibrary();
    }
    
    // Load the document library
    async function loadDocumentLibrary() {
        try {
            const documents = await docDB.getAllDocuments();
            documentList.innerHTML = '';
            
            if (documents.length === 0) {
                noDocumentsMessage.classList.remove('d-none');
                return;
            }
            
            noDocumentsMessage.classList.add('d-none');
            
            // Sort by date processed (newest first)
            documents.sort((a, b) => new Date(b.dateProcessed) - new Date(a.dateProcessed));
            
            // Render each document
            documents.forEach(doc => {
                const docElement = createDocumentElement(doc);
                documentList.appendChild(docElement);
            });
            
        } catch (error) {
            console.error('Error loading document library:', error);
        }
    }
    
    // Create a document element for the library
    function createDocumentElement(doc) {
        const docDiv = document.createElement('div');
        docDiv.className = 'list-group-item document-card';
        docDiv.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1">${doc.title}</h5>
                <div class="document-actions">
                    <button class="btn btn-sm btn-outline-danger delete-document" data-id="${doc.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="document-info mb-1">
                <span><i class="bi bi-file-text"></i> ${doc.wordCount.toLocaleString()} words</span>
                <span><i class="bi bi-calendar"></i> ${new Date(doc.dateProcessed).toLocaleDateString()}</span>
                ${doc.imported ? '<span class="badge bg-info">Imported</span>' : ''}
            </div>
        `;
        
        // Add click handler to open document
        docDiv.addEventListener('click', (e) => {
            // Ignore if clicked on delete button
            if (!e.target.closest('.delete-document')) {
                loadDocument(doc.id);
            }
        });
        
        // Add delete handler
        const deleteBtn = docDiv.querySelector('.delete-document');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent opening the document
                
                if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                    try {
                        await docDB.deleteDocument(doc.id);
                        docDiv.remove();
                        
                        // Check if library is now empty
                        if (documentList.children.length === 0) {
                            noDocumentsMessage.classList.remove('d-none');
                        }
                        
                        // If currently viewing this document, go back to library
                        if (currentDocument && currentDocument.id === doc.id) {
                            currentDocument = null;
                            showLibrarySection();
                        }
                    } catch (error) {
                        console.error('Error deleting document:', error);
                        alert(`Error deleting document: ${error.message}`);
                    }
                }
            });
        }
        
        return docDiv;
    }
    
    // Load a document from the library
    async function loadDocument(documentId) {
        try {
            // Show loading indicator
            showProcessingSection();
            processingStatus.textContent = 'Loading document...';
            processingProgress.style.width = '50%';
            
            // Get document and its chunks
            const document = await docDB.getDocument(documentId);
            if (!document) {
                throw new Error('Document not found');
            }
            
            // Set as current document
            currentDocument = document;
            
            // Show chat interface
            showChatSection();
            updateDocumentInfo(document);
            
            // Clear existing chat messages, except the first system message
            while (chatMessages.children.length > 1) {
                chatMessages.removeChild(chatMessages.lastChild);
            }
            
            // Add welcome message
            addSystemMessage(`Document "${document.title}" loaded! Ask me anything about it.`);
            
            // Clear conversation history when loading a new document
            conversationHistory = [];
            
        } catch (error) {
            console.error('Error loading document:', error);
            showLibrarySection();
            alert(`Error loading document: ${error.message}`);
        }
    }
    
    // Export document embeddings
    async function exportDocumentEmbeddings(documentId) {
        try {
            // Show loading indicator
            addSystemMessage('Preparing document for export...');
            
            // Get document with all chunks and embeddings
            const exportData = await docDB.exportDocument(documentId);
            
            // Save as JSON file
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `${exportData.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_embeddings.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            addSystemMessage('Document embeddings exported successfully!');
            
        } catch (error) {
            console.error('Error exporting document:', error);
            throw error;
        }
    }
    
    // Import document embeddings
    async function importDocumentEmbeddings(file) {
        try {
            // Show processing section while importing
            showProcessingSection();
            processingStatus.textContent = 'Importing document embeddings...';
            processingProgress.style.width = '30%';
            
            // Read the file
            const fileContent = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e.target.error);
                reader.readAsText(file);
            });
            
            processingProgress.style.width = '60%';
            processingStatus.textContent = 'Validating and storing embeddings...';
            
            // Parse and validate file contents
            const importData = JSON.parse(fileContent);
            
            // Import into database
            const documentId = await docDB.importDocument(importData);
            
            // Set as current document
            const document = await docDB.getDocument(documentId);
            currentDocument = document;
            
            // Show chat interface
            processingProgress.style.width = '100%';
            processingStatus.textContent = 'Import complete!';
            
            setTimeout(() => {
                showChatSection();
                updateDocumentInfo(document);
                addSystemMessage(`Imported document "${document.title}" with pre-calculated embeddings! Ask me anything about it.`);
            }, 800);
            
        } catch (error) {
            console.error('Error importing document:', error);
            processingStatus.textContent = `Import failed: ${error.message}`;
            processingProgress.style.width = '100%';
            processingProgress.classList.add('bg-danger');
            
            setTimeout(() => {
                showLibrarySection();
                processingProgress.classList.remove('bg-danger');
            }, 2000);
            
            throw error;
        }
    }
    
    // Update document information display
    async function updateDocumentInfo(document) {
        // Update document info
        documentInfo.innerHTML = `
            <h6 class="card-subtitle mb-2 text-muted">${document.title}</h6>
            <div class="document-stats">
                <div class="mb-2"><strong>Words:</strong> <span class="badge bg-secondary">${document.wordCount.toLocaleString()}</span></div>
                <div><strong>Type:</strong> <span class="badge bg-info">${document.fileType || 'Text document'}</span></div>
            </div>
        `;
        
        // Update vector stats
        const stats = await docDB.getStats();
        vectorStats.innerHTML = `
            <div class="text-muted small">
                <div class="mb-1"><strong>Chunks:</strong> <span class="badge bg-primary">${stats.chunkCount || 0}</span></div>
                <div><strong>Processed:</strong> <span>${new Date(document.dateProcessed).toLocaleString()}</span></div>
            </div>
        `;
    }
    
    // Add a message from the user to the chat
    function addUserMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message user';
        messageElement.innerHTML = `
            <div class="chat-bubble">
                <p>${escapeHtml(text)}</p>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }
    
    // Add a message from the assistant to the chat
    function addAssistantMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message assistant';
        messageElement.innerHTML = `
            <div class="chat-bubble">
                <p>${formatMessageText(text)}</p>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }
    
    // Add a system message to the chat
    function addSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message system';
        messageElement.innerHTML = `
            <div class="chat-bubble">
                <p>${text}</p>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }
    
    // Add an error message to the chat
    function addErrorMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message error';
        messageElement.innerHTML = `
            <div class="chat-bubble">
                <p>${text}</p>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }
    
    // Add a typing indicator to the chat
    function addTypingIndicator() {
        const messageId = messageIdCounter++;
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message assistant';
        messageElement.id = `message-${messageId}`;
        messageElement.innerHTML = `
            <div class="chat-bubble">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageId;
    }
    
    // Remove a message from the chat by ID
    function removeMessage(messageId) {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            messageElement.remove();
        }
    }
    
    // Format message text with markdown and citation highlighting
    function formatMessageText(text) {
        // First, escape HTML to prevent XSS
        let safeText = escapeHtml(text);
        
        // Replace citation markers [1], [2], etc. with highlighted spans
        safeText = safeText.replace(/\[(\d+)\]/g, '<span class="source-citation" onclick="showSourceText($1)">[$1]</span>');
        
        // Convert markdown to HTML using marked.js if available
        if (typeof marked !== 'undefined') {
            return marked.parse(safeText);
        }
        
        // Basic markdown-like formatting if marked.js is not available
        // Add paragraphs
        safeText = safeText.split('\n\n').map(p => `<p>${p}</p>`).join('');
        // Bold
        safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        safeText = safeText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return safeText;
    }
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Add a window function to handle citation clicks
    window.showSourceText = function(citationIndex) {
        if (!currentDocument) return;
        
        // Find the relevant chunk based on the citation index
        const relevantChunks = window.lastRelevantChunks;
        if (!relevantChunks || citationIndex <= 0 || citationIndex > relevantChunks.length) {
            console.warn(`Citation index ${citationIndex} is out of range`);
            return;
        }
        
        const chunk = relevantChunks[citationIndex - 1];
        
        // Create or update the source modal
        let sourceModal = document.getElementById('sourceTextModal');
        if (!sourceModal) {
            // Create the modal if it doesn't exist
            const modalHTML = `
            <div class="modal fade" id="sourceTextModal" tabindex="-1" aria-labelledby="sourceTextModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="sourceTextModalLabel">Source Text</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="sourceTextContent" class="p-3 bg-light"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            sourceModal = document.getElementById('sourceTextModal');
        }
        
        // Update the modal content
        const sourceTextContent = document.getElementById('sourceTextContent');
        sourceTextContent.innerHTML = `
            <div class="mb-2"><strong>Source [${citationIndex}]:</strong></div>
            <div class="source-text">${escapeHtml(chunk.text)}</div>
            ${chunk.similarity ? `<div class="mt-2 text-muted small">Relevance: ${(chunk.similarity * 100).toFixed(1)}%</div>` : ''}
        `;
        
        // Show the modal
        const modal = new bootstrap.Modal(sourceModal);
        modal.show();
    };

    // Send a question to the LLM
    async function sendQuestion() {
        const question = userQuestion.value.trim();
        if (!question || !currentDocument) return;
        
        // Add user message to chat
        addUserMessage(question);
        userQuestion.value = '';
        
        // Add assistant typing indicator
        const typingMsgId = addTypingIndicator();
        
        try {
            // Check if API key is configured
            if (!llmConnector.isApiConfigured()) {
                removeMessage(typingMsgId);
                addErrorMessage('Please configure your API key first.');
                apiKeyModal.show();
                return;
            }
            
            // Step 1: Convert question to embedding
            const questionEmbedding = await vectorizer.vectorize(question);
            
            // Step 2: Find relevant chunks using two methods
            
            // Method A: Traditional embedding similarity search
            const embeddingChunks = await docDB.findSimilarChunks(questionEmbedding, 5, currentDocument.id);
            
            // Method B: Term-based search
            const allDocumentChunks = await docDB.getAllChunks(currentDocument.id);
            const termBasedChunks = termSearch.search(question, allDocumentChunks, 5);
            
            // Step 3: Merge results for better coverage
            const mergedChunks = mergeSearchResults(embeddingChunks, termBasedChunks);
            
            // Store in window object for citation reference
            window.lastRelevantChunks = mergedChunks;
            window.embeddingChunks = embeddingChunks; // Store for debugging
            window.termBasedChunks = termBasedChunks; // Store for debugging
            
            // If no chunks were found, show an error
            if (mergedChunks.length === 0) {
                removeMessage(typingMsgId);
                addAssistantMessage("I couldn't find any relevant information in the document to answer your question.");
                return;
            }
            
            // Log the search results for analysis
            console.log('Embedding search results:', embeddingChunks.map(c => ({
                similarity: c.similarity.toFixed(3),
                text: c.text.substring(0, 100) + '...'
            })));
            
            console.log('Term-based search results:', termBasedChunks.map(c => ({
                termScore: c.termScore.toFixed(3),
                terms: c.terms,
                text: c.text.substring(0, 100) + '...'
            })));
            
            console.log('Merged results:', mergedChunks.map(c => ({
                score: c.mergedScore ? c.mergedScore.toFixed(3) : 'N/A',
                text: c.text.substring(0, 100) + '...'
            })));
            
            // Step 4: Generate answer using LLM with streaming
            let currentResponseText = '';
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message assistant';
            
            // Start with an empty bubble that will be updated as the response comes in
            messageElement.innerHTML = `
                <div class="chat-bubble">
                    <p></p>
                </div>
            `;
            
            // Replace typing indicator with actual message element
            removeMessage(typingMsgId);
            chatMessages.appendChild(messageElement);
            
            // Add question to conversation history
            conversationHistory.push({
                role: 'user',
                content: question
            });
            
            // Use streaming to update the message as the response comes in
            await llmConnector.getAnswer(question, mergedChunks, (delta, fullText) => {
                currentResponseText = fullText;
                const paragraphElement = messageElement.querySelector('p');
                paragraphElement.innerHTML = formatMessageText(fullText);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, conversationHistory);
            
            // Add response to conversation history
            conversationHistory.push({
                role: 'assistant', 
                content: currentResponseText
            });
            
            // Limit conversation history to last 10 exchanges (5 user questions and 5 assistant responses)
            if (conversationHistory.length > 10) {
                conversationHistory = conversationHistory.slice(conversationHistory.length - 10);
            }
            
            // Memory cleanup - safely check if memoryManager exists and handle errors
            try {
                if (typeof memoryManager !== 'undefined') {
                    memoryManager.cleanupMemory();
                } else {
                    // Fallback memory cleanup if memoryManager is not available
                    console.log('Using fallback memory cleanup');
                    if (typeof tf !== 'undefined') {
                        try {
                            const engine = tf.engine();
                            if (engine && typeof engine.endScope === 'function') {
                                engine.endScope();
                            }
                            if (engine && typeof engine.startScope === 'function') {
                                engine.startScope();
                            }
                        } catch (e) {
                            console.warn('Error in fallback memory cleanup:', e);
                        }
                    }
                }
            } catch (memoryError) {
                console.warn('Error during memory cleanup:', memoryError);
                // Continue execution, don't block the main flow for memory cleanup errors
            }
            
        } catch (error) {
            console.error('Error answering question:', error);
            removeMessage(typingMsgId);
            addErrorMessage(`Error: ${error.message}. Please try again.`);
        }
    }
    
    /**
     * Merge and rerank search results from multiple methods
     * @param {Array<Object>} embeddingResults - Results from embedding similarity search
     * @param {Array<Object>} termResults - Results from term-based search
     * @returns {Array<Object>} Merged and reranked results
     */
    function mergeSearchResults(embeddingResults, termResults) {
        // Create a map to track chunks by ID to avoid duplicates
        const chunkMap = new Map();
        
        // Process embedding results
        embeddingResults.forEach((chunk, index) => {
            chunkMap.set(chunk.id, {
                ...chunk,
                embeddingRank: index + 1,
                embeddingScore: chunk.similarity
            });
        });
        
        // Process term-based results
        termResults.forEach((chunk, index) => {
            if (chunkMap.has(chunk.id)) {
                // Update existing chunk with term-based scores
                const existingChunk = chunkMap.get(chunk.id);
                chunkMap.set(chunk.id, {
                    ...existingChunk,
                    termRank: index + 1,
                    termScore: chunk.termScore,
                    terms: chunk.terms
                });
            } else {
                // Add new chunk from term-based search
                chunkMap.set(chunk.id, {
                    ...chunk,
                    termRank: index + 1,
                    termScore: chunk.termScore,
                    similarity: 0
                });
            }
        });
        
        // Calculate a combined score for each chunk
        const combinedResults = Array.from(chunkMap.values()).map(chunk => {
            // Default values if a method didn't find this chunk
            const embeddingRank = chunk.embeddingRank || (embeddingResults.length + 1);
            const termRank = chunk.termRank || (termResults.length + 1);
            const embeddingScore = chunk.embeddingScore || 0;
            const termScore = chunk.termScore || 0;
            
            // Combined score (weighted sum of normalized scores)
            const normalizedEmbeddingScore = embeddingScore;
            const normalizedTermScore = termScore / 3; // Scale term scores
            
            // Merged score - 60% embedding, 40% term-based
            const mergedScore = (normalizedEmbeddingScore * 0.6) + (normalizedTermScore * 0.4);
            
            // Rank boost if found by both methods
            const rankBoost = chunk.embeddingRank && chunk.termRank ? 0.1 : 0;
            
            return {
                ...chunk,
                mergedScore: mergedScore + rankBoost
            };
        });
        
        // Sort by merged score (descending)
        combinedResults.sort((a, b) => b.mergedScore - a.mergedScore);
        
        // Return top chunks (max of 5)
        return combinedResults.slice(0, 5);
    }

    // Function to clear the chat history
    function clearChat() {
        // Keep only the first system welcome message
        while (chatMessages.children.length > 1) {
            chatMessages.removeChild(chatMessages.lastChild);
        }
        
        // Clear conversation history when chat is cleared
        conversationHistory = [];
        
        // Add a system message that the chat was cleared
        addSystemMessage('Chat history cleared. You can ask new questions about the document.');
    }

    // Update the handleFiles function to identify Excel files
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        const fileType = file.name.split('.').pop().toLowerCase();
        
        // Show CSV analyzer for CSV and Excel files
        if (fileType === 'csv' || fileType === 'xlsx' || fileType === 'xls') {
            // Initialize and open CSV analyzer
            processDocument(file);
        } else {
            // Regular document processing
            processDocument(file);
        }
    }

    // Initialize app (only once)
    async function init() {
        if (initialized) return;
        initialized = true;
        
        setupEventListeners();
        
        try {
            // Pre-load TensorFlow.js model
            await vectorizer.loadModel();
            
            // Check if any documents exist in the database
            const documents = await docDB.getAllDocuments();
            if (documents.length > 0) {
                // Show library instead of loading the most recent document
                showLibrarySection();
            }
            
        } catch (error) {
            console.error('Error initializing app:', error);
            // Continue anyway - we'll handle errors later
        }
    }
    
    // Start the app
    init();
});
