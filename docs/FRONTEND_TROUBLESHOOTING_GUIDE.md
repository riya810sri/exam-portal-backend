# 🛠️ Frontend Integration Troubleshooting Guide

## 🚨 **Common Issues & Solutions**

### **Issue #1: Socket Connection Failed**

#### **Symptoms:**
- Console error: "Failed to connect to socket"
- Connection status shows "Connection Lost"
- No security events being logged

#### **Diagnosis Steps:**
```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Check if dynamic socket ports are available
netstat -an | grep :400[0-9]

# Test socket connection manually
telnet localhost 4000
```

#### **Solutions:**

**Solution A: Backend Not Running**
```bash
cd exam_portal_backend
npm start
# Verify server starts on port 3000
```

**Solution B: Port Already in Use**
```javascript
// In your React component, add retry logic
const connectWithRetry = async (port, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const socket = io(`http://localhost:${port}`);
      return socket;
    } catch (error) {
      console.log(`Retry ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Max retries exceeded');
};
```

**Solution C: CORS Issues**
```javascript
// Update backend app.js CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
```

---

### **Issue #2: Browser Validation Failed**

#### **Symptoms:**
- Alert: "Browser validation failed"
- Cannot start exam session
- Console shows validation errors

#### **Diagnosis Steps:**
```javascript
// Test browser capabilities
console.log('UserAgent:', navigator.userAgent);
console.log('Canvas support:', !!document.createElement('canvas').getContext);
console.log('WebGL support:', !!document.createElement('canvas').getContext('webgl'));
console.log('Device memory:', navigator.deviceMemory);
```

#### **Solutions:**

**Solution A: Unsupported Browser**
```javascript
// Add browser compatibility check
const checkBrowserSupport = () => {
  const ua = navigator.userAgent;
  const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
  const isFirefox = ua.includes('Firefox');
  const isSafari = ua.includes('Safari') && !ua.includes('Chrome');
  
  if (!isChrome && !isFirefox && !isSafari) {
    alert('Please use Chrome, Firefox, or Safari for the exam');
    return false;
  }
  return true;
};
```

**Solution B: Canvas/WebGL Disabled**
```javascript
// Enhanced canvas fingerprint with fallback
static async generateCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return 'canvas_disabled';
    }
    
    // Test basic canvas operations
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Test', 2, 2);
    
    return canvas.toDataURL();
  } catch (error) {
    console.warn('Canvas fingerprint failed:', error);
    return 'canvas_error_' + Date.now();
  }
}
```

**Solution C: Browser Extensions Interfering**
```javascript
// Detect browser extensions
const detectExtensions = () => {
  // Check for common extension indicators
  const extensionDetected = 
    window.chrome?.extension ||
    window.chrome?.app ||
    window.chrome?.runtime?.onConnect ||
    document.querySelector('[data-extension]');
    
  if (extensionDetected) {
    alert('Please disable browser extensions before starting the exam');
    return false;
  }
  return true;
};
```

---

### **Issue #3: Security Events Not Logging**

#### **Symptoms:**
- Events occur but don't appear in admin dashboard
- Console shows events but socket doesn't receive them
- Development panel shows empty event list

#### **Diagnosis Steps:**
```javascript
// Add debug logging to event handler
const logEvent = (socket, eventType, details) => {
  console.log('Logging event:', eventType, details);
  console.log('Socket connected:', socket?.connected);
  console.log('Socket ID:', socket?.id);
  
  const eventData = {
    event_type: eventType,
    timestamp: Date.now(),
    details
  };

  if (socket?.connected) {
    socket.emit('security_event', eventData);
    console.log('Event emitted successfully');
  } else {
    console.error('Socket not connected, buffering event');
  }
};
```

#### **Solutions:**

**Solution A: Socket Disconnection**
```javascript
// Add reconnection logic
useEffect(() => {
  if (socket) {
    socket.on('disconnect', () => {
      console.log('Socket disconnected, attempting reconnection...');
      setTimeout(() => {
        if (!socket.connected) {
          socket.connect();
        }
      }, 5000);
    });
  }
}, [socket]);
```

**Solution B: Event Listener Not Attached**
```javascript
// Ensure event listeners are properly attached
const startEventMonitoring = (socket) => {
  // Remove existing listeners first
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('blur', handleBlur);
  
  // Add new listeners
  const handleVisibilityChange = () => {
    logEvent(socket, 'visibilitychange', { hidden: document.hidden });
  };
  
  const handleBlur = () => {
    logEvent(socket, 'blur', { type: 'window_blur' });
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleBlur);
};
```

**Solution C: Event Buffering System**
```javascript
// Add event buffering for offline scenarios
const useEventBuffer = () => {
  const [eventBuffer, setEventBuffer] = useState([]);
  
  const bufferEvent = (event) => {
    setEventBuffer(prev => [...prev, event]);
  };
  
  const flushBuffer = (socket) => {
    if (socket?.connected && eventBuffer.length > 0) {
      eventBuffer.forEach(event => {
        socket.emit('security_event', event);
      });
      setEventBuffer([]);
    }
  };
  
  return { bufferEvent, flushBuffer };
};
```

---

### **Issue #4: Fullscreen Not Working**

#### **Symptoms:**
- Exam doesn't enter fullscreen mode
- User can exit fullscreen easily
- Fullscreen API errors in console

#### **Diagnosis Steps:**
```javascript
// Test fullscreen API support
console.log('Fullscreen API support:', {
  requestFullscreen: !!document.documentElement.requestFullscreen,
  webkitRequestFullscreen: !!document.documentElement.webkitRequestFullscreen,
  mozRequestFullScreen: !!document.documentElement.mozRequestFullScreen,
  msRequestFullscreen: !!document.documentElement.msRequestFullscreen
});
```

#### **Solutions:**

**Solution A: Cross-Browser Fullscreen**
```javascript
const enterFullscreen = async () => {
  const element = document.documentElement;
  
  try {
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
  } catch (error) {
    console.error('Fullscreen failed:', error);
    alert('Please manually enter fullscreen mode (F11)');
  }
};
```

**Solution B: Fullscreen Exit Detection**
```javascript
const monitorFullscreen = () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  
  const handleFullscreenChange = () => {
    const isFullscreen = 
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;
      
    if (!isFullscreen) {
      logEvent(socket, 'fullscreen_exit', { 
        timestamp: Date.now(),
        method: 'fullscreen_api' 
      });
      alert('⚠️ Fullscreen mode required for exam');
      enterFullscreen();
    }
  };
};
```

---

### **Issue #5: Admin Dashboard 401/403 Errors**

#### **Symptoms:**
- Admin dashboard shows "Access Denied"
- API calls return 401 Unauthorized
- 403 Forbidden errors in network tab

#### **Diagnosis Steps:**
```javascript
// Check authentication status
console.log('Auth token:', localStorage.getItem('authToken'));
console.log('Admin token:', localStorage.getItem('adminToken'));

// Test API endpoint manually
fetch('http://localhost:3000/api/admin/security-dashboard/overview', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
    'Content-Type': 'application/json'
  }
})
.then(res => console.log('API Response:', res.status))
.catch(err => console.error('API Error:', err));
```

#### **Solutions:**

**Solution A: Missing Admin Token**
```javascript
// Set admin token (get from backend admin login)
localStorage.setItem('adminToken', 'your-admin-jwt-token-here');

// Or implement admin login
const adminLogin = async (email, password) => {
  try {
    const response = await api.post('/api/admin/login', {
      email,
      password
    });
    
    localStorage.setItem('adminToken', response.data.token);
    return response.data;
  } catch (error) {
    throw new Error('Admin login failed');
  }
};
```

**Solution B: Token Expired**
```javascript
// Add token refresh logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      alert('Session expired. Please login again.');
      // Redirect to admin login
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);
```

**Solution C: Incorrect Token Format**
```javascript
// Ensure correct token format in API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  // Check if it's an admin endpoint
  if (config.url.includes('/admin/')) {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  } else {
    const userToken = localStorage.getItem('authToken');
    if (userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
    }
  }
  return config;
});
```

---

### **Issue #6: Performance Problems**

#### **Symptoms:**
- UI becomes slow during exam
- High CPU usage
- Memory leaks over time
- Browser becomes unresponsive

#### **Diagnosis Steps:**
```javascript
// Monitor performance
const monitorPerformance = () => {
  setInterval(() => {
    console.log('Memory usage:', {
      used: performance.memory?.usedJSHeapSize,
      total: performance.memory?.totalJSHeapSize,
      limit: performance.memory?.jsHeapSizeLimit
    });
  }, 30000);
};
```

#### **Solutions:**

**Solution A: Event Listener Cleanup**
```javascript
// Proper cleanup in useEffect
useEffect(() => {
  const handleKeyDown = (e) => {
    // Handle keydown
  };
  
  const handleVisibilityChange = () => {
    // Handle visibility change
  };
  
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

**Solution B: Reduce Event Frequency**
```javascript
// Throttle high-frequency events
const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

// Use throttled event handlers
const throttledKeyHandler = throttle((e) => {
  logEvent(socket, 'keydown', { key: e.key });
}, 100);
```

**Solution C: Memory Management**
```javascript
// Limit stored events
const [securityEvents, setSecurityEvents] = useState([]);

const addSecurityEvent = (event) => {
  setSecurityEvents(prev => {
    const newEvents = [...prev, event];
    // Keep only last 100 events to prevent memory issues
    return newEvents.slice(-100);
  });
};
```

---

### **Issue #7: Mobile Compatibility Problems**

#### **Symptoms:**
- Features don't work on mobile browsers
- Touch events not detected
- Responsive design issues

#### **Solutions:**

**Solution A: Touch Event Monitoring**
```javascript
// Add touch event listeners for mobile
const addMobileEventListeners = (socket) => {
  // Monitor touch events
  document.addEventListener('touchstart', (e) => {
    logEvent(socket, 'touch_start', { 
      touches: e.touches.length,
      timestamp: Date.now() 
    });
  });
  
  // Monitor orientation changes
  window.addEventListener('orientationchange', () => {
    logEvent(socket, 'orientation_change', { 
      orientation: screen.orientation?.angle || window.orientation 
    });
  });
  
  // Monitor page visibility (mobile app switching)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logEvent(socket, 'mobile_app_switch', { 
        timestamp: Date.now() 
      });
    }
  });
};
```

**Solution B: Mobile-Specific Validation**
```javascript
// Detect mobile browser
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Mobile-specific browser validation
const generateMobileValidationData = async () => {
  return {
    ...await BrowserValidator.generateValidationData(),
    isMobile: isMobile(),
    touchSupport: 'ontouchstart' in window,
    deviceOrientation: window.DeviceOrientationEvent !== undefined,
    deviceMotion: window.DeviceMotionEvent !== undefined,
    vibration: 'vibrate' in navigator
  };
};
```

---

## 🔍 **Debug Tools & Utilities**

### **Debug Panel Component**
```javascript
const DebugPanel = ({ events, socket, monitoringSession }) => {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '50px',
      right: '10px',
      width: '300px',
      height: '400px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '10px',
      fontSize: '12px',
      overflow: 'auto',
      zIndex: 10000
    }}>
      <h4>🔧 Debug Panel</h4>
      
      <div>
        <strong>Connection:</strong> {socket?.connected ? '✅' : '❌'}
      </div>
      
      <div>
        <strong>Session ID:</strong> {monitoringSession?.monit_id || 'None'}
      </div>
      
      <div>
        <strong>Socket Port:</strong> {monitoringSession?.socket_port || 'None'}
      </div>
      
      <div>
        <strong>Events Count:</strong> {events.length}
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <strong>Recent Events:</strong>
        {events.slice(-5).map((event, index) => (
          <div key={index} style={{ padding: '2px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            {event.event_type}: {JSON.stringify(event.details).substring(0, 50)}...
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **Network Diagnostics**
```javascript
const runNetworkDiagnostics = async () => {
  console.log('🔍 Running Network Diagnostics...');
  
  // Test API connectivity
  try {
    const response = await fetch('http://localhost:3000/api/health');
    console.log('✅ API Server:', response.status === 200 ? 'Online' : 'Issues');
  } catch (error) {
    console.log('❌ API Server: Offline');
  }
  
  // Test socket connectivity
  try {
    const testSocket = io('http://localhost:4000', { timeout: 5000 });
    testSocket.on('connect', () => {
      console.log('✅ Socket: Connected');
      testSocket.disconnect();
    });
    testSocket.on('connect_error', () => {
      console.log('❌ Socket: Connection failed');
    });
  } catch (error) {
    console.log('❌ Socket: Error -', error.message);
  }
  
  // Test browser capabilities
  console.log('🌐 Browser Capabilities:', {
    canvas: !!document.createElement('canvas').getContext,
    webgl: !!document.createElement('canvas').getContext('webgl'),
    fullscreen: !!document.documentElement.requestFullscreen,
    websockets: 'WebSocket' in window,
    localStorage: 'localStorage' in window
  });
};
```

---

## 📞 **Getting Help**

### **Before Asking for Help:**
1. Check browser console for errors
2. Verify backend server is running
3. Test with a different browser
4. Clear browser cache and cookies
5. Check network connectivity
6. Review implementation against guides

### **Helpful Information to Provide:**
- Browser version and operating system
- Console error messages (full stack trace)
- Network tab responses from browser dev tools
- Steps to reproduce the issue
- Current configuration (environment variables)

### **Resources:**
- [Quick Start Guide](./FRONTEND_QUICK_START_GUIDE.md)
- [Complete Integration Guide](./FRONTEND_INTEGRATION_COMPLETE_GUIDE.md)
- [Implementation Checklist](./DEVELOPER_IMPLEMENTATION_CHECKLIST.md)
- [Backend API Documentation](../API_QUICK_REFERENCE.md)

---

**🛠️ Remember: Most issues are configuration-related. Double-check your setup against the guides before diving into complex debugging.**
