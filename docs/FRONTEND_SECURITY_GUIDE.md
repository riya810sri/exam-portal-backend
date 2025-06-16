# Security Monitoring System - Frontend Developer Guide

## Overview

This document provides complete implementation instructions for frontend developers to integrate with our exam security monitoring system. The security system uses WebSocket connections to monitor student activity during exams and detect potential cheating attempts.

## Connection Details

Every exam session creates a dedicated WebSocket server with these connection parameters:

```javascript
// Connection parameters that will be returned from the backend
{
  host: 'localhost',
  port: 4000-4999, // Dynamically assigned port
  uri: 'wss://test.test.com'
}
```

## Step 1: Initial Setup

### Required Dependencies

Add Socket.IO client to your project:

```bash
npm install socket.io-client
```

### Create Security Monitor Module

Create a file named `examSecurityMonitor.js` in your project:

```javascript
import { io } from 'socket.io-client';

class ExamSecurityMonitor {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.monitoringActive = false;
    this.monitorId = null;
    this.connectionDetails = null;
    this.eventBuffer = [];
    this.browserProfile = null;
  }

  /**
   * Initialize monitoring for an exam session
   * @param {Object} connectionDetails - Details from backend { host, port, uri }
   * @param {string} examId - The exam identifier
   * @param {string} studentId - The student identifier
   */
  async initializeMonitoring(connectionDetails, examId, studentId) {
    try {
      if (this.socket) {
        this.socket.disconnect();
      }

      this.connectionDetails = connectionDetails;
      this.monitorId = `${studentId}-${examId}-${Date.now()}`;
      
      console.log(`Initializing security monitoring with connection:`, connectionDetails);
      
      // Create socket connection to the specified port
      this.socket = io(`${connectionDetails.host}:${connectionDetails.port}`, {
        transports: ['websocket', 'polling'],
        query: {
          examId,
          studentId,
          monitorId: this.monitorId
        }
      });

      // Setup event listeners
      this.setupEventListeners();

      // Wait for connection
      await this.waitForConnection();
      
      // Send browser validation data
      await this.validateBrowser();
      
      // Start monitoring events
      this.startEventMonitoring();
      
      // Automatically enter fullscreen mode
      await this.enterFullScreen();
      
      return {
        success: true,
        monitorId: this.monitorId,
        message: 'Security monitoring initialized successfully'
      };
    } catch (error) {
      console.error('Failed to initialize security monitoring:', error);
      return {
        success: false,
        error: error.message || 'Unknown error initializing security monitoring'
      };
    }
  }

  /**
   * Wait for socket connection
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      // Set timeout for connection
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log('Connected to security monitoring server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('Connection error:', error);
        reject(error);
      });
    });
  }

  /**
   * Setup socket event listeners
   */
  setupEventListeners() {
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.warn(`Disconnected from security monitoring: ${reason}`);
      
      // Try to reconnect if unexpected disconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setTimeout(() => {
          if (this.connectionDetails) {
            this.socket.connect();
          }
        }, 3000);
      }
    });

    this.socket.on('validation_success', (data) => {
      console.log('Browser validation successful:', data);
      this.monitoringActive = true;
    });

    this.socket.on('validation_failed', (data) => {
      console.error('Browser validation failed:', data);
      // Show error to user
      this.showSecurityAlert('Browser validation failed', data.message);
      
      if (data.action === 'disconnect') {
        setTimeout(() => {
          window.location.href = '/exam-terminated';
        }, 5000);
      }
    });

    this.socket.on('security_warning', (data) => {
      console.warn('Security warning received:', data);
      this.showSecurityAlert('Security Warning', data.message);
    });

    this.socket.on('session_terminated', (data) => {
      console.error('Session terminated:', data);
      this.showSecurityAlert('Session Terminated', data.message, true);
      
      // Redirect after delay
      setTimeout(() => {
        window.location.href = '/exam-terminated';
      }, 5000);
    });

    this.socket.on('restriction_blocked', (data) => {
      console.error('Restriction violation:', data);
      this.showSecurityAlert('Access Restricted', data.message, true);
      
      if (data.action === 'disconnect') {
        setTimeout(() => {
          window.location.href = '/access-restricted';
        }, 5000);
      }
    });

    this.socket.on('pong', () => {
      // Update last activity timestamp
      this.lastActivity = Date.now();
    });
  }

  /**
   * Display security alert to user
   */
  showSecurityAlert(title, message, isError = false) {
    // Implement based on your UI library (React, Vue, etc.)
    console.warn(`SECURITY ALERT: ${title} - ${message}`);
    
    // Example implementation with custom event
    const alertEvent = new CustomEvent('securityAlert', {
      detail: {
        title,
        message,
        isError
      }
    });
    
    document.dispatchEvent(alertEvent);
  }

  /**
   * Collect and send browser validation data
   */
  async validateBrowser() {
    try {
      // Collect browser fingerprint data
      const browserProfile = await this.collectBrowserProfile();
      this.browserProfile = browserProfile;
      
      // Send validation data to server
      this.socket.emit('browser_validation', browserProfile);
      
      return true;
    } catch (error) {
      console.error('Error during browser validation:', error);
      return false;
    }
  }

  /**
   * Collect browser profile for validation
   */
  async collectBrowserProfile() {
    // Get canvas fingerprint
    const canvasFingerprint = await this.getCanvasFingerprint();
    
    // Get WebGL info
    const webGLInfo = await this.getWebGLInfo();
    
    // Get browser plugins
    const plugins = this.getBrowserPlugins();
    
    // Get system fonts
    const fonts = await this.getSystemFonts();
    
    // Get navigator properties
    const navigatorProperties = this.getNavigatorProperties();
    
    // Get screen data
    const screenData = this.getScreenData();
    
    // Get connection timing
    const timing = {
      connectTime: performance.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset()
    };
    
    return {
      userAgent: navigator.userAgent,
      canvas: canvasFingerprint,
      webGL: webGLInfo,
      plugins,
      fonts,
      timing,
      navigatorProperties,
      screenData,
      deviceMemory: navigator.deviceMemory || null,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      connection: this.getNetworkInformation()
    };
  }

  /**
   * Get canvas fingerprint
   */
  getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      
      const ctx = canvas.getContext('2d');
      ctx.font = '20px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText('Canvas Fingerprint 👾', 10, 30);
      ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';
      ctx.fillRect(100, 15, 80, 30);
      
      return canvas.toDataURL();
    } catch (e) {
      console.error('Canvas fingerprint error:', e);
      return 'canvas-error';
    }
  }

  /**
   * Get WebGL information
   */
  getWebGLInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return 'webgl-not-supported';
      }
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
      
      return 'webgl-info-restricted';
    } catch (e) {
      console.error('WebGL info error:', e);
      return 'webgl-error';
    }
  }

  /**
   * Get browser plugins
   */
  getBrowserPlugins() {
    try {
      const plugins = [];
      for (let i = 0; i < navigator.plugins.length; i++) {
        const plugin = navigator.plugins[i];
        plugins.push({
          name: plugin.name,
          filename: plugin.filename,
          description: plugin.description
        });
      }
      return plugins;
    } catch (e) {
      console.error('Plugin detection error:', e);
      return [];
    }
  }

  /**
   * Get system fonts (simplified method)
   */
  async getSystemFonts() {
    // Common fonts to test
    const fontList = [
      'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New',
      'Courier', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman',
      'Comic Sans MS', 'Trebuchet MS', 'Impact', 'Tahoma'
    ];
    
    const detectedFonts = [];
    
    // Use font detection technique
    const testString = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const testSize = '72px';
    const baseFont = 'monospace';
    const baseFontFamily = `${testSize} ${baseFont}`;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.font = baseFontFamily;
    const baseWidth = ctx.measureText(testString).width;
    
    for (const font of fontList) {
      ctx.font = `${testSize} ${font}, ${baseFont}`;
      const width = ctx.measureText(testString).width;
      
      if (width !== baseWidth) {
        detectedFonts.push(font);
      }
    }
    
    return detectedFonts;
  }

  /**
   * Get navigator properties
   */
  getNavigatorProperties() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      webdriver: navigator.webdriver
    };
  }

  /**
   * Get screen data
   */
  getScreenData() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation ? 
        { type: screen.orientation.type, angle: screen.orientation.angle } : 
        'not-available',
      devicePixelRatio: window.devicePixelRatio
    };
  }

  /**
   * Get network information
   */
  getNetworkInformation() {
    const connection = navigator.connection || 
                      navigator.mozConnection || 
                      navigator.webkitConnection;
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }
    
    return { effectiveType: 'unknown' };
  }

  /**
   * Start monitoring browser events
   */
  startEventMonitoring() {
    if (this.monitoringActive) {
      // Setup global event listeners
      this.setupEventCapture();
      
      // Start keyboard monitoring
      this.startKeyboardMonitoring();
      
      // Start mouse monitoring
      this.startMouseMonitoring();
      
      // Start periodic heartbeat
      this.startHeartbeat();
      
      console.log('Security event monitoring started');
    }
  }

  /**
   * Setup event capture for security-relevant browser events
   */
  setupEventCapture() {
    // Tab visibility events
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Window focus events
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    
    // Full screen change
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    
    // Prevent right-click menu
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    
    // Prevent copy/paste
    document.addEventListener('copy', this.handleCopy.bind(this));
    document.addEventListener('cut', this.handleCut.bind(this));
    document.addEventListener('paste', this.handlePaste.bind(this));
    
    // Window events
    window.addEventListener('resize', this.handleResize.bind(this));
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    
    // Dev tools detection
    this.setupDevToolsDetection();
  }

  /**
   * Handle visibility change (tab switching)
   */
  handleVisibilityChange(event) {
    const isHidden = document.hidden;
    
    this.sendSecurityEvent('visibilitychange', {
      hidden: isHidden,
      timestamp: Date.now()
    });
    
    if (isHidden) {
      this.tabSwitchCount = (this.tabSwitchCount || 0) + 1;
      
      // Emit warning on multiple tab switches
      if (this.tabSwitchCount > 3) {
        this.showSecurityAlert(
          'Warning', 
          'Multiple tab switches detected. Your actions are being monitored.'
        );
      }
    }
  }

  /**
   * Handle window blur (user switched to another window)
   */
  handleWindowBlur(event) {
    this.sendSecurityEvent('blur', {
      timestamp: Date.now()
    });
  }

  /**
   * Handle window focus (user returned to exam window)
   */
  handleWindowFocus(event) {
    this.sendSecurityEvent('focus', {
      timestamp: Date.now()
    });
  }

  /**
   * Handle fullscreen change
   */
  handleFullscreenChange(event) {
    const isFullscreen = !!document.fullscreenElement;
    
    this.sendSecurityEvent('fullscreenchange', {
      fullscreen: isFullscreen,
      timestamp: Date.now()
    });
    
    if (!isFullscreen) {
      this.showSecurityAlert(
        'Warning', 
        'Exiting fullscreen mode during an exam may be flagged as suspicious activity.'
      );
      
      // Attempt to re-enter fullscreen automatically after 2 seconds
      setTimeout(() => {
        this.enterFullScreen();
      }, 2000);
    }
  }

  /**
   * Automatically enter fullscreen mode
   */
  async enterFullScreen(element = document.documentElement) {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      
      console.log('Entered fullscreen mode automatically');
      return true;
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      this.showSecurityAlert(
        'Error',
        'Unable to enter fullscreen mode. Please press F11 to continue.'
      );
      return false;
    }
  }

  /**
   * Handle context menu (right-click)
   */
  handleContextMenu(event) {
    // Prevent default right-click menu
    event.preventDefault();
    
    this.sendSecurityEvent('contextmenu', {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now()
    });
    
    return false;
  }

  /**
   * Handle copy event
   */
  handleCopy(event) {
    // Prevent copying
    event.preventDefault();
    
    this.sendSecurityEvent('copy', {
      timestamp: Date.now()
    });
    
    this.showSecurityAlert('Warning', 'Copying is not allowed during the exam');
    
    return false;
  }

  /**
   * Handle cut event
   */
  handleCut(event) {
    // Prevent cutting
    event.preventDefault();
    
    this.sendSecurityEvent('cut', {
      timestamp: Date.now()
    });
    
    this.showSecurityAlert('Warning', 'Cutting text is not allowed during the exam');
    
    return false;
  }

  /**
   * Handle paste event
   */
  handlePaste(event) {
    // Prevent pasting
    event.preventDefault();
    
    this.sendSecurityEvent('paste', {
      timestamp: Date.now()
    });
    
    this.showSecurityAlert('Warning', 'Pasting is not allowed during the exam');
    
    return false;
  }

  /**
   * Handle window resize
   */
  handleResize(event) {
    this.sendSecurityEvent('resize', {
      width: window.innerWidth,
      height: window.innerHeight,
      timestamp: Date.now()
    });
  }

  /**
   * Handle before unload (page navigation)
   */
  handleBeforeUnload(event) {
    this.sendSecurityEvent('beforeunload', {
      timestamp: Date.now()
    });
    
    // Show warning message to user
    event.preventDefault();
    event.returnValue = 'Navigating away from the exam will be recorded as suspicious activity. Are you sure?';
    
    return event.returnValue;
  }

  /**
   * Setup developer tools detection
   */
  setupDevToolsDetection() {
    // Method 1: Window size detection
    let devToolsOpen = false;
    const threshold = 160;
    
    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          this.sendSecurityEvent('devtools_detected', {
            method: 'size',
            timestamp: Date.now()
          });
          
          this.showSecurityAlert(
            'Warning',
            'Developer tools detected. This activity will be reported.'
          );
        }
      } else {
        devToolsOpen = false;
      }
    };
    
    // Method 2: Console.log overrides
    const oldLog = console.log;
    console.log = (...args) => {
      this.sendSecurityEvent('console_log', {
        timestamp: Date.now()
      });
      
      return oldLog.apply(console, args);
    };
    
    // Set interval to check for dev tools
    setInterval(checkDevTools, 1000);
    
    // Method 3: debugger detection
    function debuggerDetection() {
      const startTime = new Date().getTime();
      debugger;
      const endTime = new Date().getTime();
      const elapsed = endTime - startTime;
      
      if (elapsed > 100) {
        this.sendSecurityEvent('debugger_detected', {
          elapsed,
          timestamp: Date.now()
        });
      }
    }
    
    setInterval(debuggerDetection.bind(this), 5000);
  }

  /**
   * Start keyboard monitoring
   */
  startKeyboardMonitoring() {
    this.keyboardEvents = [];
    this.lastKeyTime = Date.now();
    
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Periodically send keyboard data
    this.keyboardInterval = setInterval(() => {
      if (this.keyboardEvents.length > 0) {
        this.sendKeyboardData();
      }
    }, 10000); // Send every 10 seconds
  }

  /**
   * Handle keydown event
   */
  handleKeyDown(event) {
    // Check for prohibited key combinations
    const isCtrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    
    // Prohibited combinations
    const prohibitedCombos = {
      'c': isCtrl, // Ctrl+C (Copy)
      'v': isCtrl, // Ctrl+V (Paste)
      'x': isCtrl, // Ctrl+X (Cut)
      'p': isCtrl, // Ctrl+P (Print)
      's': isCtrl, // Ctrl+S (Save)
      'f': isCtrl, // Ctrl+F (Find)
      'g': isCtrl, // Ctrl+G (Find Next)
      'f12': !isCtrl, // F12 (Dev Tools)
      'f11': !isCtrl, // F11 (Fullscreen) - Handled automatically by system
      'i': isCtrl && event.shiftKey, // Ctrl+Shift+I (Dev Tools)
      'j': isCtrl && event.shiftKey, // Ctrl+Shift+J (Console)
      'u': isCtrl, // Ctrl+U (View Source)
    };
    
    if (prohibitedCombos[key]) {
      event.preventDefault();
      
      this.sendSecurityEvent('prohibited_key', {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
        timestamp: Date.now()
      });
      
      this.showSecurityAlert(
        'Warning',
        `Key combination ${isCtrl ? 'Ctrl+' : ''}${event.key} is not allowed during the exam`
      );
      
      return false;
    }
    
    // Record keyboard event
    const now = Date.now();
    this.keyboardEvents.push({
      type: 'keydown',
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      timestamp: now,
      timeDiff: this.lastKeyTime ? now - this.lastKeyTime : 0
    });
    
    this.lastKeyTime = now;
    
    // Limit buffer size
    if (this.keyboardEvents.length > 100) {
      this.sendKeyboardData();
    }
  }

  /**
   * Handle keyup event
   */
  handleKeyUp(event) {
    const now = Date.now();
    this.keyboardEvents.push({
      type: 'keyup',
      key: event.key,
      code: event.code,
      timestamp: now
    });
  }

  /**
   * Send keyboard data to server
   */
  sendKeyboardData() {
    if (!this.socket || !this.connected || this.keyboardEvents.length === 0) {
      return;
    }
    
    // Send keyboard events to server
    this.socket.emit('keyboard_data', {
      events: this.keyboardEvents,
      timestamp: Date.now()
    });
    
    // Clear keyboard events
    this.keyboardEvents = [];
  }

  /**
   * Start mouse monitoring
   */
  startMouseMonitoring() {
    this.mouseEvents = [];
    this.lastMouseTime = Date.now();
    this.lastMousePosition = { x: 0, y: 0 };
    
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('click', this.handleMouseClick.bind(this));
    
    // Periodically send mouse data
    this.mouseInterval = setInterval(() => {
      if (this.mouseEvents.length > 0) {
        this.sendMouseData();
      }
    }, 10000); // Send every 10 seconds
  }

  /**
   * Handle mouse move
   */
  handleMouseMove(event) {
    // Throttle mouse move events (only record every 200ms)
    const now = Date.now();
    if (now - this.lastMouseTime < 200) {
      return;
    }
    
    const position = {
      x: event.clientX,
      y: event.clientY
    };
    
    const distance = this.calculateDistance(this.lastMousePosition, position);
    const timeDiff = now - this.lastMouseTime;
    const speed = distance / timeDiff;
    
    this.mouseEvents.push({
      type: 'mousemove',
      x: position.x,
      y: position.y,
      distance,
      timeDiff,
      speed,
      timestamp: now
    });
    
    this.lastMouseTime = now;
    this.lastMousePosition = position;
    
    // Limit buffer size
    if (this.mouseEvents.length > 100) {
      this.sendMouseData();
    }
  }

  /**
   * Handle mouse click
   */
  handleMouseClick(event) {
    const now = Date.now();
    this.mouseEvents.push({
      type: 'click',
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      timestamp: now
    });
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }

  /**
   * Send mouse data to server
   */
  sendMouseData() {
    if (!this.socket || !this.connected || this.mouseEvents.length === 0) {
      return;
    }
    
    // Send mouse events to server
    this.socket.emit('mouse_data', {
      events: this.mouseEvents,
      timestamp: Date.now()
    });
    
    // Clear mouse events
    this.mouseEvents = [];
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Send security event to server
   */
  sendSecurityEvent(event_type, details = {}) {
    if (!this.socket || !this.connected || !this.monitoringActive) {
      // Buffer events if not connected
      this.eventBuffer.push({
        event_type,
        details,
        timestamp: Date.now()
      });
      
      return;
    }
    
    // Send any buffered events first
    if (this.eventBuffer.length > 0) {
      this.eventBuffer.forEach(event => {
        this.socket.emit('security_event', event);
      });
      this.eventBuffer = [];
    }
    
    // Send current event
    this.socket.emit('security_event', {
      event_type,
      details,
      timestamp: Date.now()
    });
  }

  /**
   * Clean up and disconnect
   */
  cleanup() {
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.keyboardInterval) {
      clearInterval(this.keyboardInterval);
    }
    
    if (this.mouseInterval) {
      clearInterval(this.mouseInterval);
    }
    
    // Send any pending data
    if (this.keyboardEvents.length > 0) {
      this.sendKeyboardData();
    }
    
    if (this.mouseEvents.length > 0) {
      this.sendMouseData();
    }
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    this.monitoringActive = false;
    this.monitorId = null;
    this.connectionDetails = null;
    
    console.log('Security monitoring cleaned up');
  }
}

// Export as singleton
export default new ExamSecurityMonitor();
```

## Step 2: Backend Integration

### Starting a Monitoring Session

When a student starts an exam, you need to make an API call to create a monitoring session:

```javascript
import axios from 'axios';
import securityMonitor from './examSecurityMonitor';

async function startExam(examId, authToken) {
  try {
    // 1. Request to start monitoring session
    const response = await axios.post(
      `/api/exam-attendance/${examId}/start-monitoring`,
      {
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browserFingerprint: {} // Optional additional data
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 2. Extract connection details from response
    const { connection } = response.data;
    
    // 3. Initialize security monitoring (this will automatically enter fullscreen)
    const result = await securityMonitor.initializeMonitoring(
      connection,
      examId,
      getUserId() // Implement this function to get current user ID
    );
    
    if (!result.success) {
      console.error('Failed to initialize security monitoring:', result.error);
      return false;
    }
    
    // 4. Show success message to user
    console.log('Exam started successfully in secure mode');
    
    return true;
  } catch (error) {
    console.error('Error starting exam monitoring:', error);
    return false;
  }
}
```
    const response = await axios.post(
      `/api/exam-attendance/${examId}/start-monitoring`,
      {
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browserFingerprint: {} // Optional additional data
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 2. Extract connection details from response
    const { connection } = response.data;
    
    // 3. Initialize security monitoring
    const result = await securityMonitor.initializeMonitoring(
      connection,
      examId,
      getUserId() // Implement this function to get current user ID
    );
    
    if (!result.success) {
      console.error('Failed to initialize security monitoring:', result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error starting exam monitoring:', error);
    return false;
  }
}
```

### Implementing Security Alert UI

Create a component to display security alerts to the user:

```jsx
// React component example
function SecurityAlertComponent() {
  const [alerts, setAlerts] = useState([]);
  
  useEffect(() => {
    // Listen for security alerts
    const handleSecurityAlert = (event) => {
      const { title, message, isError } = event.detail;
      
      setAlerts(prevAlerts => [
        ...prevAlerts,
        { id: Date.now(), title, message, isError }
      ]);
      
      // Auto-dismiss non-error alerts after 10 seconds
      if (!isError) {
        setTimeout(() => {
          setAlerts(prevAlerts => 
            prevAlerts.filter(alert => alert.id !== Date.now())
          );
        }, 10000);
      }
    };
    
    document.addEventListener('securityAlert', handleSecurityAlert);
    
    return () => {
      document.removeEventListener('securityAlert', handleSecurityAlert);
    };
  }, []);
  
  return (
    <div className="security-alerts-container">
      {alerts.map(alert => (
        <div 
          key={alert.id} 
          className={`security-alert ${alert.isError ? 'error' : 'warning'}`}
        >
          <h4>{alert.title}</h4>
          <p>{alert.message}</p>
          <button onClick={() => setAlerts(alerts.filter(a => a.id !== alert.id))}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Step 3: Integration Points

### Main Exam Component

```jsx
// ExamComponent.jsx
import React, { useEffect, useState } from 'react';
import securityMonitor from './examSecurityMonitor';
import SecurityAlertComponent from './SecurityAlertComponent';

function ExamComponent({ examId, authToken }) {
  const [isMonitoringActive, setMonitoringActive] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  useEffect(() => {
    // Listen for fullscreen status changes
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement ||
                               document.msFullscreenElement;
      setIsFullscreen(!!fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  const handleStartExam = async () => {
    // Start security monitoring which will automatically enter fullscreen
    const success = await startExam(examId, authToken);
    
    if (success) {
      setMonitoringActive(true);
      setExamStarted(true);
    } else {
      alert('Failed to initialize secure exam environment. Please try again.');
    }
  };
  
  // Clean up monitoring when component unmounts
  useEffect(() => {
    return () => {
      securityMonitor.cleanup();
    };
  }, []);
  
  return (
    <div className="exam-container">
      {/* Security alert component */}
      <SecurityAlertComponent />
      
      {!examStarted ? (
        <div className="exam-start-screen">
          <h2>🔒 Secure Exam Environment</h2>
          <div className="security-notice">
            <p><strong>⚠️ Security Notice:</strong></p>
            <ul>
              <li>Your browser will be validated for security</li>
              <li>The exam will automatically enter fullscreen mode</li>
              <li>All activities are monitored during the exam</li>
              <li>Tab switching and copy/paste are disabled</li>
              <li>Right-click and developer tools are blocked</li>
            </ul>
          </div>
          
          <button 
            onClick={handleStartExam}
            className="start-exam-button"
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Start Secure Exam
          </button>
        </div>
      ) : (
        <div className="exam-content">
          {/* Security status indicator */}
          <div className="security-status" style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            padding: '5px 10px',
            backgroundColor: isMonitoringActive && isFullscreen ? '#4CAF50' : '#ff9800',
            color: 'white',
            fontSize: '14px',
            borderRadius: '4px',
            zIndex: 9999
          }}>
            {isMonitoringActive && isFullscreen ? (
              <span>🔒 Secure Mode Active</span>
            ) : (
              <span>⚠️ Security Setup in Progress</span>
            )}
          </div>
          
          {/* Exam questions and content */}
          <div className="exam-questions">
            <h3>Exam Questions</h3>
            {/* Your exam UI here */}
            <p>Exam content will be displayed here...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExamComponent;
```

## Step 4: Handling Security Alerts

When the backend detects suspicious activity, it will send security alerts through the WebSocket connection. The frontend should display these alerts to the user and take appropriate actions based on the severity.

### Alert Types

1. **Warning Alerts**: Informational alerts about potential issues
2. **Error Alerts**: Critical security violations that may lead to exam termination
3. **Termination Alerts**: Alerts that notify the user that their exam has been terminated

### CSS for Security Alerts

```css
/* SecurityAlerts.css */
.security-alerts-container {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 350px;
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
}

.security-alert {
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.security-alert.warning {
  background-color: #fff3cd;
  border-left: 5px solid #ffc107;
  color: #856404;
}

.security-alert.error {
  background-color: #f8d7da;
  border-left: 5px solid #dc3545;
  color: #721c24;
}

.security-alert h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.security-alert button {
  float: right;
  padding: 5px 10px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 3px;
  cursor: pointer;
}

.security-status {
  padding: 10px;
  text-align: center;
  font-weight: bold;
  background-color: #f8f9fa;
  border-radius: 5px;
  margin-bottom: 20px;
}

.status-active {
  color: #28a745;
}

.status-inactive {
  color: #dc3545;
}
```

## Step 5: Automatic Full-Screen Mode Management

The security monitoring system automatically handles fullscreen mode without requiring user interaction. Here's how it works:

```javascript
// FullScreenManager.js
class FullScreenManager {
  constructor() {
    this.isFullScreen = false;
    this.setupListeners();
  }
  
  setupListeners() {
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
  }
  
  handleFullscreenChange() {
    this.isFullScreen = !!document.fullscreenElement || 
                        !!document.webkitFullscreenElement || 
                        !!document.mozFullScreenElement ||
                        !!document.msFullscreenElement;
                        
    // Dispatch event for other components
    const event = new CustomEvent('fullscreenStatusChange', {
      detail: { isFullScreen: this.isFullScreen }
    });
    document.dispatchEvent(event);
    
    // If user exits fullscreen during exam, attempt to re-enter
    if (!this.isFullScreen && this.examInProgress) {
      setTimeout(() => {
        this.enterFullScreen();
      }, 1000);
    }
  }
  
  // Automatic fullscreen entry
  async enterFullScreen(element = document.documentElement) {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.error('Fullscreen entry failed:', error);
      return false;
    }
  }
  
  exitFullScreen() {
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
  
  // Set exam status to control automatic re-entry
  setExamInProgress(inProgress) {
    this.examInProgress = inProgress;
  }
}

export default new FullScreenManager();
```

### Key Features:

1. **Automatic Entry**: Fullscreen mode is entered automatically when security monitoring starts
2. **Auto Re-entry**: If user exits fullscreen during exam, system attempts to re-enter automatically
3. **Cross-browser Support**: Works with all major browsers (Chrome, Firefox, Safari, Edge)
4. **No User Interaction Required**: No popups or manual steps needed
5. **Security Integration**: Fully integrated with the security monitoring system
    if (this.isFullScreen) {
      this.exitFullScreen();
    } else {
      this.enterFullScreen(element);
    }
}

export default new FullScreenManager();
```

## Step 6: Security Event Breakdown

Here's a breakdown of all the security events that are monitored and sent to the backend:

| Event Type | Description | Risk Level |
|------------|-------------|------------|
| `visibilitychange` | Tab switching or hiding | High |
| `blur` | Window lost focus | Medium |
| `focus` | Window gained focus | Low |
| `fullscreenchange` | Fullscreen mode changed | Medium |
| `contextmenu` | Right-click menu accessed | Medium |
| `copy` | Copy attempt | High |
| `cut` | Cut attempt | High |
| `paste` | Paste attempt | High |
| `resize` | Browser window resized | Low |
| `beforeunload` | Page navigation attempt | Medium |
| `devtools_detected` | Developer tools opened | Very High |
| `console_log` | Console usage detected | High |
| `debugger_detected` | Debugger usage detected | Very High |
| `prohibited_key` | Prohibited key combination used | High |
| `keyboard_data` | Keyboard usage patterns | Varies |
| `mouse_data` | Mouse movement patterns | Varies |

## Troubleshooting

### Common Issues and Solutions

1. **Connection Failed**
   - Check if the WebSocket server is running
   - Verify that your server is returning the correct connection details
   - Ensure CORS is properly configured on the backend

2. **Browser Validation Failed**
   - Check browser compatibility (WebSocket is supported in all modern browsers)
   - Some browser extensions may interfere with validation
   - Private/Incognito mode may affect some validation checks

3. **Events Not Being Received**
   - Verify that the socket connection is active
   - Check for network issues or firewalls
   - Ensure the correct event names are being used

4. **Performance Issues**
   - Reduce the frequency of mouse event tracking
   - Increase the interval for sending batched events
   - Optimize the browser validation process

## Automatic Fullscreen Features

### 🔒 **Seamless Security Integration**

The system now provides **automatic fullscreen functionality** with the following features:

1. **No User Interaction Required**: 
   - Fullscreen mode is entered automatically when the exam starts
   - No popups, buttons, or manual steps needed
   - Seamless transition to secure mode

2. **Intelligent Re-entry**:
   - If user accidentally exits fullscreen (e.g., pressing Escape), system automatically re-enters
   - Warning messages notify users about security violations  
   - Configurable delay before re-entry attempt

3. **Cross-Browser Compatibility**:
   - Works on Chrome, Firefox, Safari, Edge
   - Handles different browser prefixes automatically
   - Fallback mechanisms for unsupported browsers

4. **Security Monitoring Integration**:
   - Fullscreen changes are logged as security events
   - Automatic attempts to exit fullscreen are flagged
   - Admin dashboard shows fullscreen violation statistics

### Implementation Notes:

- The `F11` key is blocked to prevent manual fullscreen toggle
- System handles fullscreen programmatically through JavaScript APIs
- Exam automatically exits fullscreen when completed
- All fullscreen events are logged for security analysis

---

## Conclusion

This guide provides a comprehensive implementation of the security monitoring system for frontend developers. The code includes:

1. Complete WebSocket connection handling
2. Browser validation for security checks
3. Comprehensive event monitoring (keyboard, mouse, UI events)
4. Security alert display and management
5. Full-screen mode support

By following this guide, frontend developers can ensure their application properly integrates with the backend security monitoring system, sending all necessary client-side events for proper exam security.

All events are automatically logged, processed, and analyzed by the backend to detect potential cheating attempts and ensure exam integrity.
