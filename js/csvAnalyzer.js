/**
 * Advanced CSV Analyzer with LLM Integration
 * Performs intelligent analysis of CSV data and creates LLM-friendly representations
 */
class CSVAnalyzer {
    constructor() {
        this.data = null;
        this.meta = null;
        this.analysis = null;
        this.llmInsights = null;
        this.narratives = null;
        this.schema = null;
    }

    /**
     * Initialize the analyzer with CSV data
     * @param {Array} data - Parsed CSV data (array of objects)
     * @param {Object} meta - CSV metadata (headers, etc.)
     */
    initialize(data, meta) {
        this.data = data;
        this.meta = meta;
        this.analysis = null;
        this.llmInsights = null;
        this.narratives = null;
    }

    /**
     * Perform comprehensive analysis of the CSV data
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeData() {
        if (!this.data || !this.meta) {
            throw new Error('No data loaded for analysis');
        }

        // Basic statistical analysis
        this.analysis = this.performStatisticalAnalysis();
        
        // Generate a schema for the data
        this.schema = this.generateDataSchema();
        
        // Generate narratives from the data
        this.narratives = await this.generateDataNarratives();
        
        // Detect relationships between columns
        this.relationships = this.detectRelationships();
        
        // For larger datasets, get strategic sampling guidance
        if (this.data.length > 100) {
            this.samplingStrategy = this.recommendSamplingStrategy();
        }

        return {
            schema: this.schema,
            analysis: this.analysis,
            narratives: this.narratives,
            relationships: this.relationships,
            samplingStrategy: this.samplingStrategy
        };
    }

    /**
     * Perform statistical analysis of the data
     * @private
     */
    performStatisticalAnalysis() {
        const analysis = {
            rowCount: this.data.length,
            columnStats: {},
            dataQuality: { 
                missingValues: {},
                outliers: {},
                inconsistencies: {}
            }
        };

        // Analyze each column
        this.meta.fields.forEach(field => {
            const columnData = this.data.map(row => row[field]);
            const dataType = this.inferDataType(columnData);
            
            analysis.columnStats[field] = {
                dataType,
                nonNullCount: columnData.filter(val => val !== null && val !== undefined && val !== '').length,
                uniqueCount: new Set(columnData.map(v => String(v))).size
            };

            // Type-specific analysis
            if (dataType === 'numeric') {
                const numbers = columnData.filter(v => typeof v === 'number').map(v => v);
                analysis.columnStats[field].min = Math.min(...numbers);
                analysis.columnStats[field].max = Math.max(...numbers);
                analysis.columnStats[field].avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
                analysis.columnStats[field].sum = numbers.reduce((a, b) => a + b, 0);
                
                // Detect outliers (simple z-score method)
                const mean = analysis.columnStats[field].avg;
                const stdDev = Math.sqrt(numbers.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / numbers.length);
                
                analysis.dataQuality.outliers[field] = columnData
                    .map((val, idx) => ({ value: val, index: idx }))
                    .filter(item => typeof item.value === 'number' && Math.abs((item.value - mean) / stdDev) > 3);
            }
            
            // Calculate missing values
            analysis.dataQuality.missingValues[field] = columnData
                .map((val, idx) => ({ rowIndex: idx, isEmpty: val === null || val === undefined || val === '' }))
                .filter(item => item.isEmpty);
                
            // Check data consistency (format patterns for strings)
            if (dataType === 'string') {
                const patterns = this.detectPatterns(columnData);
                analysis.columnStats[field].patterns = patterns;
                
                // Find inconsistencies in patterns
                if (patterns.dominant && patterns.variants.length > 0) {
                    analysis.dataQuality.inconsistencies[field] = patterns.variants;
                }
            }
        });

        return analysis;
    }

    /**
     * Infer the data type of a column
     * @param {Array} values - Column values
     * @private
     */
    inferDataType(values) {
        const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
        if (nonEmpty.length === 0) return 'unknown';
        
        const types = nonEmpty.map(v => {
            if (typeof v === 'number') return 'numeric';
            if (typeof v === 'boolean') return 'boolean';
            
            // Check if it's a date
            if (typeof v === 'string') {
                if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(v) || !isNaN(Date.parse(v)))
                    return 'date';
                return 'string';
            }
            
            return 'unknown';
        });
        
        // Get most common type
        const typeCounts = types.reduce((counts, type) => {
            counts[type] = (counts[type] || 0) + 1;
            return counts;
        }, {});
        
        const dominantType = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
            
        return dominantType;
    }

    /**
     * Detect patterns in string data
     * @param {Array} values - String values
     * @private
     */
    detectPatterns(values) {
        const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '' && typeof v === 'string');
        if (nonEmpty.length === 0) return { patterns: [] };
        
        // Simplified pattern detection
        const patterns = {
            allNumeric: /^\d+$/,
            alphanumeric: /^[a-zA-Z0-9]+$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
            phone: /^[\d\s()+.-]+$/
        };
        
        const matches = {};
        
        nonEmpty.forEach(val => {
            Object.entries(patterns).forEach(([name, regex]) => {
                if (regex.test(val)) {
                    matches[name] = (matches[name] || 0) + 1;
                }
            });
        });
        
        // Find dominant pattern
        let dominant = null;
        let maxCount = 0;
        
        Object.entries(matches).forEach(([pattern, count]) => {
            if (count > maxCount && count > nonEmpty.length * 0.7) {
                dominant = pattern;
                maxCount = count;
            }
        });
        
        // Find variants that don't match the dominant pattern
        const variants = [];
        if (dominant) {
            nonEmpty.forEach((val, idx) => {
                if (!patterns[dominant].test(val)) {
                    variants.push({ value: val, rowIndex: idx });
                }
            });
        }
        
        return {
            dominant,
            matches,
            variants: variants.slice(0, 10) // Limit to 10 examples
        };
    }

    /**
     * Generate a structured schema for the data
     * @private
     */
    generateDataSchema() {
        if (!this.analysis) return null;
        
        const schema = {
            title: 'CSV Data Schema',
            columns: {}
        };
        
        this.meta.fields.forEach(field => {
            const colStats = this.analysis.columnStats[field];
            
            schema.columns[field] = {
                type: colStats.dataType,
                description: this.generateColumnDescription(field, colStats),
                constraints: this.inferConstraints(field, colStats)
            };
        });
        
        return schema;
    }

    /**
     * Generate a natural language description of a column
     * @param {string} field - Column name
     * @param {Object} stats - Column statistics
     * @private
     */
    generateColumnDescription(field, stats) {
        const type = stats.dataType;
        const uniqueRatio = stats.uniqueCount / this.data.length;
        let description = `${field} (${type})`;
        
        if (uniqueRatio === 1) {
            description += ": Contains unique values, possibly an identifier or key.";
        } else if (uniqueRatio > 0.9) {
            description += ": Almost all values are unique.";
        } else if (uniqueRatio < 0.1) {
            description += ": Low cardinality, likely a category or status field.";
        }
        
        if (type === 'numeric') {
            description += ` Values range from ${stats.min} to ${stats.max}, averaging ${stats.avg.toFixed(2)}.`;
        }
        
        if (stats.nonNullCount < this.data.length) {
            const missingPercentage = ((this.data.length - stats.nonNullCount) / this.data.length * 100).toFixed(1);
            description += ` Missing data: ${missingPercentage}%.`;
        }
        
        return description;
    }

    /**
     * Infer constraints for a column
     * @param {string} field - Column name
     * @param {Object} stats - Column statistics
     * @private
     */
    inferConstraints(field, stats) {
        const constraints = {
            required: stats.nonNullCount === this.data.length,
            unique: stats.uniqueCount === this.data.length
        };
        
        if (stats.dataType === 'numeric') {
            constraints.min = stats.min;
            constraints.max = stats.max;
        }
        
        return constraints;
    }

    /**
     * Generate narrative descriptions of the data using LLM
     * @returns {Promise<Object>} Narratives about the data
     * @private
     */
    async generateDataNarratives() {
        if (!this.analysis) return null;
        
        // Prepare a concise data summary for the LLM
        const dataSummary = this.createDataSummaryForLLM();
        
        // Generate narratives using LLM
        try {
            // First, get column interpretations for better context
            const columnInterpretations = await this.generateColumnInterpretations();
            
            const narratives = {
                overview: await this.callLLMForNarrative(dataSummary, 'overview'),
                insights: await this.callLLMForNarrative(dataSummary, 'insights'),
                queryExamples: await this.callLLMForNarrative(dataSummary, 'queries'),
                transformations: await this.callLLMForNarrative(dataSummary, 'transformations'),
                columnMeanings: columnInterpretations // Store column interpretations
            };
            
            return narratives;
        } catch (error) {
            console.error('Error generating narratives:', error);
            return {
                overview: 'Could not generate narratives. Please check your API configuration.',
                error: error.message
            };
        }
    }

    /**
     * Generate LLM-based interpretations of column meanings
     * @returns {Promise<Object>} Column interpretations
     * @private
     */
    async generateColumnInterpretations() {
        if (!llmConnector.isApiConfigured()) {
            return {};
        }
        
        // Create a detailed representation of columns for LLM to analyze
        let columnInfo = `COLUMN SEMANTIC ANALYSIS REQUEST:\n\n`;
        
        // Add basic dataset context
        columnInfo += `Dataset contains ${this.data.length} rows with ${this.meta.fields.length} columns.\n\n`;
        
        // Add detailed column information with examples and stats
        columnInfo += `COLUMN DETAILS:\n`;
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            columnInfo += `### Column: ${field}\n`;
            columnInfo += `- Data Type: ${stats.dataType}\n`;
            columnInfo += `- Non-null: ${stats.nonNullCount}/${this.data.length} (${(stats.nonNullCount/this.data.length*100).toFixed(1)}%)\n`;
            columnInfo += `- Unique values: ${stats.uniqueCount}\n`;
            
            // Add type-specific information
            if (stats.dataType === 'numeric') {
                columnInfo += `- Range: ${stats.min} to ${stats.max}, avg: ${stats.avg.toFixed(2)}\n`;
            } else if (stats.dataType === 'string' && stats.patterns && stats.patterns.dominant) {
                columnInfo += `- Pattern: ${stats.patterns.dominant}\n`;
            }
            
            // Add examples (up to 5 unique values)
            const examples = [...new Set(this.data.slice(0, 10).map(row => row[field]))].slice(0, 5);
            columnInfo += `- Examples: ${examples.map(ex => `"${ex}"`).join(', ')}\n\n`;
        });
        
        // Add sample rows to show relationships
        columnInfo += `\nSAMPLE ROWS (to understand relationships):\n`;
        for (let i = 0; i < Math.min(3, this.data.length); i++) {
            columnInfo += `Row ${i+1}:\n`;
            this.meta.fields.forEach(field => {
                columnInfo += `- ${field}: ${this.data[i][field]}\n`;
            });
            columnInfo += '\n';
        }
        
        // Create the prompt
        const prompt = `I need you to analyze these database columns and provide a semantic interpretation for each one. 
For each column, please provide:
1. A clear description of what the column likely represents in 1-2 sentences
2. The business context or domain this column relates to
3. If applicable, how this column relates to other columns
4. Possible alternative names or standard terminology for this field

Please format your response as a JSON object where each key is the column name and the value is an object with these properties:
- description: brief description of what the column represents
- context: business context or domain
- relationships: how it relates to other columns (if applicable)
- standardTerminology: alternative standard names for this field

Here's the column information:

${columnInfo}`;
        
        // Call LLM
        const messages = [
            { role: 'system', content: 'You are a data analysis expert specializing in database schema understanding and standardization. Return responses as clean, properly formatted JSON without any explanatory text.' },
            { role: 'user', content: prompt }
        ];
        
        try {
            const result = await llmConnector.sendRequest(messages);
            
            // Try multiple approaches to extract valid JSON from the response
            return this.extractValidJson(result);
        } catch (error) {
            console.error('Error getting column interpretations:', error);
            // Return a basic object with column names
            return this.createBasicColumnMeanings();
        }
    }

    /**
     * Attempt to extract valid JSON from a string using multiple methods
     * @param {string} jsonString - String that may contain JSON
     * @returns {Object} Extracted JSON object or fallback object
     * @private
     */
    extractValidJson(jsonString) {
        // First try: Direct JSON parsing
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Could not parse LLM response as JSON directly, trying alternative methods');
        }
        
        // Second try: Extract JSON from code blocks
        try {
            const jsonCodeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
                return JSON.parse(jsonCodeBlockMatch[1]);
            }
        } catch (error) {
            console.warn('Could not extract JSON from code blocks');
        }
        
        // Third try: Extract JSON object pattern
        try {
            const jsonObjectMatch = jsonString.match(/(\{[\s\S]*\})/);
            if (jsonObjectMatch && jsonObjectMatch[1]) {
                return JSON.parse(jsonObjectMatch[1]);
            }
        } catch (error) {
            console.warn('Could not extract JSON object pattern');
        }
        
        // Fourth try: Cleanup and fix common JSON formatting issues
        try {
            // Remove markdown backticks and json language identifier
            let cleanedJson = jsonString.replace(/```json\s*|\s*```/g, '');
            
            // Handle JavaScript-style comments that might be in the response
            cleanedJson = cleanedJson.replace(/\/\/.*$/gm, '');
            cleanedJson = cleanedJson.replace(/\/\*[\s\S]*?\*\//g, '');
            
            // Fix unquoted property names
            cleanedJson = cleanedJson.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
            
            // Fix single quotes used for strings
            cleanedJson = cleanedJson.replace(/:\s*'([^']*)'/g, ':"$1"');
            
            // Remove trailing commas in objects and arrays
            cleanedJson = cleanedJson.replace(/,(\s*[\]}])/g, '$1');
            
            // Use JSON5 if available (more lenient JSON parser)
            if (typeof JSON5 !== 'undefined') {
                return JSON5.parse(cleanedJson);
            }
            
            return JSON.parse(cleanedJson);
        } catch (error) {
            console.warn('Failed to clean and parse JSON:', error);
            
            // Final try: Use a regex-based approach to extract key-value pairs
            return this.extractJsonWithRegex(jsonString);
        }
    }

    /**
     * Extract JSON-like data using regex when all other methods fail
     * @param {string} text - The text to extract from
     * @returns {Object} Extracted data as an object
     * @private
     */
    extractJsonWithRegex(text) {
        const result = {};
        
        // Simple regex to find column sections in the text
        const columnSections = text.split(/(?=###\s*Column:|^[A-Za-z0-9_]+:)/m);
        
        for (const section of columnSections) {
            // Try to identify column name
            const columnMatch = section.match(/^(?:###\s*Column:\s*)?([A-Za-z0-9_]+)(?::|\s*$)/m);
            if (!columnMatch) continue;
            
            const columnName = columnMatch[1].trim();
            
            // Extract potential description
            const descriptionMatch = section.match(/description[:\s]+([^\n]+)/i);
            const description = descriptionMatch ? descriptionMatch[1].trim().replace(/['"]/g, '') : 
                                "No description available";
            
            // Extract potential context
            const contextMatch = section.match(/context[:\s]+([^\n]+)/i);
            const context = contextMatch ? contextMatch[1].trim().replace(/['"]/g, '') : 
                            "Unknown context";
            
            // Create an entry for this column
            result[columnName] = {
                description: description,
                context: context,
                relationships: "Not specified",
                standardTerminology: columnName
            };
        }
        
        // If regex extraction failed completely, create basic meanings
        if (Object.keys(result).length === 0) {
            return this.createBasicColumnMeanings();
        }
        
        return result;
    }

    /**
     * Create basic column meanings when extraction fails
     * @returns {Object} Basic column meanings
     * @private
     */
    createBasicColumnMeanings() {
        const basicMeanings = {};
        
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            let description = `Column containing ${stats.dataType} data`;
            
            if (stats.dataType === 'numeric') {
                description += ` with values ranging from ${stats.min} to ${stats.max}`;
            } else if (stats.uniqueCount === this.data.length) {
                description += " with unique values (possibly an identifier)";
            } else if (stats.uniqueCount < 10) {
                description += " with few distinct values (possibly a category)";
            }
            
            basicMeanings[field] = {
                description: description,
                context: "Auto-generated context",
                relationships: "Automatically detected",
                standardTerminology: field
            };
        });
        
        return basicMeanings;
    }

    /**
     * Create a concise summary of the data for LLM prompting
     * @private
     */
    createDataSummaryForLLM() {
        const sampleSize = Math.min(5, this.data.length);
        const sample = this.data.slice(0, sampleSize);
        
        let summary = `CSV DATA SUMMARY:\n`;
        summary += `- ${this.data.length} rows and ${this.meta.fields.length} columns\n`;
        summary += `- Columns: ${this.meta.fields.join(', ')}\n\n`;
        
        // Add column information
        summary += `COLUMN DETAILS:\n`;
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            summary += `- ${field}: ${stats.dataType}, ${stats.nonNullCount}/${this.data.length} non-null`;
            
            if (stats.dataType === 'numeric') {
                summary += `, range: ${stats.min} to ${stats.max}, avg: ${stats.avg.toFixed(2)}`;
            }
            
            if (stats.uniqueCount === this.data.length) {
                summary += `, UNIQUE VALUES`;
            } else if (stats.uniqueCount < 10) {
                // For categorical data with few unique values, list them
                const categories = [...new Set(this.data.map(row => String(row[field])))];
                summary += `, categories: ${categories.join(', ')}`;
            }
            
            summary += `\n`;
        });
        
        // Add a small sample of the data as a table
        summary += `\nSAMPLE DATA (${sampleSize} rows):\n`;
        
        // Add table headers
        summary += this.meta.fields.join(' | ') + '\n';
        summary += this.meta.fields.map(() => '---').join(' | ') + '\n';
        
        // Add table rows
        sample.forEach(row => {
            const values = this.meta.fields.map(field => {
                const val = row[field];
                return val !== null && val !== undefined ? String(val).substring(0, 30) : 'NULL';
            });
            summary += values.join(' | ') + '\n';
        });
        
        // Add relationships if detected
        if (this.relationships && Object.keys(this.relationships).length > 0) {
            summary += `\nPOTENTIAL RELATIONSHIPS:\n`;
            Object.entries(this.relationships).forEach(([source, targets]) => {
                targets.forEach(target => {
                    summary += `- ${source} may be related to ${target.column} (${target.type})\n`;
                });
            });
        }
        
        return summary;
    }

    /**
     * Call LLM to generate narratives about the data
     * @param {string} dataSummary - Data summary for context
     * @param {string} narrativeType - Type of narrative to generate
     * @param {AbortSignal} [signal=null] - Optional abort signal for request cancellation
     * @returns {Promise<string>} Generated narrative
     * @private
     */
    async callLLMForNarrative(dataSummary, narrativeType, signal = null) {
        if (!llmConnector.isApiConfigured()) {
            return "API key required to generate intelligent narratives.";
        }
        
        let prompt = "";
        
        switch (narrativeType) {
            case 'overview':
                prompt = `I need a concise overview of this CSV dataset that explains what the data represents in 2-3 sentences. Here's the data summary:\n\n${dataSummary}`;
                break;
            case 'insights':
                prompt = `Based on this CSV data summary, what are 3-5 key insights or patterns that might be valuable to understand? Focus on relationships between columns, data quality issues, and potential business value.\n\n${dataSummary}`;
                break;
            case 'queries':
                prompt = `Based on this CSV data structure, suggest 3-5 interesting questions someone might ask about this data. Format each question conversationally, as if someone was asking an AI assistant about this dataset.\n\n${dataSummary}`;
                break;
            case 'transformations':
                prompt = `Based on this CSV data structure, suggest 2-3 ways the data could be transformed or enhanced to make it more valuable for analysis. Consider aggregations, reshaping, or derived fields. Explain why each transformation would be useful.\n\n${dataSummary}`;
                break;
            default:
                prompt = `Generate a brief summary of this CSV data.\n\n${dataSummary}`;
        }
        
        try {
            // Use a simplified direct call to avoid circular dependencies
            const messages = [
                { role: 'system', content: 'You are a data analysis assistant that helps users understand tabular CSV data.' },
                { role: 'user', content: prompt }
            ];
            
            // Pass the abort signal to sendRequest
            const result = await llmConnector.sendRequest(messages, signal);
            return result;
        } catch (error) {
            console.warn(`Error generating ${narrativeType} narrative:`, error);
            return `Could not generate ${narrativeType} narrative due to an error. You can still analyze the data structure directly.`;
        }
    }

    /**
     * Detect potential relationships between columns
     * @private
     */
    detectRelationships() {
        const relationships = {};
        const fields = this.meta.fields;
        
        // Look for primary key - foreign key relationships
        const uniqueColumns = fields.filter(field => 
            this.analysis.columnStats[field].uniqueCount === this.data.length);
            
        uniqueColumns.forEach(uniqueCol => {
            const uniqueValues = new Set(this.data.map(row => String(row[uniqueCol])));
            
            // Check if values from this unique column appear in other columns
            fields.filter(f => f !== uniqueCol).forEach(otherCol => {
                const otherValues = this.data.map(row => String(row[otherCol]));
                const matchCount = otherValues.filter(v => uniqueValues.has(v)).length;
                
                // If significant overlap, might be a relationship
                if (matchCount > this.data.length * 0.5) {
                    if (!relationships[uniqueCol]) {
                        relationships[uniqueCol] = [];
                    }
                    
                    relationships[uniqueCol].push({
                        column: otherCol,
                        type: 'primary-foreign',
                        matchRatio: matchCount / this.data.length
                    });
                }
            });
        });
        
        // Look for correlated numeric columns
        const numericColumns = fields.filter(field => 
            this.analysis.columnStats[field].dataType === 'numeric');
            
        for (let i = 0; i < numericColumns.length; i++) {
            for (let j = i + 1; j < numericColumns.length; j++) {
                const col1 = numericColumns[i];
                const col2 = numericColumns[j];
                
                // Calculate correlation
                const correlation = this.calculateCorrelation(col1, col2);
                
                if (Math.abs(correlation) > 0.7) {
                    if (!relationships[col1]) {
                        relationships[col1] = [];
                    }
                    
                    relationships[col1].push({
                        column: col2,
                        type: 'correlation',
                        strength: correlation
                    });
                }
            }
        }
        
        return relationships;
    }

    /**
     * Calculate correlation between two numeric columns
     * @param {string} col1 - First column name
     * @param {string} col2 - Second column name
     * @private
     */
    calculateCorrelation(col1, col2) {
        const pairs = this.data
            .map(row => [row[col1], row[col2]])
            .filter(pair => typeof pair[0] === 'number' && typeof pair[1] === 'number');
            
        if (pairs.length < 5) return 0; // Not enough data
        
        const n = pairs.length;
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
        
        for (let i = 0; i < n; i++) {
            const x = pairs[i][0];
            const y = pairs[i][1];
            
            sum1 += x;
            sum2 += y;
            sum1Sq += x * x;
            sum2Sq += y * y;
            pSum += x * y;
        }
        
        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2Sq / n));
        
        return den === 0 ? 0 : num / den;
    }

    /**
     * Recommend sampling strategy for large datasets
     * @private
     */
    recommendSamplingStrategy() {
        const rowCount = this.data.length;
        const strategy = {
            recommendation: 'full',
            explanation: 'Your dataset is small enough to process in full.',
            sampleSize: rowCount,
            sampleMethod: 'none'
        };
        
        // For larger datasets, recommend sampling
        if (rowCount > 1000) {
            const categoricalColumns = this.meta.fields.filter(field => {
                const stats = this.analysis.columnStats[field];
                return stats.uniqueCount < 20 && stats.uniqueCount > 1;
            });
            
            if (categoricalColumns.length > 0) {
                // Stratified sampling by categorical column
                const bestColumn = categoricalColumns[0]; // First one for simplicity
                strategy.recommendation = 'stratified';
                strategy.sampleColumn = bestColumn;
                strategy.sampleSize = Math.min(1000, rowCount);
                strategy.sampleMethod = 'stratified';
                strategy.explanation = `Recommend stratified sampling by "${bestColumn}" to ensure representation of all categories.`;
            } else {
                // Random sampling
                strategy.recommendation = 'random';
                strategy.sampleSize = Math.min(1000, rowCount);
                strategy.sampleMethod = 'random';
                strategy.explanation = 'Recommend random sampling to reduce data size while maintaining overall distribution.';
            }
        }
        
        return strategy;
    }

    /**
     * Create interactive visualization data for the CSV
     * @returns {Object} Visualization data
     */
    generateVisualizationData() {
        // Generate data for various visualization types
        return {
            columnRelationships: this.prepareRelationshipGraphData(),
            dataDistributions: this.prepareDistributionChartData(),
            qualityHeatmap: this.prepareQualityHeatmapData()
        };
    }

    /**
     * Prepare data for relationship graph visualization
     * @private
     */
    prepareRelationshipGraphData() {
        if (!this.relationships) return null;
        
        const nodes = this.meta.fields.map(field => ({
            id: field,
            label: field,
            type: this.analysis.columnStats[field].dataType,
            unique: this.analysis.columnStats[field].uniqueCount === this.data.length
        }));
        
        const links = [];
        
        Object.entries(this.relationships).forEach(([source, targets]) => {
            targets.forEach(target => {
                links.push({
                    source,
                    target: target.column,
                    type: target.type,
                    strength: target.strength || target.matchRatio || 0.5
                });
            });
        });
        
        return { nodes, links };
    }

    /**
     * Prepare data for distribution charts
     * @private
     */
    prepareDistributionChartData() {
        const distributions = {};
        
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            
            if (stats.dataType === 'numeric') {
                // Numeric histogram data
                const values = this.data
                    .map(row => row[field])
                    .filter(v => typeof v === 'number');
                
                if (values.length > 0) {
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const binCount = Math.min(10, stats.uniqueCount);
                    const binSize = (max - min) / binCount;
                    
                    const histogram = Array(binCount).fill(0);
                    
                    values.forEach(v => {
                        const binIndex = Math.min(binCount - 1, Math.floor((v - min) / binSize));
                        histogram[binIndex]++;
                    });
                    
                    distributions[field] = {
                        type: 'histogram',
                        data: histogram,
                        labels: Array(binCount).fill(0).map((_, i) => 
                            `${(min + i * binSize).toFixed(1)} - ${(min + (i + 1) * binSize).toFixed(1)}`)
                    };
                }
            } else if (stats.uniqueCount < 20) {
                // Categorical bar chart data
                const counts = {};
                
                this.data.forEach(row => {
                    const val = String(row[field] || 'NULL');
                    counts[val] = (counts[val] || 0) + 1;
                });
                
                const sortedCounts = Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                
                distributions[field] = {
                    type: 'bar',
                    data: sortedCounts.map(item => item[1]),
                    labels: sortedCounts.map(item => item[0])
                };
            }
        });
        
        return distributions;
    }

    /**
     * Prepare data quality heatmap data
     * @private
     */
    prepareQualityHeatmapData() {
        const quality = {};
        
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            const missingCount = this.data.length - stats.nonNullCount;
            
            quality[field] = {
                completeness: 1 - (missingCount / this.data.length),
                uniqueness: stats.uniqueCount / this.data.length,
                outliers: this.analysis.dataQuality.outliers[field] ? 
                    this.analysis.dataQuality.outliers[field].length / this.data.length : 0,
                consistency: stats.patterns && stats.patterns.variants ? 
                    1 - (stats.patterns.variants.length / this.data.length) : 1
            };
        });
        
        return quality;
    }

    /**
     * Transform the CSV data into optimal format for LLM processing
     * @param {Object} options - Transformation options
     * @returns {string} LLM-friendly text representation
     */
    transformForLLM(options = {}) {
        // Always embed the entire CSV document regardless of preview settings
        return this.transformToFullDocument(options);
    }

    /**
     * Transform the CSV data into a full-document markdown format for embedding
     * This ensures the entire document is processed regardless of UI preview settings
     * @param {Object} options - Transformation options
     * @returns {string} Full document representation of the CSV
     * @private
     */
    transformToFullDocument(options) {
        // If narrative format is requested, use our enhanced narrative transformation
        if (options.format === 'narrative') {
            return this.transformToContextualNarrative(options);
        }
        
        // Otherwise, proceed with the existing implementation
        let result = `# ${options.title || 'Full CSV Document'}\n\n`;
        
        // If we have a LLM-generated overview, use it first
        if (this.narratives && this.narratives.overview) {
            result += `## Overview\n`;
            result += `${this.narratives.overview}\n\n`;
        }
        
        // Add basic data dimensions
        result += `## Data Overview\n`;
        result += `This dataset contains ${this.data.length} records with ${this.meta.fields.length} attributes per record.\n`;
        result += `- Columns: ${this.meta.fields.join(', ')}\n\n`;
        
        // Check if we have LLM-interpreted column meanings
        const hasColumnMeanings = this.narratives && this.narratives.columnMeanings && 
                                 Object.keys(this.narratives.columnMeanings).length > 0;
        
        // Add data dictionary with LLM interpretations if available
        if (hasColumnMeanings) {
            result += `## Data Dictionary (with AI Interpretations)\n\n`;
            
            this.meta.fields.forEach(field => {
                result += `### ${field}\n`;
                
                // Add LLM interpretation if available
                if (this.narratives.columnMeanings[field]) {
                    const meaning = this.narratives.columnMeanings[field];
                    if (meaning.description) {
                        result += `**Meaning**: ${meaning.description}\n`;
                    }
                    if (meaning.context) {
                        result += `**Business Context**: ${meaning.context}\n`;
                    }
                    if (meaning.relationships) {
                        result += `**Relationships**: ${meaning.relationships}\n`;
                    }
                    if (meaning.standardTerminology) {
                        result += `**Standard Terminology**: ${meaning.standardTerminology}\n`;
                    }
                    result += `\n`;
                }
            });
        }
        
        // Check if analysis is available before attempting to access nested properties
        if (this.analysis && this.analysis.analysis && this.analysis.analysis.columns) {
            // Include column analysis
            result += `## Column Analysis\n`;
            this.meta.fields.forEach(field => {
                const stats = this.analysis.analysis.columns[field];
                if (!stats) return; // Skip if stats not available for this field
                
                result += `### ${field}\n`;
                result += `- Data Type: ${stats.dataType}\n`;
                result += `- Non-null values: ${stats.nonNullCount}/${this.data.length} (${(100 - stats.nullPercentage).toFixed(1)}%)\n`;
                result += `- Unique values: ${stats.uniqueValueCount}\n`;
                
                if (stats.dataType === 'numeric') {
                    result += `- Range: ${stats.min} to ${stats.max}\n`;
                    result += `- Average: ${stats.avg ? stats.avg.toFixed(2) : 'N/A'}\n`;
                } else if (stats.dataType === 'string') {
                    result += `- Length range: ${stats.stringStats.minLength} to ${stats.stringStats.maxLength} characters\n`;
                }
                result += `\n`;
            });
        } else {
            // If analysis isn't available, include a basic description
            result += `## Basic Column Information\n`;
            this.meta.fields.forEach(field => {
                result += `### ${field}\n`;
                
                // Generate basic type inference from the first few rows
                const sampleValues = this.data.slice(0, 5).map(row => row[field]);
                const inferredType = this.inferBasicType(sampleValues);
                
                result += `- Data Type: ${inferredType}\n`;
                result += `- Example values: ${sampleValues.map(v => v !== null && v !== undefined ? String(v) : 'NULL').join(', ')}\n\n`;
            });
        }
        
        // Include all data rows (not just the preview)
        result += `## Full Dataset (${this.data.length} rows)\n\n`;
        
        // Table header
        result += `| ${this.meta.fields.join(' | ')} |\n`;
        result += `| ${this.meta.fields.map(() => '---').join(' | ')} |\n`;
        
        // All rows (full document)
        this.data.forEach(row => {
            const rowValues = this.meta.fields.map(field => {
                const val = row[field];
                return (val !== null && val !== undefined) ? String(val) : 'NULL';
            });
            result += `| ${rowValues.join(' | ')} |\n`;
        });
        
        // Include key insights if available
        if (this.analysis && this.analysis.narratives && this.analysis.narratives.insights) {
            result += `\n## Key Insights\n${this.analysis.narratives.insights}\n`;
        }
        
        return result;
    }

    /**
     * Transform data to narrative format with enhanced contextual associations
     * Each datapoint is associated with its column name or semantic meaning
     * @param {Object} options - Transformation options
     * @returns {string} Contextual narrative of the CSV data
     * @private
     */
    transformToContextualNarrative(options) {
        let narrative = `# ${options.title || 'Contextual Data Narrative'}\n\n`;
        
        // Add dataset overview
        narrative += `## Data Overview\n`;
        narrative += `This dataset contains ${this.data.length} records with ${this.meta.fields.length} attributes per record.\n\n`;
        
        // Add LLM-generated overview if available
        if (this.narratives && this.narratives.overview) {
            narrative += `${this.narratives.overview}\n\n`;
        }
        
        // Add column meanings section to help establish context
        const hasColumnMeanings = this.narratives && this.narratives.columnMeanings && 
                                Object.keys(this.narratives.columnMeanings).length > 0;
        
        if (hasColumnMeanings) {
            narrative += `## Column Context Reference\n`;
            this.meta.fields.forEach(field => {
                if (this.narratives.columnMeanings[field]) {
                    const meaning = this.narratives.columnMeanings[field];
                    narrative += `- **${field}**: ${meaning.description || 'No interpretation available.'}\n`;
                } else {
                    narrative += `- **${field}**: ${field}\n`;
                }
            });
            narrative += `\n`;
        }
        
        // Calculate optimal chunk size based on row size
        const chunkingStrategy = this.determineOptimalChunkingStrategy();
        narrative += `## Records (${chunkingStrategy.description})\n\n`;
        
        // Group rows into optimal chunks
        const chunks = this.createContextualChunks(chunkingStrategy);
        
        // Add each chunk as a separate section
        chunks.forEach((chunk, chunkIndex) => {
            narrative += `### Chunk ${chunkIndex + 1}\n\n`;
            
            chunk.rows.forEach((row, rowIndex) => {
                narrative += `**Record ${chunk.startRowIndex + rowIndex + 1}:** `;
                
                // Create a coherent sentence for the record with column context
                const recordNarrative = this.createRowNarrative(row);
                narrative += `${recordNarrative}\n\n`;
            });
        });
        
        // Include key insights if available
        if (this.narratives && this.narratives.insights) {
            narrative += `## Key Insights\n${this.narratives.insights}\n\n`;
        }
        
        // Add query suggestions if available
        if (this.narratives && this.narratives.queryExamples) {
            narrative += `## Suggested Questions\n`;
            
            // Extract questions from narrative
            const questions = this.narratives.queryExamples
                .split('\n')
                .filter(line => line.includes('?') || line.trim().startsWith('-'))
                .map(q => q.replace(/^[\s\d\-\.\•]+/, '').trim())
                .filter(q => q);
                
            questions.forEach(q => {
                narrative += `- ${q}\n`;
            });
            narrative += `\n`;
        }
        
        return narrative;
    }

    /**
     * Determine the optimal chunking strategy for the dataset
     * @returns {Object} Chunking strategy information
     * @private
     */
    determineOptimalChunkingStrategy() {
        // Estimate the size of each row in tokens
        const avgRowSize = this.estimateRowSize();
        
        // Target chunk size (around 1000-1500 tokens per chunk)
        const targetTokensPerChunk = 1200;
        
        // Calculate how many rows can fit in a chunk
        let rowsPerChunk = Math.max(1, Math.floor(targetTokensPerChunk / avgRowSize));
        
        // Ensure we don't make too many tiny chunks for small datasets
        if (this.data.length < 50) {
            rowsPerChunk = Math.max(rowsPerChunk, Math.ceil(this.data.length / 10));
        }
        
        // For very small datasets, just keep all rows together
        if (this.data.length < 10) {
            rowsPerChunk = this.data.length;
        }
        
        return {
            rowsPerChunk,
            description: this.data.length <= rowsPerChunk ? 
                'all records in a single narrative' : 
                `grouped in narratives of approximately ${rowsPerChunk} records each`
        };
    }

    /**
     * Estimate the average size of a row in tokens
     * @returns {number} Estimated tokens per row
     * @private
     */
    estimateRowSize() {
        // Sample a few rows to estimate size
        const sampleSize = Math.min(5, this.data.length);
        let totalChars = 0;
        
        for (let i = 0; i < sampleSize; i++) {
            const row = this.data[i];
            // Count characters in field names and values
            this.meta.fields.forEach(field => {
                // Field name + value + punctuation/formatting
                totalChars += field.length + 2; // "field: "
                const val = row[field];
                if (val !== null && val !== undefined) {
                    totalChars += String(val).length + 2; // ", "
                }
            });
            totalChars += 20; // Additional overhead for formatting
        }
        
        // Estimate tokens (rough approximation - 4 chars per token on average)
        const avgCharsPerRow = totalChars / sampleSize;
        return Math.ceil(avgCharsPerRow / 4);
    }

    /**
     * Create contextual chunks from the dataset
     * @param {Object} strategy - Chunking strategy
     * @returns {Array<Object>} Array of chunks with their rows
     * @private
     */
    createContextualChunks(strategy) {
        const chunks = [];
        const { rowsPerChunk } = strategy;
        
        // Create chunks
        for (let i = 0; i < this.data.length; i += rowsPerChunk) {
            const rowsInChunk = Math.min(rowsPerChunk, this.data.length - i);
            const chunkRows = this.data.slice(i, i + rowsInChunk);
            
            chunks.push({
                startRowIndex: i,
                rows: chunkRows
            });
        }
        
        return chunks;
    }

    /**
     * Create a narrative representation of a data row with column context
     * @param {Object} row - Data row
     * @returns {string} Narrative representation
     * @private
     */
    createRowNarrative(row) {
        const hasColumnMeanings = this.narratives && this.narratives.columnMeanings;
        const contextualItems = [];
        
        // Get key columns for context (ID-like columns or the first few columns)
        const keyColumns = this.identifyKeyColumns();
        
        // First add key columns for context
        keyColumns.forEach(field => {
            if (row[field] !== null && row[field] !== undefined) {
                const displayName = this.getColumnDisplayName(field);
                contextualItems.push(`${displayName}: ${row[field]}`);
            }
        });
        
        // Then add remaining data fields
        this.meta.fields.forEach(field => {
            // Skip fields already included as key columns
            if (keyColumns.includes(field)) return;
            
            if (row[field] !== null && row[field] !== undefined) {
                const displayName = this.getColumnDisplayName(field);
                contextualItems.push(`${displayName}: ${row[field]}`);
            }
        });
        
        // Join in a natural language format
        return contextualItems.join(', ') + '.';
    }

    /**
     * Get a display name for a column, using LLM-derived meaning if available
     * @param {string} field - Column name
     * @returns {string} Display name with context
     * @private
     */
    getColumnDisplayName(field) {
        if (this.narratives && 
            this.narratives.columnMeanings && 
            this.narratives.columnMeanings[field]) {
            
            const meaning = this.narratives.columnMeanings[field];
            
            // If we have a useful standard terminology, use that
            if (meaning.standardTerminology) {
                return meaning.standardTerminology;
            }
            
            // If we have a meaningful context, combine it with the field name
            if (meaning.context) {
                return `${field} (${meaning.context})`;
            }
        }
        
        // Default to the original field name
        return field;
    }

    /**
     * Identify key columns that provide context for each row
     * @returns {Array<string>} Key column names
     * @private
     */
    identifyKeyColumns() {
        const keyColumns = [];
        
        // First look for likely ID columns
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            
            // If column is unique (likely ID) or has ID in the name
            if ((stats.uniqueCount === this.data.length && stats.nonNullCount === this.data.length) ||
                /id$/i.test(field)) {
                keyColumns.push(field);
            }
        });
        
        // If no ID columns found, use the first column
        if (keyColumns.length === 0 && this.meta.fields.length > 0) {
            keyColumns.push(this.meta.fields[0]);
        }
        
        // Add categorical columns that might provide good context
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            
            // Look for categorical columns with few unique values
            if (stats.uniqueCount > 1 && 
                stats.uniqueCount <= 10 && 
                !keyColumns.includes(field)) {
                keyColumns.push(field);
            }
        });
        
        // Limit to 1-3 key columns
        return keyColumns.slice(0, 3);
    }

    /**
     * The methods below are still used for generating previews in the UI
     */
    transformToNarrative(options) {
        // Forward to the new contextual narrative implementation
        return this.transformToContextualNarrative(options);
    }

    /**
     * Transform data to table format (markdown tables)
     * @param {Object} options - Transformation options
     * @private
     */
    transformToTableFormat(options) {
        let result = `# ${options.title || 'Tabular Data'}\n\n`;
        
        // Add schema information
        result += `## Schema Information\n`;
        const schemaTable = `| Column | Type | Description |\n| ------ | ---- | ----------- |\n`;
        result += schemaTable + this.meta.fields.map(field => {
            const stats = this.analysis.columnStats[field];
            return `| ${field} | ${stats.dataType} | ${this.generateColumnDescription(field, stats)} |`;
        }).join('\n') + '\n\n';
        
        // Data sample in table format
        result += `## Data Sample\n`;
        
        // Determine how many rows to show based on dataset size
        const sampleSize = Math.min(options.sampleSize || 10, this.data.length);
        
        // Column headers
        result += `| ${this.meta.fields.join(' | ')} |\n`;
        // Header separator
        result += `| ${this.meta.fields.map(() => '---').join(' | ')} |\n`;
        
        // Sample rows
        for (let i = 0; i < sampleSize; i++) {
            const rowValues = this.meta.fields.map(field => {
                const val = this.data[i][field];
                return val !== null && val !== undefined ? String(val).substring(0, 50) : 'NULL';
            });
            result += `| ${rowValues.join(' | ')} |\n`;
        }
        
        // If showing subset, indicate there's more
        if (sampleSize < this.data.length) {
            result += `\n*Showing ${sampleSize} of ${this.data.length} rows*\n\n`;
        }
        
        return result;
    }

    /**
     * Transform data to hierarchical format (JSON-like nested objects)
     * @param {Object} options - Transformation options
     * @private
     */
    transformToHierarchicalFormat(options) {
        // Identify potential grouping fields (categorical, limited values)
        const groupingColumns = this.meta.fields.filter(field => {
            const stats = this.analysis.columnStats[field];
            return stats.uniqueCount < Math.min(10, this.data.length / 10) && stats.uniqueCount > 1;
        });
        
        let result = `# ${options.title || 'Hierarchical Data View'}\n\n`;
        
        if (groupingColumns.length === 0) {
            // If no good columns for grouping, fall back to tabular format
            return this.transformToTableFormat(options);
        }
        
        // Choose primary grouping column (first one for simplicity)
        const primaryGroup = options.groupBy || groupingColumns[0];
        
        result += `## Data Grouped by "${primaryGroup}"\n\n`;
        
        // Group data by the column
        const groups = {};
        this.data.forEach(row => {
            const groupValue = String(row[primaryGroup] || 'NULL');
            if (!groups[groupValue]) {
                groups[groupValue] = [];
            }
            groups[groupValue].push(row);
        });
        
        // Generate hierarchical output
        Object.entries(groups).forEach(([groupValue, rows]) => {
            result += `### ${primaryGroup}: ${groupValue}\n`;
            result += `*${rows.length} records*\n\n`;
            
            // Show a sample of records in this group
            const sampleSize = Math.min(options.groupSampleSize || 3, rows.length);
            
            for (let i = 0; i < sampleSize; i++) {
                result += `#### Record ${i + 1}\n`;
                this.meta.fields.filter(f => f !== primaryGroup).forEach(field => {
                    result += `- **${field}**: ${rows[i][field]}\n`;
                });
                result += '\n';
            }
            
            // If more records exist, indicate this
            if (sampleSize < rows.length) {
                result += `*${rows.length - sampleSize} more records in this group*\n\n`;
            }
        });
        
        return result;
    }

    /**
     * Transform data to Q&A format (key information as questions and answers)
     * @param {Object} options - Transformation options
     * @private
     */
    transformToQAFormat(options) {
        let result = `# ${options.title || 'Data Q&A'}\n\n`;
        
        // Add dataset overview as Q&A
        result += `## Dataset Overview\n\n`;
        result += `**Q: What kind of data is in this dataset?**\n\n`;
        result += `A: This dataset contains ${this.data.length} records with ${this.meta.fields.length} attributes: ${this.meta.fields.join(', ')}.\n\n`;
        
        result += `**Q: What are the main attributes in this data?**\n\n`;
        result += `A: The main attributes are:\n`;
        
        this.meta.fields.forEach(field => {
            const stats = this.analysis.columnStats[field];
            result += `- **${field}** (${stats.dataType}): ${this.generateColumnDescription(field, stats)}\n`;
        });
        result += '\n';
        
        // Add key statistics
        result += `## Key Statistics\n\n`;
        
        // For numeric columns, add min/max/avg
        const numericColumns = this.meta.fields.filter(field => 
            this.analysis.columnStats[field].dataType === 'numeric');
            
        if (numericColumns.length > 0) {
            result += `**Q: What are the key numeric insights in this data?**\n\n`;
            result += `A: Here are the statistics for numeric columns:\n\n`;
            
            numericColumns.forEach(field => {
                const stats = this.analysis.columnStats[field];
                result += `- **${field}**: Min=${stats.min}, Max=${stats.max}, Average=${stats.avg.toFixed(2)}\n`;
            });
            result += '\n';
        }
        
        // For categorical columns, add distribution
        const catColumns = this.meta.fields.filter(field => {
            const stats = this.analysis.columnStats[field];
            return stats.uniqueCount < 10 && stats.uniqueCount > 1;
        });
        
        if (catColumns.length > 0) {
            result += `**Q: What are the common categories or groups in this data?**\n\n`;
            result += `A: Here are the distributions for categorical columns:\n\n`;
            
            catColumns.forEach(field => {
                const valueCounts = {};
                this.data.forEach(row => {
                    const value = String(row[field] || 'NULL');
                    valueCounts[value] = (valueCounts[value] || 0) + 1;
                });
                
                result += `- **${field}** distribution:\n`;
                Object.entries(valueCounts)
                    .sort((a, b) => b[1] - a[1])
                    .forEach(([value, count]) => {
                        const percentage = ((count / this.data.length) * 100).toFixed(1);
                        result += `  - ${value}: ${count} (${percentage}%)\n`;
                    });
                result += '\n';
            });
        }
        
        // Include sample queries if available
        if (this.narratives && this.narratives.queryExamples) {
            result += `## Sample Questions You Can Ask\n\n`;
            result += this.narratives.queryExamples.split('\n').map(line => {
                if (line.trim().startsWith('-')) {
                    // Convert list items to clickable query suggestions
                    return line;
                }
                return line;
            }).join('\n');
            result += '\n\n';
        }
        
        return result;
    }
}

// Export as global instance
window.csvAnalyzer = new CSVAnalyzer();

// Update the initCsvAnalyzer function to handle Excel files
async function initCsvAnalyzer(file) {
    // Clear previous data
    if (window.csvAnalyzer) {
        window.csvAnalyzer.data = null;
        window.csvAnalyzer.meta = null;
        window.csvAnalyzer.analysis = null;
    }
    
    // Show loading state in the UI
    const previewTable = document.getElementById('csv-preview-table');
    if (previewTable) {
        previewTable.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary"></div><p class="mt-2">Loading data...</p></div>';
    }
    
    try {
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType === 'xlsx' || fileType === 'xls') {
            // Process Excel file
            const processedData = await processExcelFile(file);
            
            // Initialize analyzer with the processed data
            if (window.csvAnalyzer) {
                window.csvAnalyzer.initialize(processedData.data, processedData.meta);
            }
            
            // Update UI
            if (window.csvAnalyzerUI) {
                window.csvAnalyzerUI.showAnalyzer(processedData.data, processedData.meta);
                
                // Add event handler for the process button to ensure modal closes properly
                const processBtn = document.getElementById('csv-process-btn');
                const originalHandler = processBtn.onclick;
                
                processBtn.onclick = function(e) {
                    if (originalHandler) originalHandler(e);
                    
                    // Ensure modal is properly closed
                    setTimeout(() => {
                        const modalElement = document.getElementById('csvAnalyzerModal');
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) modal.hide();
                        
                        // Remove modal backdrop and modal-open class
                        document.body.classList.remove('modal-open');
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) backdrop.remove();
                    }, 100);
                };
            }
        } else {
            // Use existing CSV parsing logic
            parseCsvWithPapa(file);
        }
    } catch (error) {
        console.error('Error initializing CSV analyzer:', error);
        if (previewTable) {
            previewTable.innerHTML = `<div class="alert alert-danger">Error loading file: ${error.message}</div>`;
        }
    }
}

/**
 * Process an Excel file and prepare it for the CSV analyzer
 * @param {File} file - Excel file to process
 * @returns {Promise<Object>} Processed data in CSV format
 */
async function processExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // Get the first worksheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to CSV format
                const csvContent = XLSX.utils.sheet_to_csv(worksheet);
                
                // Parse CSV content with PapaParse
                const parsedData = Papa.parse(csvContent, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true
                });
                
                resolve({
                    content: csvContent,
                    data: parsedData.data,
                    meta: parsedData.meta
                });
            } catch (error) {
                reject(new Error('Failed to process Excel file: ' + error.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parse CSV using Papa Parse
 * @param {File} file - CSV file to parse
 */
function parseCsvWithPapa(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function(results) {
            // Initialize analyzer with parsed data
            if (window.csvAnalyzer) {
                window.csvAnalyzer.initialize(results.data, results.meta);
            }
            
            // Update UI
            if (window.csvAnalyzerUI) {
                window.csvAnalyzerUI.showAnalyzer(results.data, results.meta);
            }
        },
        error: function(error) {
            console.error('Error parsing CSV:', error);
            const previewTable = document.getElementById('csv-preview-table');
            if (previewTable) {
                previewTable.innerHTML = `<div class="alert alert-danger">Error parsing file: ${error.message}</div>`;
            }
        }
    });
}
