# Exam Security Monitoring System - Frontend Integration Guide

## Overview

This guide provides comprehensive instructions for frontend developers to integrate with the exam security monitoring system. The system uses server-side logic to monitor exam security, with real-time communication via Socket.IO connections established dynamically for each exam session.

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│  Main Server     │────│   MongoDB       │
│   (React App)   │    │  (Port 3000)     │    │   (Security)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         │              ┌────────▼────────┐
         │              │ Admin Dashboard │
         │              │ Security APIs   │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Dynamic Socket │────│  Anti-Abuse      │────│  Real-time      │
│  Servers        │    │  System          │    │  Monitoring     │
│  (Ports 4000+)  │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

1. **Main Server** (`Port 3000`) - Express.js server handling authentication, API requests, and main routing
2. **Dynamic Socket.IO Servers** (`Ports 4000-4999`) - Isolated WebSocket servers created on-demand for each exam session
3. **Anti-Abuse System** - Detects and prevents automation, suspicious activity, and abuse
4. **Security Monitor** - Processes and responds to security events in real-time

## Required Dependencies

To integrate with the system, frontend applications should include:

```bash
npm install socket.io-client axios
```

## Environment Configuration

```javascript
// .env file
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_SOCKET_BASE_URL=http://localhost
```

## API Endpoints

### 1. Start Monitoring Session

This API initializes the monitoring session and returns the connection details for the dynamic Socket.IO server.

**Endpoint:**
- `POST /api/exam-attendance/{examId}/start-monitoring`
- `POST /api/exam-attendance/start-monitoring/{examId}`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response Format:**
```json
{
  "message": "Monitoring started successfully",
  "success": true,
  "monitoringId": "60a7c3b9e8f5a232b4c88c7f",
  "riskLevel": "LOW",
  "status": "MONITORING_ACTIVE",
  "socket": {
    "port": 4052,
    "url": "http://localhost:4052",
    "monit_id": "609a8c5f12345_60b7c3b9e8f5a_1620304050607",
    "protocols": ["websocket", "polling"]
  },
  "validation": {
    "requireBrowserValidation": true,
    "maxConnectionTime": 300000,
    "requiredEvents": [
      "browser_validation",
      "exam_ready",
      "security_heartbeat"
    ]
  }
}
```

**Sample Implementation:**
```javascript
const startMonitoring = async (examId, studentId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/exam-attendance/${examId}/start-monitoring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        student_id: studentId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to start monitoring session');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting monitoring:', error);
    throw error;
  }
};
```

## Socket.IO Integration

### 1. Connecting to Dynamic Socket Server

Once you receive the socket connection details from the `start-monitoring` endpoint, establish a connection to the dynamic Socket.IO server:

```javascript
import { io } from 'socket.io-client';

const connectToSocketServer = (socketConfig) => {
  const { url, port, monit_id, protocols } = socketConfig;
  
  const socket = io(`${url || `http://localhost:${port}`}`, {
    transports: protocols || ['websocket', 'polling'],
    timeout: 5000,
    query: {
      monit_id,
      client_type: 'browser_monitor'
    }
  });
  
  return socket;
};
```

### 2. Browser Validation

After connecting, you must validate the browser environment:

```javascript
// Generate browser validation data
const generateBrowserValidation = () => {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth
    },
    windowSize: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeOffset: new Date().getTimezoneOffset(),
    plugins: Array.from(navigator.plugins).map(p => ({
      name: p.name,
      description: p.description,
      filename: p.filename
    })),
    timestamp: Date.now()
  };
};

// Send validation data
socket.on('connect', () => {
  const validationData = generateBrowserValidation();
  socket.emit('browser_validation', validationData);
});

// Handle validation response
socket.on('validation_success', (data) => {
  console.log('Browser validation successful');
  // Start monitoring events
  startSecurityMonitoring(socket);
});

socket.on('validation_failed', (data) => {
  console.error('Browser validation failed:', data);
  // Handle validation failure (show error, etc.)
});
```

### 3. Sending Security Events

Monitor and send relevant security events to the server:

```javascript
const startSecurityMonitoring = (socket) => {
  // Monitor page visibility changes
  document.addEventListener('visibilitychange', () => {
    emitSecurityEvent(socket, 'visibilitychange', {
      hidden: document.hidden,
      visibilityState: document.visibilityState
    });
  });

  // Monitor window focus/blur
  window.addEventListener('blur', () => {
    emitSecurityEvent(socket, 'blur', { type: 'window_blur' });
  });

  window.addEventListener('focus', () => {
    emitSecurityEvent(socket, 'focus', { type: 'window_focus' });
  });

  // Monitor copy/paste events
  document.addEventListener('copy', (e) => {
    emitSecurityEvent(socket, 'copy', {
      selection: window.getSelection().toString().substring(0, 100)
    });
  });

  document.addEventListener('paste', (e) => {
    emitSecurityEvent(socket, 'paste', {
      clipboardData: e.clipboardData?.getData('text')?.substring(0, 100)
    });
  });

  // Monitor right-click
  document.addEventListener('contextmenu', (e) => {
    emitSecurityEvent(socket, 'contextmenu', { type: 'right_click' });
  });

  // Monitor keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Check for suspicious key combinations
    const suspicious = [
      e.ctrlKey && e.key === 'c',
      e.ctrlKey && e.key === 'v',
      e.ctrlKey && e.key === 'p',
      e.ctrlKey && e.shiftKey && e.key === 'i',
      e.ctrlKey && e.key === 'u'
    ];

    if (suspicious.some(Boolean)) {
      emitSecurityEvent(socket, 'suspicious_key', {
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey
      });
    }
  });

  // Monitor fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    emitSecurityEvent(socket, 'fullscreenchange', {
      isFullscreen: !!document.fullscreenElement
    });
  });

  // Monitor page navigation attempts
  window.addEventListener('beforeunload', (e) => {
    emitSecurityEvent(socket, 'beforeunload', { type: 'page_leave_attempt' });
  });

  // Basic DevTools detection
  let devtools = { open: false };
  const threshold = 160;

  setInterval(() => {
    if (window.outerHeight - window.innerHeight > threshold || 
        window.outerWidth - window.innerWidth > threshold) {
      if (!devtools.open) {
        devtools.open = true;
        emitSecurityEvent(socket, 'devtools_detected', {
          method: 'window_size_detection',
          dimensions: {
            outerWidth: window.outerWidth,
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight
          }
        });
      }
    } else {
      devtools.open = false;
    }
  }, 1000);

  // Send heartbeat every 30 seconds
  setInterval(() => {
    if (socket.connected) {
      socket.emit('ping');
    }
  }, 30000);
};

// Helper function to emit security events
const emitSecurityEvent = (socket, eventType, details) => {
  if (socket && socket.connected) {
    const eventData = {
      event_type: eventType,
      timestamp: Date.now(),
      details
    };
    
    socket.emit('security_event', eventData);
  }
};
```

### 4. Handling Server Responses

Listen for server responses and notifications:

```javascript
// Handle event processing confirmation
socket.on('event_processed', (data) => {
  console.log(`Event processed (ID: ${data.event_id}) with risk score: ${data.risk_score}`);
});

// Handle security alerts
socket.on('security_alert', (data) => {
  console.log('Security alert received:', data);
  // Show alert to user if needed
});

// Handle increased monitoring
socket.on('monitoring_increased', (data) => {
  console.log('Monitoring increased:', data);
  // Update UI to inform user
});

// Handle security warnings
socket.on('security_warning', (data) => {
  console.log('Security warning received:', data);
  showWarningToUser(data.message || 'Please review your actions');
});

// Handle session suspension
socket.on('session_suspended', (data) => {
  console.log('Session suspended:', data);
  // Show critical alert and potentially redirect
  showCriticalAlert(data.message || 'Your session has been suspended');
});

// Handle connection issues
socket.on('disconnect', (reason) => {
  console.log('Disconnected from security monitoring server:', reason);
  // Update UI to show disconnected state
});

socket.on('connect_error', (error) => {
  console.error('Failed to connect to security monitoring server:', error);
  // Handle connection errors
});
```

## React Implementation Example

Here's a complete React hook implementation for integrating with the security monitoring system:

```jsx
// hooks/useSecurityMonitor.js
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSecurityMonitor = (examId, studentId, onSecurityEvent) => {
  const [isConnected, setIsConnected] = useState(false);
  const [monitoringSession, setMonitoringSession] = useState(null);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const socketRef = useRef(null);
  const eventBufferRef = useRef([]);

  const startMonitoring = async () => {
    try {
      // Start monitoring session
      const response = await fetch(`/api/exam-attendance/${examId}/start-monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start monitoring session');
      }

      const session = await response.json();
      setMonitoringSession(session);

      // Connect to dynamic socket
      connectToSocket(session.socket);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const connectToSocket = (socketConfig) => {
    const { url, port, monit_id, protocols } = socketConfig;
    
    const socket = io(`${url || `http://localhost:${port}`}`, {
      transports: protocols || ['websocket', 'polling'],
      timeout: 5000,
      query: { monit_id, client_type: 'browser_monitor' }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      
      // Send browser validation
      const validationData = generateBrowserValidation();
      socket.emit('browser_validation', validationData);
      
      // Send buffered events if any
      if (eventBufferRef.current.length > 0) {
        eventBufferRef.current.forEach(event => {
          socket.emit('security_event', event);
        });
        eventBufferRef.current = [];
      }
    });

    socket.on('validation_success', () => {
      console.log('Browser validation successful');
      startEventMonitoring(socket);
    });

    socket.on('validation_failed', (data) => {
      console.error('Browser validation failed:', data);
      onSecurityEvent?.({ type: 'validation_failed', data });
    });

    socket.on('security_alert', (data) => {
      addSecurityAlert('alert', data);
      onSecurityEvent?.({ type: 'security_alert', data });
    });

    socket.on('security_warning', (data) => {
      addSecurityAlert('warning', data);
      onSecurityEvent?.({ type: 'security_warning', data });
    });

    socket.on('session_suspended', (data) => {
      addSecurityAlert('critical', data);
      onSecurityEvent?.({ type: 'session_suspended', data });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });
  };

  const generateBrowserValidation = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth
      },
      windowSize: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timeOffset: new Date().getTimezoneOffset(),
      plugins: Array.from(navigator.plugins || []).map(p => ({
        name: p.name,
        description: p.description,
        filename: p.filename
      })),
      timestamp: Date.now()
    };
  };

  const startEventMonitoring = (socket) => {
    // Page visibility
    document.addEventListener('visibilitychange', () => {
      emitSecurityEvent(socket, 'visibilitychange', { 
        hidden: document.hidden,
        visibilityState: document.visibilityState
      });
    });

    // Window focus/blur
    window.addEventListener('blur', () => {
      emitSecurityEvent(socket, 'blur', { type: 'window_blur' });
    });
    
    window.addEventListener('focus', () => {
      emitSecurityEvent(socket, 'focus', { type: 'window_focus' });
    });

    // Copy/paste
    document.addEventListener('copy', () => {
      emitSecurityEvent(socket, 'copy', {
        selection: window.getSelection().toString().substring(0, 100)
      });
    });
    
    document.addEventListener('paste', (e) => {
      emitSecurityEvent(socket, 'paste', {
        clipboardData: e.clipboardData?.getData('text')?.substring(0, 100)
      });
    });

    // Right-click
    document.addEventListener('contextmenu', (e) => {
      emitSecurityEvent(socket, 'contextmenu', { type: 'right_click' });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const suspicious = [
        e.ctrlKey && e.key === 'c',
        e.ctrlKey && e.key === 'v',
        e.ctrlKey && e.key === 'p',
        e.ctrlKey && e.shiftKey && e.key === 'i',
        e.ctrlKey && e.key === 'u'
      ];

      if (suspicious.some(Boolean)) {
        emitSecurityEvent(socket, 'suspicious_key', {
          key: e.key,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey
        });
      }
    });

    // Fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      emitSecurityEvent(socket, 'fullscreenchange', {
        isFullscreen: !!document.fullscreenElement
      });
    });

    // Page navigation
    window.addEventListener('beforeunload', () => {
      emitSecurityEvent(socket, 'beforeunload', { type: 'page_leave_attempt' });
    });

    // DevTools detection
    let devtools = { open: false };
    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          emitSecurityEvent(socket, 'devtools_detected', {
            method: 'window_size_detection',
            dimensions: {
              outerWidth: window.outerWidth,
              innerWidth: window.innerWidth,
              outerHeight: window.outerHeight,
              innerHeight: window.innerHeight
            }
          });
        }
      } else {
        devtools.open = false;
      }
    }, 1000);

    // Heartbeat
    setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);
  };

  const emitSecurityEvent = (socket, eventType, details) => {
    const eventData = {
      event_type: eventType,
      timestamp: Date.now(),
      details
    };
    
    if (socket && socket.connected) {
      socket.emit('security_event', eventData);
      onSecurityEvent?.(eventData);
    } else {
      // Buffer events if not connected
      eventBufferRef.current.push(eventData);
    }
  };

  const addSecurityAlert = (severity, data) => {
    setSecurityAlerts(prev => [
      {
        id: Date.now(),
        severity,
        data,
        timestamp: new Date(),
        read: false
      },
      ...prev.slice(0, 49) // Keep last 50 alerts
    ]);
  };

  const markAlertAsRead = (alertId) => {
    setSecurityAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
  };

  const stopMonitoring = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', () => {});
    window.removeEventListener('blur', () => {});
    window.removeEventListener('focus', () => {});
    document.removeEventListener('copy', () => {});
    document.removeEventListener('paste', () => {});
    document.removeEventListener('contextmenu', () => {});
    document.removeEventListener('keydown', () => {});
    document.removeEventListener('fullscreenchange', () => {});
    window.removeEventListener('beforeunload', () => {});
  };

  useEffect(() => {
    if (examId && studentId) {
      startMonitoring();
    }
    
    return () => {
      stopMonitoring();
    };
  }, [examId, studentId]);

  return {
    isConnected,
    monitoringSession,
    securityAlerts,
    markAlertAsRead,
    clearAlerts: () => setSecurityAlerts([])
  };
};
```

## Admin Dashboard Integration

For admin interfaces, you can listen for security events across all exam sessions:

```jsx
// hooks/useAdminSecurityMonitor.js
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export const useAdminSecurityMonitor = (adminId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!adminId) return;

    // Connect to main WebSocket
    const socket = io(process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    socket.on('connect', () => {
      setIsConnected(true);
      
      // Authenticate as admin
      socket.emit('authenticate', {
        userId: adminId,
        isAdmin: true,
        token: localStorage.getItem('authToken')
      });
      
      // Join admin dashboard room
      socket.emit('join_room', 'admin-dashboard');
    });

    socket.on('authenticated', () => {
      console.log('Admin authentication successful');
      fetchDashboardData();
    });

    // Listen for security events
    socket.on('security_alert', (data) => {
      addSecurityAlert('alert', data);
    });

    socket.on('high_risk_detected', (data) => {
      addSecurityAlert('warning', data);
    });

    socket.on('critical_threat_detected', (data) => {
      addSecurityAlert('critical', data);
    });

    socket.on('auto_suspend_triggered', (data) => {
      addSecurityAlert('critical', data);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [adminId]);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/security-dashboard/overview', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const addSecurityAlert = (severity, data) => {
    setSecurityAlerts(prev => [
      {
        id: Date.now(),
        severity,
        data,
        timestamp: new Date(),
        read: false
      },
      ...prev.slice(0, 49) // Keep last 50 alerts
    ]);
  };

  const markAlertAsRead = (alertId) => {
    setSecurityAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
  };

  const clearAlerts = () => {
    setSecurityAlerts([]);
  };

  return {
    isConnected,
    securityAlerts,
    dashboardData,
    markAlertAsRead,
    clearAlerts,
    refreshDashboard: fetchDashboardData
  };
};
```

## Security Events Reference

| Event Type | Description | Risk Level |
|------------|-------------|------------|
| `visibilitychange` | Page visibility change (tab switching) | Medium |
| `blur` | Window lost focus | Medium |
| `focus` | Window gained focus | Low |
| `copy` | Content copied | High |
| `paste` | Content pasted | High |
| `contextmenu` | Right-click menu accessed | Medium |
| `suspicious_key` | Suspicious keyboard shortcuts | High |
| `fullscreenchange` | Fullscreen mode changed | Medium |
| `beforeunload` | Attempted to leave page | Medium |
| `devtools_detected` | Developer tools detected | High |
| `multiple_tabs` | Multiple tabs open | High |
| `automation_detected` | Browser automation detected | Critical |

## Server-to-Client Notifications

| Event Type | Description | Target |
|------------|-------------|--------|
| `security_alert` | General security alert | Student |
| `security_warning` | Warning about behavior | Student |
| `monitoring_increased` | Enhanced monitoring started | Student |
| `session_suspended` | Exam session suspended | Student |
| `high_risk_detected` | High risk student activity | Admin |
| `critical_threat_detected` | Critical security threat | Admin |
| `auto_suspend_triggered` | Automatic suspension occurred | Admin |

## Admin Dashboard API Endpoints

### 1. Security Dashboard Overview

**Endpoint:** `GET /api/admin/security-dashboard/overview`

**Response:**
```json
{
  "activeSessions": 12,
  "activeMonitoringServers": 12,
  "highRiskSessions": 3,
  "suspendedSessions": 1,
  "totalSecurityEvents": 432,
  "threatsByType": {
    "devtools_detected": 45,
    "tab_switching": 120,
    "copy_paste": 67,
    "suspicious_key": 39,
    "automation_detected": 2
  },
  "recentEvents": [
    {
      "id": "60a7c3b9e8f5a232b4c88c7f",
      "timestamp": "2023-09-01T10:12:34.567Z",
      "event_type": "devtools_detected",
      "student_id": "609a8c5f12345",
      "exam_id": "60b7c3b9e8f5a",
      "risk_score": 85
    }
    // More events...
  ]
}
```

### 2. Active Monitoring Sessions

**Endpoint:** `GET /api/admin/security-dashboard/active-sessions`

**Response:**
```json
{
  "total": 12,
  "sessions": [
    {
      "monit_id": "609a8c5f12345_60b7c3b9e8f5a_1620304050607",
      "port": 4052,
      "connections": 1,
      "uptime": 327000,
      "lastActivity": "2023-09-01T10:15:34.567Z",
      "student": {
        "id": "609a8c5f12345",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "exam": {
        "id": "60b7c3b9e8f5a",
        "title": "Advanced JavaScript Exam"
      }
    }
    // More sessions...
  ]
}
```

### 3. Security Events History

**Endpoint:** `GET /api/admin/security-dashboard/security-events`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `studentId` - Filter by student (optional)
- `examId` - Filter by exam (optional)
- `eventType` - Filter by event type (optional)
- `startDate` - Filter by start date (optional)
- `endDate` - Filter by end date (optional)

**Response:**
```json
{
  "total": 432,
  "page": 1,
  "limit": 20,
  "events": [
    {
      "id": "60a7c3b9e8f5a232b4c88c7f",
      "monit_id": "609a8c5f12345_60b7c3b9e8f5a_1620304050607",
      "student_id": "609a8c5f12345",
      "exam_id": "60b7c3b9e8f5a",
      "event_type": "devtools_detected",
      "timestamp": "2023-09-01T10:12:34.567Z",
      "details": {
        "method": "window_size_detection",
        "dimensions": {
          "outerWidth": 1280,
          "innerWidth": 1000,
          "outerHeight": 900,
          "innerHeight": 600
        }
      },
      "risk_score": 85,
      "is_suspicious": true,
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "ip_address": "192.168.1.1"
    }
    // More events...
  ]
}
```

## Troubleshooting

### Common Issues

1. **Socket Connection Failed**
   - Check if backend server is running
   - Verify CORS settings in backend
   - Check if port is available and not blocked by firewall

2. **Browser Validation Failed**
   - Use supported browsers (Chrome, Firefox, Safari)
   - Disable browser extensions
   - Clear browser cache

3. **Security Events Not Logging**
   - Check network connectivity
   - Verify authentication token
   - Check browser console for errors

### Debugging

For debugging WebSocket connections, you can use this test code:

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
    <script src="https://cdn.socket.io/4.0.0/socket.io.min.js"></script>
</head>
<body>
    <h1>WebSocket Security Monitor Test</h1>
    <div id="status">Connecting...</div>
    <div id="messages"></div>

    <script>
        const socket = io('http://localhost:3000');
        const status = document.getElementById('status');
        const messages = document.getElementById('messages');

        socket.on('connect', () => {
            status.textContent = 'Connected ✅';
            
            // Authenticate
            socket.emit('authenticate', {
                userId: 'test-user',
                examId: 'test-exam',
                token: 'test-token'
            });
        });

        socket.on('authenticated', (data) => {
            messages.innerHTML += '<p>✅ Authenticated: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('security_alert', (data) => {
            messages.innerHTML += '<p>🚨 Security Alert: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('security_warning', (data) => {
            messages.innerHTML += '<p>⚠️ Warning: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('disconnect', () => {
            status.textContent = 'Disconnected ❌';
        });
    </script>
</body>
</html>
```

## Best Practices

1. **Handle Connection Failures Gracefully**
   - Implement reconnection logic
   - Show appropriate UI feedback
   - Buffer events when disconnected

2. **Minimize Resource Usage**
   - Clean up event listeners when monitoring stops
   - Use debouncing for frequent events
   - Implement proper cleanup in React useEffect

3. **Security Considerations**
   - Never expose monitoring details to students
   - Use secure connections (HTTPS)
   - Validate all data on the server

## Conclusion

This integration guide provides all necessary information for frontend developers to integrate with the exam security monitoring system. The system relies on server-side logic with dynamic Socket.IO connections for real-time communication.

For further assistance or to report issues, please contact the backend team.
