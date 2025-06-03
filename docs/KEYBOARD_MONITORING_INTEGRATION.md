# Keyboard Monitoring Integration Guide

This guide explains how to integrate the keyboard monitoring feature into the frontend of your exam application. Keyboard monitoring helps detect potential cheating behaviors by analyzing keyboard patterns during exams.

## Overview

The keyboard monitoring system works by:

1. Tracking keyboard events on the client side
2. Sending this data to the server for analysis
3. Analyzing patterns to detect suspicious behavior
4. Updating the risk assessment for the exam session

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
      
      // Execute keyboard monitoring script
      if (data.scripts && data.scripts.keyboardMonitoring) {
        executeMonitoringScript(data.scripts.keyboardMonitoring);
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
  
  // Store socket globally for the monitoring script to access
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
  
  // Start sending heartbeats
  setInterval(() => {
    if (socket.connected) {
      socket.emit('security_heartbeat', { timestamp: Date.now() });
    }
  }, 10000);
  
  return socket;
}
```

### 3. Execute Keyboard Monitoring Script

Execute the keyboard monitoring script received from the server:

```javascript
function executeMonitoringScript(scriptCode) {
  try {
    // Create a new script element
    const scriptElement = document.createElement('script');
    scriptElement.textContent = scriptCode;
    document.head.appendChild(scriptElement);
    
    console.log('Keyboard monitoring script initialized');
  } catch (error) {
    console.error('Failed to initialize keyboard monitoring:', error);
  }
}
```

### 4. React Component Example

Here's a complete React component example that integrates keyboard monitoring:

```jsx
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const ExamMonitoring = ({ examId, sessionToken }) => {
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [socket, setSocket] = useState(null);
  
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
          
          // Execute keyboard monitoring script
          if (data.scripts && data.scripts.keyboardMonitoring) {
            executeMonitoringScript(data.scripts.keyboardMonitoring);
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
      // Remove global socket reference
      if (window.socket) {
        window.socket = null;
      }
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
    
    // Start sending heartbeats
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('security_heartbeat', { timestamp: Date.now() });
      }
    }, 10000);
    
    // Clear interval on component unmount
    return socketInstance;
  };
  
  // Execute keyboard monitoring script
  const executeMonitoringScript = (scriptCode) => {
    try {
      // Create a new script element
      const scriptElement = document.createElement('script');
      scriptElement.textContent = scriptCode;
      document.head.appendChild(scriptElement);
      
      console.log('Keyboard monitoring script initialized');
    } catch (error) {
      console.error('Failed to initialize keyboard monitoring:', error);
    }
  };
  
  return (
    <div className="exam-monitoring">
      {monitoringActive ? (
        <div className="monitoring-status active">
          <span className="status-indicator"></span>
          Exam security monitoring active
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

## Security Considerations

1. **Data Privacy**: The keyboard monitoring only tracks keystroke timing and patterns, not the actual keys pressed (except for potential shortcut combinations).

2. **Transparency**: Always inform students that their keyboard activity is being monitored for exam security purposes.

3. **False Positives**: The system uses statistical analysis to detect anomalies, but some legitimate behaviors might be flagged. Always have a human review suspicious activities.

4. **Browser Support**: The monitoring script works in modern browsers but might have limitations in older browsers or certain environments.

## Troubleshooting

### Common Issues

1. **Socket Connection Failures**:
   - Check if the port is accessible from the client
   - Verify that the monit_id is correctly passed
   - Ensure CORS is properly configured

2. **Script Execution Errors**:
   - Check browser console for errors
   - Verify that the script is properly injected
   - Ensure no Content Security Policy (CSP) is blocking script execution

3. **Data Not Being Sent**:
   - Verify that the global socket object is available
   - Check if the socket is connected
   - Look for network errors in the browser console

### Debugging

Add the following code to enable debug mode:

```javascript
// Enable debug mode for keyboard monitoring
window.KEYBOARD_MONITORING_DEBUG = true;
```

This will output additional information to the console about keyboard events and data transmission. 