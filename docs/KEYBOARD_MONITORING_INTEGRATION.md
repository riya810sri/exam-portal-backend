# Keyboard, Keybinding, Mouse & Fullscreen Monitoring Integration Guide

This guide explains how to integrate the keyboard, keybinding, mouse monitoring, and fullscreen features into the frontend of your exam application. These monitoring systems help detect potential cheating behaviors and maintain exam integrity.

## Overview

The monitoring system works by:

1. Tracking keyboard events, keybindings, and mouse movements on the client side
2. Collecting mouse position data every 2 seconds
3. Enforcing fullscreen mode during the exam
4. Sending this data to the server for analysis
5. Analyzing patterns to detect suspicious behavior or prohibited keyboard shortcuts
6. Updating the risk assessment for the exam session
7. Notifying administrators of potential violations

## Integration Steps

### 1. Start Monitoring Session

When a student begins an exam, start the monitoring session by calling the `/api/exam-attendance/:examId/start-monitoring` endpoint:

```javascript
async function startExamMonitoring(examId) {
  try {
    const response = await fetch(`/api/exam-attendance/${examId}/start-monitoring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to start monitoring');
    }

    const data = await response.json();
    
    if (data.success) {
      // Initialize socket connection
      initializeSocketConnection(data.socket);
      
      // Execute monitoring scripts
      if (data.scripts) {
        if (data.scripts.keyboardMonitoring) {
          executeMonitoringScript(data.scripts.keyboardMonitoring, 'keyboard-monitoring');
        }
        if (data.scripts.mouseMonitoring) {
          executeMonitoringScript(data.scripts.mouseMonitoring, 'mouse-monitoring');
        }
        if (data.scripts.fullscreenManager) {
          executeMonitoringScript(data.scripts.fullscreenManager, 'fullscreen-manager');
          
          // Start exam in fullscreen mode
          window.examInProgress = true;
          window.enterExamFullscreen();
        }
      }
      
      return data;
    }
  } catch (error) {
    console.error('Error starting monitoring:', error);
  }
}
```

### 2. Initialize Socket Connection

Set up a socket connection to receive and send monitoring data:

```javascript
function initializeSocketConnection(socketConfig) {
  if (!socketConfig || !socketConfig.port || !socketConfig.monit_id) {
    console.error('Invalid socket configuration');
    return;
  }
  
  // Create socket connection
  const socketUrl = socketConfig.url || `http://localhost:${socketConfig.port}`;
  const socket = io(socketUrl, {
    transports: socketConfig.protocols || ['websocket', 'polling'],
    query: {
      monit_id: socketConfig.monit_id,
      client_type: 'exam_client'
    }
  });
  
  // Store socket globally for the monitoring scripts to access
  window.socket = socket;
  
  // Set up event handlers
  socket.on('connect', () => {
    console.log('Connected to monitoring server');
    
    // Send browser validation data
    socket.emit('browser_validation', {
      userAgent: navigator.userAgent,
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from monitoring server');
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  // Add handler for security warnings (like prohibited keybindings)
  socket.on('security_warning', (warning) => {
    handleSecurityWarning(warning);
  });
  
  // Start sending heartbeats
  setInterval(() => {
    if (socket.connected) {
      socket.emit('security_heartbeat', { timestamp: Date.now() });
    }
  }, 10000);
  
  return socket;
}

// Handle security warnings from server
function handleSecurityWarning(warning) {
  console.warn('Security warning received:', warning);
  
  // You can implement UI notifications, log the event, or take other actions
  if (warning.type === 'PROHIBITED_KEYBINDING') {
    // Example: Show a warning to the user
    showWarningNotification(
      'Warning: Prohibited keyboard shortcuts detected',
      'The use of certain keyboard shortcuts is not allowed during exams.'
    );
  } else if (warning.type === 'FULLSCREEN_REQUIRED') {
    // Prompt user to return to fullscreen
    showWarningNotification(
      'Warning: Fullscreen Required',
      'Please return to fullscreen mode to continue your exam.'
    );
    
    // Attempt to re-enter fullscreen
    setTimeout(() => {
      if (window.enterExamFullscreen) {
        window.enterExamFullscreen();
      }
    }, 3000);
  }
}

// Example notification function (implement based on your UI library)
function showWarningNotification(title, message) {
  // This is a placeholder - implement using your UI framework
  // For example with Toast notifications
  if (window.toastNotify) {
    window.toastNotify({
      title,
      message,
      type: 'warning',
      duration: 5000
    });
  } else {
    // Fallback to alert if no notification system is available
    alert(`${title}\n${message}`);
  }
}
```

### 3. Execute Monitoring Scripts

Execute the monitoring scripts received from the server:

```javascript
function executeMonitoringScript(scriptCode, scriptId) {
  try {
    // Create a new script element
    const scriptElement = document.createElement('script');
    scriptElement.textContent = scriptCode;
    scriptElement.id = scriptId;
    document.head.appendChild(scriptElement);
    
    console.log(`${scriptId} initialized`);
  } catch (error) {
    console.error(`Failed to initialize ${scriptId}:`, error);
  }
}
```

### 4. Handle Exam Completion

When the exam is completed, the API response includes a flag to exit fullscreen mode:

```javascript
async function completeExam(examId, answers) {
  // Submit the answers to complete the exam
  const response = await fetch(`/api/exam-attendance/${examId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ answers })
  });

  const data = await response.json();
  
  // Check if we should exit fullscreen mode
  if (data.shouldExitFullscreen && window.exitExamFullscreen) {
    // Set exam as no longer in progress
    window.examInProgress = false;
    
    // Exit fullscreen mode
    window.exitExamFullscreen();
  }
  
  return data;
}
```

### 5. Custom Fullscreen Warning Handlers

You can define custom handlers for fullscreen warnings:

```javascript
// Define a custom fullscreen warning handler
window.showFullscreenWarning = function(warningCount, maxWarnings) {
  const remainingWarnings = maxWarnings - warningCount;
  
  // Use your UI framework to show a warning
  showWarningModal({
    title: 'Fullscreen Required',
    message: `Please return to fullscreen mode to continue your exam. Warning ${warningCount}/${maxWarnings}.`,
    type: 'warning',
    actions: [{
      label: 'Return to Fullscreen',
      onClick: () => window.enterExamFullscreen()
    }]
  });
};

// Define a handler for when maximum fullscreen violations are reached
window.handleMaxFullscreenViolations = function() {
  showWarningModal({
    title: 'Exam Security Violation',
    message: 'You have repeatedly exited fullscreen mode. This will be reported as a security violation.',
    type: 'error',
    actions: [{
      label: 'Continue in Fullscreen',
      onClick: () => window.enterExamFullscreen()
    }]
  });
  
  // Optionally report to your application's central security monitoring
  reportSecurityViolation({
    type: 'FULLSCREEN_VIOLATIONS_EXCEEDED',
    timestamp: Date.now()
  });
};
```

### 6. React Component Example

Here's a complete React component example that integrates keyboard, keybinding, mouse, and fullscreen monitoring:

```jsx
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify'; // Example notification library

const ExamMonitoring = ({ examId, sessionToken }) => {
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [socket, setSocket] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Start monitoring when component mounts
  useEffect(() => {
    let mounted = true;
    
    const startMonitoring = async () => {
      try {
        const response = await fetch(`/api/exam-attendance/${examId}/start-monitoring`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to start monitoring');
        }

        const data = await response.json();
        
        if (data.success && mounted) {
          // Initialize socket connection
          const socketInstance = initializeSocketConnection(data.socket);
          setSocket(socketInstance);
          
          // Execute monitoring scripts
          if (data.scripts) {
            if (data.scripts.keyboardMonitoring) {
              executeMonitoringScript(data.scripts.keyboardMonitoring, 'keyboard-monitoring');
            }
            if (data.scripts.mouseMonitoring) {
              executeMonitoringScript(data.scripts.mouseMonitoring, 'mouse-monitoring');
            }
            if (data.scripts.fullscreenManager) {
              executeMonitoringScript(data.scripts.fullscreenManager, 'fullscreen-manager');
              
              // Setup custom handlers
              window.showFullscreenWarning = (count, max) => {
                toast.warning(
                  `Please return to fullscreen mode to continue your exam. Warning ${count}/${max}.`,
                  { autoClose: 5000 }
                );
              };
              
              window.handleMaxFullscreenViolations = () => {
                toast.error(
                  'Multiple fullscreen violations detected. This will be reported.',
                  { autoClose: false }
                );
              };
              
              // Start exam in fullscreen mode
              window.examInProgress = true;
              setTimeout(() => {
                if (window.enterExamFullscreen) {
                  window.enterExamFullscreen();
                }
              }, 1000);
            }
          }
          
          setMonitoringActive(true);
        }
      } catch (error) {
        console.error('Error starting monitoring:', error);
      }
    };
    
    startMonitoring();
    
    // Cleanup on unmount
    return () => {
      mounted = false;
      if (socket) {
        socket.disconnect();
      }
      
      // Exit fullscreen if active
      if (document.fullscreenElement && window.exitExamFullscreen) {
        window.exitExamFullscreen();
      }
      
      // Remove global socket reference
      if (window.socket) {
        window.socket = null;
      }
      
      // Set exam as no longer in progress
      window.examInProgress = false;
    };
  }, [examId, sessionToken]);
  
  // Initialize socket connection
  const initializeSocketConnection = (socketConfig) => {
    if (!socketConfig || !socketConfig.port || !socketConfig.monit_id) {
      console.error('Invalid socket configuration');
      return null;
    }
    
    // Create socket connection
    const socketUrl = socketConfig.url || `http://localhost:${socketConfig.port}`;
    const socketInstance = io(socketUrl, {
      transports: socketConfig.protocols || ['websocket', 'polling'],
      query: {
        monit_id: socketConfig.monit_id,
        client_type: 'exam_client'
      }
    });
    
    // Store socket globally for the monitoring script to access
    window.socket = socketInstance;
    
    // Set up event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to monitoring server');
      
      // Send browser validation data
      socketInstance.emit('browser_validation', {
        userAgent: navigator.userAgent,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: Date.now()
      });
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Disconnected from monitoring server');
    });
    
    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Handle security warnings
    socketInstance.on('security_warning', (warning) => {
      console.warn('Security warning received:', warning);
      
      // Add to warnings list
      setWarnings(prev => [...prev, warning]);
      
      // Show notification
      if (warning.type === 'PROHIBITED_KEYBINDING') {
        toast.warning(
          'The use of keyboard shortcuts is not allowed during exams.',
          { autoClose: 5000 }
        );
      } else if (warning.type === 'MOUSE_ANOMALY') {
        toast.warning(
          'Unusual mouse activity detected.',
          { autoClose: 5000 }
        );
      } else if (warning.type === 'FULLSCREEN_REQUIRED') {
        toast.error(
          'Fullscreen mode is required for this exam.',
          { autoClose: false }
        );
        
        // Try to re-enter fullscreen
        if (window.enterExamFullscreen) {
          setTimeout(window.enterExamFullscreen, 2000);
        }
      }
    });
    
    // Start sending heartbeats
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('security_heartbeat', { timestamp: Date.now() });
      }
    }, 10000);
    
    return socketInstance;
  };
  
  // Execute monitoring script
  const executeMonitoringScript = (scriptCode, scriptId) => {
    try {
      // Create a new script element
      const scriptElement = document.createElement('script');
      scriptElement.textContent = scriptCode;
      scriptElement.id = scriptId;
      document.head.appendChild(scriptElement);
      
      console.log(`${scriptId} initialized`);
    } catch (error) {
      console.error(`Failed to initialize ${scriptId}:`, error);
    }
  };
  
  // Function to handle exam completion
  const handleExamCompletion = async () => {
    // When exam is completed
    window.examInProgress = false;
    
    // Exit fullscreen mode
    if (window.exitExamFullscreen) {
      window.exitExamFullscreen();
    }
  };
  
  return (
    <div className="exam-monitoring">
      {monitoringActive ? (
        <div className="monitoring-status active">
          <span className="status-indicator"></span>
          Exam security monitoring active
          
          {warnings.length > 0 && (
            <div className="warning-count">
              {warnings.length} warning(s)
            </div>
          )}
          
          <div className="fullscreen-status">
            {isFullscreen ? (
              <span className="fullscreen-active">Fullscreen Mode Active</span>
            ) : (
              <button 
                className="enter-fullscreen-button"
                onClick={() => window.enterExamFullscreen && window.enterExamFullscreen()}
              >
                Enter Fullscreen
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="monitoring-status inactive">
          <span className="status-indicator"></span>
          Initializing exam security...
        </div>
      )}
    </div>
  );
};

export default ExamMonitoring;
```

## Monitored Activities

### Keyboard & Keybinding Monitoring

The system monitors and blocks the following types of keyboard shortcuts:

1. **Browser Navigation/Interaction**
   - F5 (Page refresh)
   - Escape (Cancel dialog)
   - Alt+Tab (Switch application)
   - Alt+F4 (Close window)

2. **Browser Developer Tools**
   - F12 (Developer tools)
   - Ctrl+Shift+I (Developer tools)
   - Ctrl+Shift+J (Developer console)
   - Ctrl+Shift+C (Element inspector)

3. **Content Manipulation**
   - Ctrl+C (Copy content)
   - Ctrl+V (Paste content)
   - Ctrl+X (Cut content)
   - Ctrl+F (Find in page)
   - Ctrl+P (Print)
   - Ctrl+S (Save page)

4. **Browser Tab Management**
   - Ctrl+T (New tab)
   - Ctrl+W (Close tab)
   - Ctrl+Shift+T (Reopen closed tab)
   - Ctrl+Tab (Switch tab)

5. **System Functions**
   - Win key (Start menu)
   - Win+R (Run dialog)
   - Win+D (Show desktop)
   - PrtScn (Screenshot)
   - Win+Shift+S (Screenshot tool)

Mac-specific equivalents (using Cmd instead of Ctrl) are also monitored.

### Mouse Monitoring

The system monitors mouse activity with the following features:

1. **Continuous Tracking**
   - Mouse position is collected every 2 seconds
   - Click events are tracked in real-time

2. **Pattern Analysis**
   - Movement consistency (automated tools often have unnaturally consistent movement)
   - Straight-line movements (indicates potentially automated movement)
   - Extended periods with no movement (could indicate using another window/device)

3. **Anomaly Detection**
   - Unnatural movement patterns
   - Perfect straight-line movements
   - Robotic-like cursor behavior

### Fullscreen Monitoring

The system enforces fullscreen mode during exams:

1. **Automatic Entry**
   - Automatically enters fullscreen when exam starts
   - Prevents distractions and access to other applications/tabs

2. **Exit Prevention**
   - Blocks Escape key to prevent fullscreen exit
   - Issues warnings when fullscreen is exited
   - Attempts to re-enter fullscreen automatically

3. **Violation Tracking**
   - Counts fullscreen exit attempts
   - Reports repeated violations to server
   - Can implement escalating consequences

4. **Automatic Exit**
   - Automatically exits fullscreen when exam is completed
   - Returns to normal browsing mode for result viewing

## Handling Security Warnings

The server may send security warnings to the client when prohibited activities are detected. Your application should handle these warnings appropriately:

```javascript
// Listen for security warnings from the server
socket.on('security_warning', (warning) => {
  console.warn('Security warning received:', warning);
  
  switch (warning.type) {
    case 'PROHIBITED_KEYBINDING':
      // Display a warning to the user
      showWarning('Prohibited keyboard shortcuts detected', 
                  'The use of keyboard shortcuts is not allowed during exams.');
      
      // Optionally log the violation
      logViolation({
        type: 'KEYBINDING_VIOLATION',
        details: warning.details,
        timestamp: new Date()
      });
      break;
    
    case 'MOUSE_ANOMALY':
      // Handle mouse anomaly warnings
      showWarning('Suspicious mouse activity detected',
                  'Unusual mouse movements have been detected.');
      break;
    
    case 'FULLSCREEN_REQUIRED':
      // Handle fullscreen warnings
      showWarning('Fullscreen Required',
                  'Please return to fullscreen mode to continue your exam.');
      
      // Attempt to re-enter fullscreen
      if (window.enterExamFullscreen) {
        setTimeout(window.enterExamFullscreen, 2000);
      }
      break;
      
    case 'SUSPICIOUS_ACTIVITY':
      // Handle other types of warnings
      // ...
      break;
      
    default:
      console.warn('Unknown warning type:', warning.type);
  }
});
```

## Security Considerations

1. **Data Privacy**: The monitoring only tracks patterns and timing, not the actual content or specific keys pressed (except for known shortcuts).

2. **Transparency**: Always inform students that their keyboard and mouse activity is being monitored for exam security purposes.

3. **False Positives**: The system uses statistical analysis to detect anomalies, but some legitimate behaviors might be flagged. Always have a human review suspicious activities.

4. **Browser Support**: The monitoring scripts work in modern browsers but might have limitations in older browsers or certain environments.

5. **Fullscreen Limitations**: Some browsers have restrictions on fullscreen management. Inform users to grant necessary permissions.

## Troubleshooting

### Common Issues

1. **Socket Connection Failures**:
   - Check if the port is accessible from the client
   - Verify that the monit_id is correctly passed
   - Ensure CORS is properly configured

2. **Script Execution Errors**:
   - Check browser console for errors
   - Verify that the scripts are properly injected
   - Ensure no Content Security Policy (CSP) is blocking script execution

3. **Data Not Being Sent**:
   - Verify that the global socket object is available
   - Check if the socket is connected
   - Look for network errors in the browser console

4. **Keybinding Detection Issues**:
   - Some browsers handle certain key combinations differently
   - Verify key combinations are being properly detected in the console logs
   - Check browser compatibility for specific keys (PrtScn, Meta/Win keys)

5. **Mouse Monitoring Issues**:
   - Ensure the collection interval is appropriate (default is 2 seconds)
   - Check if mouse movement events are being captured correctly
   - Verify that mouse data is being sent to the server

6. **Fullscreen Issues**:
   - Some browsers require user interaction before entering fullscreen
   - Certain environments (iframe, embedded) have fullscreen restrictions
   - Check if the browser supports the Fullscreen API

### Debugging

Add the following code to enable debug mode:

```javascript
// Enable debug mode for all monitoring systems
window.KEYBOARD_MONITORING_DEBUG = true;
window.MOUSE_MONITORING_DEBUG = true;
window.FULLSCREEN_DEBUG = true;
```

This will output additional information to the console about keyboard events, key combinations detected, mouse movements, fullscreen changes, and data transmission. 