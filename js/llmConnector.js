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
            return `[${index + 1}] ${chunk.text}`;
        }).join('\n\n');
        
        // Check if this is CSV data by looking for the CSV TABLE ANALYSIS header
        const isCSVData = context.includes('# CSV TABLE ANALYSIS');
        
        // Create system prompt with special handling for CSV data
        let systemPrompt = `You are a helpful assistant that answers questions based on the provided document excerpts. 
        Only use the information from the excerpts to answer. If the answer cannot be found in the excerpts, 
        say "I don't have enough information in the document to answer that question." 
        When citing information, refer to the excerpt numbers like this: [1], [2], etc.`;
        
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
            content: `Here are excerpts from a document:\n\n${context}\n\nBased only on these excerpts, answer the following question: ${question}`
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
}

const llmConnector = new LlmConnector();
