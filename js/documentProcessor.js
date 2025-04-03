/**
 * Document Processing Utility
 * Handles document parsing, chunking, and preparation for vectorization
 */
class DocumentProcessor {
    constructor() {
        this.chunkSize = 300; // Max words per chunk
        this.chunkOverlap = 50; // Overlap between chunks in words
        this.supportedFileTypes = [
            'text/plain', 
            'text/markdown', 
            'text/html',
            'application/pdf',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
    }

    /**
     * Check if a file type is supported
     * @param {File} file - File to check
     * @returns {boolean} Whether the file type is supported
     */
    isFileSupported(file) {
        // Check by MIME type
        if (this.supportedFileTypes.includes(file.type)) {
            return true;
        }
        
        // Also check by extension for cases where MIME type is not correctly detected
        const extension = file.name.split('.').pop().toLowerCase();
        return ['txt', 'md', 'html', 'pdf', 'csv'].includes(extension);
    }

    /**
     * Extract text content from a file
     * @param {File} file - File to process
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} The text content of the file
     */
    async extractTextFromFile(file, progressCallback = null) {
        // Start with a more detailed message for large files
        const fileSizeMB = file.size / (1024 * 1024);
        
        if (fileSizeMB > 5) {
            if (progressCallback) progressCallback(0.05, `Processing large file (${fileSizeMB.toFixed(1)} MB). This may take a moment...`);
        } else {
            if (progressCallback) progressCallback(0.1, 'Reading file...');
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (extension === 'pdf') {
            return this.extractTextFromPdf(file, progressCallback);
        } else if (extension === 'csv') {
            return this.extractTextFromCsv(file, progressCallback);
        } else {
            // Use chunked reading for large text files to avoid memory issues
            if (fileSizeMB > 10) {  // For files larger than 10MB
                return this.handleLargeTextFile(file, progressCallback);
            } else {
                return this.readTextFile(file, progressCallback);
            }
        }
    }

    /**
     * Handle very large text files with chunked processing
     * @param {File} file - Large text file
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} The text content of the file
     */
    async handleLargeTextFile(file, progressCallback = null) {
        return new Promise((resolve, reject) => {
            // Using FileReader in chunks for very large files
            const chunkSize = 10 * 1024 * 1024; // 10MB chunks
            const fileSize = file.size;
            let offset = 0;
            let textContent = '';
            
            if (progressCallback) progressCallback(0.1, 'Reading large file in chunks...');
            
            const readNextChunk = () => {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    textContent += e.target.result;
                    offset += chunkSize;
                    
                    // Report progress
                    const progress = Math.min(0.1 + (offset / fileSize) * 0.3, 0.4);
                    if (progressCallback) progressCallback(progress, `Reading file: ${Math.min(100, Math.round(offset / fileSize * 100))}%`);
                    
                    if (offset < fileSize) {
                        // Read the next chunk
                        readNextChunk();
                    } else {
                        // Done reading the file
                        if (progressCallback) progressCallback(0.4, 'File loaded completely.');
                        resolve(textContent);
                    }
                };
                
                reader.onerror = (error) => {
                    reject(new Error('Error reading file: ' + error));
                };
                
                // Read a chunk
                const blob = file.slice(offset, offset + chunkSize);
                reader.readAsText(blob);
            };
            
            // Start reading chunks
            readNextChunk();
        });
    }
    
    /**
     * Read a text file
     * @param {File} file - File to read
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} The text content of the file
     */
    async readTextFile(file, progressCallback = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                let text = event.target.result;
                if (progressCallback) progressCallback(0.3, 'File loaded successfully');
                resolve(text);
            };
            
            reader.onerror = (error) => {
                reject(new Error('Error reading file: ' + error));
            };
            
            reader.readAsText(file);
        });
    }
    
    /**
     * Extract text from a PDF file
     * @param {File} file - PDF file
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} Extracted text content
     */
    async extractTextFromPdf(file, progressCallback = null) {
        // First, check if PDF.js is loaded, if not, load it
        if (typeof pdfjsLib === 'undefined') {
            if (progressCallback) progressCallback(0.15, 'Loading PDF parser...');
            
            // Load PDF.js dynamically
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.min.js';
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            // Wait a moment to ensure PDF.js is fully initialized
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (progressCallback) progressCallback(0.2, 'Parsing PDF file...');
        
        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load the PDF file
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        const totalPages = pdf.numPages;
        
        // Extract text from each page
        for (let i = 1; i <= totalPages; i++) {
            if (progressCallback) {
                const pageProgress = 0.2 + (0.6 * (i / totalPages));
                progressCallback(pageProgress, `Extracting text from page ${i}/${totalPages}`);
            }
            
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Concatenate the text items
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        
        if (progressCallback) progressCallback(0.8, 'PDF processing complete');
        
        return fullText;
    }

    /**
     * Extract text from a CSV file
     * @param {File} file - CSV file to process
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} Text representation of the CSV data
     */
    async extractTextFromCsv(file, progressCallback = null) {
        if (progressCallback) progressCallback(0.2, 'Parsing CSV file...');
        
        return new Promise((resolve, reject) => {
            // First, check if Papa Parse is loaded
            if (typeof Papa === 'undefined') {
                // Load Papa Parse dynamically
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js';
                script.onload = () => {
                    this.parseCSVWithPapa(file, progressCallback, resolve, reject);
                };
                script.onerror = () => {
                    reject(new Error('Failed to load CSV parser. Please try again.'));
                };
                document.head.appendChild(script);
            } else {
                this.parseCSVWithPapa(file, progressCallback, resolve, reject);
            }
        });
    }
    
    /**
     * Parse CSV using Papa Parse
     * @private
     */
    parseCSVWithPapa(file, progressCallback, resolve, reject) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, // Auto-convert strings to numbers/booleans when possible
            error: (error) => {
                reject(new Error('Error parsing CSV: ' + error.message));
            },
            complete: (results) => {
                if (progressCallback) progressCallback(0.5, 'Analyzing CSV structure...');
                
                if (!results.data || results.data.length === 0) {
                    reject(new Error('No data found in CSV file'));
                    return;
                }
                
                try {
                    // Analyze CSV structure before converting to text
                    const analysis = this.analyzeCSVStructure(results.data, results.meta);
                    
                    if (progressCallback) progressCallback(0.7, 'Converting CSV to structured text...');
                    
                    // Convert CSV data to text with structure analysis included
                    let textContent = this.formatCSVWithAnalysis(results.data, results.meta, analysis);
                    
                    if (progressCallback) progressCallback(0.9, 'CSV processing complete');
                    resolve(textContent);
                } catch (err) {
                    reject(new Error('Error processing CSV data: ' + err.message));
                }
            }
        });
    }

    /**
     * Analyze CSV structure to understand data patterns
     * @param {Array<Object>} data - Parsed CSV data
     * @param {Object} meta - CSV metadata
     * @returns {Object} Analysis results
     * @private
     */
    analyzeCSVStructure(data, meta) {
        const analysis = {
            rowCount: data.length,
            columnCount: meta.fields ? meta.fields.length : 0,
            columns: {},
            sampleSize: Math.min(5, data.length),
            patterns: []
        };
        
        // Skip analysis for empty data
        if (data.length === 0 || !meta.fields) return analysis;
        
        // Analyze each column
        meta.fields.forEach(field => {
            const columnAnalysis = {
                name: field,
                dataType: 'unknown',
                nonNullCount: 0,
                uniqueValues: new Set(),
                numericStats: {
                    min: null,
                    max: null,
                    sum: 0,
                    avg: null
                },
                stringStats: {
                    minLength: null,
                    maxLength: null,
                    hasNumbers: false,
                    hasSpecialChars: false
                },
                example: data[0][field]
            };
            
            // Analyze values
            let numericCount = 0;
            let dateCount = 0;
            let booleanCount = 0;
            
            data.forEach(row => {
                const value = row[field];
                
                // Count non-null values
                if (value !== null && value !== undefined && value !== '') {
                    columnAnalysis.nonNullCount++;
                    columnAnalysis.uniqueValues.add(String(value));
                    
                    // Check type
                    if (typeof value === 'number') {
                        numericCount++;
                        
                        // Update numeric stats
                        if (columnAnalysis.numericStats.min === null || value < columnAnalysis.numericStats.min) {
                            columnAnalysis.numericStats.min = value;
                        }
                        if (columnAnalysis.numericStats.max === null || value > columnAnalysis.numericStats.max) {
                            columnAnalysis.numericStats.max = value;
                        }
                        columnAnalysis.numericStats.sum += value;
                    } else if (typeof value === 'boolean') {
                        booleanCount++;
                    } else if (typeof value === 'string') {
                        // Check if it looks like a date
                        if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value) || 
                            /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(value) ||
                            !isNaN(Date.parse(value))) {
                            dateCount++;
                        }
                        
                        // Update string stats
                        if (columnAnalysis.stringStats.minLength === null || value.length < columnAnalysis.stringStats.minLength) {
                            columnAnalysis.stringStats.minLength = value.length;
                        }
                        if (columnAnalysis.stringStats.maxLength === null || value.length > columnAnalysis.stringStats.maxLength) {
                            columnAnalysis.stringStats.maxLength = value.length;
                        }
                        
                        if (/\d/.test(value)) columnAnalysis.stringStats.hasNumbers = true;
                        if (/[^\w\s]/.test(value)) columnAnalysis.stringStats.hasSpecialChars = true;
                    }
                }
            });
            
            // Determine most likely data type
            if (numericCount > 0.8 * columnAnalysis.nonNullCount) {
                columnAnalysis.dataType = 'numeric';
                // Calculate average for numeric columns
                columnAnalysis.numericStats.avg = columnAnalysis.numericStats.sum / numericCount;
            } else if (dateCount > 0.8 * columnAnalysis.nonNullCount) {
                columnAnalysis.dataType = 'date';
            } else if (booleanCount > 0.8 * columnAnalysis.nonNullCount) {
                columnAnalysis.dataType = 'boolean';
            } else {
                columnAnalysis.dataType = 'string';
            }
            
            // Calculate nullability percentage
            columnAnalysis.nullPercentage = (data.length - columnAnalysis.nonNullCount) / data.length * 100;
            
            // Store unique value count (convert Set to count)
            columnAnalysis.uniqueValueCount = columnAnalysis.uniqueValues.size;
            delete columnAnalysis.uniqueValues; // Remove Set to avoid circular reference issues
            
            analysis.columns[field] = columnAnalysis;
        });
        
        // Look for patterns and relationships across columns
        this.detectColumnPatterns(analysis, data);
        
        return analysis;
    }

    /**
     * Detect patterns and relationships between columns
     * @param {Object} analysis - Analysis object to update
     * @param {Array<Object>} data - Parsed CSV data
     * @private
     */
    detectColumnPatterns(analysis, data) {
        const fields = Object.keys(analysis.columns);
        
        // Look for key columns (potential IDs)
        for (const field of fields) {
            const column = analysis.columns[field];
            
            // Potential ID column check
            if (column.uniqueValueCount === analysis.rowCount && 
                column.nullPercentage === 0 &&
                (column.dataType === 'numeric' || /id/i.test(field))) {
                analysis.patterns.push({
                    type: 'potentialKey',
                    column: field,
                    note: `Column "${field}" appears to be a unique identifier.`
                });
            }
            
            // Categorical column check
            if (column.uniqueValueCount > 1 && 
                column.uniqueValueCount < Math.min(20, analysis.rowCount * 0.2) && 
                column.dataType === 'string') {
                analysis.patterns.push({
                    type: 'categorical',
                    column: field,
                    note: `Column "${field}" appears to be categorical with ${column.uniqueValueCount} distinct values.`
                });
            }
        }
    }

    /**
     * Format CSV with analysis results for better LLM comprehension
     * @param {Array<Object>} data - Parsed CSV data
     * @param {Object} meta - CSV metadata
     * @param {Object} analysis - Analysis results
     * @returns {string} Text representation
     * @private
     */
    formatCSVWithAnalysis(data, meta, analysis) {
        let textContent = '';
        
        // 1. Table overview
        textContent += `# CSV TABLE ANALYSIS\n\n`;
        textContent += `## Table Overview\n`;
        textContent += `- File contains ${analysis.rowCount} rows and ${analysis.columnCount} columns\n`;
        textContent += `- Columns: ${meta.fields.join(', ')}\n\n`;
        
        // 2. Column analysis
        textContent += `## Column Analysis\n`;
        Object.entries(analysis.columns).forEach(([fieldName, column]) => {
            textContent += `### ${fieldName}\n`;
            textContent += `- Data Type: ${column.dataType}\n`;
            textContent += `- Non-null values: ${column.nonNullCount}/${analysis.rowCount} (${(100 - column.nullPercentage).toFixed(1)}%)\n`;
            textContent += `- Unique values: ${column.uniqueValueCount}\n`;
            
            if (column.dataType === 'numeric') {
                textContent += `- Range: ${column.numericStats.min} to ${column.numericStats.max}\n`;
                textContent += `- Average: ${column.numericStats.avg ? column.numericStats.avg.toFixed(2) : 'N/A'}\n`;
            } else if (column.dataType === 'string') {
                textContent += `- Length range: ${column.stringStats.minLength} to ${column.stringStats.maxLength} characters\n`;
                if (column.stringStats.hasNumbers) {
                    textContent += `- Contains numeric characters\n`;
                }
            }
            textContent += `- Example: "${column.example}"\n\n`;
        });
        
        // 3. Patterns and relationships
        if (analysis.patterns.length > 0) {
            textContent += `## Detected Patterns\n`;
            analysis.patterns.forEach(pattern => {
                textContent += `- ${pattern.note}\n`;
            });
            textContent += `\n`;
        }
        
        // 4. Add chunking recommendations
        const chunkingRecommendations = this.generateChunkingRecommendations(data, meta, analysis);
        textContent += `## Chunking Recommendations\n${chunkingRecommendations}\n\n`;
        
        // 5. Sample data (first few rows)
        textContent += `## Data Sample (${analysis.sampleSize} rows)\n`;
        const sampleData = data.slice(0, analysis.sampleSize);
        
        // Table header
        textContent += meta.fields.join(' | ') + '\n';
        textContent += meta.fields.map(() => '---').join(' | ') + '\n';
        
        // Table rows
        sampleData.forEach(row => {
            const values = meta.fields.map(field => {
                const val = row[field];
                return val !== null && val !== undefined ? String(val).substring(0, 50) : 'NULL';
            });
            textContent += values.join(' | ') + '\n';
        });
        textContent += '\n';
        
        // 6. Full data in structured format, using the recommended chunking strategy
        textContent += `## Full Dataset (${this.applyChunkingStrategy(data, analysis)})\n`;
        data.forEach((row, index) => {
            textContent += `### Row ${index + 1}\n`;
            meta.fields.forEach(field => {
                const value = row[field] !== null && row[field] !== undefined ? row[field] : 'NULL';
                textContent += `${field}: ${value}\n`;
            });
            textContent += '\n';
        });
        
        return textContent;
    }

    /**
     * Generate recommendations for chunking CSV data
     * @param {Array<Object>} data - Parsed CSV data
     * @param {Object} meta - CSV metadata
     * @param {Object} analysis - Analysis results
     * @returns {string} Chunking recommendations text
     * @private
     */
    generateChunkingRecommendations(data, meta, analysis) {
        let recommendations = '';
        
        // Identify key columns for possible grouping
        const keyColumns = analysis.patterns
            .filter(p => p.type === 'potentialKey')
            .map(p => p.column);
        
        // Identify categorical columns for possible segmentation
        const categoricalColumns = analysis.patterns
            .filter(p => p.type === 'categorical')
            .map(p => p.column);
        
        // Determine optimal chunk size based on row size and complexity
        const avgRowSize = Object.values(analysis.columns).reduce((sum, col) => {
            if (col.dataType === 'string' && col.stringStats.maxLength) {
                return sum + col.stringStats.maxLength;
            }
            return sum + 10; // Assume 10 chars for non-string types
        }, 0) / analysis.columnCount;
        
        // Calculate optimal chunks per strategy
        const rowsPerChunk = Math.max(10, Math.min(50, Math.ceil(5000 / avgRowSize)));
        
        recommendations += `Based on the analysis of this CSV data, here are recommendations for chunking strategies:\n\n`;
        
        // Strategy 1: Chunk by row ranges
        recommendations += `1. **Row-based chunking**: Split the data into chunks of ${rowsPerChunk} rows each.\n`;
        recommendations += `   - Pros: Simple, maintains all relationships within chunks.\n`;
        recommendations += `   - Cons: May not group related records together if they're far apart.\n\n`;
        
        // Strategy 2: If we found key columns
        if (keyColumns.length > 0) {
            recommendations += `2. **Key-based chunking**: Group records by the key column "${keyColumns[0]}".\n`;
            recommendations += `   - Pros: Keeps logically related records together.\n`;
            recommendations += `   - Cons: Chunks may be uneven in size.\n\n`;
        }
        
        // Strategy 3: If we found categorical columns
        if (categoricalColumns.length > 0) {
            const catColumn = categoricalColumns[0];
            const uniqueValueCount = analysis.columns[catColumn].uniqueValueCount;
            recommendations += `3. **Category-based chunking**: Group records by the categorical column "${catColumn}" (${uniqueValueCount} categories).\n`;
            recommendations += `   - Pros: Organizes data by logical categories.\n`;
            recommendations += `   - Cons: Category sizes may be very uneven.\n\n`;
        }
        
        // Strategy 4: If we have date columns
        const dateColumns = Object.entries(analysis.columns)
            .filter(([_, col]) => col.dataType === 'date')
            .map(([name, _]) => name);
        
        if (dateColumns.length > 0) {
            recommendations += `4. **Temporal chunking**: Group records by time periods based on "${dateColumns[0]}".\n`;
            recommendations += `   - Pros: Maintains chronological relationships.\n`;
            recommendations += `   - Cons: Some time periods may have very few records.\n\n`;
        }
        
        // Final recommendation based on data characteristics
        recommendations += `**Recommended strategy**: `;
        
        if (analysis.rowCount < 100) {
            recommendations += `For this small dataset (${analysis.rowCount} rows), treating the entire table as a single chunk is reasonable.\n`;
        } else if (keyColumns.length > 0) {
            recommendations += `Use key-based chunking with "${keyColumns[0]}" as the primary organization method.\n`;
        } else if (categoricalColumns.length > 0 && analysis.columns[categoricalColumns[0]].uniqueValueCount < 10) {
            recommendations += `Use category-based chunking with "${categoricalColumns[0]}" as it has a reasonable number of categories (${analysis.columns[categoricalColumns[0]].uniqueValueCount}).\n`;
        } else if (dateColumns.length > 0) {
            recommendations += `Use temporal chunking with "${dateColumns[0]}" to organize data chronologically.\n`;
        } else {
            recommendations += `Use row-based chunking with ${rowsPerChunk} rows per chunk.\n`;
        }
        
        return recommendations;
    }

    /**
     * Apply the recommended chunking strategy and return a description
     * @param {Array<Object>} data - The CSV data
     * @param {Object} analysis - The analysis results
     * @returns {string} Description of the applied strategy
     * @private
     */
    applyChunkingStrategy(data, analysis) {
        const totalRows = data.length;
        
        // Identify the chunking strategy based on the analysis
        let strategy = "organized by individual rows";
        
        // Key columns (use for chunking if available)
        const keyColumns = analysis.patterns
            .filter(p => p.type === 'potentialKey')
            .map(p => p.column);
            
        if (keyColumns.length > 0) {
            strategy = `organized by ${keyColumns[0]} as the primary key`;
        }
        
        // Categorical columns with reasonable number of categories
        const categoricalColumns = analysis.patterns
            .filter(p => p.type === 'categorical')
            .map(p => p.column);
            
        if (categoricalColumns.length > 0 && 
            analysis.columns[categoricalColumns[0]].uniqueValueCount <= 10) {
            strategy = `grouped by ${categoricalColumns[0]} categories`;
        }
        
        return `${totalRows} rows, ${strategy}`;
    }

    /**
     * Split a document into chunks for vectorization
     * @param {string} text - Document text
     * @param {Function} progressCallback - Progress callback function
     * @returns {Array<Object>} Array of document chunks with metadata
     */
    chunkDocument(text, progressCallback = null) {
        if (progressCallback) progressCallback(0.4, 'Chunking document...');
        
        // For very large documents, adjust the approach
        const isLargeDocument = text.length > 1000000; // 1MB text
        
        if (isLargeDocument) {
            // Use more aggressive chunking for large documents
            this.chunkSize = 400; // Larger chunks
            this.chunkOverlap = 40; // Less overlap
            
            // Process in sections for large documents
            return this.chunkLargeDocument(text, progressCallback);
        }
        
        // Regular document processing
        // Basic preprocessing
        const cleanText = text.replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n') // Normalize excessive newlines
            .trim();
        
        // First try to split by paragraphs
        const paragraphs = cleanText.split(/\n{2,}/);
        
        // If we have very few paragraphs, split into sentences
        if (paragraphs.length < 5) {
            const sentences = cleanText.replace(/([.!?])\s+/g, "$1\n").split('\n');
            return this.createChunksFromSentences(sentences, progressCallback);
        }
        
        // Otherwise, use the paragraphs as a base and merge or split as needed
        return this.createChunksFromParagraphs(paragraphs, progressCallback);
    }
    
    /**
     * Process a large document by breaking it into sections first
     * @param {string} text - Large document text
     * @param {Function} progressCallback - Progress callback function
     * @returns {Array<Object>} Array of document chunks
     */
    chunkLargeDocument(text, progressCallback = null) {
        if (progressCallback) progressCallback(0.45, 'Processing large document in sections...');
        
        // Break into major sections first (chapters, major parts)
        const sections = this.findDocumentSections(text);
        const allChunks = [];
        
        sections.forEach((section, sectionIndex) => {
            if (progressCallback) {
                const progress = 0.45 + (0.4 * (sectionIndex / sections.length));
                progressCallback(progress, `Processing section ${sectionIndex + 1} of ${sections.length}`);
            }
            
            // Process each section
            const paragraphs = section.split(/\n{2,}/);
            const sectionChunks = this.createChunksFromParagraphs(paragraphs);
            
            // Add section info to chunks
            const sectionPrefix = `Section ${sectionIndex + 1}: `;
            sectionChunks.forEach(chunk => {
                allChunks.push({
                    ...chunk,
                    section: sectionIndex,
                    sectionTitle: sectionPrefix
                });
            });
        });
        
        if (progressCallback) progressCallback(0.85, `Created ${allChunks.length} chunks from large document`);
        
        return allChunks;
    }
    
    /**
     * Find natural sections in a document 
     * @param {string} text - Document text
     * @returns {Array<string>} Document sections
     */
    findDocumentSections(text) {
        // Try to identify chapter headers or major section breaks
        // Look for patterns like "Chapter X", "Section X", or lines in all caps followed by newlines
        const potentialSectionBreaks = [
            /(?:CHAPTER|Chapter)\s+\w+.*?\n/g,
            /(?:SECTION|Section)\s+\w+.*?\n/g,
            /\n[A-Z][A-Z\s]{10,}[A-Z]\n/g,
            /\n={3,}\n/g, // Equal signs as dividers
            /\n-{3,}\n/g, // Dashes as dividers
            /\n\*{3,}\n/g // Asterisks as dividers
        ];
        
        // Find potential break points
        let breakPoints = [];
        potentialSectionBreaks.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                breakPoints.push(match.index);
            }
        });
        
        // Add beginning and end of document
        breakPoints.push(0);
        breakPoints.push(text.length);
        
        // Sort and deduplicate break points
        breakPoints = [...new Set(breakPoints)].sort((a, b) => a - b);
        
        // Create sections from break points
        const sections = [];
        for (let i = 0; i < breakPoints.length - 1; i++) {
            const section = text.substring(breakPoints[i], breakPoints[i + 1]);
            if (section.trim().length > 0) {
                sections.push(section);
            }
        }
        
        // If we didn't find any natural breaks, or too few, use arbitrary splitting
        if (sections.length < 3) {
            // Split into roughly equal sections (aim for ~5-10 sections for a large document)
            const targetSections = Math.min(10, Math.max(5, Math.floor(text.length / 100000)));
            const sectionSize = Math.ceil(text.length / targetSections);
            
            sections.length = 0; // Clear the array
            
            for (let i = 0; i < text.length; i += sectionSize) {
                const section = text.substring(i, Math.min(i + sectionSize, text.length));
                // Try to break at a paragraph boundary if possible
                const lastParagraphBreak = section.lastIndexOf('\n\n');
                
                if (lastParagraphBreak > 0 && lastParagraphBreak > section.length * 0.7) {
                    // If we found a paragraph break in the latter part of the section, break there
                    sections.push(text.substring(i, i + lastParagraphBreak));
                    i = i + lastParagraphBreak - 1; // Adjust i to continue from the paragraph break
                } else {
                    sections.push(section);
                }
            }
        }
        
        return sections;
    }
    
    /**
     * Create chunks from sentences
     * @param {Array<string>} sentences - Array of sentences
     * @param {Function} progressCallback - Progress callback function
     * @returns {Array<Object>} Array of document chunks
     */
    createChunksFromSentences(sentences, progressCallback = null) {
        const chunks = [];
        let currentChunk = [];
        let currentChunkWords = 0;
        
        sentences.forEach((sentence, index) => {
            const wordCount = sentence.split(/\s+/).filter(Boolean).length;
            
            if (currentChunkWords + wordCount <= this.chunkSize || currentChunk.length === 0) {
                // Add to current chunk
                currentChunk.push(sentence);
                currentChunkWords += wordCount;
            } else {
                // Current chunk is full, store it and start a new one
                chunks.push({
                    text: currentChunk.join(' '),
                    index: chunks.length,
                    wordCount: currentChunkWords
                });
                
                // Start new chunk with overlap if possible
                const overlap = [];
                let overlapWords = 0;
                
                // Add some of the previous sentences for context
                for (let i = Math.max(0, currentChunk.length - 3); i < currentChunk.length; i++) {
                    const overlapSentence = currentChunk[i];
                    const overlapWordCount = overlapSentence.split(/\s+/).filter(Boolean).length;
                    
                    if (overlapWords + overlapWordCount <= this.chunkOverlap) {
                        overlap.push(overlapSentence);
                        overlapWords += overlapWordCount;
                    }
                }
                
                currentChunk = [...overlap, sentence];
                currentChunkWords = overlapWords + wordCount;
            }
            
            if (progressCallback && index % 20 === 0) {
                const progress = 0.4 + (0.1 * (index / sentences.length));
                progressCallback(progress, 'Creating chunks...');
            }
        });
        
        // Add the last chunk if it's not empty
        if (currentChunk.length > 0) {
            chunks.push({
                text: currentChunk.join(' '),
                index: chunks.length,
                wordCount: currentChunkWords
            });
        }
        
        if (progressCallback) progressCallback(0.5, `Created ${chunks.length} chunks`);
        
        return chunks;
    }
    
    /**
     * Create chunks from paragraphs
     * @param {Array<string>} paragraphs - Array of paragraphs
     * @param {Function} progressCallback - Progress callback function
     * @returns {Array<Object>} Array of document chunks
     */
    createChunksFromParagraphs(paragraphs, progressCallback = null) {
        const chunks = [];
        let currentChunk = [];
        let currentChunkWords = 0;
        
        paragraphs.forEach((paragraph, index) => {
            const wordCount = paragraph.split(/\s+/).filter(Boolean).length;
            
            // If this paragraph alone exceeds chunk size, we need to split it
            if (wordCount > this.chunkSize) {
                // First add any accumulated content as a chunk
                if (currentChunk.length > 0) {
                    chunks.push({
                        text: currentChunk.join('\n\n'),
                        index: chunks.length,
                        wordCount: currentChunkWords
                    });
                    currentChunk = [];
                    currentChunkWords = 0;
                }
                
                // Split the large paragraph into sentences
                const sentences = paragraph.replace(/([.!?])\s+/g, "$1\n").split('\n');
                const sentenceChunks = this.createChunksFromSentences(sentences);
                
                // Add these as separate chunks
                chunks.push(...sentenceChunks);
            } 
            // Normal case - paragraph fits or can be added to current chunk
            else if (currentChunkWords + wordCount <= this.chunkSize || currentChunk.length === 0) {
                currentChunk.push(paragraph);
                currentChunkWords += wordCount;
            } 
            // Current chunk is full, store it and start a new one
            else {
                chunks.push({
                    text: currentChunk.join('\n\n'),
                    index: chunks.length,
                    wordCount: currentChunkWords
                });
                
                // Start a new chunk
                currentChunk = [paragraph];
                currentChunkWords = wordCount;
            }
            
            if (progressCallback && index % 10 === 0) {
                const progress = 0.4 + (0.1 * (index / paragraphs.length));
                progressCallback(progress, 'Processing paragraphs...');
            }
        });
        
        // Add the last chunk if it's not empty
        if (currentChunk.length > 0) {
            chunks.push({
                text: currentChunk.join('\n\n'),
                index: chunks.length,
                wordCount: currentChunkWords
            });
        }
        
        if (progressCallback) progressCallback(0.5, `Created ${chunks.length} chunks`);
        
        return chunks;
    }

    /**
     * Extract metadata from document
     * @param {string} text - Document text
     * @param {File} file - Original file
     * @returns {Object} Document metadata
     */
    extractMetadata(text, file) {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        
        // Try to extract a title from the first few lines
        const firstLines = text.split('\n').slice(0, 5);
        let title = file.name;
        
        // Look for a reasonable title line
        for (const line of firstLines) {
            const trimmedLine = line.trim();
            if (trimmedLine && trimmedLine.length < 100 && !/^[#>*\-\d]/.test(trimmedLine)) {
                title = trimmedLine;
                break;
            }
        }
        
        return {
            filename: file.name,
            title: title.replace(/\.[^/.]+$/, ""), // Remove file extension from title
            fileType: file.type,
            fileSize: file.size,
            wordCount: wordCount,
            dateProcessed: new Date().toISOString()
        };
    }
}

const documentProcessor = new DocumentProcessor();
