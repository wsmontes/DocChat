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
            
            // Safely dispose variables
            try {
                tf.disposeVariables();
            } catch (error) {
                console.warn('Error disposing variables:', error);
            }
            
            // Safely end scope
            try {
                // Get the current engine - this might return undefined if there's an issue
                const engine = tf.engine();
                if (engine && typeof engine.endScope === 'function') {
                    engine.endScope();
                }
            } catch (error) {
                console.warn('Error ending TensorFlow scope:', error);
            }
            
            // Safely start a new scope
            try {
                // Get the current engine - this might return undefined if there's an issue
                const engine = tf.engine();
                if (engine && typeof engine.startScope === 'function') {
                    engine.startScope();
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
