/**
 * Memory management utility for TensorFlow.js
 * Helps prevent memory leaks and monitor memory usage
 */
class TensorflowMemoryManager {
    constructor() {
        this.isSupported = typeof tf !== 'undefined' && tf.memory;
        this.memoryLimit = 500000000; // 500MB memory limit before suggesting cleanup
        this.memoryWarningDisplayed = false;
    }
    
    /**
     * Check current memory usage and display warnings if needed
     */
    checkMemoryUsage() {
        if (!this.isSupported) return;
        
        try {
            const memoryInfo = tf.memory();
            console.log('TensorFlow.js memory usage:', memoryInfo);
            
            // Check if memory usage is high
            if (memoryInfo.numBytes > this.memoryLimit && !this.memoryWarningDisplayed) {
                console.warn('TensorFlow.js memory usage is high. Consider disposing unused tensors.');
                this.memoryWarningDisplayed = true;
                
                // Reset warning flag after some time
                setTimeout(() => {
                    this.memoryWarningDisplayed = false;
                }, 60000); // Reset after 1 minute
            }
        } catch (error) {
            console.error('Error checking memory usage:', error);
        }
    }
    
    /**
     * Clean up unused tensors
     */
    cleanupMemory() {
        if (!this.isSupported) return;
        
        try {
            console.log('Cleaning up TensorFlow.js memory...');
            
            // Safely check if tf is accessible
            if (!tf || !tf.engine) {
                console.warn('TensorFlow.js not properly initialized, skipping memory cleanup');
                return;
            }
            
            // Safely dispose variables
            try {
                if (typeof tf.disposeVariables === 'function') {
                    tf.disposeVariables();
                }
            } catch (error) {
                console.warn('Error disposing variables:', error);
            }
            
            // Safely end scope
            try {
                const engine = tf.engine();
                // Check if engine exists and has a properly initialized scope system
                if (!engine) {
                    console.warn('TensorFlow engine is null, cannot end scope.');
                } else if (typeof engine.endScope === 'function') {
                    // Additional check to ensure track functionality is available
                    if (engine.state && typeof engine.state.track === 'function') {
                        engine.endScope();
                    } else {
                        console.warn('TensorFlow scope tracking is not available, skipping endScope');
                    }
                }
            } catch (error) {
                console.warn('Error ending TensorFlow scope:', error);
            }
            
            // Safely start a new scope
            try {
                const engine = tf.engine();
                if (!engine) {
                    console.warn('TensorFlow engine is null, cannot start scope.');
                } else if (typeof engine.startScope === 'function') {
                    // Additional check for track functionality
                    if (engine.state && typeof engine.state.track === 'function') {
                        engine.startScope();
                    } else {
                        console.warn('TensorFlow scope tracking is not available, skipping startScope');
                    }
                }
            } catch (error) {
                console.warn('Error starting TensorFlow scope:', error);
            }
            
            // Force garbage collection if available
            if (window.gc) window.gc();
            
            this.checkMemoryUsage();
        } catch (error) {
            console.error('Error during memory cleanup:', error);
        }
    }
    
    /**
     * Run an operation in a managed memory context
     * @param {Function} operation - The operation to run
     * @returns {Promise} The result of the operation
     */
    async runWithMemoryManagement(operation) {
        if (!this.isSupported) return operation();
        
        let scopeStarted = false;
        
        try {
            // Start a new scope for automatic tensor cleanup
            try {
                const engine = tf.engine();
                if (engine && typeof engine.startScope === 'function') {
                    engine.startScope();
                    scopeStarted = true;
                }
            } catch (error) {
                console.warn('Error starting TensorFlow scope:', error);
            }
            
            const result = await operation();
            return result;
        } finally {
            // End the scope to clean up temporary tensors
            if (scopeStarted) {
                try {
                    const engine = tf.engine();
                    if (engine && typeof engine.endScope === 'function') {
                        engine.endScope();
                    }
                } catch (error) {
                    console.warn('Error ending TensorFlow scope:', error);
                }
            }
            this.checkMemoryUsage();
        }
    }
}

// Create a global instance for use throughout the app
const memoryManager = new TensorflowMemoryManager();

// Set up periodic memory checks
setInterval(() => {
    try {
        memoryManager.checkMemoryUsage();
    } catch (error) {
        console.error('Error in periodic memory check:', error);
    }
}, 30000); // Check every 30 seconds
