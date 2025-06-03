# 🚀 Frontend Integration Guide - Secure Exam Monitoring System

## 📋 Overview

This guide provides complete instructions for frontend developers to integrate with the **Comprehensive Secure Browser-Only Exam Monitoring System**. The backend provides real-time security monitoring, dynamic Socket.IO servers, and comprehensive admin dashboards.

---

## 🔧 **System Architecture**

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

---

## 🎯 **Integration Steps**

### **Step 1: Environment Setup**

```javascript
// .env file
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_SOCKET_BASE_URL=http://localhost
```

### **Step 2: Install Dependencies**

```bash
npm install socket.io-client axios
```

---

## 📚 **Core Implementation**

### **1. API Service Setup**

Create `src/services/examApi.js`:

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

// Create axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const examApi = {
  // Start monitoring session
  startMonitoring: async (examId, studentId) => {
    const response = await api.post('/api/exam-attendance/start-monitoring', {
      exam_id: examId,
      student_id: studentId
    });
    return response.data;
  },

  // Stop monitoring session
  stopMonitoring: async (monitId) => {
    const response = await api.post('/api/exam-attendance/stop-monitoring', {
      monit_id: monitId
    });
    return response.data;
  },

  // Report cheating incident
  reportCheating: async (examId, studentId, incidentData) => {
    const response = await api.post('/api/exam-attendance/report-cheating', {
      exam_id: examId,
      student_id: studentId,
      ...incidentData
    });
    return response.data;
  }
};

export default api;
```

### **2. Browser Validation System**

Create `src/utils/browserValidator.js`:

```javascript
export class BrowserValidator {
  static async generateValidationData() {
    return {
      userAgent: navigator.userAgent,
      canvas: await this.generateCanvasFingerprint(),
      webGL: this.getWebGLInfo(),
      plugins: this.getPluginList(),
      fonts: await this.detectFonts(),
      timing: this.getTimingData(),
      navigatorProperties: this.getNavigatorProperties(),
      screenData: this.getScreenData(),
      deviceMemory: navigator.deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      connection: this.getConnectionInfo()
    };
  }

  static async generateCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Draw unique pattern
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Security validation canvas 🔒', 2, 2);
      
      // Add some shapes
      ctx.fillStyle = 'rgba(255,0,0,0.5)';
      ctx.fillRect(10, 10, 50, 50);
      
      return canvas.toDataURL();
    } catch (error) {
      return 'canvas_error';
    }
  }

  static getWebGLInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'webgl_not_supported';
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      
      return `${vendor} ${renderer}`;
    } catch (error) {
      return 'webgl_error';
    }
  }

  static getPluginList() {
    const plugins = [];
    for (let i = 0; i < navigator.plugins.length; i++) {
      plugins.push(navigator.plugins[i].name);
    }
    return plugins;
  }

  static async detectFonts() {
    const baseFonts = ['Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana'];
    const testFonts = [
      'Arial Black', 'Comic Sans MS', 'Impact', 'Lucida Console',
      'Tahoma', 'Trebuchet MS', 'Courier New', 'Palatino'
    ];
    
    const availableFonts = [];
    
    // Simple font detection (you can enhance this)
    for (const font of [...baseFonts, ...testFonts]) {
      if (this.isFontAvailable(font)) {
        availableFonts.push(font);
      }
    }
    
    return availableFonts;
  }

  static isFontAvailable(fontName) {
    const testText = 'mmmmmmmmmmlli';
    const fontSize = '72px';
    const baseFont = 'monospace';
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    context.font = fontSize + ' ' + baseFont;
    const baselineWidth = context.measureText(testText).width;
    
    context.font = fontSize + ' ' + fontName + ', ' + baseFont;
    const width = context.measureText(testText).width;
    
    return width !== baselineWidth;
  }

  static getTimingData() {
    const timing = performance.timing;
    return {
      connectTime: timing.connectEnd - timing.connectStart,
      domainLookupTime: timing.domainLookupEnd - timing.domainLookupStart,
      loadTime: timing.loadEventEnd - timing.navigationStart
    };
  }

  static getNavigatorProperties() {
    return {
      webdriver: navigator.webdriver,
      plugins: navigator.plugins.length,
      languages: navigator.languages?.length || 0,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      maxTouchPoints: navigator.maxTouchPoints || 0
    };
  }

  static getScreenData() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    };
  }

  static getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0
    };
  }
}
```

### **3. Security Event Monitor**

Create `src/components/SecurityMonitor.jsx`:

```javascript
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { BrowserValidator } from '../utils/browserValidator';

const SecurityMonitor = ({ examId, studentId, onSecurityEvent, onValidationFailed }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [monitoringSession, setMonitoringSession] = useState(null);
  const eventBuffer = useRef([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (examId && studentId && !isInitialized.current) {
      initializeMonitoring();
      isInitialized.current = true;
    }

    return () => {
      cleanup();
    };
  }, [examId, studentId]);

  const initializeMonitoring = async () => {
    try {
      // Start monitoring session with backend
      const response = await fetch('/api/exam-attendance/start-monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          exam_id: examId,
          student_id: studentId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start monitoring session');
      }

      const { socket_port, monit_id } = await response.json();
      setMonitoringSession({ socket_port, monit_id });

      // Connect to dynamic socket server
      await connectToSocket(socket_port, monit_id);

    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
      onSecurityEvent?.({
        type: 'monitoring_error',
        details: { error: error.message }
      });
    }
  };

  const connectToSocket = async (port, monitId) => {
    try {
      const socketInstance = io(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      socketInstance.on('connect', async () => {
        console.log('Connected to monitoring server');
        setIsConnected(true);

        // Send browser validation data
        const validationData = await BrowserValidator.generateValidationData();
        socketInstance.emit('browser_validation', validationData);
      });

      socketInstance.on('validation_success', (data) => {
        console.log('Browser validation passed:', data);
        startSecurityMonitoring(socketInstance);
      });

      socketInstance.on('validation_failed', (data) => {
        console.error('Browser validation failed:', data);
        onValidationFailed?.(data);
      });

      socketInstance.on('disconnect', () => {
        console.log('Disconnected from monitoring server');
        setIsConnected(false);
      });

      socketInstance.on('error', (error) => {
        console.error('Socket error:', error);
        onSecurityEvent?.({
          type: 'socket_error',
          details: { error: error.message }
        });
      });

      setSocket(socketInstance);

    } catch (error) {
      console.error('Failed to connect to socket:', error);
    }
  };

  const startSecurityMonitoring = (socketInstance) => {
    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      logSecurityEvent(socketInstance, {
        event_type: 'visibilitychange',
        timestamp: Date.now(),
        details: { 
          hidden: document.hidden,
          visibilityState: document.visibilityState
        }
      });
    });

    // Monitor focus/blur events
    window.addEventListener('blur', () => {
      logSecurityEvent(socketInstance, {
        event_type: 'blur',
        timestamp: Date.now(),
        details: { type: 'window_blur' }
      });
    });

    window.addEventListener('focus', () => {
      logSecurityEvent(socketInstance, {
        event_type: 'focus',
        timestamp: Date.now(),
        details: { type: 'window_focus' }
      });
    });

    // Monitor copy/paste events
    document.addEventListener('copy', (e) => {
      logSecurityEvent(socketInstance, {
        event_type: 'copy',
        timestamp: Date.now(),
        details: { 
          selection: window.getSelection().toString().substring(0, 100)
        }
      });
    });

    document.addEventListener('paste', (e) => {
      logSecurityEvent(socketInstance, {
        event_type: 'paste',
        timestamp: Date.now(),
        details: { 
          clipboardData: e.clipboardData?.getData('text')?.substring(0, 100)
        }
      });
    });

    // Monitor context menu (right-click)
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Disable right-click
      logSecurityEvent(socketInstance, {
        event_type: 'contextmenu',
        timestamp: Date.now(),
        details: { 
          x: e.clientX, 
          y: e.clientY,
          target: e.target.tagName
        }
      });
    });

    // Monitor key combinations
    document.addEventListener('keydown', (e) => {
      const suspiciousKeys = [
        'F12', 'F11', // DevTools, Fullscreen
        'PrintScreen',
        'ContextMenu'
      ];

      const suspiciousCombos = [
        e.ctrlKey && e.shiftKey && e.key === 'I', // Ctrl+Shift+I (DevTools)
        e.ctrlKey && e.shiftKey && e.key === 'J', // Ctrl+Shift+J (Console)
        e.ctrlKey && e.key === 'u', // Ctrl+U (View Source)
        e.ctrlKey && e.altKey && e.key === 'i', // Ctrl+Alt+I (DevTools)
        e.altKey && e.key === 'Tab' // Alt+Tab (Switch applications)
      ];

      if (suspiciousKeys.includes(e.key) || suspiciousCombos.some(combo => combo)) {
        e.preventDefault();
        logSecurityEvent(socketInstance, {
          event_type: 'keydown',
          timestamp: Date.now(),
          details: {
            key: e.key,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey,
            suspicious: true
          }
        });
      }
    });

    // Monitor fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      logSecurityEvent(socketInstance, {
        event_type: 'fullscreenchange',
        timestamp: Date.now(),
        details: { 
          isFullscreen: !!document.fullscreenElement
        }
      });
    });

    // Monitor beforeunload (leaving page)
    window.addEventListener('beforeunload', (e) => {
      logSecurityEvent(socketInstance, {
        event_type: 'beforeunload',
        timestamp: Date.now(),
        details: { type: 'page_leave_attempt' }
      });
    });

    // Detect DevTools (basic detection)
    let devtools = { open: false };
    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          logSecurityEvent(socketInstance, {
            event_type: 'devtools_detected',
            timestamp: Date.now(),
            details: { 
              method: 'window_size_detection',
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
      if (socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 30000);
  };

  const logSecurityEvent = (socketInstance, eventData) => {
    if (socketInstance && socketInstance.connected) {
      socketInstance.emit('security_event', eventData);
      onSecurityEvent?.(eventData);
    } else {
      // Buffer events if not connected
      eventBuffer.current.push(eventData);
    }
  };

  const cleanup = () => {
    if (socket) {
      socket.disconnect();
    }
    
    // Remove all event listeners
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

  return (
    <div className="security-monitor">
      {/* Optional: Display connection status */}
      <div className="connection-status" style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        padding: '5px 10px',
        backgroundColor: isConnected ? '#4CAF50' : '#f44336',
        color: 'white',
        fontSize: '12px',
        borderRadius: '4px',
        zIndex: 9999
      }}>
        {isConnected ? '🔒 Monitoring Active' : '⚠️ Connection Lost'}
      </div>
    </div>
  );
};

export default SecurityMonitor;
```

### **4. Exam Component Integration**

Create `src/components/ExamPage.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import SecurityMonitor from './SecurityMonitor';

const ExamPage = ({ examId, studentId }) => {
  const [securityEvents, setSecurityEvents] = useState([]);
  const [examStarted, setExamStarted] = useState(false);
  const [validationFailed, setValidationFailed] = useState(false);

  useEffect(() => {
    // Force fullscreen when exam starts
    if (examStarted) {
      enterFullscreen();
    }
  }, [examStarted]);

  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  };

  const handleSecurityEvent = (event) => {
    console.log('Security event detected:', event);
    setSecurityEvents(prev => [...prev, event]);

    // Handle high-risk events
    if (event.details?.suspicious || ['devtools_detected', 'tampering_detected'].includes(event.event_type)) {
      alert('⚠️ Security violation detected! This incident has been logged.');
    }
  };

  const handleValidationFailed = (data) => {
    setValidationFailed(true);
    alert(`❌ Browser validation failed: ${data.reasons?.join(', ')}`);
  };

  const startExam = () => {
    setExamStarted(true);
  };

  if (validationFailed) {
    return (
      <div className="validation-failed">
        <h2>❌ Access Denied</h2>
        <p>Your browser failed security validation. Please use a supported browser and try again.</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="exam-page">
      {/* Security Monitor Component */}
      {examStarted && (
        <SecurityMonitor
          examId={examId}
          studentId={studentId}
          onSecurityEvent={handleSecurityEvent}
          onValidationFailed={handleValidationFailed}
        />
      )}

      {!examStarted ? (
        <div className="exam-start">
          <h2>🔒 Secure Exam Environment</h2>
          <p>Before starting the exam, please note:</p>
          <ul>
            <li>✅ Your browser will be validated for security</li>
            <li>✅ All activities will be monitored</li>
            <li>✅ Switching tabs or apps is not allowed</li>
            <li>✅ DevTools and copy/paste are disabled</li>
          </ul>
          <button onClick={startExam} className="start-exam-btn">
            Start Secure Exam
          </button>
        </div>
      ) : (
        <div className="exam-content">
          <h2>📝 Exam in Progress</h2>
          {/* Your exam questions and content here */}
          
          {/* Security Events Log (for debugging) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="security-log" style={{ 
              position: 'fixed', 
              bottom: '10px', 
              left: '10px',
              width: '300px',
              maxHeight: '200px',
              overflow: 'auto',
              backgroundColor: '#f5f5f5',
              padding: '10px',
              fontSize: '12px',
              borderRadius: '4px'
            }}>
              <h4>Security Events (Dev Mode)</h4>
              {securityEvents.slice(-5).map((event, index) => (
                <div key={index}>
                  {event.event_type}: {JSON.stringify(event.details)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamPage;
```

---

## 🛡️ **Admin Dashboard Integration**

### **1. Admin Security Dashboard**

Create `src/components/admin/SecurityDashboard.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import api from '../../services/examApi';

const SecurityDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState([]);
  const [bannedClients, setBannedClients] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load overview data
      const overviewResponse = await api.get('/api/admin/security-dashboard/overview');
      setOverview(overviewResponse.data);

      // Load recent events
      const eventsResponse = await api.get('/api/admin/security-dashboard/session-events?limit=50');
      setEvents(eventsResponse.data.events);

      // Load banned clients
      const bannedResponse = await api.get('/api/admin/security-dashboard/banned-clients');
      setBannedClients(bannedResponse.data.banned_clients);

      // Load active sessions
      const sessionsResponse = await api.get('/api/admin/security-dashboard/active-sessions');
      setActiveSessions(sessionsResponse.data.sessions);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const banClient = async (ipAddress, reason) => {
    try {
      await api.post('/api/admin/security-dashboard/ban-client', {
        ip_address: ipAddress,
        reason: reason || 'Manual ban by admin'
      });
      
      // Refresh data
      loadDashboardData();
      alert('Client banned successfully');
    } catch (error) {
      console.error('Failed to ban client:', error);
      alert('Failed to ban client');
    }
  };

  const unbanClient = async (ipAddress) => {
    try {
      await api.delete(`/api/admin/security-dashboard/unban-client/${ipAddress}`);
      
      // Refresh data
      loadDashboardData();
      alert('Client unbanned successfully');
    } catch (error) {
      console.error('Failed to unban client:', error);
      alert('Failed to unban client');
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="security-dashboard">
      <h1>🛡️ Security Monitoring Dashboard</h1>

      {/* Overview Cards */}
      <div className="overview-cards">
        <div className="card">
          <h3>📊 Security Events</h3>
          <div className="stat">{overview?.security_events_count || 0}</div>
          <div className="sub-stat">Last 24 hours</div>
        </div>
        
        <div className="card">
          <h3>🚫 Banned Clients</h3>
          <div className="stat">{overview?.banned_clients_count || 0}</div>
          <div className="sub-stat">Active bans</div>
        </div>
        
        <div className="card">
          <h3>⚡ Active Sessions</h3>
          <div className="stat">{overview?.active_sessions_count || 0}</div>
          <div className="sub-stat">Current monitoring</div>
        </div>
        
        <div className="card">
          <h3>🔍 Threats Detected</h3>
          <div className="stat">{overview?.threats_detected || 0}</div>
          <div className="sub-stat">High-risk events</div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="section">
        <h2>🔄 Active Monitoring Sessions</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Port</th>
                <th>Connections</th>
                <th>Uptime</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map((session) => (
                <tr key={session.monit_id}>
                  <td>{session.monit_id}</td>
                  <td>{session.port}</td>
                  <td>{session.connections}</td>
                  <td>{Math.floor(session.uptime / 1000 / 60)} min</td>
                  <td>{new Date(session.last_activity).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Security Events */}
      <div className="section">
        <h2>🚨 Recent Security Events</h2>
        <div className="events-list">
          {events.map((event) => (
            <div key={event._id} className={`event-item ${event.is_suspicious ? 'suspicious' : ''}`}>
              <div className="event-header">
                <span className="event-type">{event.event_type}</span>
                <span className="event-time">{new Date(event.timestamp).toLocaleString()}</span>
                <span className={`risk-score risk-${event.risk_score > 70 ? 'high' : event.risk_score > 30 ? 'medium' : 'low'}`}>
                  Risk: {event.risk_score}
                </span>
              </div>
              <div className="event-details">
                <strong>Session:</strong> {event.monit_id} | 
                <strong>IP:</strong> {event.ip_address} |
                <strong>Details:</strong> {JSON.stringify(event.details)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Banned Clients */}
      <div className="section">
        <h2>🚫 Banned Clients</h2>
        <div className="banned-clients">
          {bannedClients.map((client) => (
            <div key={client._id} className="banned-client">
              <div className="client-info">
                <strong>IP:</strong> {client.ip_address}<br/>
                <strong>Reason:</strong> {client.ban_reason}<br/>
                <strong>Violations:</strong> {client.violation_count}<br/>
                <strong>Until:</strong> {client.is_permanent ? 'Permanent' : new Date(client.ban_until).toLocaleString()}
              </div>
              <div className="client-actions">
                {!client.is_permanent && (
                  <button onClick={() => unbanClient(client.ip_address)}>
                    Unban
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
```

### **2. Admin Dashboard Styles**

Create `src/styles/SecurityDashboard.css`:

```css
.security-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  opacity: 0.9;
}

.stat {
  font-size: 36px;
  font-weight: bold;
  margin: 10px 0;
}

.sub-stat {
  font-size: 14px;
  opacity: 0.8;
}

.section {
  background: white;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section h2 {
  margin: 0 0 20px 0;
  color: #333;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #ddd;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.events-list {
  max-height: 400px;
  overflow-y: auto;
}

.event-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
  background: #f9f9f9;
}

.event-item.suspicious {
  border-color: #ff9800;
  background: #fff3e0;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-type {
  font-weight: bold;
  color: #333;
}

.event-time {
  color: #666;
  font-size: 14px;
}

.risk-score {
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.risk-high {
  background-color: #f44336;
}

.risk-medium {
  background-color: #ff9800;
}

.risk-low {
  background-color: #4caf50;
}

.event-details {
  font-size: 14px;
  color: #666;
}

.banned-clients {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
}

.banned-client {
  border: 1px solid #f44336;
  border-radius: 8px;
  padding: 15px;
  background: #ffebee;
}

.client-info {
  margin-bottom: 10px;
  line-height: 1.5;
}

.client-actions button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.client-actions button:hover {
  background-color: #45a049;
}

.loading {
  text-align: center;
  padding: 50px;
  font-size: 18px;
  color: #666;
}

/* Responsive design */
@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .event-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .banned-clients {
    grid-template-columns: 1fr;
  }
}
```

---

## 📱 **React Hooks for Security Monitoring**

Create `src/hooks/useSecurityMonitoring.js`:

```javascript
import { useState, useEffect, useCallback } from 'react';
import { examApi } from '../services/examApi';

export const useSecurityMonitoring = (examId, studentId) => {
  const [monitoringSession, setMonitoringSession] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [error, setError] = useState(null);

  const startMonitoring = useCallback(async () => {
    try {
      setError(null);
      const session = await examApi.startMonitoring(examId, studentId);
      setMonitoringSession(session);
      setIsMonitoring(true);
      return session;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [examId, studentId]);

  const stopMonitoring = useCallback(async () => {
    if (!monitoringSession?.monit_id) return;

    try {
      await examApi.stopMonitoring(monitoringSession.monit_id);
      setIsMonitoring(false);
      setMonitoringSession(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [monitoringSession]);

  const addSecurityEvent = useCallback((event) => {
    setSecurityEvents(prev => [...prev, {
      ...event,
      id: Date.now() + Math.random(),
      timestamp: Date.now()
    }]);
  }, []);

  const reportCheating = useCallback(async (incidentData) => {
    try {
      await examApi.reportCheating(examId, studentId, incidentData);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [examId, studentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isMonitoring && monitoringSession?.monit_id) {
        examApi.stopMonitoring(monitoringSession.monit_id).catch(console.error);
      }
    };
  }, [isMonitoring, monitoringSession]);

  return {
    monitoringSession,
    isMonitoring,
    securityEvents,
    error,
    startMonitoring,
    stopMonitoring,
    addSecurityEvent,
    reportCheating
  };
};
```

---

## 🔧 **Environment Configuration**

### **Development Environment**

```javascript
// src/config/development.js
export const config = {
  API_BASE_URL: 'http://localhost:3000',
  SOCKET_BASE_URL: 'http://localhost',
  ENABLE_SECURITY_LOGGING: true,
  ENABLE_DEV_TOOLS: true, // Only for development
  VALIDATION_STRICT_MODE: false // Less strict for development
};
```

### **Production Environment**

```javascript
// src/config/production.js
export const config = {
  API_BASE_URL: 'https://your-api-domain.com',
  SOCKET_BASE_URL: 'https://your-socket-domain.com',
  ENABLE_SECURITY_LOGGING: false,
  ENABLE_DEV_TOOLS: false,
  VALIDATION_STRICT_MODE: true // Full security in production
};
```

---

## 🚀 **Deployment Checklist**

### **Before Deployment:**

1. ✅ **Update API URLs** in environment configuration
2. ✅ **Test all security features** in staging environment
3. ✅ **Verify socket connections** work with production URLs
4. ✅ **Test admin dashboard** with real admin credentials
5. ✅ **Validate browser compatibility** across target browsers
6. ✅ **Test fullscreen functionality** on different devices
7. ✅ **Verify CORS settings** match frontend domain

### **Production Configuration:**

```javascript
// .env.production
REACT_APP_API_BASE_URL=https://your-api-domain.com
REACT_APP_SOCKET_BASE_URL=https://your-api-domain.com
REACT_APP_ENABLE_SECURITY_LOGS=false
REACT_APP_STRICT_MODE=true
```

---

## 📊 **Testing Guide**

### **1. Unit Tests Example**

```javascript
// src/utils/__tests__/browserValidator.test.js
import { BrowserValidator } from '../browserValidator';

describe('BrowserValidator', () => {
  test('generates canvas fingerprint', async () => {
    const fingerprint = await BrowserValidator.generateCanvasFingerprint();
    expect(fingerprint).toContain('data:image/png;base64,');
  });

  test('detects available fonts', async () => {
    const fonts = await BrowserValidator.detectFonts();
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts).toContain('Arial');
  });

  test('gets screen data', () => {
    const screenData = BrowserValidator.getScreenData();
    expect(screenData.width).toBeGreaterThan(0);
    expect(screenData.height).toBeGreaterThan(0);
  });
});
```

### **2. Integration Tests**

```javascript
// src/components/__tests__/SecurityMonitor.test.js
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import SecurityMonitor from '../SecurityMonitor';

describe('SecurityMonitor', () => {
  test('handles security events', () => {
    const onSecurityEvent = jest.fn();
    render(
      <SecurityMonitor
        examId="test-exam"
        studentId="test-student"
        onSecurityEvent={onSecurityEvent}
      />
    );

    // Simulate copy event
    fireEvent.copy(document);
    expect(onSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'copy'
      })
    );
  });
});
```

---

## 🐛 **Troubleshooting**

### **Common Issues:**

1. **Socket Connection Failed**
   ```javascript
   // Check if backend is running
   // Verify CORS settings
   // Check port availability
   ```

2. **Browser Validation Failed**
   ```javascript
   // Use supported browsers (Chrome, Firefox, Safari)
   // Disable browser extensions
   // Clear browser cache
   ```

3. **Security Events Not Logging**
   ```javascript
   // Check network connectivity
   // Verify authentication token
   // Check browser console for errors
   ```

---

## 📚 **API Reference Quick Guide**

### **Monitoring Endpoints:**
- `POST /api/exam-attendance/start-monitoring` - Start monitoring session
- `POST /api/exam-attendance/stop-monitoring` - Stop monitoring session
- `POST /api/exam-attendance/report-cheating` - Report cheating incident

### **Admin Dashboard Endpoints:**
- `GET /api/admin/security-dashboard/overview` - Security overview
- `GET /api/admin/security-dashboard/session-events` - Security events
- `GET /api/admin/security-dashboard/banned-clients` - Banned clients
- `GET /api/admin/security-dashboard/active-sessions` - Active sessions
- `POST /api/admin/security-dashboard/ban-client` - Ban client
- `DELETE /api/admin/security-dashboard/unban-client/:ip` - Unban client

---

## 🎯 **Next Steps**

1. **Implement the SecurityMonitor component** in your exam pages
2. **Add the admin dashboard** for administrators
3. **Test thoroughly** in your development environment
4. **Configure production URLs** and deploy
5. **Monitor security events** in real-time

---

## 📞 **Support**

For technical support or questions about this integration:

1. Check the API documentation in `/docs/` folder
2. Review the implementation examples
3. Test endpoints using the provided test scripts
4. Contact the backend development team

---

**🚀 The security monitoring system is now ready for frontend integration!**
