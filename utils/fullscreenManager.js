/**
 * Fullscreen Manager Utility
 * 
 * This module provides functionality to manage fullscreen mode
 * during exams for security and focus purposes.
 */

/**
 * Generate a client-side fullscreen manager script
 * @returns {String} JavaScript code to be executed on client
 */
const generateFullscreenManagerScript = () => {
  return `
    (function() {
      // Track fullscreen state
      let isFullscreen = false;
      let fullscreenWarnings = 0;
      const MAX_WARNINGS = 3;
      
      // Function to enter fullscreen mode
      window.enterExamFullscreen = function() {
        const docEl = document.documentElement;
        
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) { /* Safari */
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) { /* IE11 */
          docEl.msRequestFullscreen();
        }
        
        isFullscreen = true;
        console.log('Entered fullscreen mode for exam');
        
        if (window.socket && window.socket.connected) {
          window.socket.emit('security_event', {
            event_type: 'fullscreen_entered',
            timestamp: Date.now()
          });
        }
      };
      
      // Function to exit fullscreen mode
      window.exitExamFullscreen = function() {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
          document.msExitFullscreen();
        }
        
        isFullscreen = false;
        console.log('Exited fullscreen mode after exam');
        
        if (window.socket && window.socket.connected) {
          window.socket.emit('security_event', {
            event_type: 'fullscreen_exited',
            timestamp: Date.now()
          });
        }
      };
      
      // Monitor fullscreen changes
      document.addEventListener('fullscreenchange', function() {
        if (document.fullscreenElement) {
          isFullscreen = true;
          fullscreenWarnings = 0;
        } else {
          isFullscreen = false;
          
          // Only send warning if we're expecting to be in fullscreen
          if (window.examInProgress) {
            fullscreenWarnings++;
            
            if (window.socket && window.socket.connected) {
              window.socket.emit('security_event', {
                event_type: 'fullscreen_exit_detected',
                timestamp: Date.now(),
                details: {
                  warningCount: fullscreenWarnings,
                  maxWarnings: MAX_WARNINGS
                }
              });
            }
            
            // Show warning to user
            if (typeof window.showFullscreenWarning === 'function') {
              window.showFullscreenWarning(fullscreenWarnings, MAX_WARNINGS);
            } else {
              alert(\`Warning (\${fullscreenWarnings}/\${MAX_WARNINGS}): Please return to fullscreen mode to continue your exam.\`);
            }
            
            // If too many warnings, force re-enter fullscreen
            if (fullscreenWarnings < MAX_WARNINGS) {
              setTimeout(window.enterExamFullscreen, 3000);
            } else {
              if (window.socket && window.socket.connected) {
                window.socket.emit('security_event', {
                  event_type: 'fullscreen_violations_exceeded',
                  timestamp: Date.now(),
                  details: {
                    maxWarnings: MAX_WARNINGS
                  }
                });
              }
              
              if (typeof window.handleMaxFullscreenViolations === 'function') {
                window.handleMaxFullscreenViolations();
              }
            }
          }
        }
      });
      
      // Also handle webkit and moz prefixed events for broader browser support
      document.addEventListener('webkitfullscreenchange', function() {
        if (document.webkitFullscreenElement) {
          isFullscreen = true;
          fullscreenWarnings = 0;
        } else {
          isFullscreen = false;
          
          if (window.examInProgress) {
            fullscreenWarnings++;
            // Similar handling as above
            if (fullscreenWarnings < MAX_WARNINGS) {
              setTimeout(window.enterExamFullscreen, 3000);
            }
          }
        }
      });
      
      // Add keyboard shortcut blocking for fullscreen shortcuts
      document.addEventListener('keydown', function(e) {
        // Block F11 key (fullscreen)
        if (e.key === 'F11') {
          e.preventDefault();
          
          if (!isFullscreen && window.examInProgress) {
            window.enterExamFullscreen();
          }
          
          return false;
        }
        
        // Block Escape key (exits fullscreen)
        if (e.key === 'Escape' && isFullscreen && window.examInProgress) {
          e.preventDefault();
          
          if (window.socket && window.socket.connected) {
            window.socket.emit('security_event', {
              event_type: 'fullscreen_escape_blocked',
              timestamp: Date.now()
            });
          }
          
          return false;
        }
      }, true);
      
      console.log('Fullscreen monitoring initialized');
    })();
  `;
};

module.exports = {
  generateFullscreenManagerScript
}; 