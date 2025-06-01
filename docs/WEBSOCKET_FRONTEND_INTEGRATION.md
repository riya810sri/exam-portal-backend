# WebSocket Security Monitoring - Frontend Integration Guide

## Overview

This guide shows how to integrate WebSocket functionality with the security monitoring system for real-time notifications and exam session management.

## Backend Implementation Status ✅

The backend now includes:
- ✅ WebSocket server using Socket.IO
- ✅ Real-time security event broadcasting
- ✅ Admin dashboard notifications
- ✅ Student security alerts
- ✅ CORS configuration for WebSocket connections
- ✅ Authentication and room management

## Frontend Integration

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
```

### 2. WebSocket Connection Setup

```javascript
// utils/websocket.js
import io from 'socket.io-client';

class SecurityWebSocket {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(userId, examId = null, isAdmin = false, token = null) {
    const serverUrl = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3000';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Authenticate immediately after connection
      this.authenticate(userId, examId, isAdmin, token);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.handleReconnection();
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ WebSocket authenticated:', data);
    });

    this.socket.on('auth-error', (error) => {
      console.error('❌ WebSocket authentication failed:', error);
    });
  }

  authenticate(userId, examId, isAdmin, token) {
    if (this.socket && this.isConnected) {
      this.socket.emit('authenticate', {
        userId,
        examId,
        isAdmin,
        token
      });
    }
  }

  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.socket.connect();
        }
      }, delay);
    }
  }

  // Admin event listeners
  onSuspiciousActivity(callback) {
    this.socket?.on('suspicious_activity', callback);
  }

  onHighRiskSession(callback) {
    this.socket?.on('high_risk_session', callback);
  }

  onCriticalThreat(callback) {
    this.socket?.on('critical_threat', callback);
  }

  onSessionSuspended(callback) {
    this.socket?.on('session_suspended', callback);
  }

  // Student event listeners
  onMonitoringIncreased(callback) {
    this.socket?.on('monitoring_increased', callback);
  }

  onSecurityWarning(callback) {
    this.socket?.on('security_warning', callback);
  }

  onSessionEnded(callback) {
    this.socket?.on('session_ended', callback);
  }

  // Utility methods
  ping() {
    this.socket?.emit('ping');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export const securityWebSocket = new SecurityWebSocket();
export default SecurityWebSocket;
```

### 3. React Hook for WebSocket

```javascript
// hooks/useSecurityWebSocket.js
import { useEffect, useState, useCallback } from 'react';
import { securityWebSocket } from '../utils/websocket';

export const useSecurityWebSocket = (userId, examId = null, isAdmin = false) => {
  const [isConnected, setIsConnected] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    if (!userId) return;

    // Connect to WebSocket
    const token = localStorage.getItem('authToken');
    securityWebSocket.connect(userId, examId, isAdmin, token);

    // Connection status listeners
    securityWebSocket.socket?.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    securityWebSocket.socket?.on('disconnect', () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    securityWebSocket.socket?.on('authenticated', () => {
      setConnectionStatus('authenticated');
    });

    // Security event listeners
    if (isAdmin) {
      securityWebSocket.onSuspiciousActivity((data) => {
        addSecurityAlert('suspicious_activity', data, 'info');
      });

      securityWebSocket.onHighRiskSession((data) => {
        addSecurityAlert('high_risk_session', data, 'warning');
      });

      securityWebSocket.onCriticalThreat((data) => {
        addSecurityAlert('critical_threat', data, 'error');
      });

      securityWebSocket.onSessionSuspended((data) => {
        addSecurityAlert('session_suspended', data, 'error');
      });
    } else {
      // Student listeners
      securityWebSocket.onMonitoringIncreased((data) => {
        addSecurityAlert('monitoring_increased', data, 'warning');
      });

      securityWebSocket.onSecurityWarning((data) => {
        addSecurityAlert('security_warning', data, 'error');
      });

      securityWebSocket.onSessionEnded((data) => {
        addSecurityAlert('session_ended', data, 'error');
        // Redirect to exam end page or show modal
        handleSessionEnd(data);
      });
    }

    return () => {
      securityWebSocket.disconnect();
    };
  }, [userId, examId, isAdmin]);

  const addSecurityAlert = useCallback((type, data, severity) => {
    const alert = {
      id: Date.now(),
      type,
      data,
      severity,
      timestamp: new Date(),
      read: false
    };
    
    setSecurityAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts
  }, []);

  const markAlertAsRead = useCallback((alertId) => {
    setSecurityAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
  }, []);

  const clearAlerts = useCallback(() => {
    setSecurityAlerts([]);
  }, []);

  const handleSessionEnd = useCallback((data) => {
    // Handle session termination
    if (data.reason === 'Security violation - automatic suspension') {
      // Show suspension modal
      alert('Your exam session has been suspended due to security violations.');
      // Redirect to appropriate page
      window.location.href = '/exam-suspended';
    }
  }, []);

  return {
    isConnected,
    connectionStatus,
    securityAlerts,
    markAlertAsRead,
    clearAlerts,
    ping: () => securityWebSocket.ping()
  };
};
```

### 4. Admin Dashboard Integration

```javascript
// components/AdminSecurityDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useSecurityWebSocket } from '../hooks/useSecurityWebSocket';

const AdminSecurityDashboard = ({ userId }) => {
  const { 
    isConnected, 
    connectionStatus, 
    securityAlerts, 
    markAlertAsRead, 
    clearAlerts 
  } = useSecurityWebSocket(userId, null, true);

  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    // Fetch initial dashboard data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/security/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'error': return 'bg-red-100 border-red-500 text-red-700';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'info': return 'bg-blue-100 border-blue-500 text-blue-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Security Monitoring Dashboard</h1>
        
        {/* Connection Status */}
        <div className="mt-2 flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            WebSocket: {connectionStatus} {isConnected ? '✅' : '❌'}
          </span>
        </div>
      </div>

      {/* Dashboard Overview */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Active Sessions</h3>
            <p className="text-3xl font-bold text-blue-600">{dashboardData.overview.activeSessions}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">High Risk Sessions</h3>
            <p className="text-3xl font-bold text-yellow-600">{dashboardData.overview.highRiskSessions}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Suspended Sessions</h3>
            <p className="text-3xl font-bold text-red-600">{dashboardData.overview.suspendedSessions}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Alerts Today</h3>
            <p className="text-3xl font-bold text-purple-600">{dashboardData.overview.totalActiveAlerts}</p>
          </div>
        </div>
      )}

      {/* Real-time Alerts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Real-time Security Alerts</h2>
          <button
            onClick={clearAlerts}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Clear All
          </button>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {securityAlerts.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No security alerts. System monitoring is active.
            </div>
          ) : (
            securityAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border-l-4 ${getAlertColor(alert.severity)} ${
                  alert.read ? 'opacity-60' : ''
                } hover:bg-opacity-75 cursor-pointer`}
                onClick={() => markAlertAsRead(alert.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-lg">{getAlertIcon(alert.severity)}</span>
                    <div>
                      <h4 className="font-medium capitalize">
                        {alert.type.replace('_', ' ')}
                      </h4>
                      <p className="text-sm mt-1">
                        User: {alert.data.userId} | Exam: {alert.data.examId}
                      </p>
                      {alert.data.riskLevel && (
                        <p className="text-sm mt-1">
                          Risk Score: {alert.data.riskLevel.score}% | Level: {alert.data.riskLevel.level}
                        </p>
                      )}
                      {alert.data.violation && (
                        <p className="text-sm mt-1">
                          Violation: {alert.data.violation.type}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {alert.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSecurityDashboard;
```

### 5. Student Exam Interface Integration

```javascript
// components/ExamInterface.jsx
import React, { useState, useEffect } from 'react';
import { useSecurityWebSocket } from '../hooks/useSecurityWebSocket';

const ExamInterface = ({ userId, examId }) => {
  const { 
    isConnected, 
    securityAlerts, 
    markAlertAsRead 
  } = useSecurityWebSocket(userId, examId, false);

  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [currentSecurityAlert, setCurrentSecurityAlert] = useState(null);

  useEffect(() => {
    // Show modal for critical security alerts
    const criticalAlert = securityAlerts.find(
      alert => alert.severity === 'error' && !alert.read
    );
    
    if (criticalAlert) {
      setCurrentSecurityAlert(criticalAlert);
      setShowSecurityModal(true);
    }
  }, [securityAlerts]);

  const handleSecurityModalClose = () => {
    if (currentSecurityAlert) {
      markAlertAsRead(currentSecurityAlert.id);
    }
    setShowSecurityModal(false);
    setCurrentSecurityAlert(null);
  };

  return (
    <div className="exam-interface">
      {/* Connection indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`px-3 py-1 rounded-full text-xs ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? '🔒 Secure Connection' : '⚠️ Connection Issue'}
        </div>
      </div>

      {/* Security alert notifications */}
      <div className="fixed top-16 right-4 z-40 space-y-2">
        {securityAlerts
          .filter(alert => !alert.read && alert.severity !== 'error')
          .slice(0, 3)
          .map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg shadow-lg max-w-sm ${
                alert.severity === 'warning' 
                  ? 'bg-yellow-50 border border-yellow-200' 
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">Security Notice</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {alert.data.message || 'Security monitoring active'}
                  </p>
                </div>
                <button
                  onClick={() => markAlertAsRead(alert.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Critical Security Modal */}
      {showSecurityModal && currentSecurityAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-2xl">🚨</span>
              <h3 className="text-lg font-semibold text-red-600">
                Security Alert
              </h3>
            </div>
            
            <p className="text-gray-700 mb-4">
              {currentSecurityAlert.data.message || 'A security violation has been detected.'}
            </p>
            
            {currentSecurityAlert.data.contactSupport && (
              <p className="text-sm text-gray-600 mb-4">
                Please contact support if you believe this is an error.
              </p>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleSecurityModalClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Your existing exam interface components */}
      <div className="exam-content">
        {/* Exam questions, timer, etc. */}
      </div>
    </div>
  );
};

export default ExamInterface;
```

### 6. Environment Configuration

```javascript
// .env (Frontend)
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WEBSOCKET_URL=http://localhost:3000
```

### 7. Testing WebSocket Connection

```javascript
// utils/testWebSocket.js
import { securityWebSocket } from './websocket';

export const testWebSocketConnection = () => {
  console.log('Testing WebSocket connection...');
  
  // Test connection
  securityWebSocket.connect('test-user', 'test-exam', true, 'test-token');
  
  // Test ping
  setTimeout(() => {
    securityWebSocket.ping();
  }, 2000);
  
  // Test events
  securityWebSocket.onSuspiciousActivity((data) => {
    console.log('Test: Received suspicious activity:', data);
  });
  
  setTimeout(() => {
    securityWebSocket.disconnect();
    console.log('WebSocket test completed');
  }, 5000);
};
```

## Backend CORS Fix ✅

The CORS issue has been resolved by:

1. **Multiple CORS configurations** in `app.js`
2. **Proper WebSocket CORS setup** for Socket.IO
3. **Environment-based origins** in `.env`
4. **Preflight OPTIONS handling**

## Testing the Implementation

### Start the Backend Server

```bash
cd /path/to/exam_portal_backend
npm start
```

The server will now show:
```
🚀 Server running on http://localhost:3000
🔌 WebSocket server running on ws://localhost:3000
```

### Test WebSocket Connection

You can test the WebSocket connection using a simple HTML file:

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
            
            // Authenticate as admin
            socket.emit('authenticate', {
                userId: 'test-admin',
                examId: 'test-exam',
                isAdmin: true,
                token: 'test-token'
            });
        });

        socket.on('authenticated', (data) => {
            messages.innerHTML += '<p>✅ Authenticated: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('suspicious_activity', (data) => {
            messages.innerHTML += '<p>🚨 Suspicious Activity: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('high_risk_session', (data) => {
            messages.innerHTML += '<p>⚠️ High Risk Session: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('critical_threat', (data) => {
            messages.innerHTML += '<p>🚨 Critical Threat: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('session_suspended', (data) => {
            messages.innerHTML += '<p>⛔ Session Suspended: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('disconnect', () => {
            status.textContent = 'Disconnected ❌';
        });
    </script>
</body>
</html>
```

## Security Events That Trigger WebSocket Notifications

1. **Suspicious Activity** (`suspicious_activity`)
   - Low-level violations
   - Behavioral anomalies
   - Header inconsistencies

2. **High Risk Session** (`high_risk_session`)
   - Multiple violations
   - Automation detection
   - Proxy tool usage

3. **Critical Threat** (`critical_threat`)
   - Severe security violations
   - Multiple automated behaviors
   - High confidence cheating detection

4. **Session Suspended** (`session_suspended`)
   - Automatic suspension triggered
   - Manual admin suspension
   - Risk threshold exceeded

5. **Monitoring Increased** (`monitoring_increased`)
   - Enhanced scrutiny enabled
   - Additional verification required
   - Stricter monitoring parameters

6. **Security Warning** (`security_warning`)
   - User notifications
   - Policy reminders
   - Behavior corrections

## Next Steps

1. **Implement the frontend components** using the provided examples
2. **Test the WebSocket connections** with real exam sessions
3. **Configure notification preferences** for different alert types
4. **Set up admin dashboard** for real-time monitoring
5. **Add sound notifications** for critical alerts
6. **Implement mobile responsiveness** for admin monitoring

The WebSocket implementation is now fully functional and ready for frontend integration!
