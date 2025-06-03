/**
 * Dynamic Socket.IO Server Manager
 * Creates isolated Socket.IO instances on dynamic ports for exam monitoring
 */

const http = require('http');
const socketIo = require('socket.io');
const SecurityEvent = require('../models/securityEvent.model');
const { socketAntiAbuseManager } = require('./socketAntiAbuse');
const { StudentRestrictionManager } = require('./studentRestrictionManager');
const { processKeyboardData } = require('./keyboardMonitoring');
const { processMouseData } = require('./mouseMonitoring');
const ExamAttendance = require('../models/examAttendance.model');

class DynamicSocketManager {
  constructor() {
    this.activeServers = new Map(); // monit_id -> server details
    this.portRange = { start: 4000, end: 4999 };
    this.usedPorts = new Set();
    this.connections = new Map(); // monit_id -> connection details
  }

  /**
   * Create a new Socket.IO server for monitoring session
   * @param {string} monit_id - Monitoring session ID
   * @param {string} exam_id - Exam ID
   * @param {string} student_id - Student ID
   * @returns {Promise<Object>} Server details with port
   */
  async createMonitoringServer(monit_id, exam_id, student_id) {
    try {
      // Find available port
      const port = await this.findAvailablePort();
      if (!port) {
        throw new Error('No available ports for Socket.IO server');
      }

      // Create HTTP server
      const app = require('express')();
      const server = http.createServer(app);
      
      // Configure Socket.IO with strict CORS
      const io = socketIo(server, {
        cors: {
          origin: process.env.FRONTEND_URLS?.split(',') || [
            "http://localhost:3000", 
            "http://localhost:3001",
            "http://localhost:5173"
          ],
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });

      // Setup socket event handlers
      this.setupSocketHandlers(io, monit_id, exam_id, student_id);

      // Start server
      await new Promise((resolve, reject) => {
        server.listen(port, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Store server details
      const serverInfo = {
        server,
        io,
        port,
        monit_id,
        exam_id,
        student_id,
        createdAt: new Date(),
        connections: 0,
        lastActivity: new Date()
      };

      this.activeServers.set(monit_id, serverInfo);
      this.usedPorts.add(port);

      console.log(`🔌 Created Socket.IO server for ${monit_id} on port ${port}`);

      return {
        socket_port: port,
        monit_id,
        server_url: `http://localhost:${port}`
      };

    } catch (error) {
      console.error('Error creating monitoring server:', error);
      throw error;
    }
  }

  /**
   * Setup Socket.IO event handlers for monitoring
   */
  setupSocketHandlers(io, monit_id, exam_id, student_id) {
    io.on('connection', async (socket) => {
      console.log(`📡 Client connecting to monitoring server ${monit_id}: ${socket.id}`);
      
      // Check student restrictions first
      const ipAddress = socket.handshake.address;
      const studentRestrictionManager = new StudentRestrictionManager();
      const restrictionCheck = await studentRestrictionManager.canTakeExam(student_id, exam_id, ipAddress);
      
      if (!restrictionCheck.allowed) {
        console.log(`🚫 Connection blocked due to restriction: ${restrictionCheck.restriction.type}`);
        socket.emit('restriction_blocked', {
          message: restrictionCheck.message,
          restriction: restrictionCheck.restriction,
          action: 'disconnect'
        });
        socket.disconnect(true);
        return;
      }
      
      // Validate connection with anti-abuse system
      const isValid = await socketAntiAbuseManager.validateSocketConnection(socket, monit_id, student_id, exam_id);
      if (!isValid) {
        console.log(`❌ Connection rejected for ${monit_id}: ${socket.id}`);
        return;
      }
      
      console.log(`✅ Client connected to monitoring server ${monit_id}: ${socket.id}`);
      
      // Update connection count
      const serverInfo = this.activeServers.get(monit_id);
      if (serverInfo) {
        serverInfo.connections++;
        serverInfo.lastActivity = new Date();
      }

      // Store connection details
      this.connections.set(socket.id, {
        monit_id,
        exam_id,
        student_id,
        connectedAt: new Date(),
        socket
      });

      // Handle browser validation
      socket.on('browser_validation', async (data) => {
        await this.validateBrowserClient(socket, data, monit_id, student_id, exam_id);
      });

      // Handle security events from browser
      socket.on('security_event', async (eventData) => {
        try {
          await this.processSecurityEvent(eventData, monit_id, exam_id, student_id, socket);
        } catch (error) {
          console.error('Error processing security event:', error);
          socket.emit('error', { message: 'Failed to process security event' });
        }
      });

      // Handle keyboard monitoring data
      socket.on('keyboard_data', async (data) => {
        try {
          await this.processKeyboardData(data, monit_id, exam_id, student_id, socket);
        } catch (error) {
          console.error('Error processing keyboard data:', error);
        }
      });

      // Handle mouse monitoring data
      socket.on('mouse_data', async (data) => {
        try {
          await this.processMouseData(data, monit_id, exam_id, student_id, socket);
        } catch (error) {
          console.error('Error processing mouse data:', error);
        }
      });

      // Handle heartbeat/ping
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
        if (serverInfo) {
          serverInfo.lastActivity = new Date();
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`📡 Client disconnected from ${monit_id}: ${socket.id} (${reason})`);
        
        // Update connection count
        if (serverInfo) {
          serverInfo.connections = Math.max(0, serverInfo.connections - 1);
        }

        // Remove connection details
        this.connections.delete(socket.id);

        // Check if server should be terminated
        this.checkServerTermination(monit_id);
      });

      // Handle tampering detection
      socket.on('tampering_detected', (data) => {
        this.handleTamperingDetection(socket, data, monit_id, exam_id, student_id);
      });
    });
  }

  /**
   * Validate that the client is a real browser
   */
  async validateBrowserClient(socket, validationData, monit_id, studentId = null, examId = null) {
    console.log(`🔍 Validating browser client for ${monit_id}`);
    
    const {
      userAgent,
      canvas,
      webGL,
      plugins = [],
      fonts = [],
      timing = {},
      navigatorProperties = {},
      screenData = {},
      deviceMemory,
      hardwareConcurrency,
      connection = {}
    } = validationData;

    let isValidBrowser = true;
    const reasons = [];

    // 1. User-Agent validation (strict anti-automation)
    if (!userAgent || 
        userAgent.includes('headless') ||
        userAgent.includes('PhantomJS') ||
        userAgent.includes('Selenium') ||
        userAgent.includes('WebDriver') ||
        userAgent.includes('Bot') ||
        userAgent.includes('Crawler') ||
        userAgent.includes('curl') ||
        userAgent.includes('Postman') ||
        userAgent.length < 50) {
      isValidBrowser = false;
      reasons.push('Invalid or suspicious User-Agent');
    }

    // 2. Canvas fingerprinting (detect automation)
    if (!canvas || canvas.length < 100 || canvas === 'data:image/png;base64,') {
      isValidBrowser = false;
      reasons.push('Invalid canvas fingerprint');
    }

    // 3. WebGL validation
    if (!webGL || webGL.includes('SwiftShader') || webGL.includes('ANGLE')) {
      isValidBrowser = false;
      reasons.push('Suspicious WebGL renderer');
    }

    // 4. Navigator properties check (anti-automation)
    if (navigatorProperties.webdriver === true ||
        navigatorProperties.webdriver === 'true' ||
        navigatorProperties.plugins?.length === 0 ||
        navigatorProperties.languages?.length === 0) {
      isValidBrowser = false;
      reasons.push('Automation tool detected via navigator properties');
    }

    // 5. Plugins validation (real browsers have plugins)
    if (plugins.length < 3) {
      isValidBrowser = false;
      reasons.push('Insufficient browser plugins');
    }

    // 6. Fonts validation (real browsers have system fonts)
    if (fonts.length < 10) {
      isValidBrowser = false;
      reasons.push('Insufficient system fonts detected');
    }

    // 7. Timing validation (human-like behavior)
    if (timing.connectTime && timing.connectTime < 100) {
      isValidBrowser = false;
      reasons.push('Suspicious connection timing (too fast)');
    }

    // 8. Hardware validation
    if (hardwareConcurrency && hardwareConcurrency < 2) {
      isValidBrowser = false;
      reasons.push('Suspicious hardware configuration');
    }

    // 9. Screen validation
    if (!screenData.width || !screenData.height || 
        screenData.width < 800 || screenData.height < 600) {
      isValidBrowser = false;
      reasons.push('Invalid screen resolution');
    }

    // 10. Connection validation
    if (connection.effectiveType && connection.effectiveType === 'slow-2g') {
      // This might indicate a proxy or VPN
      reasons.push('Suspicious network connection');
    }

    if (isValidBrowser) {
      socket.emit('validation_success', { 
        message: 'Browser validated successfully',
        monit_id,
        timestamp: Date.now()
      });
      console.log(`✅ Browser validation passed for ${monit_id}`);
    } else {
      socket.emit('validation_failed', { 
        message: 'Browser validation failed - Automation or proxy detected',
        reasons,
        action: 'disconnect'
      });
      console.log(`❌ Browser validation failed for ${monit_id}:`, reasons);
      
      // Log with anti-abuse system
      await socketAntiAbuseManager.handleFailedValidation(socket, monit_id, reasons, studentId, examId);
      
      // Log suspicious connection attempt
      this.logSecurityEvent({
        monit_id,
        exam_id: examId || this.connections.get(socket.id)?.exam_id,
        student_id: studentId || this.connections.get(socket.id)?.student_id,
        event_type: 'automation_detected',
        timestamp: Date.now(),
        details: { reasons, validationData },
        is_suspicious: true,
        risk_score: 95,
        user_agent: userAgent,
        ip_address: socket.handshake.address
      });

      // Disconnect suspicious client after delay
      setTimeout(() => {
        socket.disconnect(true);
        this.terminateMonitoringServer(monit_id);
      }, 2000);
    }
  }

  /**
   * Process incoming security events from browser
   */
  async processSecurityEvent(eventData, monit_id, exam_id, student_id, socket) {
    const {
      event_type,
      timestamp,
      details = {}
    } = eventData;

    // Validate event data
    if (!event_type || !timestamp) {
      socket.emit('error', { message: 'Invalid event data' });
      return;
    }

    // Calculate risk score based on event type
    const riskScore = this.calculateEventRiskScore(event_type, details);
    const isSuspicious = riskScore > 30;

    // Create security event record
    const securityEvent = new SecurityEvent({
      monit_id,
      exam_id,
      student_id,
      event_type,
      timestamp,
      details,
      risk_score: riskScore,
      is_suspicious: isSuspicious,
      session_duration: Date.now() - timestamp,
      user_agent: socket.handshake.headers['user-agent'],
      ip_address: socket.handshake.address
    });

    await securityEvent.save();

    console.log(`📊 Security event logged: ${event_type} (Risk: ${riskScore})`);

    // Emit to main server for further processing
    if (global.io && isSuspicious) {
      global.io.to('admin-dashboard').emit('security_alert', {
        monit_id,
        exam_id,
        student_id,
        event_type,
        risk_score: riskScore,
        timestamp: new Date()
      });
    }

    // Send acknowledgment
    socket.emit('event_processed', { 
      event_id: securityEvent._id,
      risk_score: riskScore,
      status: 'logged'
    });
  }

  /**
   * Calculate risk score for different event types
   */
  calculateEventRiskScore(eventType, details) {
    const riskMap = {
      // High risk events
      'devtools_detected': 90,
      'multiple_tabs': 85,
      'tab_switch': 80,
      'copy': 70,
      'cut': 65,
      'paste': 75,
      'contextmenu': 60,
      'blur': 50,
      'visibilitychange': 45,
      
      // Medium risk events
      'fullscreenchange': 40,
      'resize': 35,
      'beforeunload': 30,
      
      // Low risk events
      'keydown': 5,
      'keyup': 5,
      'mousemove': 2,
      'click': 3,
      'scroll': 2,
      'focus': 1
    };

    let baseScore = riskMap[eventType] || 10;

    // Adjust score based on details
    if (details.key && ['F12', 'F11', 'Control', 'Alt'].includes(details.key)) {
      baseScore += 20;
    }

    if (details.rapid_sequence) {
      baseScore += 15;
    }

    if (details.automation_pattern) {
      baseScore += 25;
    }

    return Math.min(100, baseScore);
  }

  /**
   * Handle tampering detection
   */
  handleTamperingDetection(socket, data, monit_id, exam_id, student_id) {
    console.log(`🚨 Tampering detected on ${monit_id}:`, data);

    // Log high-risk event
    this.logSecurityEvent({
      monit_id,
      exam_id,
      student_id,
      event_type: 'automation_detected',
      details: data,
      is_suspicious: true,
      risk_score: 95
    });

    // Alert admins immediately
    if (global.io) {
      global.io.to('admin-dashboard').emit('critical_threat', {
        monit_id,
        exam_id,
        student_id,
        type: 'tampering_detected',
        details: data,
        timestamp: new Date()
      });
    }

    // Terminate connection
    socket.emit('session_terminated', {
      reason: 'Tampering detected',
      message: 'Your session has been terminated due to security violations'
    });

    setTimeout(() => {
      socket.disconnect(true);
      this.terminateMonitoringServer(monit_id);
    }, 3000);
  }

  /**
   * Find an available port in the range
   */
  async findAvailablePort() {
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      if (!this.usedPorts.has(port) && await this.isPortAvailable(port)) {
        return port;
      }
    }
    return null;
  }

  /**
   * Check if a port is available
   */
  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Check if a monitoring server should be terminated
   */
  checkServerTermination(monit_id) {
    const serverInfo = this.activeServers.get(monit_id);
    if (!serverInfo) return;

    // Terminate if no connections and been idle for 5 minutes
    const idleTime = Date.now() - serverInfo.lastActivity.getTime();
    if (serverInfo.connections === 0 && idleTime > 5 * 60 * 1000) {
      this.terminateMonitoringServer(monit_id);
    }
  }

  /**
   * Terminate a monitoring server
   */
  terminateMonitoringServer(monit_id) {
    const serverInfo = this.activeServers.get(monit_id);
    if (!serverInfo) return;

    try {
      serverInfo.server.close();
      this.usedPorts.delete(serverInfo.port);
      this.activeServers.delete(monit_id);
      
      console.log(`🔌 Terminated Socket.IO server for ${monit_id} on port ${serverInfo.port}`);
    } catch (error) {
      console.error('Error terminating server:', error);
    }
  }

  /**
   * Log security event (helper method)
   */
  async logSecurityEvent(eventData) {
    try {
      const securityEvent = new SecurityEvent(eventData);
      await securityEvent.save();
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Get active server statistics
   */
  getServerStats() {
    const stats = {
      active_servers: this.activeServers.size,
      used_ports: this.usedPorts.size,
      total_connections: Array.from(this.activeServers.values())
        .reduce((sum, server) => sum + server.connections, 0),
      servers: Array.from(this.activeServers.entries()).map(([monit_id, info]) => ({
        monit_id,
        port: info.port,
        connections: info.connections,
        uptime: Date.now() - info.createdAt.getTime(),
        last_activity: info.lastActivity
      }))
    };

    return stats;
  }

  /**
   * Cleanup inactive servers periodically
   */
  startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      for (const [monit_id, serverInfo] of this.activeServers.entries()) {
        const idleTime = now - serverInfo.lastActivity.getTime();
        
        // Terminate servers idle for more than 10 minutes
        if (serverInfo.connections === 0 && idleTime > 10 * 60 * 1000) {
          this.terminateMonitoringServer(monit_id);
        }
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Process keyboard monitoring data
   */
  async processKeyboardData(data, monit_id, exam_id, student_id, socket) {
    if (!data || !data.events || !Array.isArray(data.events)) {
      return;
    }

    try {
      // Process and analyze keyboard data
      const { processed, analysis, keybindingAnalysis, combinedRiskScore } = processKeyboardData(data.events);
      
      // If risk score is high, log a security event
      if (combinedRiskScore > 50) {
        const securityEvent = new SecurityEvent({
          monit_id,
          exam_id,
          student_id,
          event_type: 'KEYBOARD_ANOMALY',
          timestamp: new Date(),
          details: {
            riskScore: combinedRiskScore,
            keyboardPatterns: analysis.patterns,
            keyboardAnomalies: analysis.anomalies,
            keyCount: analysis.keyCount,
            keybindingViolations: keybindingAnalysis.keybindingViolations,
            prohibitedBindings: keybindingAnalysis.detectedBindings.filter(b => b.isProhibited)
          },
          risk_score: combinedRiskScore,
          is_suspicious: true,
          user_agent: socket.handshake.headers['user-agent'],
          ip_address: socket.handshake.address
        });

        await securityEvent.save();
        
        console.log(`⚠️ Keyboard/keybinding anomaly detected for ${student_id} in exam ${exam_id} (Risk: ${combinedRiskScore})`);
        
        // Emit to admin dashboard if global.io exists
        if (global.io) {
          global.io.to('admin-dashboard').emit('security_alert', {
            monit_id,
            exam_id,
            student_id,
            event_type: 'KEYBOARD_ANOMALY',
            risk_score: combinedRiskScore,
            keybindingViolations: keybindingAnalysis.keybindingViolations.length,
            timestamp: new Date()
          });
        }
      }
      
      // Update the exam attendance record with keyboard behavior data
      const attendance = await ExamAttendance.findOne({
        examId: exam_id,
        userId: student_id,
        status: "IN_PROGRESS"
      });
      
      if (attendance) {
        // Initialize behaviorProfile if it doesn't exist
        if (!attendance.behaviorProfile) {
          attendance.behaviorProfile = {};
        }
        
        // Update keyboard-related behavior data
        attendance.behaviorProfile.keystrokePattern = processed.map(event => event.timeDiff || 0);
        attendance.behaviorProfile.avgKeyboardInterval = analysis.meanInterval;
        
        // Update keybinding-related data
        attendance.behaviorProfile.detectedKeybindings = keybindingAnalysis.detectedBindings.slice(0, 10); // Store top 10 keybindings
        attendance.behaviorProfile.prohibitedKeybindingCount = keybindingAnalysis.prohibitedBindingCount;
        attendance.behaviorProfile.keybindingViolations = keybindingAnalysis.keybindingViolations;
        
        // Update automation risk if it's higher than the current value
        if (!attendance.behaviorProfile.automationRisk || 
            combinedRiskScore > attendance.behaviorProfile.automationRisk) {
          attendance.behaviorProfile.automationRisk = combinedRiskScore;
        }
        
        // Update risk assessment if needed
        if (attendance.riskAssessment) {
          // Add keyboard or keybinding factors as needed
          if (analysis.riskScore > 70) {
            attendance.riskAssessment.riskFactors.push({
              factor: 'KEYBOARD_PATTERN',
              score: analysis.riskScore,
              description: 'Suspicious keyboard activity detected',
              timestamp: new Date()
            });
          }
          
          // Add keybinding violations if detected
          if (keybindingAnalysis.keybindingRiskScore > 50) {
            // Add only the most severe violations (up to 3)
            keybindingAnalysis.keybindingViolations.slice(0, 3).forEach(violation => {
              attendance.riskAssessment.riskFactors.push({
                factor: 'PROHIBITED_KEYBINDING',
                score: keybindingAnalysis.keybindingRiskScore,
                description: `Prohibited keybinding detected: ${violation.keys.join('+')} (${violation.description})`,
                timestamp: new Date(),
                details: violation
              });
            });
            
            // If we have prohibited bindings, increment violation count
            if (keybindingAnalysis.prohibitedBindingCount > 0) {
              attendance.riskAssessment.violationCount += 1;
            }
          }
          
          // Recalculate overall risk score
          const riskFactors = attendance.riskAssessment.riskFactors;
          const totalRisk = riskFactors.reduce((sum, factor) => sum + factor.score, 0);
          attendance.riskAssessment.overallRiskScore = Math.min(100, totalRisk / riskFactors.length);
          attendance.riskAssessment.lastUpdated = new Date();
        }
        
        await attendance.save();
        
        // If we detected prohibited keybindings with high confidence, notify the client
        if (keybindingAnalysis.prohibitedBindingCount > 0 && keybindingAnalysis.keybindingRiskScore > 70) {
          socket.emit('security_warning', {
            type: 'PROHIBITED_KEYBINDING',
            message: 'Use of prohibited keyboard shortcuts detected',
            details: {
              count: keybindingAnalysis.prohibitedBindingCount,
              examples: keybindingAnalysis.keybindingViolations.slice(0, 3).map(v => v.description)
            },
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error processing keyboard data:', error);
    }
  }

  /**
   * Process mouse monitoring data
   */
  async processMouseData(data, monit_id, exam_id, student_id, socket) {
    if (!data || !data.events || !Array.isArray(data.events)) {
      return;
    }

    try {
      // Process and analyze mouse data
      const { processed, analysis } = processMouseData(data.events);
      
      // If risk score is high, log a security event
      if (analysis.riskScore > 60) {
        const securityEvent = new SecurityEvent({
          monit_id,
          exam_id,
          student_id,
          event_type: 'MOUSE_ANOMALY',
          timestamp: new Date(),
          details: {
            riskScore: analysis.riskScore,
            patterns: analysis.patterns,
            anomalies: analysis.anomalies,
            mouseCount: analysis.mouseCount,
            straightLineRatio: analysis.straightLineRatio,
            movementConsistency: analysis.movementConsistency
          },
          risk_score: analysis.riskScore,
          is_suspicious: true,
          user_agent: socket.handshake.headers['user-agent'],
          ip_address: socket.handshake.address
        });

        await securityEvent.save();
        
        console.log(`⚠️ Mouse anomaly detected for ${student_id} in exam ${exam_id} (Risk: ${analysis.riskScore})`);
        
        // Emit to admin dashboard if global.io exists
        if (global.io) {
          global.io.to('admin-dashboard').emit('security_alert', {
            monit_id,
            exam_id,
            student_id,
            event_type: 'MOUSE_ANOMALY',
            risk_score: analysis.riskScore,
            timestamp: new Date()
          });
        }
      }
      
      // Update the exam attendance record with mouse behavior data
      const attendance = await ExamAttendance.findOne({
        examId: exam_id,
        userId: student_id,
        status: "IN_PROGRESS"
      });
      
      if (attendance) {
        // Initialize behaviorProfile if it doesn't exist
        if (!attendance.behaviorProfile) {
          attendance.behaviorProfile = {};
        }
        
        // Update mouse-related behavior data
        attendance.behaviorProfile.mouseMovements = processed.slice(-30); // Keep last 30 movements
        attendance.behaviorProfile.avgMouseSpeed = analysis.meanSpeed;
        attendance.behaviorProfile.mouseConsistency = analysis.movementConsistency;
        
        // Update automation risk if it's higher than the current value
        if (!attendance.behaviorProfile.automationRisk || 
            analysis.riskScore > attendance.behaviorProfile.automationRisk) {
          attendance.behaviorProfile.automationRisk = analysis.riskScore;
        }
        
        // Update risk assessment if needed
        if (attendance.riskAssessment) {
          // Add mouse-related factors if risky
          if (analysis.riskScore > 70) {
            attendance.riskAssessment.riskFactors.push({
              factor: 'MOUSE_PATTERN',
              score: analysis.riskScore,
              description: 'Suspicious mouse activity detected',
              timestamp: new Date()
            });
          }
          
          // Recalculate overall risk score
          const riskFactors = attendance.riskAssessment.riskFactors;
          const totalRisk = riskFactors.reduce((sum, factor) => sum + factor.score, 0);
          attendance.riskAssessment.overallRiskScore = Math.min(100, totalRisk / riskFactors.length);
          attendance.riskAssessment.lastUpdated = new Date();
        }
        
        await attendance.save();
      }
    } catch (error) {
      console.error('Error processing mouse data:', error);
    }
  }
}

// Create singleton instance
let instance = null;

class DynamicSocketManagerSingleton {
  static getInstance() {
    if (!instance) {
      instance = new DynamicSocketManager();
      instance.startCleanupTask();
    }
    return instance;
  }
}

// Export both the class and singleton
module.exports = {
  DynamicSocketManager: DynamicSocketManagerSingleton,
  instance: DynamicSocketManagerSingleton.getInstance()
};
