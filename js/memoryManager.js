/**
 * Memory management utility for TensorFlow.js
 * Helps prevent memory leaks and monitor memory usage
 */
class TensorflowMemoryManager {
    constructor() {
        this.isSupported = typeof tf !== 'undefined' && tf.memory;
        this.memoryLimit = 500000000; // 500MB memory limit before suggesting cleanup
        this.memoryWarningDisplayed = false;
        this.hasScopeTracking = this.checkScopeTrackingSupport();
        
        if (this.isSupported && !this.hasScopeTracking) {
            console.log('TensorFlow.js is available but scope tracking is not supported. Using alternative memory management.');
        }
    }
    
    /**
     * Check if TensorFlow.js scope tracking is available
     * @returns {boolean} Whether scope tracking is supported
     */
    checkScopeTrackingSupport() {
        if (!this.isSupported) return false;
        
        try {
            const engine = tf.engine();
            // Check both for the engine and the specific functions we need
            return engine && 
                   typeof engine.startScope === 'function' && 
                   typeof engine.endScope === 'function' && 
                   engine.state && 
                   typeof engine.state.track === 'function';
        } catch (error) {
            console.warn('Error checking TensorFlow.js scope support:', error);
            return false;
        }
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
     * Clean up unused tensors using the appropriate method
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
            
            // Use scope-based cleanup if available
            if (this.hasScopeTracking) {
                this.cleanupUsingScopes();
            } else {
                // Alternative memory management when scope tracking is not available
                this.alternativeCleanup();
            }
            
            // Force garbage collection if available
            if (window.gc) window.gc();
            
            this.checkMemoryUsage();
        } catch (error) {
            console.error('Error during memory cleanup:', error);
        }
    }
    
    /**
     * Cleanup memory using TensorFlow.js scopes when available
     * @private
     */
    cleanupUsingScopes() {
        try {
            // Safely dispose variables
            if (typeof tf.disposeVariables === 'function') {
                tf.disposeVariables();
            }
            
            const engine = tf.engine();
            if (engine) {
                // End current scope to clean up temporary tensors
                engine.endScope();
                // Start a new scope for future operations
                engine.startScope();
            }
        } catch (error) {
            console.warn('Error during scope-based cleanup:', error);
            // Fall back to alternative cleanup if scope-based cleanup fails
            this.alternativeCleanup();
        }
    }
    
    /**
     * Alternative memory cleanup when scope tracking is not available
     * @private
     */
    alternativeCleanup() {
        // Method 1: Try to dispose variables
        try {
            if (typeof tf.disposeVariables === 'function') {
                tf.disposeVariables();
            }
        } catch (error) {
            console.warn('Error disposing variables:', error);
        }
        
        // Method 2: Try to clean up using keepTensors
        try {
            if (typeof tf.tidy === 'function') {
                // Use tidy to automatically clean up intermediate tensors
                tf.tidy(() => {
                    // Nothing to do here - tidy will clean up tensors created inside
                });
            }
        } catch (error) {
            console.warn('Error using tf.tidy:', error);
        }
        
        // Method 3: If all else fails, try to dispose specific tensors
        try {
            // Get all tensors and dispose non-persistent ones
            if (typeof tf.memory === 'function') {
                const tensors = tf.memory().numTensors;
                if (tensors > 100) { // Only do this cleanup if we have many tensors
                    console.log(`Found ${tensors} tensors, attempting disposal of unused ones`);
                    tf.dispose();
                }
            }
        } catch (error) {
            console.warn('Error disposing tensors:', error);
        }
    }
    
    /**
     * Run an operation in a managed memory context
     * @param {Function} operation - The operation to run
     * @returns {Promise} The result of the operation
     */
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
