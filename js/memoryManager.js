/**
 * Memory manager for TensorFlow.js operations
 * Prevents memory leaks and optimizes resource usage
 */
class TensorflowMemoryManager {
    constructor() {
        // Check if TensorFlow is available
        this.isSupported = typeof tf !== 'undefined';
        
        // Feature detection for different memory management approaches
        if (this.isSupported) {
            this.hasScopeTracking = typeof tf.engine === 'function' && 
                                    typeof tf.engine().startScope === 'function';
            
            // Log memory management approach
            console.log(`TensorFlow memory management initialized. Using ${
                this.hasScopeTracking ? 'scope tracking' : 
                (typeof tf.tidy === 'function' ? 'tf.tidy' : 'fallback cleanup')
            }`);
        } else {
            console.warn('TensorFlow.js not available - running without memory management');
        }
        
        // Track tensors to help with debugging
        this.lastMemorySnapshot = null;
        this.memoryLeakThreshold = 20; // Alert if tensor count increases by this amount
    }
    
    async runWithMemoryManagement(operation) {
        if (!this.isSupported) return operation();
        
        // Use different approaches based on available features
        if (this.hasScopeTracking) {
            // Method 1: Use scope tracking if available
            const engine = tf.engine();
            try {
                engine.startScope();
                const result = await operation();
                return result;
            } finally {
                try {
                    engine.endScope();
                } catch (error) {
                    console.warn('Error ending TensorFlow scope:', error);
                }
                this.checkMemoryUsage();
            }
        } else {
            // Method 2: Use tf.tidy as a fallback
            try {
                let result;
                if (typeof tf.tidy === 'function') {
                    result = await tf.tidy(() => operation());
                } else {
                    // Method 3: Just run the operation if no memory management is available
                    result = await operation();
                    // Try to clean up afterward
                    this.alternativeCleanup();
                }
                return result;
            } finally {
                this.checkMemoryUsage();
            }
        }
    }
    
    /**
     * Alternative cleanup when tf.tidy and scope tracking are unavailable
     */
    alternativeCleanup() {
        if (!this.isSupported) return;
        
        try {
            // Get all tensors in memory
            const tensors = tf.memory().numTensors;
            if (tensors > 50) { // Only perform cleanup if many tensors exist
                console.warn(`High tensor count (${tensors}) detected, performing emergency cleanup`);
                tf.disposeVariables();
                
                // Try more aggressive cleanup if available
                if (typeof gc === 'function') {
                    gc();
                }
            }
        } catch (error) {
            console.error('Error during alternative cleanup:', error);
        }
    }
    
    /**
     * Check memory usage and detect potential leaks
     */
    checkMemoryUsage() {
        if (!this.isSupported) return;
        
        try {
            const memInfo = tf.memory();
            const currentStats = {
                tensors: memInfo.numTensors,
                bytes: memInfo.numBytes,
                timestamp: Date.now()
            };
            
            // Compare with previous snapshot if available
            if (this.lastMemorySnapshot) {
                const tensorDiff = currentStats.tensors - this.lastMemorySnapshot.tensors;
                const timeDiff = (currentStats.timestamp - this.lastMemorySnapshot.timestamp) / 1000;
                
                // Alert if tensor count has increased significantly
                if (tensorDiff > this.memoryLeakThreshold) {
                    console.warn(`Possible memory leak: +${tensorDiff} tensors in ${timeDiff.toFixed(1)}s`);
                    // Try to force garbage collection
                    this.cleanupMemory();
                }
            }
            
            // Update snapshot
            this.lastMemorySnapshot = currentStats;
            
        } catch (error) {
            console.error('Error checking memory usage:', error);
        }
    }
    
    /**
     * Try to clean up memory when leaks are detected
     */
    cleanupMemory() {
        if (!this.isSupported) return;
        
        try {
            console.log('Performing TensorFlow memory cleanup');
            
            // Approach 1: Dispose variables
            if (typeof tf.disposeVariables === 'function') {
                tf.disposeVariables();
            }
            
            // Approach 2: Manually collect garbage if available in the browser
            if (typeof window !== 'undefined' && typeof window.gc === 'function') {
                window.gc();
            }
            
            // Log final tensor count
            const memInfo = tf.memory();
            console.log(`After cleanup: ${memInfo.numTensors} tensors, ${(memInfo.numBytes / 1048576).toFixed(2)} MB`);
            
        } catch (error) {
            console.error('Error cleaning up memory:', error);
        }
    }
}

// Create a global instance
const memoryManager = new TensorflowMemoryManager();
