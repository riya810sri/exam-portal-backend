// Frontend JavaScript Module: Remove Fullscreen Popup Implementation
// This module provides the complete solution to remove manual fullscreen popups

/**
 * Automatic Fullscreen Manager - No Popup Required
 * This replaces any manual fullscreen instruction components
 */
class AutoFullscreenManager {
  constructor() {
    this.isInitialized = false;
    this.securityScriptsLoaded = false;
    this.examInProgress = false;
  }

  /**
   * Initialize automatic fullscreen without any popups
   * Call this when user clicks "Start Exam"
   */
  async initializeSecureExam(examId, studentId, authToken) {
    try {
      console.log('🚀 Initializing secure exam environment...');
      
      // 1. Load security monitoring scripts
      const scriptsLoaded = await this.loadSecurityScripts(examId, authToken);
      if (!scriptsLoaded) {
        throw new Error('Failed to load security scripts');
      }

      // 2. Set exam as active (this enables automatic fullscreen monitoring)
      window.examInProgress = true;
      this.examInProgress = true;

      // 3. Automatically enter fullscreen mode (NO USER INTERACTION REQUIRED)
      const fullscreenSuccess = await this.enterFullscreenAutomatically();
      
      if (fullscreenSuccess) {
        console.log('✅ Secure exam environment initialized successfully');
        return { success: true, message: 'Exam started in secure fullscreen mode' };
      } else {
        // Graceful fallback if automatic fullscreen fails
        console.warn('⚠️ Automatic fullscreen failed, showing fallback');
        return this.handleFullscreenFallback();
      }

    } catch (error) {
      console.error('❌ Failed to initialize secure exam:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load security monitoring scripts from backend
   */
  async loadSecurityScripts(examId, authToken) {
    try {
      const response = await fetch(`/api/exam-attendance/${examId}/monitoring-scripts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success && data.scripts) {
        // Execute fullscreen manager script
        if (data.scripts.fullscreenManager) {
          this.executeScript(data.scripts.fullscreenManager);
        }

        // Execute keyboard monitoring script
        if (data.scripts.keyboardMonitoring) {
          this.executeScript(data.scripts.keyboardMonitoring);
        }

        // Execute mouse monitoring script
        if (data.scripts.mouseMonitoring) {
          this.executeScript(data.scripts.mouseMonitoring);
        }

        this.securityScriptsLoaded = true;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to load security scripts:', error);
      return false;
    }
  }

  /**
   * Execute security script in the browser
   */
  executeScript(scriptContent) {
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);
  }

  /**
   * Automatically enter fullscreen mode without user popup
   */
  async enterFullscreenAutomatically() {
    try {
      // Wait a moment for scripts to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use the fullscreen function provided by the backend script
      if (window.enterExamFullscreen) {
        await window.enterExamFullscreen();
        console.log('✅ Entered fullscreen mode automatically');
        return true;
      } else {
        // Fallback to direct fullscreen API
        const element = document.documentElement;
        
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        } else {
          throw new Error('Fullscreen API not supported');
        }
        
        console.log('✅ Entered fullscreen mode using direct API');
        return true;
      }
    } catch (error) {
      console.error('Failed to enter fullscreen automatically:', error);
      return false;
    }
  }

  /**
   * Handle cases where automatic fullscreen fails
   */
  handleFullscreenFallback() {
    // Show a minimal, non-blocking message
    const fallbackMessage = document.createElement('div');
    fallbackMessage.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff9800;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
      ">
        <strong>⚠️ Fullscreen Required</strong><br>
        Press <kbd>F11</kbd> to enter fullscreen mode for exam security.
        <button onclick="this.parentElement.parentElement.remove()" 
                style="
                  background: none;
                  border: none;
                  color: white;
                  float: right;
                  cursor: pointer;
                  font-size: 18px;
                  margin-top: -5px;
                ">×</button>
      </div>
    `;
    
    document.body.appendChild(fallbackMessage);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (fallbackMessage.parentElement) {
        fallbackMessage.remove();
      }
    }, 10000);

    return { 
      success: true, 
      message: 'Exam started with fallback fullscreen instruction',
      fallback: true 
    };
  }

  /**
   * Exit fullscreen when exam ends
   */
  exitSecureExam() {
    try {
      window.examInProgress = false;
      this.examInProgress = false;

      if (window.exitExamFullscreen) {
        window.exitExamFullscreen();
      } else {
        // Fallback to direct exit
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }

      console.log('✅ Exited secure exam environment');
    } catch (error) {
      console.error('Error exiting secure exam:', error);
    }
  }

  /**
   * Remove any existing fullscreen instruction popups from the page
   */
  static removeExistingFullscreenPopups() {
    const selectors = [
      '.fullscreen-instruction-modal',
      '.fullscreen-popup',
      '.manual-fullscreen-guide',
      '[data-fullscreen-instructions]',
      '.fullscreen-warning-modal',
      '.enter-fullscreen-modal'
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        console.log(`Removing fullscreen popup: ${selector}`);
        element.remove();
      });
    });

    // Also remove buttons with fullscreen instruction text
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      const text = button.textContent.toLowerCase();
      if (text.includes('enter fullscreen') || 
          text.includes('press f11') || 
          text.includes('fullscreen mode') ||
          text.includes('follow these steps')) {
        console.log(`Removing manual fullscreen button: ${button.textContent}`);
        button.remove();
      }
    });
  }

  /**
   * Check if automatic fullscreen is working
   */
  static testAutomaticFullscreen() {
    console.log('🧪 Testing automatic fullscreen functionality...');
    
    setTimeout(() => {
      const isFullscreen = !!(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      if (isFullscreen) {
        console.log('✅ SUCCESS: Automatic fullscreen is working!');
      } else {
        console.log('❌ ISSUE: Fullscreen did not activate automatically');
        console.log('This might be due to browser restrictions or missing user interaction');
      }
    }, 2000);
  }
}

/**
 * DOM Content Loaded - Remove any existing popups
 */
document.addEventListener('DOMContentLoaded', () => {
  // Remove any existing fullscreen instruction popups
  AutoFullscreenManager.removeExistingFullscreenPopups();
  
  // Set up a periodic check to remove popups that might be added dynamically
  setInterval(() => {
    AutoFullscreenManager.removeExistingFullscreenPopups();
  }, 5000);
});

// Export for use in React/Vue/other frameworks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoFullscreenManager;
}

// Global assignment for direct use
window.AutoFullscreenManager = AutoFullscreenManager;

console.log('🔧 Auto Fullscreen Manager loaded - No popups will be shown!');
