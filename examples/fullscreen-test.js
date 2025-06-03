/**
 * Fullscreen Functionality Test Script
 * 
 * This script helps test the fullscreen functionality for the exam monitoring system.
 * Run this in a browser console or add to your application for testing purposes.
 */

// Sample test data (mock server response)
const mockServerResponse = {
  success: true,
  scripts: {
    fullscreenManager: `
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
        };
        
        // Add basic fullscreen change detection
        document.addEventListener('fullscreenchange', function() {
          console.log('Fullscreen change detected', document.fullscreenElement ? 'entered' : 'exited');
        });
        
        console.log('Fullscreen test script initialized');
      })();
    `
  }
};

// Function to execute the script
function executeTestScript(scriptCode) {
  try {
    const scriptElement = document.createElement('script');
    scriptElement.textContent = scriptCode;
    document.head.appendChild(scriptElement);
    console.log('Script initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize script:', error);
    return false;
  }
}

// Test fullscreen functionality
async function testFullscreenFunctionality() {
  console.log('Starting fullscreen functionality test...');
  
  // Step 1: Execute the fullscreen manager script
  const scriptInitialized = executeTestScript(mockServerResponse.scripts.fullscreenManager);
  if (!scriptInitialized) {
    console.error('Failed to initialize fullscreen script');
    return false;
  }
  
  // Step 2: Check if the fullscreen functions are available
  if (typeof window.enterExamFullscreen !== 'function') {
    console.error('enterExamFullscreen function not found');
    return false;
  }
  
  if (typeof window.exitExamFullscreen !== 'function') {
    console.error('exitExamFullscreen function not found');
    return false;
  }
  
  // Step 3: Test entering fullscreen (requires user interaction)
  console.log('Testing entering fullscreen in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Set exam in progress flag
    window.examInProgress = true;
    
    // Enter fullscreen
    window.enterExamFullscreen();
    console.log('Fullscreen requested. Check if browser entered fullscreen mode.');
    
    // Wait 5 seconds to test exit
    console.log('Testing exiting fullscreen in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Set exam completed
    window.examInProgress = false;
    
    // Exit fullscreen
    window.exitExamFullscreen();
    console.log('Fullscreen exit requested. Check if browser exited fullscreen mode.');
    
    return true;
  } catch (error) {
    console.error('Error during fullscreen test:', error);
    return false;
  }
}

// Add test UI
function createTestUI() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.padding = '20px';
  container.style.background = '#f0f0f0';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '5px';
  container.style.zIndex = '9999';
  
  container.innerHTML = `
    <h3>Fullscreen Test</h3>
    <button id="test-enter-fullscreen">Enter Fullscreen</button>
    <button id="test-exit-fullscreen">Exit Fullscreen</button>
    <button id="test-full-sequence">Test Full Sequence</button>
    <div id="test-status" style="margin-top: 10px; font-weight: bold;"></div>
  `;
  
  document.body.appendChild(container);
  
  // Add event listeners
  document.getElementById('test-enter-fullscreen').addEventListener('click', function() {
    window.examInProgress = true;
    window.enterExamFullscreen();
    document.getElementById('test-status').textContent = 'Entered fullscreen';
  });
  
  document.getElementById('test-exit-fullscreen').addEventListener('click', function() {
    window.examInProgress = false;
    window.exitExamFullscreen();
    document.getElementById('test-status').textContent = 'Exited fullscreen';
  });
  
  document.getElementById('test-full-sequence').addEventListener('click', async function() {
    document.getElementById('test-status').textContent = 'Running full test...';
    const result = await testFullscreenFunctionality();
    document.getElementById('test-status').textContent = result ? 
      'Test completed successfully' : 
      'Test failed - see console for details';
  });
}

// Initialize test
function initFullscreenTest() {
  console.log('Initializing fullscreen test...');
  
  // Execute the script
  executeTestScript(mockServerResponse.scripts.fullscreenManager);
  
  // Create the test UI after a short delay
  setTimeout(createTestUI, 500);
  
  console.log('Test initialized. Use the buttons in the top-right corner to test fullscreen functionality.');
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initFullscreenTest, 1);
  } else {
    document.addEventListener('DOMContentLoaded', initFullscreenTest);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testFullscreenFunctionality,
    initFullscreenTest
  };
} 