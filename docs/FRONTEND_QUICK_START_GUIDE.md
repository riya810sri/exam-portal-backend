# 🚀 Frontend Quick Start Guide - Exam Monitoring System

## 📋 Overview

This is a **streamlined developer guide** for quickly integrating the secure exam monitoring system into your React application. For comprehensive details, see the [Complete Integration Guide](./FRONTEND_INTEGRATION_COMPLETE_GUIDE.md).

---

## ⚡ **5-Minute Setup**

### **Step 1: Install Dependencies**
```bash
npm install socket.io-client axios
```

### **Step 2: Environment Variables**
```bash
# .env
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_SOCKET_BASE_URL=http://localhost
```

### **Step 3: Copy Core Files**
Create these files in your React project:

---

## 📂 **Essential Files**

### **1. API Service** (`src/services/examApi.js`)
```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const examApi = {
  startMonitoring: async (examId, studentId) => {
    const response = await api.post('/api/exam-attendance/start-monitoring', {
      exam_id: examId,
      student_id: studentId
    });
    return response.data;
  },

  stopMonitoring: async (monitId) => {
    const response = await api.post('/api/exam-attendance/stop-monitoring', {
      monit_id: monitId
    });
    return response.data;
  },

  reportCheating: async (examId, studentId, incidentData) => {
    const response = await api.post('/api/exam-attendance/report-cheating', {
      exam_id: examId,
      student_id: studentId,
      ...incidentData
    });
    return response.data;
  }
};
```

### **2. Browser Validator** (`src/utils/browserValidator.js`)
```javascript
export class BrowserValidator {
  static async generateValidationData() {
    return {
      userAgent: navigator.userAgent,
      canvas: await this.generateCanvasFingerprint(),
      webGL: this.getWebGLInfo(),
      plugins: this.getPluginList(),
      screenData: this.getScreenData(),
      deviceMemory: navigator.deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0
    };
  }

  static async generateCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Security validation 🔒', 2, 2);
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
      if (!gl) return null;
      
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION)
      };
    } catch (error) {
      return null;
    }
  }

  static getPluginList() {
    return Array.from(navigator.plugins).map(plugin => plugin.name);
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
}
```

### **3. Security Monitor Hook** (`src/hooks/useSecurityMonitor.js`)
```javascript
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { BrowserValidator } from '../utils/browserValidator';
import { examApi } from '../services/examApi';

export const useSecurityMonitor = (examId, studentId, onSecurityEvent) => {
  const [isConnected, setIsConnected] = useState(false);
  const [monitoringSession, setMonitoringSession] = useState(null);
  const socketRef = useRef(null);

  const startMonitoring = async () => {
    try {
      // Start monitoring session
      const session = await examApi.startMonitoring(examId, studentId);
      setMonitoringSession(session);

      // Connect to dynamic socket
      const socket = io(`http://localhost:${session.socket_port}`, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      socketRef.current = socket;

      socket.on('connect', async () => {
        setIsConnected(true);
        // Send browser validation
        const validationData = await BrowserValidator.generateValidationData();
        socket.emit('browser_validation', validationData);
      });

      socket.on('validation_success', () => {
        console.log('✅ Browser validation passed');
        startEventMonitoring(socket);
      });

      socket.on('validation_failed', (data) => {
        console.error('❌ Browser validation failed:', data);
        onSecurityEvent?.({ type: 'validation_failed', data });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const startEventMonitoring = (socket) => {
    // Monitor page visibility
    document.addEventListener('visibilitychange', () => {
      logEvent(socket, 'visibilitychange', { hidden: document.hidden });
    });

    // Monitor focus/blur
    window.addEventListener('blur', () => {
      logEvent(socket, 'blur', { type: 'window_blur' });
    });

    // Monitor copy/paste
    document.addEventListener('copy', (e) => {
      logEvent(socket, 'copy', { 
        selection: window.getSelection().toString().substring(0, 100) 
      });
    });

    // Block right-click
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      logEvent(socket, 'contextmenu', { x: e.clientX, y: e.clientY });
    });

    // Monitor suspicious keys
    document.addEventListener('keydown', (e) => {
      const suspicious = [
        'F12', 'F11',
        e.ctrlKey && e.shiftKey && e.key === 'I',
        e.ctrlKey && e.key === 'u'
      ];

      if (suspicious.some(Boolean)) {
        e.preventDefault();
        logEvent(socket, 'suspicious_key', { 
          key: e.key, 
          ctrlKey: e.ctrlKey, 
          shiftKey: e.shiftKey 
        });
      }
    });
  };

  const logEvent = (socket, eventType, details) => {
    const eventData = {
      event_type: eventType,
      timestamp: Date.now(),
      details
    };

    if (socket?.connected) {
      socket.emit('security_event', eventData);
    }
    
    onSecurityEvent?.(eventData);
  };

  const stopMonitoring = async () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    if (monitoringSession) {
      await examApi.stopMonitoring(monitoringSession.monit_id);
    }
    
    setIsConnected(false);
    setMonitoringSession(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, []);

  return {
    isConnected,
    monitoringSession,
    startMonitoring,
    stopMonitoring
  };
};
```

### **4. Exam Component** (`src/components/ExamPage.jsx`)
```javascript
import React, { useState, useEffect } from 'react';
import { useSecurityMonitor } from '../hooks/useSecurityMonitor';

const ExamPage = ({ examId, studentId }) => {
  const [examStarted, setExamStarted] = useState(false);
  const [securityEvents, setSecurityEvents] = useState([]);

  const { isConnected, startMonitoring, stopMonitoring } = useSecurityMonitor(
    examId,
    studentId,
    (event) => {
      console.log('Security event:', event);
      setSecurityEvents(prev => [...prev, event]);
      
      // Alert for high-risk events
      if (event.type === 'validation_failed' || event.event_type === 'suspicious_key') {
        alert('⚠️ Security violation detected!');
      }
    }
  );

  const handleStartExam = async () => {
    await startMonitoring();
    setExamStarted(true);
    
    // Enter fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const handleEndExam = async () => {
    await stopMonitoring();
    setExamStarted(false);
  };

  return (
    <div className="exam-page">
      {/* Connection Status */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        backgroundColor: isConnected ? '#4CAF50' : '#f44336',
        color: 'white',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 9999
      }}>
        {isConnected ? '🔒 Secure Mode Active' : '⚠️ Not Monitoring'}
      </div>

      {!examStarted ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h2>🔒 Secure Exam Environment</h2>
          <p><strong>⚠️ Security Notice:</strong></p>
          <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
            <li>Your browser will be validated</li>
            <li>All activities are monitored</li>
            <li>Tab switching is not allowed</li>
            <li>Copy/paste is disabled</li>
            <li>Right-click is blocked</li>
            <li>DevTools access is prevented</li>
          </ul>
          
          <button
            onClick={handleStartExam}
            style={{
              marginTop: '30px',
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Start Secure Exam
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>📝 Exam in Progress</h2>
            <button
              onClick={handleEndExam}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              End Exam
            </button>
          </div>

          {/* Your exam content here */}
          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
            <h3>Question 1:</h3>
            <p>What is the capital of France?</p>
            <input type="text" placeholder="Your answer..." style={{ width: '100%', padding: '10px', marginTop: '10px' }} />
          </div>

          {/* Security Events (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{
              position: 'fixed',
              bottom: '10px',
              left: '10px',
              width: '300px',
              maxHeight: '200px',
              overflow: 'auto',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '10px',
              fontSize: '12px'
            }}>
              <h4>Security Events (Dev Mode)</h4>
              {securityEvents.slice(-5).map((event, index) => (
                <div key={index} style={{ marginBottom: '5px', padding: '5px', backgroundColor: '#f9f9f9' }}>
                  <strong>{event.event_type || event.type}:</strong> {JSON.stringify(event.details || event.data)}
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

## 🔧 **Integration in Your App**

### **Add to App.js**
```javascript
import React from 'react';
import ExamPage from './components/ExamPage';

function App() {
  return (
    <div className="App">
      <ExamPage 
        examId="exam_123" 
        studentId="student_456" 
      />
    </div>
  );
}

export default App;
```

---

## 🛡️ **Admin Dashboard (Optional)**

### **Simple Admin Dashboard** (`src/components/AdminDashboard.jsx`)
```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const headers = { Authorization: `Bearer ${token}` };

      // Load overview
      const overviewRes = await axios.get('http://localhost:3000/api/admin/security-dashboard/overview', { headers });
      setOverview(overviewRes.data);

      // Load recent events
      const eventsRes = await axios.get('http://localhost:3000/api/admin/security-dashboard/session-events?limit=20', { headers });
      setEvents(eventsRes.data.events);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  if (!overview) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>🛡️ Security Dashboard</h1>
      
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ padding: '20px', backgroundColor: '#2196F3', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Security Events</h3>
          <div style={{ fontSize: '24px' }}>{overview.security_events_count || 0}</div>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#f44336', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Banned Clients</h3>
          <div style={{ fontSize: '24px' }}>{overview.banned_clients_count || 0}</div>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Active Sessions</h3>
          <div style={{ fontSize: '24px' }}>{overview.active_sessions_count || 0}</div>
        </div>
      </div>

      {/* Recent Events */}
      <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
        <h2>Recent Security Events</h2>
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {events.map((event, index) => (
            <div key={index} style={{
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: event.is_suspicious ? '#ffebee' : 'white',
              border: event.is_suspicious ? '1px solid #f44336' : '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{event.event_type}</strong>
                <span style={{ color: '#666', fontSize: '12px' }}>
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                Session: {event.monit_id} | IP: {event.ip_address} | Risk: {event.risk_score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
```

---

## ✅ **Testing Your Integration**

### **1. Start Backend Server**
```bash
cd exam_portal_backend
npm start
```

### **2. Start Frontend**
```bash
cd your-react-app
npm start
```

### **3. Test Security Features**

1. **✅ Open exam page** - Should show security notice
2. **✅ Click "Start Secure Exam"** - Should enter fullscreen and show "Secure Mode Active"
3. **✅ Try right-click** - Should be blocked and logged
4. **✅ Try Ctrl+Shift+I** - Should be blocked and show alert
5. **✅ Try switching tabs** - Should be detected and logged
6. **✅ Check browser console** - Should see security events
7. **✅ Check admin dashboard** - Should show events and stats

---

## 🐛 **Common Issues & Solutions**

### **Issue: Socket connection failed**
```javascript
// Solution: Check if backend is running on port 3000
// Verify CORS settings in backend allow your frontend domain
```

### **Issue: Browser validation failed**
```javascript
// Solution: Use Chrome/Firefox/Safari
// Disable browser extensions
// Clear cache and cookies
```

### **Issue: Admin dashboard shows 401**
```javascript
// Solution: Make sure you have admin token in localStorage
localStorage.setItem('adminToken', 'your-admin-jwt-token');
```

---

## 📞 **Support**

For detailed documentation and advanced features, see:
- [Complete Integration Guide](./FRONTEND_INTEGRATION_COMPLETE_GUIDE.md)
- [Security Setup Guide](../SECURITY_MONITORING_SETUP.md)
- [Implementation Status](../IMPLEMENTATION_COMPLETE.md)

---

**🚀 You're ready to go! This setup provides all essential security monitoring features in a React-friendly package.**
