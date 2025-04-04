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
        
        // Score each term
        terms.forEach(term => {
            // Count occurrences
            const regex = new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'gi');
            const matches = chunkText.match(regex);
            const count = matches ? matches.length : 0;
            
            // Core terms get higher weight
            const weight = coreTerms.includes(term) ? 2 : 1;
            
            // Add to score (square root to prevent domination by a single term)
            score += Math.sqrt(count) * weight;
            
            // Bonus for exact phrase matches
            if (count > 0 && term.includes(' ')) {
                score += 1;
            }
        });
        
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
     * @returns {Array<Object>} Ranked chunks with scores
     */
    search(query, chunks, limit = 5) {
        // Extract terms from query
        const terms = this.extractTerms(query);
        
        // Generate variants
        const termsWithVariants = this.generateVariants(terms);
        
        // Score each chunk
        const scoredChunks = chunks.map(chunk => {
            const score = this.scoreChunk(chunk, termsWithVariants);
            return {
                ...chunk,
                termScore: score,
                terms: terms.filter(term => 
                    chunk.text.toLowerCase().includes(term.toLowerCase())
                )
            };
        });
        
        // Sort by score (descending) and keep only specified limit
        const results = scoredChunks
            .filter(chunk => chunk.termScore > 0)
            .sort((a, b) => b.termScore - a.termScore)
            .slice(0, limit);
        
        return results;
    }
}

// Create a global instance
const termSearch = new TermSearch();
