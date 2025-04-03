/**
 * CSV/Excel Analyzer UI Handler
 * Manages the UI interactions for the CSV and Excel data analyzers
 */
class CSVAnalyzerUI {
    constructor() {
        this.data = null;
        this.meta = null;
        this.llmOptimizedText = null;
        this.initialized = false;
        this.modalElement = document.getElementById('csvAnalyzerModal');
    }

    /**
     * Initialize the UI components
     */
    initialize() {
        if (this.initialized) return;
        this.initialized = true;

        // Set up tab navigation
        const tabs = document.querySelectorAll('.csv-analyzer-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Handle process button
        const processBtn = document.getElementById('csv-process-btn');
        if (processBtn) {
            processBtn.addEventListener('click', this.handleProcessing.bind(this));
        }

        // Handle optimization strategies
        const strategyInputs = document.querySelectorAll('input[name="optimizationStrategy"]');
        strategyInputs.forEach(input => {
            input.addEventListener('change', this.updateOptimizationUI.bind(this));
        });

        // Handle sample size changes
        const sampleSizeRange = document.getElementById('sample-size-range');
        if (sampleSizeRange) {
            sampleSizeRange.addEventListener('input', this.updateSampleSize.bind(this));
        }

        // Fix modal closing issues
        if (this.modalElement) {
            this.modalElement.addEventListener('hidden.bs.modal', this.cleanupModal.bind(this));
        }
    }

    /**
     * Clean up modal after closing to prevent UI issues
     */
    cleanupModal() {
        // Remove modal-open class and backdrop
        document.body.classList.remove('modal-open');
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
        
        // Reset scroll position
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    /**
     * Handle the processing button click
     */
    handleProcessing() {
        // Get the selected optimization strategy
        const strategy = document.querySelector('input[name="optimizationStrategy"]:checked').value;
        const sampleSize = parseInt(document.getElementById('sample-size-range').value);
        const groupByField = document.getElementById('group-by-select').value;
        
        // Generate optimized text based on strategy
        this.generateOptimizedText(strategy, sampleSize, groupByField);
        
        // Properly close the modal
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(this.modalElement);
            if (modal) modal.hide();
            this.cleanupModal();
        }, 100);
    }

    /**
     * Generate optimized text for LLM processing
     */
    generateOptimizedText(strategy, sampleSize, groupByField) {
        if (!window.csvAnalyzer || !window.csvAnalyzer.data) {
            this.llmOptimizedText = "No data available for processing";
            return;
        }

        // Show a processing indicator
        const processBtn = document.getElementById('csv-process-btn');
        if (processBtn) {
            const originalText = processBtn.innerHTML;
            processBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Processing...
            `;
            processBtn.disabled = true;
            
            // Re-enable the button after processing is complete
            setTimeout(() => {
                processBtn.innerHTML = originalText;
                processBtn.disabled = false;
            }, 3000);
        }

        const options = {
            format: strategy,
            title: 'Excel/CSV Data Analysis',
            sampleSize: sampleSize,
            groupBy: groupByField || undefined
        };

        try {
            // For large datasets, use a Web Worker if available
            if (window.Worker && this.data.length > 1000 && strategy !== 'narrative') {
                this.generateOptimizedTextWithWorker(options);
                return;
            }
            
            // For smaller datasets or narratives, process directly
            this.generateOptimizedTextDirect(options, strategy);
        } catch (error) {
            console.error('Error generating optimized text:', error);
            
            // Create a basic fallback representation
            this.llmOptimizedText = this.createBasicFallbackText();
        }
    }

    /**
     * Generate optimized text directly (for smaller datasets or narrative format)
     * @param {Object} options - Transformation options
     * @param {string} strategy - The selected transformation strategy
     */
    generateOptimizedTextDirect(options, strategy) {
        // Use appropriate transformation strategy
        switch (strategy) {
            case 'narrative':
                this.llmOptimizedText = window.csvAnalyzer.transformToNarrative(options);
                break;
            case 'tabular':
                this.llmOptimizedText = window.csvAnalyzer.transformToTableFormat(options);
                break;
            case 'hierarchical':
                this.llmOptimizedText = window.csvAnalyzer.transformToHierarchicalFormat(options);
                break;
            case 'qa':
                this.llmOptimizedText = window.csvAnalyzer.transformToQAFormat(options);
                break;
            default:
                this.llmOptimizedText = window.csvAnalyzer.transformForLLM(options);
        }
    }

    /**
     * Generate optimized text using a Web Worker (for large datasets)
     * @param {Object} options - Transformation options
     */
    generateOptimizedTextWithWorker(options) {
        // Create a temporary worker for this task
        const workerBlob = new Blob([`
            self.onmessage = function(e) {
                const { data, options } = e.data;
                
                // Import necessary libraries
                importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js');
                
                try {
                    // Process the data based on the format
                    let result = '';
                    
                    switch (options.format) {
                        case 'tabular':
                            result = transformToTableFormat(data, options);
                            break;
                        case 'hierarchical':
                            result = transformToHierarchicalFormat(data, options);
                            break;
                        case 'qa':
                            result = transformToQAFormat(data, options);
                            break;
                        default:
                            result = transformToBasicFormat(data, options);
                    }
                    
                    self.postMessage({ type: 'complete', result });
                } catch (error) {
                    self.postMessage({ type: 'error', message: error.toString() });
                }
            };
            
            // Basic transformation functions
            function transformToTableFormat(data, options) {
                // Implementation of table format
                let result = '# ' + (options.title || 'Tabular Data') + '\\n\\n';
                
                // Add basic data dimensions
                result += '## Data Overview\\n';
                result += 'This dataset contains ' + data.length + ' records.\\n\\n';
                
                // Data sample in table format
                result += '## Data Sample\\n\\n';
                
                // Determine how many rows to show
                const sampleSize = Math.min(options.sampleSize || 10, data.length);
                
                // Get column headers
                const headers = Object.keys(data[0] || {});
                
                // Column headers
                result += '| ' + headers.join(' | ') + ' |\\n';
                // Header separator
                result += '| ' + headers.map(() => '---').join(' | ') + ' |\\n';
                
                // Sample rows
                for (let i = 0; i < sampleSize; i++) {
                    const rowValues = headers.map(field => {
                        const val = data[i][field];
                        return val !== null && val !== undefined ? String(val).substring(0, 50) : 'NULL';
                    });
                    result += '| ' + rowValues.join(' | ') + ' |\\n';
                }
                
                return result;
            }
            
            function transformToHierarchicalFormat(data, options) {
                // Simplified hierarchical format
                let result = '# ' + (options.title || 'Hierarchical Data') + '\\n\\n';
                
                // Group by a field if specified
                const groupByField = options.groupBy || Object.keys(data[0])[0];
                
                // Group data by the field
                const groups = {};
                data.forEach(row => {
                    const value = row[groupByField] || 'Unknown';
                    if (!groups[value]) groups[value] = [];
                    groups[value].push(row);
                });
                
                // Output groups
                Object.entries(groups).forEach(([group, rows]) => {
                    result += '## ' + groupByField + ': ' + group + '\\n';
                    result += rows.length + ' records\\n\\n';
                    
                    // Sample data for each group
                    const sampleSize = Math.min(3, rows.length);
                    for (let i = 0; i < sampleSize; i++) {
                        result += '### Record ' + (i + 1) + '\\n';
                        Object.entries(rows[i]).forEach(([key, value]) => {
                            result += '- **' + key + '**: ' + value + '\\n';
                        });
                        result += '\\n';
                    }
                });
                
                return result;
            }
            
            function transformToQAFormat(data, options) {
                // Simplified Q&A format
                let result = '# ' + (options.title || 'Data Q&A') + '\\n\\n';
                
                // Generate some sample Q&A
                result += '## Sample Questions and Answers\\n\\n';
                
                result += '**Q: What kind of data is in this dataset?**\\n\\n';
                result += 'A: This dataset contains ' + data.length + ' records with ' + 
                          Object.keys(data[0] || {}).length + ' attributes.\\n\\n';
                
                result += '**Q: What are the main fields in this data?**\\n\\n';
                result += 'A: The main fields are: ' + Object.keys(data[0] || {}).join(', ') + '\\n\\n';
                
                result += '**Q: Can you show me a sample of the data?**\\n\\n';
                result += 'A: Here is a sample row:\\n\\n';
                
                if (data.length > 0) {
                    Object.entries(data[0]).forEach(([key, value]) => {
                        result += '- **' + key + '**: ' + value + '\\n';
                    });
                }
                
                return result;
            }
            
            function transformToBasicFormat(data, options) {
                // Basic format that works for any data
                let result = '# ' + (options.title || 'Data Analysis') + '\\n\\n';
                
                // Add basic info
                result += '## Overview\\n';
                result += 'Dataset contains ' + data.length + ' records with ' + 
                          Object.keys(data[0] || {}).length + ' columns.\\n\\n';
                
                // Add column list
                result += '## Columns\\n';
                const columns = Object.keys(data[0] || {});
                columns.forEach(col => {
                    result += '- ' + col + '\\n';
                });
                result += '\\n';
                
                // Add data sample
                result += '## Data Sample\\n\\n';
                const sampleSize = Math.min(options.sampleSize || 5, data.length);
                
                for (let i = 0; i < sampleSize; i++) {
                    result += '### Record ' + (i + 1) + '\\n';
                    columns.forEach(col => {
                        result += '- **' + col + '**: ' + (data[i][col] || 'NULL') + '\\n';
                    });
                    result += '\\n';
                }
                
                return result;
            }
        `], { type: 'application/javascript' });

        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
            if (e.data.type === 'complete') {
                this.llmOptimizedText = e.data.result;
                worker.terminate();
                URL.revokeObjectURL(workerUrl); // Clean up the URL
            } else if (e.data.type === 'error') {
                console.error('Worker error:', e.data.message);
                this.llmOptimizedText = this.createBasicFallbackText();
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
            }
        };

        worker.onerror = (error) => {
            console.error('Worker initialization error:', error);
            this.llmOptimizedText = this.createBasicFallbackText();
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };

        // Send data to the worker
        worker.postMessage({
            data: this.data,
            options: options
        });
    }

    /**
     * Create a basic fallback text representation when transformation fails
     * @returns {string} Basic text representation
     */
    createBasicFallbackText() {
        if (!this.data || !this.meta) {
            return "No data available for processing";
        }
        
        let result = `# Excel/CSV Data Analysis\n\n`;
        
        // Add basic info
        result += `## Data Overview\n`;
        result += `- Dataset contains ${this.data.length} rows and ${this.meta.fields.length} columns\n`;
        result += `- Columns: ${this.meta.fields.join(', ')}\n\n`;
        
        // Add sample of the data
        result += `## Data Sample\n\n`;
        
        // Table header
        result += `| ${this.meta.fields.join(' | ')} |\n`;
        result += `| ${this.meta.fields.map(() => '---').join(' | ')} |\n`;
        
        // First 10 rows
        const sampleSize = Math.min(10, this.data.length);
        for (let i = 0; i < sampleSize; i++) {
            const rowValues = this.meta.fields.map(field => {
                const val = this.data[i][field];
                return (val !== null && val !== undefined) ? String(val).substring(0, 50) : 'NULL';
            });
            result += `| ${rowValues.join(' | ')} |\n`;
        }
        
        return result;
    }

    /**
     * Show the analyzer with the provided data
     */
    showAnalyzer(data, meta) {
        this.data = data;
        this.meta = meta;
        this.initialize();

        // Update UI elements with batched rendering for large datasets
        if (data.length > 1000) {
            // For large datasets, update UI in stages to prevent freezing
            this.updateLargeDataPreview();
        } else {
            // For smaller datasets, update everything at once
            this.updateDataPreview();
        }
        
        this.updateColumnOptions();
        
        // Show the modal (ensure previous ones are closed)
        this.cleanupModal();
        const modal = new bootstrap.Modal(this.modalElement);
        modal.show();
    }

    /**
     * Update the data preview table for large datasets
     */
    updateLargeDataPreview() {
        const previewTable = document.getElementById('csv-preview-table');
        if (!previewTable || !this.data || !this.meta) return;

        // First, show a loading indicator
        previewTable.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary"></div><p class="mt-2">Preparing data preview...</p></div>';
        
        // Update stats immediately since it's a quick operation
        this.updateDatasetStats();
        
        // Use setTimeout to yield to the UI thread before rendering the table
        setTimeout(() => {
            const sampleRows = this.data.slice(0, 5);
            
            // Build the table header first
            let tableHTML = '<table class="table table-striped table-bordered">';
            tableHTML += '<thead><tr>';
            this.meta.fields.forEach(field => {
                tableHTML += `<th>${field}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            
            // Update with just the header first
            previewTable.innerHTML = tableHTML + '<tr><td colspan="' + this.meta.fields.length + 
                '"><div class="text-center p-2"><div class="spinner-border spinner-border-sm text-primary"></div> Loading rows...</div></td></tr></tbody></table>';
            
            // Then use requestAnimationFrame to add the rows in the next frame
            requestAnimationFrame(() => {
                let rowsHTML = '';
                
                // Generate HTML for each row
                sampleRows.forEach(row => {
                    rowsHTML += '<tr>';
                    this.meta.fields.forEach(field => {
                        const value = row[field];
                        rowsHTML += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
                    });
                    rowsHTML += '</tr>';
                });
                
                // Update the table body
                const tbody = previewTable.querySelector('tbody');
                if (tbody) {
                    tbody.innerHTML = rowsHTML;
                }
                
                // If there are many fields, add horizontal scrolling to the table
                if (this.meta.fields.length > 8) {
                    previewTable.style.overflowX = 'auto';
                    previewTable.style.maxWidth = '100%';
                    previewTable.style.display = 'block';
                }
                
                // Initialize any post-rendering behaviors
                setTimeout(() => {
                    this.initializeDataPreviewInteractions();
                }, 100);
            });
        }, 50);
    }

    /**
     * Initialize interactive behaviors for data preview
     */
    initializeDataPreviewInteractions() {
        // Add any interactive behaviors for the data preview here
        // For example, column sorting, filtering, etc.
        
        // Add tooltip for large cells that might be truncated
        const tableCells = document.querySelectorAll('#csv-preview-table td');
        tableCells.forEach(cell => {
            if (cell.offsetWidth < cell.scrollWidth) {
                cell.title = cell.textContent;
                cell.style.cursor = 'help';
            }
        });
    }

    /**
     * Update the data preview table
     */
    updateDataPreview() {
        const previewTable = document.getElementById('csv-preview-table');
        if (!previewTable || !this.data || !this.meta) return;

        const sampleRows = this.data.slice(0, 5);
        let tableHTML = '<table class="table table-striped table-bordered">';
        
        // Header row
        tableHTML += '<thead><tr>';
        this.meta.fields.forEach(field => {
            tableHTML += `<th>${field}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        // Data rows
        sampleRows.forEach(row => {
            tableHTML += '<tr>';
            this.meta.fields.forEach(field => {
                const value = row[field];
                tableHTML += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';
        previewTable.innerHTML = tableHTML;

        // Update dataset stats
        this.updateDatasetStats();
    }

    /**
     * Update dataset statistics
     */
    updateDatasetStats() {
        const statsContainer = document.getElementById('csv-dataset-stats');
        if (!statsContainer) return;

        const rowCount = this.data.length;
        const columnCount = this.meta.fields.length;
        
        statsContainer.innerHTML = `
            <div class="mb-3">
                <strong>Rows:</strong> ${rowCount}
            </div>
            <div class="mb-3">
                <strong>Columns:</strong> ${columnCount}
            </div>
            <div class="mb-3">
                <strong>Data Point Count:</strong> ${rowCount * columnCount}
            </div>
        `;
    }

    /**
     * Update column options for grouping
     */
    updateColumnOptions() {
        const groupBySelect = document.getElementById('group-by-select');
        if (!groupBySelect) return;

        // Clear existing options
        groupBySelect.innerHTML = '<option value="">Group by...</option>';

        // Add column options
        this.meta.fields.forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            groupBySelect.appendChild(option);
        });
    }

    /**
     * Update UI based on optimization strategy
     */
    updateOptimizationUI() {
        const strategy = document.querySelector('input[name="optimizationStrategy"]:checked').value;
        const groupBySelect = document.getElementById('group-by-select');
        
        // Enable/disable group by select based on strategy
        if (groupBySelect) {
            groupBySelect.disabled = strategy !== 'hierarchical';
        }
        
        // Generate preview
        this.updateTransformationPreview(strategy);
    }

    /**
     * Update sample size display
     */
    updateSampleSize() {
        const sampleSizeRange = document.getElementById('sample-size-range');
        const sampleSizeDisplay = document.getElementById('sample-size-value');
        
        if (sampleSizeRange && sampleSizeDisplay) {
            sampleSizeDisplay.textContent = `${sampleSizeRange.value} rows`;
            this.updateTransformationPreview();
        }
    }

    /**
     * Update transformation preview with optimized rendering
     */
    updateTransformationPreview(strategy) {
        // Get current strategy if not provided
        if (!strategy) {
            strategy = document.querySelector('input[name="optimizationStrategy"]:checked').value;
        }
        
        const previewContainer = document.getElementById('transformation-preview');
        if (!previewContainer) return;
        
        // Show loading indicator
        previewContainer.innerHTML = `
            <div class="text-center p-3">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Generating preview...</p>
            </div>
        `;
        
        const sampleSize = parseInt(document.getElementById('sample-size-range').value);
        const groupByField = document.getElementById('group-by-select').value;
        
        // Use setTimeout to prevent UI freezing during preview generation
        setTimeout(() => {
            // Generate a small preview of the transformation
            const options = {
                format: strategy,
                title: 'Preview',
                sampleSize: Math.min(3, sampleSize),
                groupBy: groupByField || undefined
            };
            
            let previewText = '';
            
            try {
                switch (strategy) {
                    case 'narrative':
                        previewText = window.csvAnalyzer.transformToNarrative(options);
                        break;
                    case 'tabular':
                        previewText = window.csvAnalyzer.transformToTableFormat(options);
                        break;
                    case 'hierarchical':
                        previewText = window.csvAnalyzer.transformToHierarchicalFormat(options);
                        break;
                    case 'qa':
                        previewText = window.csvAnalyzer.transformToQAFormat(options);
                        break;
                    default:
                        previewText = "Preview not available for this format.";
                }
                
                // Truncate if too long
                if (previewText.length > 1000) {
                    previewText = previewText.substring(0, 1000) + '...\n(Preview truncated)';
                }
                
                // Display as markdown
                previewContainer.innerHTML = `<pre class="p-3 bg-light">${previewText}</pre>`;
                
            } catch (error) {
                console.error('Error generating preview:', error);
                previewContainer.innerHTML = `<div class="alert alert-danger">Error generating preview: ${error.message}</div>`;
            }
        }, 50); // Short delay to allow UI to update
    }

    /**
     * Switch active tab
     */
    switchTab(tabId) {
        // Update active tab
        document.querySelectorAll('.csv-analyzer-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        // Update active pane
        document.querySelectorAll('.csv-analyzer-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabId}`);
        });
    }
}

// Create global instance
window.csvAnalyzerUI = new CSVAnalyzerUI();
