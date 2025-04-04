/**
 * LLM Connector - Handles communication with LLM APIs
 */
class LlmConnector {
    constructor() {
        this.apiKey = localStorage.getItem('openai_api_key') || '';
        this.model = localStorage.getItem('openai_model') || 'gpt-3.5-turbo';
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
        this.isConfigured = !!this.apiKey;
    }
    
    /**
     * Set the API key
     * @param {string} apiKey - API Key 
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('openai_api_key', apiKey);
        this.isConfigured = !!apiKey;
    }
    
    /**
     * Set the model to use
     * @param {string} model - Model name 
     */
    setModel(model) {
        this.model = model;
        localStorage.setItem('openai_model', model);
    }
    
    /**
     * Check if API is configured
     * @returns {boolean} Whether API is configured
     */
    isApiConfigured() {
        return this.isConfigured;
    }
    
    /**
     * Get answer to a question using context from document chunks
     * @param {string} question - User question
     * @param {Array<Object>} relevantChunks - Relevant document chunks
     * @param {Function} streamHandler - Handler for streaming responses
     * @param {Array<Object>} [conversationHistory=[]] - Previous conversation messages
     * @returns {Promise<string>} Answer from LLM
     */
    async getAnswer(question, relevantChunks, streamHandler = null, conversationHistory = []) {
        if (!this.isConfigured) {
            throw new Error('API key not configured');
        }
        
        // Prepare context from chunks
        const context = relevantChunks.map((chunk, index) => {
            // Include document title if available
            const docInfo = chunk.documentTitle ? ` (from "${chunk.documentTitle}")` : '';
            return `[${index + 1}]${docInfo} ${chunk.text}`;
        }).join('\n\n');
        
        // Check if this is CSV data by looking for the CSV TABLE ANALYSIS header
        const isCSVData = context.includes('# CSV TABLE ANALYSIS');
        
        // Check if we're using multiple documents
        const documentIds = [...new Set(relevantChunks.map(chunk => chunk.documentId))];
        const isMultiDocument = documentIds.length > 1;
        
        // Create system prompt with special handling for CSV data and multiple documents
        let systemPrompt = `You are a helpful assistant that answers questions based on the provided document excerpts. 
        Only use the information from the excerpts to answer. If the answer cannot be found in the excerpts, 
        say "I don't have enough information in the document to answer that question." 
        When citing information, refer to the excerpt numbers like this: [1], [2], etc.`;
        
        if (isMultiDocument) {
            systemPrompt += `\n\nYou have access to multiple documents. When citing information, reference the document
            source that's indicated with each excerpt. Organize your answer to clearly distinguish information from
            different documents when appropriate, especially if they contain different or contradictory information.`;
        }
        
        if (isCSVData) {
            systemPrompt += `\n\nThe document contains CSV (tabular) data. 
            Pay special attention to the 'Chunking Recommendations' section, which provides guidance 
            on how to best organize and think about this data when answering questions.
            When answering questions about numeric data, consider whether computing statistics or providing summaries would be helpful. 
            For relationships between columns, refer to the patterns identified in the analysis.
            Present numeric answers in a well-formatted way, and consider using tabular format for comparing multiple values.`;
        }
        
        // Add conversation history handling
        if (conversationHistory && conversationHistory.length > 0) {
            systemPrompt += `\n\nMaintain consistency with your previous answers when addressing follow-up questions.
            If the user refers to previous questions or your previous answers, use the conversation history to provide context.`;
        }
        
        // Create messages array for the API
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];
        
        // Add conversation history if available
        if (conversationHistory && conversationHistory.length > 0) {
            messages.push(...conversationHistory);
        }
        
        // Add current context and question
        messages.push({
            role: 'user',
            content: `Here are excerpts from ${isMultiDocument ? 'multiple documents' : 'a document'}:\n\n${context}\n\nBased only on these excerpts, answer the following question: ${question}`
        });
        
        if (streamHandler) {
            return this.streamResponse(messages, streamHandler);
        } else {
            return this.sendRequest(messages);
        }
    }
    
    /**
     * Send a request to the LLM API
     * @param {Array<Object>} messages - Chat messages
     * @param {AbortSignal} [signal] - Optional signal to abort the request
     * @returns {Promise<string>} Response text
     */
    async sendRequest(messages, signal = undefined) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            signal,  // <-- new addition to allow aborting
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                temperature: 0.3,
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API error: ${error.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content.trim();
    }
    
    /**
     * Stream the response from the LLM API
     * @param {Array<Object>} messages - Chat messages
     * @param {Function} streamHandler - Handler for each chunk of the stream
     * @returns {Promise<string>} Complete response text
     */
    async streamResponse(messages, streamHandler) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                temperature: 0.3,
                max_tokens: 1000,
                stream: true
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API error: ${error.error?.message || response.statusText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                // Process each line
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.choices && data.choices[0].delta.content) {
                                const contentDelta = data.choices[0].delta.content;
                                fullText += contentDelta;
                                streamHandler(contentDelta, fullText);
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        return fullText.trim();
    }

    /**
     * Generate summaries for chunk groups 
     * @param {Array<Array<Object>>} chunkGroups - Groups of chunks to summarize
     * @param {string} question - The original user question for context
     * @param {Array<Object>} [conversationHistory=[]] - Previous conversation messages
     * @returns {Promise<Array<{summary: string, chunks: Array<Object>}>>} Summaries with their source chunks
     */
    async generateChunkGroupSummaries(chunkGroups, question, conversationHistory = []) {
        if (!this.isConfigured) {
            throw new Error('API key not configured');
        }
        
        const summaries = [];
        
        // Process each chunk group in parallel with rate limiting
        const concurrencyLimit = 3; // Maximum concurrent requests
        const batchResults = [];
        
        // Create batches to process
        for (let i = 0; i < chunkGroups.length; i += concurrencyLimit) {
            const batch = chunkGroups.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(async (group, index) => {
                try {
                    // Format the chunks into a readable context
                    const context = group.map((chunk, idx) => {
                        const docInfo = chunk.documentTitle ? ` (from "${chunk.documentTitle}")` : '';
                        return `[${idx + 1}]${docInfo} ${chunk.text}`;
                    }).join('\n\n');
                    
                    // Create system prompt with context from conversation history
                    let conversationContext = '';
                    if (conversationHistory && conversationHistory.length > 0) {
                        // Extract last few exchanges for context
                        const recentHistory = conversationHistory.slice(-4);
                        conversationContext = recentHistory.map(msg => 
                            `${msg.role === 'user' ? 'User asked' : 'You answered'}: ${msg.content.substring(0, 200)}...`
                        ).join('\n');
                    }
                    
                    // Create messages for the API
                    const messages = [
                        {
                            role: 'system',
                            content: `You are an AI that creates concise summaries of document excerpts. 
                            Summarize the key information in the provided excerpts that would be most relevant to answering the user's question.
                            Focus only on the most relevant facts and details.
                            Keep your summary under 150 words.`
                        },
                        {
                            role: 'user',
                            content: `
                            I need a concise summary of these document excerpts that focuses on information relevant to the following question: "${question}"
                            
                            ${conversationContext ? `\nRecent conversation context:\n${conversationContext}\n` : ''}
                            
                            Document excerpts:
                            ${context}
                            
                            Create a concise summary of the most relevant information from these excerpts that would help answer the question.
                            `
                        }
                    ];
                    
                    // Make API request with a timeout to prevent stalling
                    const summary = await this.sendRequest(messages);
                    
                    return {
                        summary,
                        chunks: group,
                        originalIndex: i + index
                    };
                } catch (error) {
                    console.error(`Error generating summary for chunk group ${i + index}:`, error);
                    // Return a fallback summary to ensure we don't lose the chunks
                    return {
                        summary: "Error generating summary.",
                        chunks: group,
                        originalIndex: i + index,
                        error: true
                    };
                }
            });
            
            // Wait for the current batch to complete
            const batchResults = await Promise.all(batchPromises);
            summaries.push(...batchResults);
            
            // Small delay between batches to avoid rate limiting
            if (i + concurrencyLimit < chunkGroups.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Sort by original index to maintain order
        summaries.sort((a, b) => a.originalIndex - b.originalIndex);
        
        return summaries;
    }
    
    /**
     * Find related terms to expand a search query
     * @param {string} question - User's question that yielded no results
     * @param {Array<string>} originalTerms - The original search terms
     * @param {Array<Object>} [conversationHistory=[]] - Previous conversation messages
     * @returns {Promise<Array<string>>} List of related terms to try
     */
    async findRelatedTerms(question, originalTerms, conversationHistory = []) {
        if (!this.isConfigured) {
            throw new Error('API key not configured');
        }
        
        // Create conversation context
        let conversationContext = '';
        if (conversationHistory && conversationHistory.length > 0) {
            // Extract last few exchanges for context
            const recentHistory = conversationHistory.slice(-4);
            conversationContext = recentHistory.map(msg => 
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}...`
            ).join('\n');
        }
        
        const messages = [
            {
                role: 'system',
                content: `You are an AI that helps expand search queries when initial searches yield no results.
                For a given question and its extracted search terms, you should generate alternative terms,
                synonyms, related concepts, and broader category terms that might help find relevant information.
                Return your response as a JSON array of strings containing only the alternative search terms.`
            },
            {
                role: 'user',
                content: `
                I searched for information using these terms but found no results: ${originalTerms.join(', ')}
                
                My original question was: "${question}"
                
                ${conversationContext ? `\nRecent conversation context:\n${conversationContext}\n` : ''}
                
                Please generate alternative search terms, synonyms, related concepts, and broader category terms 
                that might help find relevant information. Only include terms that are likely to appear in documents.
                
                Format your response as a JSON array of strings, for example:
                ["term1", "term2", "related phrase", "broader concept"]
                `
            }
        ];
        
        try {
            const response = await this.sendRequest(messages);
            
            // Parse the response as JSON
            const relatedTermsMatch = response.match(/\[.*\]/s);
            if (relatedTermsMatch) {
                try {
                    const relatedTerms = JSON.parse(relatedTermsMatch[0]);
                    return Array.isArray(relatedTerms) ? relatedTerms : [];
                } catch (parseError) {
                    console.error('Error parsing related terms JSON:', parseError);
                    // Fallback: extract terms using regex
                    const terms = response.match(/"([^"]*)"/g);
                    return terms ? terms.map(t => t.replace(/"/g, '')) : [];
                }
            }
            return [];
        } catch (error) {
            console.error('Error finding related terms:', error);
            return [];
        }
    }
}

const llmConnector = new LlmConnector();
