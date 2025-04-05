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
    const selectAllDocs = document.getElementById('selectAllDocs');
    const selectNoneDocs = document.getElementById('selectNoneDocs');
    const documentSelectionList = document.getElementById('documentSelectionList');
    const processQueueBtn = document.getElementById('processQueueBtn');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const uploadQueue = document.getElementById('uploadQueue');
    const queuedFiles = document.getElementById('queuedFiles');
    
    // App state
    let isProcessingFile = false;
    let currentDocument = null;
    let initialized = false;
    let messageIdCounter = 0;
    let conversationHistory = [];
    let selectedDocuments = [];
    let availableDocuments = [];
    let lastQueryEmbedding = null;
    let lastRelevantDocuments = [];
    let lastQueryTerms = [];
    let fileQueue = [];
    let isProcessingQueue = false;

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
                addFilesToQueue(files);
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
                addFilesToQueue(fileInput.files);
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
        
        // Add new document selection event listeners
        if (selectAllDocs) {
            selectAllDocs.addEventListener('click', () => {
                selectAllDocuments();
            });
        }
        
        if (selectNoneDocs) {
            selectNoneDocs.addEventListener('click', () => {
                deselectAllDocuments();
            });
        }

        // Add queue processing button handler
        if (processQueueBtn) {
            processQueueBtn.addEventListener('click', () => {
                processNextInQueue();
            });
        }
        
        // Add clear queue button handler
        if (clearQueueBtn) {
            clearQueueBtn.addEventListener('click', () => {
                clearFileQueue();
            });
        }
    }
    
    function addFilesToQueue(files) {
        uploadQueue.classList.remove('d-none');
        
        Array.from(files).forEach(file => {
            if (file.size > 100 * 1024 * 1024) {
                showFileError(file, 'File is too large (max 100MB)');
                return;
            }
            
            if (!documentProcessor.isFileSupported(file)) {
                showFileError(file, 'Unsupported file type');
                return;
            }
            
            const queueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const queueItem = {
                id: queueId,
                file: file,
                status: 'queued',
                progress: 0
            };
            
            fileQueue.push(queueItem);
            
            const fileElement = createQueuedFileElement(queueItem);
            queuedFiles.appendChild(fileElement);
        });
        
        if (!isProcessingQueue && !isProcessingFile) {
            processNextInQueue();
        }
    }
    
    function createQueuedFileElement(queueItem) {
        const file = queueItem.file;
        const fileElement = document.createElement('div');
        fileElement.className = 'queued-file';
        fileElement.id = `queue-item-${queueItem.id}`;
        
        let fileIcon = 'file-text';
        if (file.name.endsWith('.pdf')) {
            fileIcon = 'file-pdf';
        } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            fileIcon = 'file-spreadsheet';
        } else if (file.name.endsWith('.md')) {
            fileIcon = 'markdown';
        } else if (file.name.endsWith('.html')) {
            fileIcon = 'code-slash';
        }
        
        fileElement.innerHTML = `
            <div class="file-icon">
                <i class="bi bi-${fileIcon}"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
                <div class="file-progress">
                    <div class="file-progress-bar" style="width: 0%"></div>
                </div>
            </div>
            <div class="file-status">Queued</div>
            <div class="file-actions">
                <button class="btn btn-sm btn-link text-danger remove-file" aria-label="Remove file">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
        
        const removeBtn = fileElement.querySelector('.remove-file');
        removeBtn.addEventListener('click', () => {
            removeFromQueue(queueItem.id);
        });
        
        return fileElement;
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    function removeFromQueue(queueId) {
        fileQueue = fileQueue.filter(item => item.id !== queueId);
        
        const fileElement = document.getElementById(`queue-item-${queueId}`);
        if (fileElement) {
            fileElement.remove();
        }
        
        if (fileQueue.length === 0) {
            uploadQueue.classList.add('d-none');
        }
    }
    
    function clearFileQueue() {
        if (isProcessingQueue || isProcessingFile) {
            const confirm = window.confirm('Processing is in progress. Are you sure you want to clear the queue?');
            if (!confirm) return;
        }
        
        fileQueue = [];
        queuedFiles.innerHTML = '';
        uploadQueue.classList.add('d-none');
        isProcessingQueue = false;
    }
    
    function processNextInQueue() {
        if (isProcessingFile || fileQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }
        
        isProcessingQueue = true;
        
        const nextItem = fileQueue.find(item => item.status === 'queued');
        
        if (!nextItem) {
            isProcessingQueue = false;
            return;
        }
        
        updateQueueItemStatus(nextItem.id, 'processing');
        
        processFile(nextItem.file, nextItem.id)
            .then(() => {
                updateQueueItemStatus(nextItem.id, 'completed');
                
                setTimeout(() => {
                    processNextInQueue();
                }, 500);
            })
            .catch(error => {
                console.error('Error processing file:', error);
                updateQueueItemStatus(nextItem.id, 'error', error.message);
                
                setTimeout(() => {
                    processNextInQueue();
                }, 500);
            });
    }
    
    function updateQueueItemStatus(queueId, status, errorMessage = null) {
        const queueItem = fileQueue.find(item => item.id === queueId);
        if (queueItem) {
            queueItem.status = status;
        }
        
        const fileElement = document.getElementById(`queue-item-${queueId}`);
        if (!fileElement) return;
        
        fileElement.classList.remove('queued', 'processing', 'completed', 'error');
        fileElement.classList.add(status);
        
        const statusElement = fileElement.querySelector('.file-status');
        
        if (status === 'queued') {
            statusElement.textContent = 'Queued';
        } else if (status === 'processing') {
            statusElement.textContent = 'Processing...';
        } else if (status === 'completed') {
            statusElement.innerHTML = '<i class="bi bi-check-circle text-success"></i> Completed';
        } else if (status === 'error') {
            statusElement.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Error';
            if (errorMessage) {
                fileElement.setAttribute('title', errorMessage);
                fileElement.setAttribute('data-bs-toggle', 'tooltip');
                fileElement.setAttribute('data-bs-placement', 'top');
                new bootstrap.Tooltip(fileElement);
            }
        }
    }
    
    function updateQueueItemProgress(queueId, progress, message = null) {
        const queueItem = fileQueue.find(item => item.id === queueId);
        if (queueItem) {
            queueItem.progress = progress;
        }
        
        const fileElement = document.getElementById(`queue-item-${queueId}`);
        if (!fileElement) return;
        
        const progressBar = fileElement.querySelector('.file-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.round(progress * 100)}%`;
        }
        
        if (message) {
            const statusElement = fileElement.querySelector('.file-status');
            statusElement.textContent = message;
        }
    }
    
    function showFileError(file, errorMessage) {
        uploadQueue.classList.remove('d-none');
        
        const queueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const fileElement = document.createElement('div');
        fileElement.className = 'queued-file error';
        fileElement.id = `queue-item-${queueId}`;
        
        fileElement.innerHTML = `
            <div class="file-icon">
                <i class="bi bi-file-text"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-status">
                <i class="bi bi-exclamation-circle text-danger"></i> ${errorMessage}
            </div>
            <div class="file-actions">
                <button class="btn btn-sm btn-link text-danger remove-file" aria-label="Remove file">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
        
        const removeBtn = fileElement.querySelector('.remove-file');
        removeBtn.addEventListener('click', () => {
            fileElement.remove();
            
            if (queuedFiles.children.length === 0) {
                uploadQueue.classList.add('d-none');
            }
        });
        
        queuedFiles.appendChild(fileElement);
    }
    
    // Process the uploaded file
    async function processFile(file, queueId = null) {
        if (isProcessingFile && !queueId) return;
        
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
        
        if (!queueId) {
            showProcessingSection();
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
            console.log(`Processing file: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`);
            
            const updateProgress = (progress, message) => {
                if (queueId) {
                    updateQueueItemProgress(queueId, progress, message);
                } else {
                    updateProcessingStatus(progress, message);
                }
            };
            
            // Step 1: Extract text from file
            updateProgress(0.1, 'Extracting text from document...');
            
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
                updateProgress(progress, message);
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
            updateProgress(0.5, 'Analyzing document...');
            const metadata = documentProcessor.extractMetadata(text, file);
            
            // Step 3: Chunk the document with intermediate UI updates
            updateProgress(0.6, 'Chunking document...');
            
            // For large texts, split the chunking process to allow UI updates
            let chunks;
            if (text.length > 1000000) { // For texts > 1MB
                updateProgress(0.6, 'Breaking down large document...');
                // Yield to the UI thread before starting chunking
                await new Promise(resolve => setTimeout(resolve, 50));
                chunks = await documentProcessor.chunkDocument(text, (progress, message) => {
                    // Map the chunking progress (0.6-0.7) to overall progress
                    const overallProgress = 0.6 + (progress - 0.4) * 0.1;
                    updateProgress(overallProgress, message);
                });
            } else {
                chunks = await documentProcessor.chunkDocument(text, updateProgress);
            }
            
            // Step 4: Vectorize chunks with better progress indication
            updateProgress(0.7, 'Preparing to generate embeddings...');
            
            // Yield to UI thread before starting vectorization
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const chunkTexts = chunks.map(chunk => chunk.text);
            
            // Ensure the vectorizer model is loaded
            updateProgress(0.71, 'Loading vectorization model...');
            await vectorizer.loadModel();
            
            // Generate embeddings with chunked processing for large datasets
            updateProgress(0.75, 'Generating embeddings...');
            
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
                    
                    updateProgress(
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
                    updateProgress(overallProgress, 'Generating embeddings...');
                });
            }
            
            // Step 5: Prepare vectorized chunks
            updateProgress(0.95, 'Finalizing document processing...');
            const vectorizedChunks = chunks.map((chunk, index) => ({
                ...chunk,
                embedding: embeddings[index],
            }));
            
            // Step 6: Store in database
            updateProgress(0.98, 'Saving to database...');
            const documentId = await docDB.storeDocument(metadata, vectorizedChunks);
            metadata.id = documentId;
            
            // Update current document
            currentDocument = metadata;
            
            // Show chat interface
            updateProgress(1, 'Done!');
            
            if (!queueId) {
                showChatSection();
                updateDocumentInfo(metadata);
                addSystemMessage(`I've analyzed the document "${metadata.title}"! Ask me anything about it.`);
                
                // Check if API key is configured, if not, prompt user
                if (!llmConnector.isApiConfigured()) {
                    setTimeout(() => {
                        addSystemMessage('Please configure your API key to start asking questions.');
                        apiKeyModal.show();
                    }, 1000);
                }
            }
            
            return documentId;
        } catch (error) {
            console.error('Error processing document:', error);
            
            if (!queueId) {
                addErrorMessage(`Error processing document: ${error.message}`);
                showUploadSection();
            }
            
            throw error;
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
        
        // Load available documents for selection panel
        loadDocumentSelectionPanel();
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
            
            // Add to selected documents list if not already there
            if (!selectedDocuments.includes(document.id)) {
                selectedDocuments.push(document.id);
            }
            
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
        if (!question) return;
        
        // Check if any documents are selected
        if (selectedDocuments.length === 0) {
            addErrorMessage('Please select at least one document to ask questions about.');
            return;
        }
        
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
            
            // Extract terms for possible fallback search
            const originalTerms = termSearch.extractTerms(question);
            // Store for context persistence
            lastQueryTerms = originalTerms;
            
            // Call the search function with fallback handling and context awareness
            const searchResults = await performSearchWithFallbacks(
                question, 
                selectedDocuments, 
                conversationHistory,
                originalTerms
            );
            
            if (!searchResults || searchResults.chunks.length === 0) {
                removeMessage(typingMsgId);
                addAssistantMessage("I couldn't find any relevant information in the selected documents to answer your question.");
                return;
            }
            
            // Update document relevance tracking
            updateLastRelevantDocuments(searchResults.chunks);
            
            // If we have results from fallback search, inform the user
            if (searchResults.usedFallback) {
                removeMessage(typingMsgId);
                const fallbackMessage = document.createElement('div');
                fallbackMessage.className = 'chat-message system';
                fallbackMessage.innerHTML = `
                    <div class="chat-bubble">
                        <p>I couldn't find exact matches for your question, but I found some potentially related information.</p>
                    </div>
                `;
                chatMessages.appendChild(fallbackMessage);
                scrollChatToBottom();
                
                // Add a new typing indicator
                typingMsgId = addTypingIndicator();
            }
            
            // Store in window object for citation reference
            window.lastRelevantChunks = searchResults.chunks;
            
            // Get document sources for the chunks
            const docSources = [...new Set(searchResults.chunks.map(c => c.documentId))];
            
            // Generate answer using LLM with streaming
            let currentResponseText = '';
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message assistant';
            
            // Start with an empty bubble that will be updated as the response comes in
            messageElement.innerHTML = `
                <div class="chat-bubble">
                    <p></p>
                    ${docSources.length > 1 ? 
                        `<div class="document-indicator">
                            Using information from ${docSources.length} documents
                        </div>` : ''}
                </div>
            `;
            
            // Replace typing indicator with actual message element
            removeMessage(typingMsgId);
            chatMessages.appendChild(messageElement);
            scrollChatToBottom();
            
            // Add question to conversation history
            conversationHistory.push({
                role: 'user',
                content: question
            });
            
            // Use streaming to update the message as the response comes in
            await llmConnector.getAnswer(question, searchResults.chunks, (delta, fullText) => {
                currentResponseText = fullText;
                const paragraphElement = messageElement.querySelector('p');
                paragraphElement.innerHTML = formatMessageText(fullText);
                scrollChatToBottom();
            }, conversationHistory);
            
            // Add document sources if using multiple documents
            if (docSources.length > 1) {
                const documentNames = await Promise.all(docSources.map(async docId => {
                    const doc = await docDB.getDocument(docId);
                    return doc ? doc.title : `Document ${docId}`;
                }));
                
                const documentIndicator = messageElement.querySelector('.document-indicator');
                if (documentIndicator) {
                    documentIndicator.innerHTML = `
                        Sources: ${documentNames.map(name => 
                            `<span class="document-tag">${name}</span>`).join(' ')}
                    `;
                }
            }
            
            // Add response to conversation history
            conversationHistory.push({
                role: 'assistant', 
                content: currentResponseText
            });
            
            // Limit conversation history to last 10 exchanges
            if (conversationHistory.length > 10) {
                conversationHistory = conversationHistory.slice(conversationHistory.length - 10);
            }
            
            // Memory cleanup
            try {
                if (typeof memoryManager !== 'undefined') {
                    memoryManager.cleanupMemory();
                }
            } catch (memoryError) {
                console.warn('Error during memory cleanup:', memoryError);
            }
            
        } catch (error) {
            console.error('Error answering question:', error);
            removeMessage(typingMsgId);
            addErrorMessage(`Error: ${error.message}. Please try again.`);
        }
    }
    
    /**
     * Update tracking of relevant documents to maintain context across queries
     * @param {Array<Object>} chunks - Chunks that were relevant to the query
     */
    function updateLastRelevantDocuments(chunks) {
        // Track unique document IDs that contained relevant chunks
        const docIds = [...new Set(chunks.map(chunk => chunk.documentId))];
        
        // Get chunk counts per document
        const docChunkCounts = {};
        docIds.forEach(docId => {
            docChunkCounts[docId] = chunks.filter(chunk => chunk.documentId === docId).length;
        });
        
        // Store with document ID and relevance score (based on chunk count)
        lastRelevantDocuments = docIds.map(docId => ({
            documentId: docId,
            relevanceScore: docChunkCounts[docId] / chunks.length
        }));
        
        console.log('Updated relevant documents tracking:', lastRelevantDocuments);
    }

    /**
     * Perform search with fallback strategies
     * @param {string} question - User's question
     * @param {Array<number>} documentIds - Selected document IDs
     * @param {Array<Object>} conversationHistory - Previous conversation
     * @param {Array<string>} originalTerms - Original search terms
     * @returns {Promise<{chunks: Array<Object>, usedFallback: boolean}>} Search results with metadata
     */
    async function performSearchWithFallbacks(question, documentIds, conversationHistory, originalTerms) {
        // Step 1: Try initial standard search with contextual awareness
        console.log('Performing context-aware search...');
        let searchResults = await performStandardSearch(question, documentIds, true);
        
        // Return immediately if we found good results
        if (searchResults.chunks.length > 0) {
            return {
                chunks: searchResults.chunks,
                usedFallback: false
            };
        }
        
        // Step 2: If no results, try without context awareness (fresh search)
        console.log('No results with context. Trying standard search...');
        searchResults = await performStandardSearch(question, documentIds, false);
        
        if (searchResults.chunks.length > 0) {
            return {
                chunks: searchResults.chunks,
                usedFallback: false
            };
        }
        
        // Step 3: If still no results, try fallback with related terms
        console.log('No results found, trying related terms...');
        const relatedTerms = await llmConnector.findRelatedTerms(question, originalTerms, conversationHistory);
        console.log('Related terms:', relatedTerms);
        
        if (relatedTerms && relatedTerms.length > 0) {
            // Create expanded question using related terms
            const expandedQuestion = `${question} ${relatedTerms.join(' ')}`;
            searchResults = await performStandardSearch(expandedQuestion, documentIds, false);
            
            if (searchResults.chunks.length > 0) {
                return {
                    chunks: searchResults.chunks,
                    usedFallback: true
                };
            }
        }
        
        // No results even with expanded search
        return {
            chunks: [],
            usedFallback: false
        };
    }
    
    /**
     * Perform the standard search process
     * @param {string} question - User's question
     * @param {Array<number>} documentIds - Selected document IDs
     * @param {boolean} useContext - Whether to use context from previous queries
     * @returns {Promise<{chunks: Array<Object>}>} Search results
     */
    async function performStandardSearch(question, documentIds, useContext = true) {
        // Step 1: Calculate query similarity with previous query if useContext is true
        const questionEmbedding = await vectorizer.vectorize(question);
        let queryContextualScore = 0;
        
        // Check if current query is similar to the previous one
        if (useContext && lastQueryEmbedding) {
            queryContextualScore = vectorizer.cosineSimilarity(questionEmbedding, lastQueryEmbedding);
            console.log('Query similarity with previous:', queryContextualScore);
        }
        
        // Update the last query embedding for future reference
        lastQueryEmbedding = questionEmbedding;
        
        // Prioritize documents that were relevant for similar queries
        const prioritizedDocIds = [...documentIds];
        
        // If query is contextually related (similarity > 0.7) and we have previous relevant documents
        const isContextualFollow = queryContextualScore > 0.7 && lastRelevantDocuments.length > 0;
        
        if (useContext && isContextualFollow) {
            console.log('Using contextual document prioritization for follow-up query');
            
            // Custom search approach for contextual queries
            const embeddingChunks = await docDB.findSimilarChunks(questionEmbedding, 8, documentIds);
            
            // Prioritize chunks from previously relevant documents
            const relevantDocIds = lastRelevantDocuments.map(doc => doc.documentId);
            const prioritizedChunks = embeddingChunks.map(chunk => {
                // Boost score for chunks from recently relevant documents
                const docRelevance = lastRelevantDocuments.find(d => d.documentId === chunk.documentId);
                const contextBoost = docRelevance ? docRelevance.relevanceScore * 0.15 : 0;
                
                return {
                    ...chunk,
                    similarity: chunk.similarity + contextBoost,
                    boostedForContext: !!docRelevance
                };
            });
            
            // Resort after boosting
            prioritizedChunks.sort((a, b) => b.similarity - a.similarity);
            
            // Special term-based search targeting relevant documents first
            let allSelectedChunks = [];
            
            // First get chunks from previously relevant documents
            for (const docId of relevantDocIds) {
                if (documentIds.includes(docId)) {
                    const docChunks = await docDB.getAllChunks(docId);
                    allSelectedChunks = [...allSelectedChunks, ...docChunks];
                }
            }
            
            // Then get chunks from other documents if needed
            const otherDocIds = documentIds.filter(id => !relevantDocIds.includes(id));
            for (const docId of otherDocIds) {
                const docChunks = await docDB.getAllChunks(docId);
                allSelectedChunks = [...allSelectedChunks, ...docChunks];
            }
            
            const termBasedChunks = termSearch.search(question, allSelectedChunks, 8);
            
            // Merge results with contextual awareness
            const mergedChunks = mergeSearchResults(prioritizedChunks, termBasedChunks, isContextualFollow);
            
            // If we have enough chunks, return them
            if (mergedChunks.length > 0) {
                // Debug what documents the chunks came from
                const resultDocumentCounts = {};
                mergedChunks.forEach(chunk => {
                    resultDocumentCounts[chunk.documentId] = (resultDocumentCounts[chunk.documentId] || 0) + 1;
                });
                console.log('Chunks per document in contextual results:', resultDocumentCounts);
                
                return {
                    chunks: mergedChunks
                };
            }
        }
        
        // Fall back to standard search if contextual approach failed or wasn't used
        console.log('Using standard search approach');
        
        // Method A: Traditional embedding similarity search
        const embeddingChunks = await docDB.findSimilarChunks(questionEmbedding, 8, documentIds);
        
        // Method B: Term-based search
        // Gather chunks from all selected documents
        let allSelectedChunks = [];
        for (const docId of documentIds) {
            const docChunks = await docDB.getAllChunks(docId);
            allSelectedChunks = [...allSelectedChunks, ...docChunks];
        }
        const termBasedChunks = termSearch.search(question, allSelectedChunks, 8);
        
        // Step 3: Merge results for better coverage
        const mergedChunks = mergeSearchResults(embeddingChunks, termBasedChunks);
        
        // Step 4: For large result sets, perform multi-stage processing
        if (mergedChunks.length > 5) {
            return await processLargeResultSet(question, mergedChunks, conversationHistory);
        }
        
        // Store debugging info
        window.embeddingChunks = embeddingChunks;
        window.termBasedChunks = termBasedChunks;
        
        return {
            chunks: mergedChunks
        };
    }

    /**
     * Merge and rerank search results from multiple methods
     * @param {Array<Object>} embeddingResults - Results from embedding similarity search
     * @param {Array<Object>} termResults - Results from term-based search
     * @param {boolean} isContextualQuery - Whether this is a contextual follow-up query
     * @returns {Array<Object>} Merged and reranked results
     */
    function mergeSearchResults(embeddingResults, termResults, isContextualQuery = false) {
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
            
            // Combined score with increased weight for term-based results and exact matches
            const normalizedEmbeddingScore = embeddingScore;
            const normalizedTermScore = termScore / 2; // Scale term scores
            
            // Merged score - 50% embedding, 50% term-based (increased from 40%)
            const mergedScore = (normalizedEmbeddingScore * 0.5) + (normalizedTermScore * 0.5);
            
            // Rank boost if found by both methods
            const rankBoost = chunk.embeddingRank && chunk.termRank ? 0.15 : 0;
            
            // Apply contextual boost if available
            const contextBoost = chunk.boostedForContext ? 0.1 : 0;
            
            return {
                ...chunk,
                mergedScore: mergedScore + rankBoost + contextBoost
            };
        });
        
        // Group by document ID
        const docGroups = {};
        combinedResults.forEach(chunk => {
            const docId = chunk.documentId;
            if (!docGroups[docId]) {
                docGroups[docId] = [];
            }
            docGroups[docId].push(chunk);
        });
        
        // Debug document representation
        console.log('Document representation in search results:', 
            Object.entries(docGroups).map(([docId, chunks]) => 
                `Document ${docId}: ${chunks.length} chunks`));
        
        // Ensure each document gets at least one high-ranking chunk if possible
        const ensuredResults = [];
        let documentsInResults = Object.keys(docGroups);
        
        // For contextual queries, prioritize previously relevant documents 
        if (isContextualQuery && lastRelevantDocuments.length > 0) {
            // Sort document IDs by their previous relevance
            documentsInResults.sort((a, b) => {
                const aRelevance = lastRelevantDocuments.find(d => d.documentId === parseInt(a))?.relevanceScore || 0;
                const bRelevance = lastRelevantDocuments.find(d => d.documentId === parseInt(b))?.relevanceScore || 0;
                return bRelevance - aRelevance; // Higher relevance first
            });
            
            console.log('Documents sorted by previous relevance:', documentsInResults);
        }
        
        // First, add the top chunk from each document
        documentsInResults.forEach(docId => {
            if (docGroups[docId].length > 0) {
                // Sort document chunks by score
                docGroups[docId].sort((a, b) => b.mergedScore - a.mergedScore);
                // Add the top chunk from this document
                ensuredResults.push(docGroups[docId][0]);
                // Remove the added chunk
                docGroups[docId].shift();
            }
        });
        
        // Then add remaining chunks based on score
        const remainingChunks = [].concat(...Object.values(docGroups));
        remainingChunks.sort((a, b) => b.mergedScore - a.mergedScore);
        
        // Combine ensured results with remaining top chunks
        const finalResults = [...ensuredResults, ...remainingChunks]
            .slice(0, 8); // Keep up to 8 chunks (increased from 5)
        
        // Sort by score again to put them in proper order
        finalResults.sort((a, b) => b.mergedScore - a.mergedScore);
        
        console.log('Final merged results:', finalResults.map(c => ({
            documentId: c.documentId,
            documentTitle: c.documentTitle || `Document ${c.documentId}`,
            score: c.mergedScore.toFixed(3),
            terms: c.terms,
            text: c.text.substring(0, 50) + '...'
        })));
        
        return finalResults;
    }

    /**
     * Process large result sets through a multi-stage approach
     * @param {string} question - User's question
     * @param {Array<Object>} mergedChunks - Combined chunks from multiple search methods
     * @param {Array<Object>} conversationHistory - Previous conversation context
     * @returns {Promise<{chunks: Array<Object>}>} Filtered and processed chunks
     */
    async function processLargeResultSet(question, mergedChunks, conversationHistory) {
        console.log(`Processing large result set with ${mergedChunks.length} chunks`);
        
        // Sort results by score (highest first)
        const sortedChunks = [...mergedChunks].sort((a, b) => b.mergedScore - a.mergedScore);
        
        // Group chunks by document
        const documentGroups = {};
        sortedChunks.forEach(chunk => {
            const docId = chunk.documentId;
            if (!documentGroups[docId]) {
                documentGroups[docId] = [];
            }
            documentGroups[docId].push(chunk);
        });
        
        // For each document, keep only the best chunks
        let prioritizedChunks = [];
        Object.values(documentGroups).forEach(chunks => {
            // Take the highest scoring chunks from each document (at most 3 per document)
            prioritizedChunks = prioritizedChunks.concat(chunks.slice(0, 3));
        });
        
        // Re-sort by score and take the top chunks (never exceeding 8 total)
        prioritizedChunks.sort((a, b) => b.mergedScore - a.mergedScore);
        const finalChunks = prioritizedChunks.slice(0, 8);
        
        console.log(`Reduced large result set from ${mergedChunks.length} to ${finalChunks.length} chunks`);
        
        // If the size is still too large for optimal processing, we could add a second stage:
        // - Summarize groups of chunks
        // - Cluster chunks by topic similarity
        // - Use LLM to select most relevant chunks
        
        return {
            chunks: finalChunks
        };
    }

    /**
     * Ensure chat scrolls to the bottom to show newest messages
     * Using requestAnimationFrame for better scroll timing after DOM updates
     */
    function scrollChatToBottom() {
        // Use requestAnimationFrame to ensure DOM is fully updated before scrolling
        requestAnimationFrame(() => {
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Double-check scroll after a small delay (for images or dynamic content)
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        });
    }

    /**
     * Load all documents into the document selection panel
     */
    async function loadDocumentSelectionPanel() {
        const selectionList = document.getElementById('documentSelectionList');
        if (!selectionList) return;
        
        // Start with loading indicator
        selectionList.innerHTML = `
            <div class="text-center text-muted py-2 small">
                <em>Loading available documents...</em>
            </div>
        `;
        
        try {
            // Check if we're running on GitHub Pages
            const isGitHubPages = window.location.hostname.includes('github.io');
            console.log('Environment check:', isGitHubPages ? 'Running on GitHub Pages' : 'Running locally');
            
            // Add a small delay for GitHub Pages to ensure IndexedDB is ready
            if (isGitHubPages) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const documents = await docDB.getAllDocuments();
            availableDocuments = documents;
            
            // Clear the loading message
            selectionList.innerHTML = '';
            
            // Sort by date processed (newest first)
            documents.sort((a, b) => new Date(b.dateProcessed) - new Date(a.dateProcessed));
            
            // Handle empty document list
            if (documents.length === 0) {
                selectionList.innerHTML = `
                    <div class="text-center text-muted py-2 small">
                        <em>No documents available. Upload a document first.</em>
                    </div>
                `;
                return;
            }
            
            // Add a header explaining document selection
            const headerElement = document.createElement('div');
            headerElement.className = 'document-selection-header';
            headerElement.innerHTML = `
                <div class="alert alert-info py-2 mb-2">
                    <i class="bi bi-info-circle-fill"></i> 
                    Selected documents are used for answering questions
                </div>
            `;
            selectionList.appendChild(headerElement);
            
            // Create an item for each document
            documents.forEach(doc => {
                // Check if this is the current document
                const isCurrentDoc = currentDocument && currentDocument.id === doc.id;
                // Add current document to selected by default
                if (isCurrentDoc && !selectedDocuments.includes(doc.id)) {
                    selectedDocuments.push(doc.id);
                }
                
                const docItem = document.createElement('div');
                docItem.className = 'document-selection-item';
                // Add a highlighted class if this document is selected
                if (selectedDocuments.includes(doc.id)) {
                    docItem.classList.add('document-selected');
                }
                
                docItem.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input document-checkbox" type="checkbox" 
                               id="doc-${doc.id}" data-doc-id="${doc.id}" 
                               ${selectedDocuments.includes(doc.id) ? 'checked' : ''}>
                        <label class="form-check-label" for="doc-${doc.id}">
                            <span class="document-title">
                                ${doc.title}
                                ${isCurrentDoc ? '<span class="document-active-badge">Active</span>' : ''}
                            </span>
                            <span class="document-info">
                                ${doc.wordCount.toLocaleString()} words · ${new Date(doc.dateProcessed).toLocaleDateString()}
                            </span>
                        </label>
                    </div>
                `;
                
                selectionList.appendChild(docItem);
                
                // Add event listener for checkbox
                const checkbox = docItem.querySelector(`#doc-${doc.id}`);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        addDocumentToSelection(doc.id);
                        docItem.classList.add('document-selected');
                    } else {
                        removeDocumentFromSelection(doc.id);
                        docItem.classList.remove('document-selected');
                    }
                });
            });
            
            // Update the document indicator to reflect current state
            updateActiveDocumentsIndicator();
        } catch (error) {
            console.error('Error loading documents for selection:', error);
            
            // Show error message instead of perpetual loading
            selectionList.innerHTML = `
                <div class="alert alert-warning py-2 mb-2">
                    <i class="bi bi-exclamation-triangle"></i> 
                    Unable to load documents. 
                    ${error.message ? `<br><small class="text-muted">${error.message}</small>` : ''}
                </div>
                <div class="text-center mt-2">
                    <button class="btn btn-sm btn-outline-primary refresh-docs-btn">
                        <i class="bi bi-arrow-clockwise"></i> Try Again
                    </button>
                </div>
            `;
            
            // Add click handler for refresh button
            const refreshBtn = selectionList.querySelector('.refresh-docs-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    loadDocumentSelectionPanel();
                });
            }
        }
    }

    /**
     * Add a document to the selection
     * @param {number} docId - Document ID to add
     */
    function addDocumentToSelection(docId) {
        if (!selectedDocuments.includes(docId)) {
            selectedDocuments.push(docId);
            updateDocumentSelectionUI();
            
            // Get document title for user notification
            docDB.getDocument(docId).then(doc => {
                if (doc) {
                    // Update the status in the chat with more specific information
                    const activeDocsMessage = selectedDocuments.length > 1 ? 
                        ` (${selectedDocuments.length} documents now active)` : '';
                    addSystemMessage(`Added "${doc.title}" to the conversation context.${activeDocsMessage} You can now ask questions about this document.`);
                }
            });
        }
    }
    
    /**
     * Remove a document from the selection
     * @param {number} docId - Document ID to remove
     */
    function removeDocumentFromSelection(docId) {
        // Get document title before removing from list
        docDB.getDocument(docId).then(doc => {
            const docTitle = doc ? doc.title : `Document ${docId}`;
            
            // Now remove from selection
            selectedDocuments = selectedDocuments.filter(id => id !== docId);
            updateDocumentSelectionUI();
            
            // Create message with remaining documents information
            let message = `Removed "${docTitle}" from context.`;
            
            if (selectedDocuments.length > 0) {
                // Add information about remaining documents
                if (selectedDocuments.length === 1) {
                    docDB.getDocument(selectedDocuments[0]).then(remainingDoc => {
                        if (remainingDoc) {
                            addSystemMessage(`${message} Now using only "${remainingDoc.title}" for context.`);
                        }
                    });
                } else {
                    message += ` ${selectedDocuments.length} documents remain in context.`;
                    addSystemMessage(message);
                }
            } else {
                addSystemMessage(`${message} Please select at least one document to continue.`);
            }
        });
    }
    
    /**
     * Select all available documents
     */
    function selectAllDocuments() {
        selectedDocuments = availableDocuments.map(doc => doc.id);
        updateDocumentSelectionUI();
        addSystemMessage(`All ${availableDocuments.length} documents are now in context. You can ask questions about any document.`);
    }
    
    /**
     * Deselect all documents
     */
    function deselectAllDocuments() {
        selectedDocuments = [];
        updateDocumentSelectionUI();
        addSystemMessage(`Removed all documents from context. Please select at least one document to continue.`);
    }
    
    /**
     * Update the document selection UI to reflect current selections
     */
    function updateDocumentSelectionUI() {
        // Update all checkboxes to match selectedDocuments array
        document.querySelectorAll('.document-checkbox').forEach(checkbox => {
            const docId = parseInt(checkbox.dataset.docId);
            checkbox.checked = selectedDocuments.includes(docId);
        });
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
            await vectorizer.loadModel();
            
            const documents = await docDB.getAllDocuments();
            if (documents.length > 0) {
                showLibrarySection();
            } else {
                showLibrarySection();
            }
            
            // Add a floating indicator to show which documents are active
            createActiveDocumentsIndicator();
            
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }
    
    /**
     * Create a floating indicator showing which documents are currently active
     */
    async function createActiveDocumentsIndicator() {
        // Create element if it doesn't exist
        let indicator = document.getElementById('active-documents-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'active-documents-indicator';
            indicator.className = 'active-documents-indicator';
            document.body.appendChild(indicator);
            
            // Add a subtle style that doesn't interfere with UI
            const style = document.createElement('style');
            style.textContent = `
                .active-documents-indicator {
                    position: fixed;
                    bottom: 10px;
                    left: 10px;
                    background: rgba(0,0,0,0.6);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    z-index: 1000;
                    max-width: 300px;
                    opacity: 0.7;
                    transition: opacity 0.3s;
                }
                .active-documents-indicator:hover {
                    opacity: 0.9;
                }
                .active-documents-indicator .doc-name {
                    display: inline-block;
                    background: rgba(255,255,255,0.2);
                    padding: 1px 5px;
                    margin: 2px;
                    border-radius: 3px;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Update periodically to ensure it reflects current state
        updateActiveDocumentsIndicator();
        setInterval(updateActiveDocumentsIndicator, 5000);
    }
    
    /**
     * Update the active documents indicator with current selection
     */
    async function updateActiveDocumentsIndicator() {
        const indicator = document.getElementById('active-documents-indicator');
        if (!indicator) return;
        
        if (selectedDocuments.length === 0) {
            indicator.innerHTML = 'No documents selected';
            return;
        }
        
        // Get document titles
        const docTitles = await Promise.all(selectedDocuments.map(async id => {
            const doc = await docDB.getDocument(id);
            return doc ? doc.title : `Document ${id}`;
        }));
        
        // Update indicator content
        indicator.innerHTML = 'Active docs: ' + docTitles.map(title => 
            `<span class="doc-name">${title.substring(0, 15)}${title.length > 15 ? '...' : ''}</span>`
        ).join(' ');
    }

    // Start the app
    init();
});
