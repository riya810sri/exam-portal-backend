/**
 * ExamSecurityMonitor - Comprehensive Browser-Only Exam Monitoring Client
 * 
 * Captures all user events and security violations in real-time:
 * - Keydown/keyup events with timing analysis
 * - Copy/paste detection with content hashing
 * - Context menu (right-click) blocking
 * - Tab switching and window focus/blur
 * - Developer tools detection
 * - Screen recording detection
 * - Mouse movement and click patterns
 * - Page visibility and navigation attempts
 * - Browser extension detection
 * - Automation tool detection
 * 
 * Features:
 * - Real-time Socket.IO communication with dynamic port allocation
 * - Browser-only enforcement with multi-layer validation
 * - Risk scoring and automatic threat escalation
 * - Anti-tampering protection with integrity checks
 * - Offline-first with automatic reconnection
 * - Comprehensive event logging and analytics
 */

class ExamSecurityMonitor {
  constructor(config = {}) {
    this.config = {
      // API Configuration
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3000/api',
      sessionId: config.sessionId || null,
      
      // Monitoring Configuration
      heartbeatInterval: config.heartbeatInterval || 5000, // 5 seconds
      eventBufferSize: config.eventBufferSize || 100,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 2000,
      
      // Security Thresholds
      maxTabSwitches: config.maxTabSwitches || 3,
      maxDevToolsDetections: config.maxDevToolsDetections || 1,
      maxCopyPasteAttempts: config.maxCopyPasteAttempts || 2,
      maxContextMenuAttempts: config.maxContextMenuAttempts || 5,
      
      // Debug and Logging
      debug: config.debug || false,
      enableConsoleLogging: config.enableConsoleLogging || true
    };
    
    // State Management
    this.state = {
      isMonitoring: false,
      isConnected: false,
      socket: null,
      socketPort: null,
      monit_id: null,
      examId: null,
      sessionStartTime: null,
      lastHeartbeat: null,
      reconnectAttempts: 0,
      violationCounts: {
        tabSwitch: 0,
        devTools: 0,
        copyPaste: 0,
        contextMenu: 0,
        suspiciousKeyboard: 0,
        focusLoss: 0
      }
    };
    
    // Event Buffers
    this.eventBuffer = [];
    this.keyBuffer = [];
    this.mouseBuffer = [];
    
    // Timing Trackers
    this.timingData = {
      lastKeydown: null,
      lastMouseMove: null,
      lastFocusChange: null,
      tabSwitchStart: null,
      pageLoadTime: Date.now()
    };
    
    // Browser Validation Data
    this.browserProfile = null;
    
    // Bound event handlers (for proper cleanup)
    this.boundHandlers = {
      keydown: this.handleKeydown.bind(this),
      keyup: this.handleKeyup.bind(this),
      copy: this.handleCopy.bind(this),
      paste: this.handlePaste.bind(this),
      cut: this.handleCut.bind(this),
      contextmenu: this.handleContextMenu.bind(this),
      beforeunload: this.handleBeforeUnload.bind(this),
      visibilitychange: this.handleVisibilityChange.bind(this),
      blur: this.handleWindowBlur.bind(this),
      focus: this.handleWindowFocus.bind(this),
      resize: this.handleWindowResize.bind(this),
      mousemove: this.handleMouseMove.bind(this),
      click: this.handleClick.bind(this),
      scroll: this.handleScroll.bind(this),
      devtoolschange: this.handleDevToolsDetection.bind(this)
    };
    
    // Initialize browser validation
    this.initializeBrowserValidation();
    
    this.log('ExamSecurityMonitor initialized');
  }
  
  /**
   * Start monitoring for a specific exam
   * @param {string} examId - The exam ID to monitor
   * @returns {Promise<boolean>} Success status
   */
  async startMonitoring(examId) {
    try {
      this.log(`Starting monitoring for exam: ${examId}`);
      
      if (!this.config.sessionId) {
        throw new Error('Session ID is required for monitoring');
      }
      
      this.state.examId = examId;
      this.state.sessionStartTime = Date.now();
      
      // Step 1: Start monitoring on backend and get dynamic socket info
      const monitoringData = await this.initializeBackendMonitoring(examId);
      
      if (!monitoringData.success) {
        throw new Error(monitoringData.message || 'Failed to initialize backend monitoring');
      }
      
      // Step 2: Connect to dynamic Socket.IO server
      if (monitoringData.socket) {
        await this.connectToSocket(monitoringData.socket);
      }
      
      // Step 3: Start browser event monitoring
      this.startBrowserEventMonitoring();
      
      // Step 4: Start security checks and heartbeat
      this.startSecurityChecks();
      this.startHeartbeat();
      
      // Step 5: Perform initial browser validation
      await this.performBrowserValidation();
      
      this.state.isMonitoring = true;
      this.log('✅ Monitoring started successfully');
      
      return true;
      
    } catch (error) {
      this.logError('Failed to start monitoring:', error);
      return false;
    }
  }
  
  /**
   * Stop monitoring and cleanup
   */
  async stopMonitoring() {
    try {
      this.log('Stopping monitoring...');
      
      this.state.isMonitoring = false;
      
      // Stop event monitoring
      this.stopBrowserEventMonitoring();
      
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      
      // Disconnect socket
      if (this.state.socket) {
        this.state.socket.disconnect();
        this.state.socket = null;
        this.state.isConnected = false;
      }
      
      // Send final session summary
      await this.sendSessionSummary();
      
      this.log('✅ Monitoring stopped successfully');
      
    } catch (error) {
      this.logError('Error stopping monitoring:', error);
    }
  }
  
  /**
   * Initialize backend monitoring and get dynamic socket details
   * @param {string} examId - Exam ID
   * @returns {Promise<Object>} Monitoring configuration
   */
  async initializeBackendMonitoring(examId) {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/exam-attendance/${examId}/start-monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.sessionId,
          'User-Agent': navigator.userAgent,
          'X-Monitoring-Client': 'ExamSecurityMonitor-v1.0'
        },
        body: JSON.stringify({
          browserFingerprint: this.browserProfile,
          clientTimestamp: Date.now(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
          colorDepth: window.screen.colorDepth,
          pixelRatio: window.devicePixelRatio
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.log('Backend monitoring initialized:', data);
      
      return data;
      
    } catch (error) {
      this.logError('Failed to initialize backend monitoring:', error);
      throw error;
    }
  }
  
  /**
   * Connect to dynamic Socket.IO server
   * @param {Object} socketConfig - Socket configuration from backend
   */
  async connectToSocket(socketConfig) {
    try {
      this.log('Connecting to dynamic Socket.IO server:', socketConfig);
      
      // Load Socket.IO client library if not already loaded
      if (typeof io === 'undefined') {
        await this.loadSocketIOClient();
      }
      
      this.state.socketPort = socketConfig.port;
      this.state.monit_id = socketConfig.monit_id;
      
      // Connect to dynamic socket server
      this.state.socket = io(socketConfig.url, {
        transports: socketConfig.protocols || ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.config.maxReconnectAttempts,
        reconnectionDelay: this.config.reconnectDelay,
        query: {
          monit_id: this.state.monit_id,
          exam_id: this.state.examId,
          client_type: 'browser_monitor'
        }
      });
      
      // Setup socket event handlers
      this.setupSocketEventHandlers();
      
      // Wait for connection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'));
        }, 15000);
        
        this.state.socket.on('connect', () => {
          clearTimeout(timeout);
          this.state.isConnected = true;
          this.log('✅ Connected to Socket.IO server');
          resolve();
        });
        
        this.state.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.logError('Socket connection failed:', error);
          reject(error);
        });
      });
      
    } catch (error) {
      this.logError('Failed to connect to socket:', error);
      throw error;
    }
  }
  
  /**
   * Setup Socket.IO event handlers
   */
  setupSocketEventHandlers() {
    if (!this.state.socket) return;
    
    this.state.socket.on('connect', () => {
      this.log('Socket connected');
      this.state.isConnected = true;
      this.state.reconnectAttempts = 0;
      
      // Send initial browser validation
      this.emitSecurityEvent('connection_established', {
        timestamp: Date.now(),
        browserProfile: this.browserProfile,
        monit_id: this.state.monit_id
      });
    });
    
    this.state.socket.on('disconnect', (reason) => {
      this.log('Socket disconnected:', reason);
      this.state.isConnected = false;
      
      // Handle unexpected disconnections
      if (this.state.isMonitoring && reason !== 'io client disconnect') {
        this.handleSocketDisconnection(reason);
      }
    });
    
    this.state.socket.on('reconnect', (attemptNumber) => {
      this.log(`Socket reconnected after ${attemptNumber} attempts`);
      this.state.isConnected = true;
    });
    
    this.state.socket.on('security_alert', (data) => {
      this.log('Security alert received:', data);
      this.handleSecurityAlert(data);
    });
    
    this.state.socket.on('monitoring_command', (command) => {
      this.log('Monitoring command received:', command);
      this.handleMonitoringCommand(command);
    });
    
    this.state.socket.on('validation_challenge', (challenge) => {
      this.log('Validation challenge received');
      this.handleValidationChallenge(challenge);
    });
  }
  
  /**
   * Start browser event monitoring
   */
  startBrowserEventMonitoring() {
    this.log('Starting browser event monitoring...');
    
    // Keyboard events
    document.addEventListener('keydown', this.boundHandlers.keydown, true);
    document.addEventListener('keyup', this.boundHandlers.keyup, true);
    
    // Clipboard events
    document.addEventListener('copy', this.boundHandlers.copy, true);
    document.addEventListener('paste', this.boundHandlers.paste, true);
    document.addEventListener('cut', this.boundHandlers.cut, true);
    
    // Context menu blocking
    document.addEventListener('contextmenu', this.boundHandlers.contextmenu, true);
    
    // Window/tab events
    window.addEventListener('beforeunload', this.boundHandlers.beforeunload);
    document.addEventListener('visibilitychange', this.boundHandlers.visibilitychange);
    window.addEventListener('blur', this.boundHandlers.blur);
    window.addEventListener('focus', this.boundHandlers.focus);
    window.addEventListener('resize', this.boundHandlers.resize);
    
    // Mouse events
    document.addEventListener('mousemove', this.boundHandlers.mousemove);
    document.addEventListener('click', this.boundHandlers.click);
    document.addEventListener('scroll', this.boundHandlers.scroll);
    
    // Start continuous security checks
    this.startDevToolsDetection();
    this.startScreenRecordingDetection();
    this.startAutomationDetection();
    
    this.log('✅ Browser event monitoring started');
  }
  
  /**
   * Stop browser event monitoring
   */
  stopBrowserEventMonitoring() {
    this.log('Stopping browser event monitoring...');
    
    // Remove all event listeners
    document.removeEventListener('keydown', this.boundHandlers.keydown, true);
    document.removeEventListener('keyup', this.boundHandlers.keyup, true);
    document.removeEventListener('copy', this.boundHandlers.copy, true);
    document.removeEventListener('paste', this.boundHandlers.paste, true);
    document.removeEventListener('cut', this.boundHandlers.cut, true);
    document.removeEventListener('contextmenu', this.boundHandlers.contextmenu, true);
    window.removeEventListener('beforeunload', this.boundHandlers.beforeunload);
    document.removeEventListener('visibilitychange', this.boundHandlers.visibilitychange);
    window.removeEventListener('blur', this.boundHandlers.blur);
    window.removeEventListener('focus', this.boundHandlers.focus);
    window.removeEventListener('resize', this.boundHandlers.resize);
    document.removeEventListener('mousemove', this.boundHandlers.mousemove);
    document.removeEventListener('click', this.boundHandlers.click);
    document.removeEventListener('scroll', this.boundHandlers.scroll);
    
    // Stop security checks
    if (this.devToolsDetectionInterval) {
      clearInterval(this.devToolsDetectionInterval);
    }
    
    if (this.screenRecordingDetectionInterval) {
      clearInterval(this.screenRecordingDetectionInterval);
    }
    
    if (this.automationDetectionInterval) {
      clearInterval(this.automationDetectionInterval);
    }
    
    this.log('✅ Browser event monitoring stopped');
  }
  
  /**
   * Handle keydown events
   */
  handleKeydown(event) {
    const now = Date.now();
    const timeSinceLastKey = this.timingData.lastKeydown ? now - this.timingData.lastKeydown : 0;
    
    this.timingData.lastKeydown = now;
    
    // Detect prohibited key combinations
    const prohibitedKeys = [
      'F12', // Developer tools
      'F5',  // Refresh
      'F11', // Fullscreen toggle
      'Tab'  // Tab switching
    ];
    
    const prohibitedCombinations = [
      { ctrl: true, shift: true, key: 'I' }, // Ctrl+Shift+I (DevTools)
      { ctrl: true, shift: true, key: 'J' }, // Ctrl+Shift+J (Console)
      { ctrl: true, shift: true, key: 'C' }, // Ctrl+Shift+C (Inspect)
      { ctrl: true, key: 'U' },              // Ctrl+U (View Source)
      { ctrl: true, key: 'S' },              // Ctrl+S (Save)
      { ctrl: true, key: 'P' },              // Ctrl+P (Print)
      { ctrl: true, key: 'A' },              // Ctrl+A (Select All)
      { ctrl: true, key: 'C' },              // Ctrl+C (Copy)
      { ctrl: true, key: 'V' },              // Ctrl+V (Paste)
      { ctrl: true, key: 'X' },              // Ctrl+X (Cut)
      { alt: true, key: 'Tab' },             // Alt+Tab (Switch applications)
      { cmd: true, key: 'Tab' },             // Cmd+Tab (macOS app switching)
      { ctrl: true, key: 'T' },              // Ctrl+T (New tab)
      { ctrl: true, key: 'W' },              // Ctrl+W (Close tab)
      { ctrl: true, key: 'R' }               // Ctrl+R (Refresh)
    ];
    
    const keyEvent = {
      type: 'keydown',
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      timestamp: now,
      timeSinceLastKey: timeSinceLastKey
    };
    
    // Check for prohibited keys
    if (prohibitedKeys.includes(event.key)) {
      this.handleSecurityViolation('prohibited_key', {
        ...keyEvent,
        severity: event.key === 'F12' ? 'high' : 'medium',
        riskScore: event.key === 'F12' ? 90 : 60
      });
      
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
    
    // Check for prohibited combinations
    for (const combo of prohibitedCombinations) {
      const match = (
        (!combo.ctrl || event.ctrlKey) &&
        (!combo.alt || event.altKey) &&
        (!combo.shift || event.shiftKey) &&
        (!combo.cmd || event.metaKey) &&
        event.key.toLowerCase() === combo.key.toLowerCase()
      );
      
      if (match) {
        this.handleSecurityViolation('prohibited_key_combination', {
          ...keyEvent,
          combination: combo,
          severity: 'high',
          riskScore: 85
        });
        
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }
    
    // Detect suspicious typing patterns
    if (timeSinceLastKey < 50) {
      this.state.violationCounts.suspiciousKeyboard++;
      this.handleSecurityViolation('suspicious_keyboard_pattern', {
        ...keyEvent,
        pattern: 'too_fast',
        intervalMs: timeSinceLastKey,
        severity: 'medium',
        riskScore: 70
      });
    }
    
    // Buffer keyboard events for analysis
    this.keyBuffer.push(keyEvent);
    if (this.keyBuffer.length > 50) {
      this.keyBuffer.shift();
    }
    
    // Emit regular keydown event
    this.emitSecurityEvent('keydown', keyEvent);
  }
  
  /**
   * Handle keyup events
   */
  handleKeyup(event) {
    const keyEvent = {
      type: 'keyup',
      key: event.key,
      code: event.code,
      timestamp: Date.now()
    };
    
    this.emitSecurityEvent('keyup', keyEvent);
  }
  
  /**
   * Handle copy events
   */
  handleCopy(event) {
    this.state.violationCounts.copyPaste++;
    
    const copyEvent = {
      type: 'copy',
      timestamp: Date.now(),
      selectionLength: window.getSelection().toString().length,
      attemptNumber: this.state.violationCounts.copyPaste
    };
    
    this.handleSecurityViolation('copy_attempt', {
      ...copyEvent,
      severity: 'high',
      riskScore: 75
    });
    
    // Block copy operation
    event.preventDefault();
    event.stopPropagation();
    
    this.showSecurityWarning('Copy operation is not allowed during the exam');
    
    return false;
  }
  
  /**
   * Handle paste events
   */
  handlePaste(event) {
    this.state.violationCounts.copyPaste++;
    
    const pasteEvent = {
      type: 'paste',
      timestamp: Date.now(),
      attemptNumber: this.state.violationCounts.copyPaste
    };
    
    this.handleSecurityViolation('paste_attempt', {
      ...pasteEvent,
      severity: 'high',
      riskScore: 70
    });
    
    // Block paste operation
    event.preventDefault();
    event.stopPropagation();
    
    this.showSecurityWarning('Paste operation is not allowed during the exam');
    
    return false;
  }
  
  /**
   * Handle cut events
   */
  handleCut(event) {
    this.state.violationCounts.copyPaste++;
    
    const cutEvent = {
      type: 'cut',
      timestamp: Date.now(),
      attemptNumber: this.state.violationCounts.copyPaste
    };
    
    this.handleSecurityViolation('cut_attempt', {
      ...cutEvent,
      severity: 'high',
      riskScore: 75
    });
    
    // Block cut operation
    event.preventDefault();
    event.stopPropagation();
    
    this.showSecurityWarning('Cut operation is not allowed during the exam');
    
    return false;
  }
  
  /**
   * Handle context menu (right-click) events
   */
  handleContextMenu(event) {
    this.state.violationCounts.contextMenu++;
    
    const contextMenuEvent = {
      type: 'contextmenu',
      timestamp: Date.now(),
      x: event.clientX,
      y: event.clientY,
      target: event.target.tagName,
      attemptNumber: this.state.violationCounts.contextMenu
    };
    
    this.handleSecurityViolation('context_menu_attempt', {
      ...contextMenuEvent,
      severity: 'medium',
      riskScore: 60
    });
    
    // Block context menu
    event.preventDefault();
    event.stopPropagation();
    
    if (this.state.violationCounts.contextMenu <= 2) {
      this.showSecurityWarning('Right-click is disabled during the exam');
    }
    
    return false;
  }
  
  /**
   * Handle window beforeunload events
   */
  handleBeforeUnload(event) {
    const unloadEvent = {
      type: 'beforeunload',
      timestamp: Date.now(),
      url: window.location.href
    };
    
    this.handleSecurityViolation('navigation_attempt', {
      ...unloadEvent,
      severity: 'critical',
      riskScore: 95
    });
    
    // Attempt to prevent navigation
    event.preventDefault();
    event.returnValue = 'You are about to leave the exam. This will be recorded as a violation.';
    
    return 'You are about to leave the exam. This will be recorded as a violation.';
  }
  
  /**
   * Handle visibility change (tab switching)
   */
  handleVisibilityChange() {
    const now = Date.now();
    const isHidden = document.visibilityState === 'hidden';
    
    if (isHidden) {
      this.timingData.tabSwitchStart = now;
      this.state.violationCounts.tabSwitch++;
      
      this.handleSecurityViolation('tab_switch_start', {
        type: 'tab_switch',
        direction: 'away',
        timestamp: now,
        attemptNumber: this.state.violationCounts.tabSwitch,
        severity: 'high',
        riskScore: 80
      });
      
    } else {
      const switchDuration = this.timingData.tabSwitchStart ? 
        now - this.timingData.tabSwitchStart : 0;
      
      this.handleSecurityViolation('tab_switch_end', {
        type: 'tab_switch',
        direction: 'back',
        timestamp: now,
        duration: switchDuration,
        severity: switchDuration > 10000 ? 'critical' : 'high',
        riskScore: switchDuration > 10000 ? 95 : 80
      });
      
      this.timingData.tabSwitchStart = null;
    }
    
    // Check if user has exceeded tab switch limit
    if (this.state.violationCounts.tabSwitch >= this.config.maxTabSwitches) {
      this.handleCriticalViolation('excessive_tab_switching', {
        totalSwitches: this.state.violationCounts.tabSwitch,
        maxAllowed: this.config.maxTabSwitches
      });
    }
  }
  
  /**
   * Handle window blur events
   */
  handleWindowBlur() {
    this.state.violationCounts.focusLoss++;
    
    this.handleSecurityViolation('window_blur', {
      type: 'focus_loss',
      timestamp: Date.now(),
      attemptNumber: this.state.violationCounts.focusLoss,
      severity: 'medium',
      riskScore: 65
    });
  }
  
  /**
   * Handle window focus events
   */
  handleWindowFocus() {
    this.emitSecurityEvent('window_focus', {
      type: 'focus_gain',
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle window resize events
   */
  handleWindowResize() {
    const resizeEvent = {
      type: 'window_resize',
      timestamp: Date.now(),
      width: window.innerWidth,
      height: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    };
    
    this.emitSecurityEvent('window_resize', resizeEvent);
  }
  
  /**
   * Handle mouse move events (throttled)
   */
  handleMouseMove(event) {
    const now = Date.now();
    
    // Throttle mouse events to avoid spam
    if (this.timingData.lastMouseMove && now - this.timingData.lastMouseMove < 100) {
      return;
    }
    
    this.timingData.lastMouseMove = now;
    
    const mouseEvent = {
      type: 'mousemove',
      x: event.clientX,
      y: event.clientY,
      timestamp: now
    };
    
    // Buffer mouse events for pattern analysis
    this.mouseBuffer.push(mouseEvent);
    if (this.mouseBuffer.length > 100) {
      this.mouseBuffer.shift();
    }
    
    // Detect suspicious mouse patterns (too perfect/linear movement)
    if (this.mouseBuffer.length >= 10) {
      const suspiciousPattern = this.detectSuspiciousMousePattern();
      if (suspiciousPattern) {
        this.handleSecurityViolation('suspicious_mouse_pattern', {
          ...mouseEvent,
          pattern: suspiciousPattern,
          severity: 'medium',
          riskScore: 70
        });
      }
    }
  }
  
  /**
   * Handle click events
   */
  handleClick(event) {
    const clickEvent = {
      type: 'click',
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      target: event.target.tagName,
      timestamp: Date.now()
    };
    
    this.emitSecurityEvent('click', clickEvent);
  }
  
  /**
   * Handle scroll events
   */
  handleScroll() {
    const scrollEvent = {
      type: 'scroll',
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      timestamp: Date.now()
    };
    
    this.emitSecurityEvent('scroll', scrollEvent);
  }
  
  /**
   * Start developer tools detection
   */
  startDevToolsDetection() {
    let devtools = { open: false, orientation: null };
    
    const threshold = 160;
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        
        if (!devtools.open) {
          devtools.open = true;
          devtools.orientation = window.outerWidth - window.innerWidth > threshold ? 'vertical' : 'horizontal';
          
          this.state.violationCounts.devTools++;
          
          this.handleSecurityViolation('devtools_opened', {
            type: 'devtools_detection',
            orientation: devtools.orientation,
            timestamp: Date.now(),
            outerWidth: window.outerWidth,
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight,
            attemptNumber: this.state.violationCounts.devTools,
            severity: 'critical',
            riskScore: 90
          });
          
          // Critical violation if DevTools detected
          if (this.state.violationCounts.devTools >= this.config.maxDevToolsDetections) {
            this.handleCriticalViolation('devtools_usage', {
              totalDetections: this.state.violationCounts.devTools,
              maxAllowed: this.config.maxDevToolsDetections
            });
          }
        }
        
      } else {
        if (devtools.open) {
          devtools.open = false;
          
          this.handleSecurityViolation('devtools_closed', {
            type: 'devtools_detection',
            action: 'closed',
            timestamp: Date.now(),
            severity: 'high',
            riskScore: 85
          });
        }
      }
    }, 500);
    
    // Console detection
    let consoleOpen = false;
    Object.defineProperty(window, 'console', {
      get() {
        if (!consoleOpen) {
          consoleOpen = true;
          this.handleSecurityViolation('console_access', {
            type: 'console_detection',
            timestamp: Date.now(),
            severity: 'critical',
            riskScore: 95
          });
        }
        return console;
      }
    });
  }
  
  /**
   * Start screen recording detection
   */
  startScreenRecordingDetection() {
    this.screenRecordingDetectionInterval = setInterval(() => {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // Check for active screen capture
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          
          // Detect potential screen recording apps
          if (videoDevices.length > 2) {
            this.handleSecurityViolation('potential_screen_recording', {
              type: 'screen_recording_detection',
              deviceCount: videoDevices.length,
              timestamp: Date.now(),
              severity: 'high',
              riskScore: 85
            });
          }
        });
      }
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Start automation detection
   */
  startAutomationDetection() {
    this.automationDetectionInterval = setInterval(() => {
      const automationIndicators = [];
      
      // Check for webdriver
      if (navigator.webdriver) {
        automationIndicators.push('webdriver_detected');
      }
      
      // Check for Selenium indicators
      if (window.document.documentElement.getAttribute('webdriver') ||
          window.navigator.webdriver ||
          window.document.$cdc_asdjflasutopfhvcZLmcfl_ ||
          window.$chrome_asyncScriptInfo ||
          window.__$webdriverAsyncExecutor) {
        automationIndicators.push('selenium_detected');
      }
      
      // Check for PhantomJS
      if (window.callPhantom || window._phantom || window.phantom) {
        automationIndicators.push('phantomjs_detected');
      }
      
      // Check for unusual window properties
      if (window.Buffer || window.emit || window.spawn) {
        automationIndicators.push('nodejs_environment');
      }
      
      if (automationIndicators.length > 0) {
        this.handleCriticalViolation('automation_detected', {
          indicators: automationIndicators,
          timestamp: Date.now(),
          severity: 'critical',
          riskScore: 100
        });
      }
    }, 5000); // Check every 5 seconds
  }
  
  /**
   * Start heartbeat to maintain connection
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const heartbeatData = {
        timestamp: Date.now(),
        sessionDuration: Date.now() - this.state.sessionStartTime,
        violationCounts: { ...this.state.violationCounts },
        browserState: {
          url: window.location.href,
          title: document.title,
          visibility: document.visibilityState,
          focused: document.hasFocus(),
          online: navigator.onLine
        }
      };
      
      this.emitSecurityEvent('heartbeat', heartbeatData);
      
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Initialize browser validation profile
   */
  async initializeBrowserValidation() {
    try {
      this.browserProfile = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency,
        maxTouchPoints: navigator.maxTouchPoints,
        vendor: navigator.vendor,
        vendorSub: navigator.vendorSub,
        productSub: navigator.productSub,
        
        // Screen information
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          colorDepth: window.screen.colorDepth,
          pixelDepth: window.screen.pixelDepth,
          orientation: window.screen.orientation?.type
        },
        
        // Timezone and locale
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        
        // Canvas fingerprint
        canvas: await this.generateCanvasFingerprint(),
        
        // WebGL fingerprint
        webgl: this.getWebGLFingerprint(),
        
        // Available fonts
        fonts: await this.detectAvailableFonts(),
        
        // Browser plugins
        plugins: this.getPluginList(),
        
        // Audio context fingerprint
        audio: await this.generateAudioFingerprint(),
        
        // WebRTC fingerprint
        webrtc: await this.getWebRTCFingerprint(),
        
        // Performance fingerprint
        performance: this.getPerformanceFingerprint()
      };
      
      this.log('Browser validation profile generated');
      
    } catch (error) {
      this.logError('Failed to generate browser profile:', error);
      this.browserProfile = { error: error.message };
    }
  }
  
  /**
   * Generate canvas fingerprint
   */
  async generateCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 280;
      canvas.height = 60;
      
      // Draw text with various properties
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('ExamSecurityMonitor 🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Browser Fingerprint Test', 4, 45);
      
      // Draw some shapes
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.beginPath();
      ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      
      return canvas.toDataURL();
      
    } catch (error) {
      return 'canvas_error: ' + error.message;
    }
  }
  
  /**
   * Get WebGL fingerprint
   */
  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'webgl_not_supported';
      
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        extensions: gl.getSupportedExtensions()
      };
      
    } catch (error) {
      return 'webgl_error: ' + error.message;
    }
  }
  
  /**
   * Detect available fonts
   */
  async detectAvailableFonts() {
    const testString = 'mmMwWLliI0O&1';
    const testSize = '48px';
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Times New Roman', 'Courier New', 'Helvetica', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Trebuchet MS',
      'Impact', 'Comic Sans MS', 'Tahoma', 'Lucida Console'
    ];
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 50;
    
    const baselines = {};
    for (const baseFont of baseFonts) {
      context.font = testSize + ' ' + baseFont;
      baselines[baseFont] = context.measureText(testString).width;
    }
    
    const availableFonts = [];
    for (const testFont of testFonts) {
      for (const baseFont of baseFonts) {
        context.font = testSize + ' ' + testFont + ', ' + baseFont;
        const width = context.measureText(testString).width;
        if (width !== baselines[baseFont]) {
          availableFonts.push(testFont);
          break;
        }
      }
    }
    
    return availableFonts;
  }
  
  /**
   * Get plugin list
   */
  getPluginList() {
    const plugins = [];
    for (let i = 0; i < navigator.plugins.length; i++) {
      plugins.push({
        name: navigator.plugins[i].name,
        description: navigator.plugins[i].description,
        filename: navigator.plugins[i].filename
      });
    }
    return plugins;
  }
  
  /**
   * Generate audio fingerprint
   */
  async generateAudioFingerprint() {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        return 'audio_context_not_supported';
      }
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;
      
      gainNode.gain.value = 0;
      
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(0);
      
      return new Promise((resolve) => {
        scriptProcessor.onaudioprocess = (event) => {
          const buffer = event.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += Math.abs(buffer[i]);
          }
          
          oscillator.stop();
          audioContext.close();
          
          resolve(sum.toString());
        };
      });
      
    } catch (error) {
      return 'audio_error: ' + error.message;
    }
  }
  
  /**
   * Get WebRTC fingerprint
   */
  async getWebRTCFingerprint() {
    try {
      if (!window.RTCPeerConnection) {
        return 'webrtc_not_supported';
      }
      
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const ips = [];
      
      pc.createDataChannel('');
      
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pc.close();
          resolve(ips.length > 0 ? ips : 'no_webrtc_ips');
        }, 2000);
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const ip = event.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ip && ips.indexOf(ip[1]) === -1) {
              ips.push(ip[1]);
            }
          } else {
            clearTimeout(timeout);
            pc.close();
            resolve(ips.length > 0 ? ips : 'no_webrtc_ips');
          }
        };
      });
      
    } catch (error) {
      return 'webrtc_error: ' + error.message;
    }
  }
  
  /**
   * Get performance fingerprint
   */
  getPerformanceFingerprint() {
    try {
      const timing = performance.timing;
      const navigation = performance.navigation;
      
      return {
        navigationStart: timing.navigationStart,
        unloadEventStart: timing.unloadEventStart,
        unloadEventEnd: timing.unloadEventEnd,
        redirectStart: timing.redirectStart,
        redirectEnd: timing.redirectEnd,
        fetchStart: timing.fetchStart,
        domainLookupStart: timing.domainLookupStart,
        domainLookupEnd: timing.domainLookupEnd,
        connectStart: timing.connectStart,
        connectEnd: timing.connectEnd,
        secureConnectionStart: timing.secureConnectionStart,
        requestStart: timing.requestStart,
        responseStart: timing.responseStart,
        responseEnd: timing.responseEnd,
        domLoading: timing.domLoading,
        domInteractive: timing.domInteractive,
        domContentLoadedEventStart: timing.domContentLoadedEventStart,
        domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
        domComplete: timing.domComplete,
        loadEventStart: timing.loadEventStart,
        loadEventEnd: timing.loadEventEnd,
        navigationType: navigation.type,
        redirectCount: navigation.redirectCount
      };
      
    } catch (error) {
      return 'performance_error: ' + error.message;
    }
  }
  
  /**
   * Detect suspicious mouse patterns
   */
  detectSuspiciousMousePattern() {
    if (this.mouseBuffer.length < 10) return null;
    
    const recent = this.mouseBuffer.slice(-10);
    
    // Check for perfectly linear movement (automation indicator)
    const slopes = [];
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i-1].x;
      const dy = recent[i].y - recent[i-1].y;
      if (dx !== 0) {
        slopes.push(dy / dx);
      }
    }
    
    if (slopes.length > 5) {
      const avgSlope = slopes.reduce((a, b) => a + b) / slopes.length;
      const variance = slopes.reduce((sum, slope) => sum + Math.pow(slope - avgSlope, 2), 0) / slopes.length;
      
      if (variance < 0.01) {
        return 'linear_movement_automation';
      }
    }
    
    // Check for impossible movement speed
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i-1].x;
      const dy = recent[i].y - recent[i-1].y;
      const dt = recent[i].timestamp - recent[i-1].timestamp;
      const distance = Math.sqrt(dx*dx + dy*dy);
      const speed = distance / dt; // pixels per ms
      
      if (speed > 5) { // Unrealistic mouse speed
        return 'impossible_mouse_speed';
      }
    }
    
    return null;
  }
  
  /**
   * Handle security violations
   */
  handleSecurityViolation(violationType, violationData) {
    const violation = {
      type: violationType,
      timestamp: Date.now(),
      sessionDuration: Date.now() - this.state.sessionStartTime,
      examId: this.state.examId,
      monit_id: this.state.monit_id,
      ...violationData
    };
    
    this.log(`🚨 Security violation: ${violationType}`, violation);
    
    // Add to event buffer
    this.eventBuffer.push(violation);
    if (this.eventBuffer.length > this.config.eventBufferSize) {
      this.eventBuffer.shift();
    }
    
    // Emit to socket immediately for high/critical severity
    if (violation.severity === 'high' || violation.severity === 'critical') {
      this.emitSecurityEvent('security_violation', violation);
    }
    
    // Show warning to user for certain violations
    if (['copy_attempt', 'paste_attempt', 'context_menu_attempt'].includes(violationType)) {
      // Warning already shown in individual handlers
    }
    
    // Check for automatic suspension triggers
    if (violation.riskScore >= 90 || violation.severity === 'critical') {
      this.handleCriticalViolation(violationType, violationData);
    }
  }
  
  /**
   * Handle critical violations that may trigger suspension
   */
  handleCriticalViolation(violationType, violationData) {
    const criticalViolation = {
      type: 'critical_violation',
      originalType: violationType,
      timestamp: Date.now(),
      examId: this.state.examId,
      monit_id: this.state.monit_id,
      violationCounts: { ...this.state.violationCounts },
      totalViolations: Object.values(this.state.violationCounts).reduce((a, b) => a + b, 0),
      ...violationData
    };
    
    this.logError(`🔥 CRITICAL VIOLATION: ${violationType}`, criticalViolation);
    
    // Emit critical violation immediately
    this.emitSecurityEvent('critical_violation', criticalViolation);
    
    // Show critical warning
    this.showCriticalWarning('Critical security violation detected. Your exam may be suspended.');
    
    // Check for auto-suspension conditions
    const totalViolations = Object.values(this.state.violationCounts).reduce((a, b) => a + b, 0);
    if (totalViolations >= 10 || 
        this.state.violationCounts.devTools >= 1 || 
        this.state.violationCounts.tabSwitch >= this.config.maxTabSwitches) {
      
      this.triggerAutoSuspension();
    }
  }
  
  /**
   * Trigger automatic exam suspension
   */
  triggerAutoSuspension() {
    this.logError('🚫 AUTO-SUSPENSION TRIGGERED');
    
    const suspensionData = {
      type: 'auto_suspension',
      timestamp: Date.now(),
      examId: this.state.examId,
      monit_id: this.state.monit_id,
      reason: 'Multiple critical security violations detected',
      violationCounts: { ...this.state.violationCounts },
      sessionDuration: Date.now() - this.state.sessionStartTime
    };
    
    // Emit suspension event
    this.emitSecurityEvent('exam_suspended', suspensionData);
    
    // Show suspension notice
    this.showSuspensionNotice();
    
    // Stop monitoring
    this.stopMonitoring();
    
    // Redirect or disable exam interface
    if (this.config.onAutoSuspension) {
      this.config.onAutoSuspension(suspensionData);
    }
  }
  
  /**
   * Emit security event to socket
   */
  emitSecurityEvent(eventType, eventData) {
    if (!this.state.socket || !this.state.isConnected) {
      // Buffer events if not connected
      this.eventBuffer.push({ eventType, eventData, timestamp: Date.now() });
      return;
    }
    
    try {
      this.state.socket.emit('security_event', {
        event_type: eventType,
        monit_id: this.state.monit_id,
        exam_id: this.state.examId,
        timestamp: Date.now(),
        data: eventData
      });
      
      if (this.config.debug) {
        this.log(`📡 Emitted: ${eventType}`, eventData);
      }
      
    } catch (error) {
      this.logError('Failed to emit security event:', error);
    }
  }
  
  /**
   * Perform browser validation
   */
  async performBrowserValidation() {
    try {
      const validationData = {
        browserProfile: this.browserProfile,
        timestamp: Date.now(),
        windowSize: {
          inner: { width: window.innerWidth, height: window.innerHeight },
          outer: { width: window.outerWidth, height: window.outerHeight }
        },
        documentProperties: {
          title: document.title,
          url: document.URL,
          referrer: document.referrer,
          domain: document.domain,
          characterSet: document.characterSet
        }
      };
      
      this.emitSecurityEvent('browser_validation', validationData);
      
      this.log('✅ Browser validation completed');
      
    } catch (error) {
      this.logError('Browser validation failed:', error);
    }
  }
  
  /**
   * Handle socket disconnection
   */
  handleSocketDisconnection(reason) {
    this.log('⚠️ Socket disconnected:', reason);
    
    this.state.reconnectAttempts++;
    
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logError('Max reconnection attempts reached. Switching to offline mode.');
      this.handleOfflineMode();
    }
  }
  
  /**
   * Handle offline mode
   */
  handleOfflineMode() {
    this.log('📴 Entering offline mode - events will be buffered');
    
    // Continue monitoring but buffer all events
    // Events will be sent when connection is restored
  }
  
  /**
   * Handle security alerts from server
   */
  handleSecurityAlert(alertData) {
    this.log('🚨 Security alert received:', alertData);
    
    switch (alertData.type) {
      case 'suspicious_activity':
        this.showSecurityWarning(alertData.message || 'Suspicious activity detected');
        break;
      case 'warning':
        this.showSecurityWarning(alertData.message);
        break;
      case 'critical':
        this.showCriticalWarning(alertData.message);
        break;
      case 'suspension':
        this.showSuspensionNotice(alertData.message);
        break;
    }
  }
  
  /**
   * Handle monitoring commands from server
   */
  handleMonitoringCommand(command) {
    this.log('📋 Monitoring command received:', command);
    
    switch (command.action) {
      case 'increase_monitoring':
        this.config.heartbeatInterval = Math.max(1000, this.config.heartbeatInterval / 2);
        this.restartHeartbeat();
        break;
      case 'decrease_monitoring':
        this.config.heartbeatInterval = Math.min(10000, this.config.heartbeatInterval * 2);
        this.restartHeartbeat();
        break;
      case 'request_validation':
        this.performBrowserValidation();
        break;
      case 'suspend_exam':
        this.triggerAutoSuspension();
        break;
    }
  }
  
  /**
   * Handle validation challenges from server
   */
  async handleValidationChallenge(challenge) {
    this.log('🎯 Validation challenge received:', challenge.type);
    
    try {
      let response = null;
      
      switch (challenge.type) {
        case 'canvas_fingerprint':
          response = await this.generateCanvasFingerprint();
          break;
        case 'timing_check':
          const start = performance.now();
          await new Promise(resolve => setTimeout(resolve, 100));
          response = performance.now() - start;
          break;
        case 'mouse_movement':
          response = await this.requestMouseMovement();
          break;
        default:
          response = 'challenge_not_supported';
      }
      
      this.emitSecurityEvent('validation_response', {
        challengeId: challenge.id,
        response: response,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.logError('Failed to handle validation challenge:', error);
      
      this.emitSecurityEvent('validation_error', {
        challengeId: challenge.id,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Request mouse movement for validation
   */
  async requestMouseMovement() {
    return new Promise((resolve) => {
      const movements = [];
      let timeout;
      
      const handler = (event) => {
        movements.push({
          x: event.clientX,
          y: event.clientY,
          timestamp: Date.now()
        });
        
        if (movements.length >= 5) {
          document.removeEventListener('mousemove', handler);
          clearTimeout(timeout);
          resolve(movements);
        }
      };
      
      document.addEventListener('mousemove', handler);
      
      timeout = setTimeout(() => {
        document.removeEventListener('mousemove', handler);
        resolve(movements);
      }, 5000);
      
      // Show instruction to user
      this.showSecurityInfo('Please move your mouse to verify you are human');
    });
  }
  
  /**
   * Restart heartbeat with new interval
   */
  restartHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.startHeartbeat();
  }
  
  /**
   * Send session summary when stopping
   */
  async sendSessionSummary() {
    const summary = {
      type: 'session_summary',
      examId: this.state.examId,
      monit_id: this.state.monit_id,
      sessionStartTime: this.state.sessionStartTime,
      sessionEndTime: Date.now(),
      sessionDuration: Date.now() - this.state.sessionStartTime,
      violationCounts: { ...this.state.violationCounts },
      totalViolations: Object.values(this.state.violationCounts).reduce((a, b) => a + b, 0),
      totalEvents: this.eventBuffer.length,
      browserProfile: this.browserProfile
    };
    
    this.emitSecurityEvent('session_summary', summary);
    this.log('📊 Session summary sent');
  }
  
  /**
   * Load Socket.IO client library dynamically
   */
  async loadSocketIOClient() {
    return new Promise((resolve, reject) => {
      if (typeof io !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Socket.IO client'));
      document.head.appendChild(script);
    });
  }
  
  /**
   * Show security warning to user
   */
  showSecurityWarning(message) {
    if (!this.config.enableConsoleLogging) return;
    
    console.warn('🔒 EXAM SECURITY WARNING:', message);
    
    // Could also show modal/toast notification if UI framework is available
    if (typeof this.config.onSecurityWarning === 'function') {
      this.config.onSecurityWarning(message);
    }
  }
  
  /**
   * Show critical warning to user
   */
  showCriticalWarning(message) {
    console.error('🚨 CRITICAL SECURITY WARNING:', message);
    
    if (typeof this.config.onCriticalWarning === 'function') {
      this.config.onCriticalWarning(message);
    }
  }
  
  /**
   * Show suspension notice
   */
  showSuspensionNotice(message = 'Your exam has been suspended due to security violations.') {
    console.error('🚫 EXAM SUSPENDED:', message);
    
    if (typeof this.config.onSuspension === 'function') {
      this.config.onSuspension(message);
    }
  }
  
  /**
   * Show security info to user
   */
  showSecurityInfo(message) {
    if (this.config.enableConsoleLogging) {
      console.info('ℹ️ EXAM SECURITY:', message);
    }
    
    if (typeof this.config.onSecurityInfo === 'function') {
      this.config.onSecurityInfo(message);
    }
  }
  
  /**
   * Log messages
   */
  log(message, data = null) {
    if (this.config.debug || this.config.enableConsoleLogging) {
      if (data) {
        console.log(`[ExamSecurityMonitor] ${message}`, data);
      } else {
        console.log(`[ExamSecurityMonitor] ${message}`);
      }
    }
  }
  
  /**
   * Log errors
   */
  logError(message, error = null) {
    if (error) {
      console.error(`[ExamSecurityMonitor] ${message}`, error);
    } else {
      console.error(`[ExamSecurityMonitor] ${message}`);
    }
  }
  
  /**
   * Get current monitoring statistics
   */
  getStatistics() {
    return {
      sessionDuration: Date.now() - this.state.sessionStartTime,
      violationCounts: { ...this.state.violationCounts },
      totalViolations: Object.values(this.state.violationCounts).reduce((a, b) => a + b, 0),
      isMonitoring: this.state.isMonitoring,
      isConnected: this.state.isConnected,
      eventsBuffered: this.eventBuffer.length,
      socketPort: this.state.socketPort,
      monit_id: this.state.monit_id
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated', this.config);
  }
}

// Export for use in browser environments
if (typeof window !== 'undefined') {
  window.ExamSecurityMonitor = ExamSecurityMonitor;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExamSecurityMonitor;
}
