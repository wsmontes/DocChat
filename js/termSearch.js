/**
 * TermSearch - Extracts key terms from user queries and performs text-based search
 */
class TermSearch {
    constructor() {
        this.stopWords = new Set([
            'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 
            'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 
            'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 
            'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should', 
            'may', 'might', 'must', 'of', 'from', 'then', 'than', 'so', 'that'
        ]);
    }

    /**
     * Extract important terms from a user query
     * @param {string} query - User's question
     * @returns {Array<string>} List of important terms
     */
    extractTerms(query) {
        // Clean the query and split into words
        const words = query.toLowerCase()
            .replace(/[.,;:!?()'"]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.stopWords.has(word));
        
        // Deduplicate terms
        const uniqueTerms = [...new Set(words)];
        
        // Find multi-word terms (bigrams and trigrams)
        const multiWordTerms = this.extractMultiWordTerms(query.toLowerCase());
        
        // Combine single words and multi-word terms
        return [...uniqueTerms, ...multiWordTerms];
    }

    /**
     * Extract potential multi-word terms (phrases) from the query
     * @param {string} query - User's question
     * @returns {Array<string>} List of multi-word terms
     */
    extractMultiWordTerms(query) {
        const cleanedQuery = query.toLowerCase().replace(/[.,;:!?()'"]/g, '');
        const words = cleanedQuery.split(/\s+/);
        const phrases = [];
        
        // Extract bigrams (two-word phrases)
        for (let i = 0; i < words.length - 1; i++) {
            if (!this.stopWords.has(words[i]) && !this.stopWords.has(words[i+1])) {
                phrases.push(`${words[i]} ${words[i+1]}`);
            }
        }
        
        // Extract trigrams (three-word phrases)
        for (let i = 0; i < words.length - 2; i++) {
            if (!this.stopWords.has(words[i]) && !this.stopWords.has(words[i+2])) {
                phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
            }
        }
        
        return phrases;
    }

    /**
     * Generate variants of terms (stemming, pluralization, etc.)
     * @param {Array<string>} terms - List of extracted terms
     * @returns {Array<string>} List of terms with their variants
     */
    generateVariants(terms) {
        const variants = new Set(terms);
        
        terms.forEach(term => {
            // Add basic stemming variants
            if (term.endsWith('s')) {
                variants.add(term.slice(0, -1)); // Remove trailing 's'
            } else {
                variants.add(term + 's'); // Add trailing 's'
            }
            
            // Handle 'ing' forms
            if (term.endsWith('ing') && term.length > 5) {
                variants.add(term.slice(0, -3)); // remove 'ing'
                variants.add(term.slice(0, -3) + 'e'); // handle 'e' cases (making -> make)
            }
            
            // Handle 'ed' forms
            if (term.endsWith('ed') && term.length > 4) {
                variants.add(term.slice(0, -2)); // remove 'ed'
                variants.add(term.slice(0, -1)); // handle cases like 'used' -> 'use'
            }
            
            // Handle common prefixes
            if (term.startsWith('un') || term.startsWith('in') || term.startsWith('re')) {
                variants.add(term.slice(2));
            }
        });
        
        return [...variants];
    }

    /**
     * Score a chunk based on term matches
     * @param {Object} chunk - Document chunk
     * @param {Array<string>} terms - List of search terms and variants
     * @returns {number} Match score for the chunk
     */
    scoreChunk(chunk, terms) {
        if (!chunk || !chunk.text) return 0;
        
        const chunkText = chunk.text.toLowerCase();
        let score = 0;
        
        // Core terms (original terms from query)
        const coreTerms = terms.slice(0, terms.length / 2);
        
        // Track exact matches for bonus calculation
        const exactMatches = [];
        
        // Score each term
        terms.forEach(term => {
            // Check for exact match (case-insensitive but whole word)
            const exactRegex = new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'gi');
            const exactMatches = chunkText.match(exactRegex);
            const exactCount = exactMatches ? exactMatches.length : 0;
            
            // Check for partial match (substring)
            const partialRegex = new RegExp(this.escapeRegExp(term), 'gi');
            const partialMatches = chunkText.match(partialRegex);
            const partialCount = partialMatches ? partialMatches.length - exactCount : 0; // Subtract exact matches
            
            // Core terms get higher weight
            const termWeight = coreTerms.includes(term) ? 3 : 1;
            
            // Exact matches get higher weight than partial matches
            const exactMatchBonus = 2;
            
            // Add to score (square root to prevent domination by a single term)
            score += (Math.sqrt(exactCount) * exactMatchBonus * termWeight) + (Math.sqrt(partialCount) * termWeight);
            
            // Bonus for exact multi-word phrases
            if (exactCount > 0 && term.includes(' ')) {
                score += 2 * termWeight; // Double bonus for exact multi-word matches
            }
            
            // Keep track of terms with exact matches for later bonus
            if (exactCount > 0) {
                exactMatches.push(term);
            }
        });
        
        // Additional bonus for multiple different terms matching exactly (diversity bonus)
        // This rewards chunks that match multiple unique terms rather than many occurrences of the same term
        if (exactMatches.length > 1) {
            score += Math.sqrt(exactMatches.length) * 1.5;
        }
        
        // Bonus for high concentration of matches (match density)
        const textLength = chunkText.length;
        if (textLength > 0 && exactMatches.length > 0) {
            const densityBonus = Math.min(1, exactMatches.length / (textLength / 100)); // Per 100 chars
            score += densityBonus * 2;
        }
        
        // Normalize by chunk length (to avoid favoring very long chunks)
        const lengthFactor = 1 / Math.sqrt(chunkText.length / 500);
        score = score * lengthFactor;
        
        return score;
    }

    /**
     * Escape string for use in RegExp
     * @private
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Perform term-based search
     * @param {string} query - User's question
     * @param {Array<Object>} chunks - Document chunks to search
     * @param {number} limit - Maximum number of results
     * @param {Array<string>} [previousTerms=[]] - Terms from previous query for context
     * @returns {Array<Object>} Ranked chunks with scores
     */
    search(query, chunks, limit = 5, previousTerms = []) {
        // Extract terms from query
        const terms = this.extractTerms(query);
        
        // Generate variants
        const termsWithVariants = this.generateVariants(terms);
        
        // Check term overlap with previous query if provided
        const termOverlap = previousTerms.length > 0 ? 
            this.calculateTermOverlap(terms, previousTerms) : 0;
        
        // If significant term overlap, consider this a follow-up query
        const isFollowUp = termOverlap > 0.3;
        
        // Group chunks by document ID
        const docChunks = {};
        chunks.forEach(chunk => {
            if (!docChunks[chunk.documentId]) {
                docChunks[chunk.documentId] = [];
            }
            docChunks[chunk.documentId].push(chunk);
        });
        
        // Score chunks from each document
        const docResults = {};
        Object.entries(docChunks).forEach(([docId, docChunks]) => {
            // Score each chunk in this document
            const scoredChunks = docChunks.map(chunk => {
                const score = this.scoreChunk(chunk, termsWithVariants);
                return {
                    ...chunk,
                    termScore: score,
                    terms: terms.filter(term => 
                        chunk.text.toLowerCase().includes(term.toLowerCase())
                    )
                };
            }).filter(chunk => chunk.termScore > 0);
            
            // Sort by score (descending)
            scoredChunks.sort((a, b) => b.termScore - a.termScore);
            
            // Store top results for this document
            docResults[docId] = scoredChunks.slice(0, Math.ceil(limit / 2));
        });
        
        // Calculate how many documents we have results for
        const docsWithResults = Object.values(docResults).filter(chunks => chunks.length > 0).length;
        
        // Calculate per-document limit to ensure balanced representation
        const perDocLimit = Math.max(1, Math.ceil(limit / Math.max(1, docsWithResults)));
        
        // Get top chunks from each document up to per-document limit
        let allResults = [];
        Object.values(docResults).forEach(chunks => {
            allResults = allResults.concat(chunks.slice(0, perDocLimit));
        });
        
        // Sort by score (descending) across all documents and take top results
        return allResults
            .sort((a, b) => b.termScore - a.termScore)
            .slice(0, limit);
    }
    
    /**
     * Calculate term overlap between two term sets
     * @param {Array<string>} currentTerms - Current query terms
     * @param {Array<string>} previousTerms - Previous query terms
     * @returns {number} Overlap ratio (0-1)
     */
    calculateTermOverlap(currentTerms, previousTerms) {
        // Count how many terms from current query appear in previous query
        const overlapCount = currentTerms.filter(term => 
            previousTerms.some(prevTerm => 
                prevTerm.toLowerCase().includes(term.toLowerCase()) || 
                term.toLowerCase().includes(prevTerm.toLowerCase())
            )
        ).length;
        
        // Calculate overlap ratio (relative to current terms count)
        return currentTerms.length > 0 ? overlapCount / currentTerms.length : 0;
    }
}

// Create a global instance
const termSearch = new TermSearch();
