/**
 * Web Worker for Excel file processing
 * This worker handles computationally intensive Excel parsing operations
 * to prevent UI freezing on the main thread.
 */

// Import xlsx library
importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

// Listen for messages from the main thread
self.onmessage = function(e) {
    const { action, data } = e.data;
    
    if (action === 'processExcel') {
        try {
            processExcelFile(data);
        } catch (error) {
            self.postMessage({
                type: 'error',
                message: 'Error processing Excel file: ' + error.message
            });
        }
    }
};

/**
 * Process Excel file data
 * @param {ArrayBuffer} data - The Excel file data
 */
function processExcelFile(data) {
    // Report progress
    self.postMessage({ type: 'progress', progress: 0.3, message: 'Parsing Excel file in web worker...' });
    
    try {
        // Read the Excel file
        const workbook = XLSX.read(data, { type: 'array' });
        
        self.postMessage({ type: 'progress', progress: 0.5, message: 'Excel file parsed, processing worksheet...' });
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        self.postMessage({ type: 'progress', progress: 0.7, message: 'Converting to text format...' });
        
        // Process the JSON data
        const result = formatExcelText(jsonData);
        
        self.postMessage({ type: 'progress', progress: 0.9, message: 'Excel processing complete!' });
        
        // Return the result
        self.postMessage({
            type: 'complete',
            result: result
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: 'Error in Excel worker: ' + error.message
        });
    }
}

/**
 * Format Excel data as text
 * @param {Array} data - Excel data as JSON
 * @returns {string} Formatted text representation
 */
function formatExcelText(data) {
    if (!data || !data.length) return "No data found in Excel file";
    
    let textContent = `# Excel Data\n\n`;
    
    // Table overview
    textContent += `## Table Overview\n`;
    textContent += `- ${data.length} rows and ${Object.keys(data[0]).length} columns\n`;
    textContent += `- Columns: ${Object.keys(data[0]).join(', ')}\n\n`;
    
    // Add a sample of the data as a table (first 10 rows)
    const sampleSize = Math.min(10, data.length);
    textContent += `## Data Sample (${sampleSize} rows)\n\n`;
    
    // Add table headers
    const headers = Object.keys(data[0]);
    textContent += headers.join(' | ') + '\n';
    textContent += headers.map(() => '---').join(' | ') + '\n';
    
    // Add sample rows
    for (let i = 0; i < sampleSize; i++) {
        const values = headers.map(header => {
            const val = data[i][header];
            return val !== null && val !== undefined ? String(val).substring(0, 50) : 'NULL';
        });
        textContent += values.join(' | ') + '\n';
    }
    
    // Add data categories and patterns
    textContent += `\n## Data Analysis\n`;
    textContent += `### Column Types\n`;
    
    headers.forEach(header => {
        const values = data.map(row => row[header]).filter(Boolean);
        const sampleValue = values[0] || '';
        let valueType = 'unknown';
        
        if (typeof sampleValue === 'number') {
            valueType = 'numeric';
        } else if (typeof sampleValue === 'string') {
            // Check if it's a date
            if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(sampleValue) || !isNaN(Date.parse(sampleValue))) {
                valueType = 'date';
            } else {
                valueType = 'text';
            }
        } else if (typeof sampleValue === 'boolean') {
            valueType = 'boolean';
        }
        
        textContent += `- **${header}**: ${valueType} (Example: "${sampleValue}")\n`;
    });
    
    return textContent;
}
