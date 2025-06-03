/**
 * Real-time monitoring and alerting system for exam security
 * Provides live monitoring of suspicious activities and automated responses
 */

const EventEmitter = require('events');
const ExamAttendance = require('../models/examAttendance.model');
const User = require('../models/user.model');
const { mailSender } = require('./mailSender');

class ExamSecurityMonitor extends EventEmitter {
  constructor() {
    super();
    
    // Configuration for monitoring thresholds
    this.config = {
      highRiskThreshold: 70,
      criticalRiskThreshold: 85,
      maxViolationsPerSession: 5,
      alertCooldown: 5 * 60 * 1000, // 5 minutes between similar alerts
      autoSuspendThreshold: 90
    };

    // Cache for recent alerts to prevent spam
    this.recentAlerts = new Map();
    
    // Statistics tracking
    this.stats = {
      totalAlertsToday: 0,
      highRiskSessions: 0,
      suspendedSessions: 0,
      detectionTypes: {}
    };

    // Setup event listeners
    this.setupEventListeners();
    
    console.log('Exam Security Monitor initialized with WebSocket support');
  }

  /**
   * Get Socket.IO instance for real-time communication
   */
  getSocketIO() {
    return global.io;
  }

  /**
   * Broadcast to admin dashboard
   */
  broadcastToAdmins(eventType, data) {
    const io = this.getSocketIO();
    if (io) {
      io.to('admin-dashboard').emit(eventType, {
        timestamp: new Date().toISOString(),
        type: eventType,
        data
      });
      console.log(`📡 [WebSocket] Broadcasted to admins: ${eventType}`);
    }
  }

  /**
   * Send to specific user
   */
  sendToUser(userId, eventType, data) {
    const io = this.getSocketIO();
    if (io) {
      io.to(`user-${userId}`).emit(eventType, {
        timestamp: new Date().toISOString(),
        type: eventType,
        data
      });
      console.log(`📡 [WebSocket] Sent to user ${userId}: ${eventType}`);
    }
  }

  /**
   * Send to specific exam session
   */
  sendToExamSession(examId, eventType, data) {
    const io = this.getSocketIO();
    if (io) {
      io.to(`exam-${examId}`).emit(eventType, {
        timestamp: new Date().toISOString(),
        type: eventType,
        data
      });
      console.log(`📡 [WebSocket] Sent to exam ${examId}: ${eventType}`);
    }
  }

  /**
   * Setup event listeners for different types of security events
   */
  setupEventListeners() {
    this.on('suspiciousActivity', this.handleSuspiciousActivity.bind(this));
    this.on('highRiskSession', this.handleHighRiskSession.bind(this));
    this.on('criticalThreat', this.handleCriticalThreat.bind(this));
    this.on('autoSuspend', this.handleAutoSuspend.bind(this));
  }

  /**
   * Monitor exam session for security violations
   * @param {string} userId - User ID
   * @param {string} examId - Exam ID
   * @param {Object} violation - Violation details
   */
  async monitorSession(userId, examId, violation) {
    try {
      const sessionKey = `${userId}-${examId}`;
      
      // Debug log: Start monitoring
      console.log('DEBUG [SecurityMonitor] Start:', {
        timestamp: new Date().toISOString(),
        sessionKey,
        violationType: violation.evidenceType,
        details: violation.details
      });
      
      // Get current exam attendance
      const attendance = await ExamAttendance.findOne({
        userId,
        examId,
        status: 'IN_PROGRESS'
      });

      if (!attendance) {
        console.warn(`No active session found for monitoring: ${sessionKey}`);
        return;
      }

      // Debug log: Before risk assessment
      console.log('DEBUG [SecurityMonitor] Pre-Assessment:', {
        currentRiskScore: attendance.riskAssessment?.overallRiskScore || 0,
        violationCount: attendance.riskAssessment?.violationCount || 0
      });

      // Update risk assessment
      await this.updateRiskAssessment(attendance, violation);
      
      // Calculate current risk level
      const riskLevel = this.calculateRiskLevel(attendance);

      // Debug log: After risk assessment
      console.log('DEBUG [SecurityMonitor] Post-Assessment:', {
        newRiskScore: riskLevel.score,
        riskLevel: riskLevel.level,
        actionRequired: riskLevel.actionRequired,
        confidence: riskLevel.confidence
      });
      
      // Emit appropriate events based on risk level
      if (riskLevel.score >= this.config.autoSuspendThreshold) {
        this.emit('autoSuspend', { userId, examId, attendance, riskLevel, violation });
      } else if (riskLevel.score >= this.config.criticalRiskThreshold) {
        this.emit('criticalThreat', { userId, examId, attendance, riskLevel, violation });
      } else if (riskLevel.score >= this.config.highRiskThreshold) {
        this.emit('highRiskSession', { userId, examId, attendance, riskLevel, violation });
      } else {
        this.emit('suspiciousActivity', { userId, examId, attendance, riskLevel, violation });
      }

      // Update statistics
      this.updateStats(violation.evidenceType);

      // Debug log: Monitoring complete
      console.log('DEBUG [SecurityMonitor] Complete:', {
        timestamp: new Date().toISOString(),
        sessionKey,
        finalRiskScore: riskLevel.score,
        status: attendance.status
      });

    } catch (error) {
      console.error('DEBUG [SecurityMonitor] Error:', {
        error: error.message,
        stack: error.stack,
        userId,
        examId,
        violationType: violation.evidenceType
      });
    }
  }

  /**
   * Update risk assessment for an exam session
   * @param {Object} attendance - Exam attendance record
   * @param {Object} violation - New violation details
   */
  async updateRiskAssessment(attendance, violation) {
    try {
      // Debug log: Start risk assessment
      console.log('DEBUG [RiskAssessment] Start:', {
        attendanceId: attendance._id,
        currentRiskScore: attendance.riskAssessment?.overallRiskScore || 0,
        violationType: violation.evidenceType
      });

      // Initialize risk assessment if not exists
      if (!attendance.riskAssessment) {
        attendance.riskAssessment = {
          overallRiskScore: 0,
          riskFactors: [],
          lastUpdated: new Date(),
          violationCount: 0,
          confidence: 0
        };
        // Debug log: Initialize risk assessment
        console.log('DEBUG [RiskAssessment] Initialized new assessment');
      }

      // Add new risk factor
      const riskFactor = {
        type: violation.evidenceType,
        severity: this.calculateSeverity(violation),
        confidence: violation.confidence || 0.8,
        timestamp: new Date(),
        details: violation.details || {}
      };

      // Debug log: New risk factor
      console.log('DEBUG [RiskAssessment] New Factor:', {
        type: riskFactor.type,
        severity: riskFactor.severity,
        confidence: riskFactor.confidence
      });

      attendance.riskAssessment.riskFactors.push(riskFactor);
      attendance.riskAssessment.violationCount++;
      attendance.riskAssessment.lastUpdated = new Date();

      // Calculate the new risk score
      const newScore = this.calculateOverallRiskScore(
        attendance.riskAssessment.riskFactors
      );

      // Debug log: Score calculation
      console.log('DEBUG [RiskAssessment] Score Update:', {
        oldScore: attendance.riskAssessment.overallRiskScore,
        newScore,
        change: newScore - attendance.riskAssessment.overallRiskScore,
        totalViolations: attendance.riskAssessment.violationCount
      });

      attendance.riskAssessment.overallRiskScore = newScore;

      // Update confidence based on number of violations
      attendance.riskAssessment.confidence = Math.min(
        0.95,
        0.5 + (attendance.riskAssessment.violationCount * 0.1)
      );

      // Retry logic to handle concurrent updates
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          await attendance.save();
          break; // Success, exit retry loop
          
        } catch (error) {
          retryCount++;
          
          if (error.name === 'VersionError' && retryCount < maxRetries) {
            // Wait briefly before retrying to reduce collision probability
            console.log(`VersionError in securityMonitor, retrying... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            
            // Refresh the document to get latest version
            const freshAttendance = await ExamAttendance.findById(attendance._id);
            if (freshAttendance) {
              // Re-apply our risk assessment updates to the fresh document
              if (!freshAttendance.riskAssessment) {
                freshAttendance.riskAssessment = {
                  overallRiskScore: 0,
                  riskFactors: [],
                  lastUpdated: new Date(),
                  violationCount: 0,
                  confidence: 0
                };
              }
              
              // Add the new risk factor if it's not already there
              const existingFactor = freshAttendance.riskAssessment.riskFactors.find(
                f => f.type === riskFactor.type && 
                     Math.abs(new Date(f.timestamp) - riskFactor.timestamp) < 1000
              );
              
              if (!existingFactor) {
                freshAttendance.riskAssessment.riskFactors.push(riskFactor);
                freshAttendance.riskAssessment.violationCount++;
              }
              
              freshAttendance.riskAssessment.lastUpdated = new Date();
              freshAttendance.riskAssessment.overallRiskScore = this.calculateOverallRiskScore(
                freshAttendance.riskAssessment.riskFactors
              );
              freshAttendance.riskAssessment.confidence = Math.min(
                0.95,
                0.5 + (freshAttendance.riskAssessment.violationCount * 0.1)
              );
              
              attendance = freshAttendance; // Use the fresh document for next retry
            }
            continue;
          }
          
          // If it's not a version error or we've exhausted retries, re-throw
          console.error(`Error saving risk assessment after ${retryCount} retries:`, error);
          throw error;
        }
      }

      // Debug log: Assessment complete
      console.log('DEBUG [RiskAssessment] Complete:', {
        attendanceId: attendance._id,
        finalRiskScore: attendance.riskAssessment.overallRiskScore,
        confidence: attendance.riskAssessment.confidence,
        lastUpdated: attendance.riskAssessment.lastUpdated
      });

    } catch (error) {
      console.error('DEBUG [RiskAssessment] Error:', {
        error: error.message,
        stack: error.stack,
        attendanceId: attendance._id,
        violationType: violation.evidenceType
      });
    }
  }

  /**
   * Calculate severity of a violation
   * @param {Object} violation - Violation details
   * @returns {number} Severity score (0-100)
   */
  calculateSeverity(violation) {
    const severityMap = {
      'PROXY_TOOL_DETECTED': 90,
      'AUTOMATED_BEHAVIOR': 85,
      'TAB_SWITCH': 40,
      'COPY_PASTE_ATTEMPT': 60,
      'MULTIPLE_TABS': 50,
      'FULLSCREEN_EXIT': 30,
      'SUSPICIOUS_TIMING': 70,
      'HEADER_ANOMALY': 80,
      'RAPID_RESPONSES': 65,
      'IDENTICAL_TIMING': 75,
      'SEQUENTIAL_ANSWERS': 70
    };

    return severityMap[violation.evidenceType] || 50;
  }

  /**
   * Calculate overall risk score from risk factors
   * @param {Array} riskFactors - Array of risk factors
   * @returns {number} Overall risk score (0-100)
   */
  calculateOverallRiskScore(riskFactors) {
    if (!riskFactors || riskFactors.length === 0) return 0;

    // Weight recent violations more heavily
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    riskFactors.forEach(factor => {
      const age = now - new Date(factor.timestamp).getTime();
      const ageHours = age / (1000 * 60 * 60);
      
      // Exponential decay - recent violations matter more
      const weight = Math.exp(-ageHours / 2) * factor.confidence;
      
      weightedSum += factor.severity * weight;
      totalWeight += weight;
    });

    const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Bonus for multiple violations
    const violationBonus = Math.min(20, riskFactors.length * 3);
    
    return Math.min(100, baseScore + violationBonus);
  }

  /**
   * Calculate risk level details
   * @param {Object} attendance - Exam attendance record
   * @returns {Object} Risk level information
   */
  calculateRiskLevel(attendance) {
    const score = attendance.riskAssessment?.overallRiskScore || 0;
    const violationCount = attendance.riskAssessment?.violationCount || 0;
    
    let level, description, actionRequired;
    
    if (score >= this.config.autoSuspendThreshold) {
      level = 'CRITICAL';
      description = 'Extremely high risk - automatic suspension triggered';
      actionRequired = 'IMMEDIATE_SUSPENSION';
    } else if (score >= this.config.criticalRiskThreshold) {
      level = 'HIGH';
      description = 'High risk of cheating detected';
      actionRequired = 'MANUAL_REVIEW';
    } else if (score >= this.config.highRiskThreshold) {
      level = 'MEDIUM';
      description = 'Suspicious behavior detected';
      actionRequired = 'ENHANCED_MONITORING';
    } else {
      level = 'LOW';
      description = 'Normal activity';
      actionRequired = 'CONTINUE_MONITORING';
    }

    return {
      score,
      level,
      description,
      actionRequired,
      violationCount,
      confidence: attendance.riskAssessment?.confidence || 0
    };
  }

  /**
   * Handle suspicious activity events
   * @param {Object} eventData - Event data
   */
  async handleSuspiciousActivity(eventData) {
    const { userId, examId, violation, riskLevel } = eventData;
    
    console.log(`SUSPICIOUS ACTIVITY: User ${userId}, Exam ${examId}, Risk: ${riskLevel.score}%`);
    console.log(`Type: ${violation.evidenceType}, Details: ${JSON.stringify(violation.details)}`);
    
    // WebSocket: Broadcast to admins
    this.broadcastToAdmins('suspicious_activity', {
      userId,
      examId,
      violation: {
        type: violation.evidenceType,
        details: violation.details
      },
      riskLevel: {
        score: riskLevel.score,
        level: riskLevel.level
      }
    });
    
    // Log to database for analysis
    await this.logSecurityEvent('suspicious_activity', eventData);
  }

  /**
   * Handle high risk session events
   * @param {Object} eventData - Event data
   */
  async handleHighRiskSession(eventData) {
    const { userId, examId, violation, riskLevel } = eventData;
    
    console.warn(`HIGH RISK SESSION: User ${userId}, Exam ${examId}, Risk: ${riskLevel.score}%`);
    
    // WebSocket: Broadcast to admins with high priority
    this.broadcastToAdmins('high_risk_session', {
      userId,
      examId,
      violation: {
        type: violation.evidenceType,
        details: violation.details
      },
      riskLevel: {
        score: riskLevel.score,
        level: riskLevel.level,
        actionRequired: riskLevel.actionRequired
      },
      priority: 'HIGH'
    });
    
    // WebSocket: Notify the specific user about increased monitoring
    this.sendToUser(userId, 'monitoring_increased', {
      examId,
      message: 'Your session is being monitored for security purposes',
      riskLevel: 'MEDIUM'
    });
    
    // Send alert to administrators
    await this.sendAdminAlert('high_risk', eventData);
    
    // Increase monitoring frequency for this session
    await this.enhanceMonitoring(userId, examId);
    
    // Log event
    await this.logSecurityEvent('high_risk_session', eventData);
    
    this.stats.highRiskSessions++;
  }

  /**
   * Handle critical threat events
   * @param {Object} eventData - Event data
   */
  async handleCriticalThreat(eventData) {
    const { userId, examId, violation, riskLevel } = eventData;
    
    console.error(`CRITICAL THREAT: User ${userId}, Exam ${examId}, Risk: ${riskLevel.score}%`);
    
    // WebSocket: Immediate broadcast to all admins with CRITICAL priority
    this.broadcastToAdmins('critical_threat', {
      userId,
      examId,
      violation: {
        type: violation.evidenceType,
        details: violation.details
      },
      riskLevel: {
        score: riskLevel.score,
        level: riskLevel.level,
        actionRequired: riskLevel.actionRequired
      },
      priority: 'CRITICAL',
      urgent: true
    });
    
    // WebSocket: Send warning to user
    this.sendToUser(userId, 'security_warning', {
      examId,
      message: 'Critical security violation detected. Your session may be suspended.',
      riskLevel: 'HIGH',
      actionRequired: true
    });
    
    // Immediate admin notification
    await this.sendUrgentAlert('critical_threat', eventData);
    
    // Flag for immediate manual review
    await this.flagForManualReview(userId, examId, riskLevel);
    
    // Log critical event
    await this.logSecurityEvent('critical_threat', eventData);
  }

  /**
   * Handle automatic suspension events
   * @param {Object} eventData - Event data
   */
  async handleAutoSuspend(eventData) {
    const { userId, examId, attendance, riskLevel } = eventData;
    
    console.error(`AUTO SUSPEND: User ${userId}, Exam ${examId}, Risk: ${riskLevel.score}%`);
    
    try {
      // Suspend the exam session with retry logic
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          // Refresh the document to get latest version
          const latestAttendance = await ExamAttendance.findById(attendance._id);
          if (!latestAttendance) {
            throw new Error('Attendance record not found during suspension');
          }
          
          // Update suspension fields
          latestAttendance.status = 'SUSPENDED';
          latestAttendance.endTime = new Date();
          latestAttendance.suspensionReason = `Automatic suspension due to high risk score: ${riskLevel.score}%`;
          latestAttendance.flaggedForReview = true;
          
          await latestAttendance.save();
          
          // Update the attendance reference for subsequent operations
          attendance = latestAttendance;
          break; // Success, exit retry loop
          
        } catch (error) {
          retryCount++;
          
          if (error.name === 'VersionError' && retryCount < maxRetries) {
            console.log(`VersionError in autoSuspend, retrying... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            continue;
          }
          
          // If it's not a version error or we've exhausted retries, re-throw
          console.error(`Error suspending session after ${retryCount} retries:`, error);
          throw error;
        }
      }
      
      // WebSocket: Immediate notification to admins
      this.broadcastToAdmins('session_suspended', {
        userId,
        examId,
        attendanceId: attendance._id,
        riskScore: riskLevel.score,
        suspensionReason: attendance.suspensionReason,
        automatic: true,
        priority: 'URGENT'
      });
      
      // WebSocket: Notify user of suspension
      this.sendToUser(userId, 'session_suspended', {
        examId,
        message: 'Your exam session has been automatically suspended due to security violations.',
        reason: 'Multiple security violations detected',
        contactSupport: true
      });
      
      // WebSocket: Broadcast to exam session (for any other connected clients)
      this.sendToExamSession(examId, 'session_ended', {
        userId,
        reason: 'Security violation - automatic suspension',
        endTime: attendance.endTime
      });
      
      // Send immediate alerts
      await this.sendUrgentAlert('auto_suspend', eventData);
      
      // Log suspension
      await this.logSecurityEvent('auto_suspend', eventData);
      
      this.stats.suspendedSessions++;
      
      console.error(`Session automatically suspended for user ${userId}`);
      
    } catch (error) {
      console.error('Error in auto suspension:', error);
    }
  }

  /**
   * Send alert to administrators
   * @param {string} alertType - Type of alert
   * @param {Object} eventData - Event data
   */
  async sendAdminAlert(alertType, eventData) {
    const alertKey = `${alertType}-${eventData.userId}-${eventData.examId}`;
    
    // Check cooldown to prevent spam
    if (this.recentAlerts.has(alertKey)) {
      const lastAlert = this.recentAlerts.get(alertKey);
      if (Date.now() - lastAlert < this.config.alertCooldown) {
        return; // Skip duplicate alert within cooldown period
      }
    }

    try {
      // Get admin users (assuming they have role: 'admin')
      const adminUsers = await User.find({ role: 'admin' }).select('email firstName lastName');
      
      const alertSubject = this.getAlertSubject(alertType, eventData);
      const alertBody = this.getAlertBody(alertType, eventData);
      
      // Send email to all admins
      for (const admin of adminUsers) {
        try {
          await mailSender(admin.email, alertSubject, alertBody);
        } catch (emailError) {
          console.error(`Failed to send alert to ${admin.email}:`, emailError);
        }
      }
      
      // Update recent alerts cache
      this.recentAlerts.set(alertKey, Date.now());
      this.stats.totalAlertsToday++;
      
    } catch (error) {
      console.error('Error sending admin alert:', error);
    }
  }

  /**
   * Send urgent alert for critical events
   * @param {string} alertType - Type of alert
   * @param {Object} eventData - Event data
   */
  async sendUrgentAlert(alertType, eventData) {
    // Always send urgent alerts, bypass cooldown for critical events
    try {
      const adminUsers = await User.find({ role: 'admin' }).select('email firstName lastName');
      
      const alertSubject = `🚨 URGENT: ${this.getAlertSubject(alertType, eventData)}`;
      const alertBody = this.getUrgentAlertBody(alertType, eventData);
      
      for (const admin of adminUsers) {
        try {
          await mailSender(admin.email, alertSubject, alertBody);
        } catch (emailError) {
          console.error(`Failed to send urgent alert to ${admin.email}:`, emailError);
        }
      }
      
      this.stats.totalAlertsToday++;
      
    } catch (error) {
      console.error('Error sending urgent alert:', error);
    }
  }

  /**
   * Generate alert subject line
   * @param {string} alertType - Type of alert
   * @param {Object} eventData - Event data
   * @returns {string} Alert subject
   */
  getAlertSubject(alertType, eventData) {
    const typeMap = {
      'high_risk': 'High Risk Exam Session Detected',
      'critical_threat': 'Critical Security Threat Detected',
      'auto_suspend': 'Exam Session Automatically Suspended'
    };
    
    return typeMap[alertType] || 'Exam Security Alert';
  }

  /**
   * Generate alert email body
   * @param {string} alertType - Type of alert
   * @param {Object} eventData - Event data
   * @returns {string} Alert body
   */
  getAlertBody(alertType, eventData) {
    const { userId, examId, violation, riskLevel } = eventData;
    
    return `
Exam Security Alert - ${alertType.toUpperCase()}

User ID: ${userId}
Exam ID: ${examId}
Risk Score: ${riskLevel.score}%
Risk Level: ${riskLevel.level}
Violation Type: ${violation.evidenceType}
Confidence: ${(riskLevel.confidence * 100).toFixed(1)}%

Violation Details:
${JSON.stringify(violation.details, null, 2)}

Action Required: ${riskLevel.actionRequired}

Time: ${new Date().toISOString()}

Please review this session immediately in the admin dashboard.
`;
  }

  /**
   * Generate urgent alert email body
   * @param {string} alertType - Type of alert
   * @param {Object} eventData - Event data
   * @returns {string} Urgent alert body
   */
  getUrgentAlertBody(alertType, eventData) {
    const { userId, examId, violation, riskLevel } = eventData;
    
    return `
🚨 URGENT EXAM SECURITY ALERT 🚨

${alertType === 'auto_suspend' ? 'EXAM SESSION AUTOMATICALLY SUSPENDED' : 'CRITICAL SECURITY THREAT DETECTED'}

User ID: ${userId}
Exam ID: ${examId}
Risk Score: ${riskLevel.score}% (CRITICAL LEVEL)
Violations Count: ${riskLevel.violationCount}

Latest Violation: ${violation.evidenceType}

${alertType === 'auto_suspend' ? 
  'The exam session has been automatically suspended due to extremely high risk score.' :
  'Immediate manual intervention required - potential cheating in progress.'
}

IMMEDIATE ACTION REQUIRED:
1. Review the session in admin dashboard
2. Contact the student if necessary
3. Investigate the violation details
4. Determine appropriate disciplinary action

Time: ${new Date().toISOString()}

This is an automated security alert. Please respond immediately.
`;
  }

  /**
   * Enhance monitoring for high-risk sessions
   * @param {string} userId - User ID
   * @param {string} examId - Exam ID
   */
  async enhanceMonitoring(userId, examId) {
    // Mark session for enhanced monitoring
    try {
      await ExamAttendance.updateOne(
        { userId, examId, status: 'IN_PROGRESS' },
        { 
          $set: { 
            enhancedMonitoring: true,
            enhancedMonitoringSince: new Date()
          }
        }
      );
      
      console.log(`Enhanced monitoring enabled for user ${userId}, exam ${examId}`);
      
    } catch (error) {
      console.error('Error enabling enhanced monitoring:', error);
    }
  }

  /**
   * Flag session for manual review
   * @param {string} userId - User ID
   * @param {string} examId - Exam ID
   * @param {Object} riskLevel - Risk level details
   */
  async flagForManualReview(userId, examId, riskLevel) {
    try {
      await ExamAttendance.updateOne(
        { userId, examId, status: 'IN_PROGRESS' },
        { 
          $set: { 
            flaggedForReview: true,
            reviewPriority: riskLevel.level,
            reviewReason: `Critical risk score: ${riskLevel.score}%`,
            reviewRequestedAt: new Date()
          }
        }
      );
      
      console.log(`Session flagged for manual review: user ${userId}, exam ${examId}`);
      
    } catch (error) {
      console.error('Error flagging for manual review:', error);
    }
  }

  /**
   * Log security events for analysis
   * @param {string} eventType - Type of security event
   * @param {Object} eventData - Event data
   */
  async logSecurityEvent(eventType, eventData) {
    try {
      // Here you could log to a dedicated security events collection
      // For now, we'll just log to console with structured data
      const logEntry = {
        timestamp: new Date().toISOString(),
        eventType,
        userId: eventData.userId,
        examId: eventData.examId,
        riskScore: eventData.riskLevel?.score,
        violationType: eventData.violation?.evidenceType,
        details: eventData.violation?.details
      };
      
      console.log(`SECURITY_LOG: ${JSON.stringify(logEntry)}`);
      
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Update statistics
   * @param {string} violationType - Type of violation
   */
  updateStats(violationType) {
    if (!this.stats.detectionTypes[violationType]) {
      this.stats.detectionTypes[violationType] = 0;
    }
    this.stats.detectionTypes[violationType]++;
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeAlerts: this.recentAlerts.size,
      config: this.config
    };
  }

  /**
   * Clean up old alerts cache
   */
  cleanupAlerts() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, timestamp] of this.recentAlerts) {
      if (now - timestamp > maxAge) {
        this.recentAlerts.delete(key);
      }
    }
  }
}

// Create singleton instance
const securityMonitor = new ExamSecurityMonitor();

// Clean up alerts cache every hour
setInterval(() => {
  securityMonitor.cleanupAlerts();
}, 60 * 60 * 1000);

// Reset daily stats at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    securityMonitor.stats.totalAlertsToday = 0;
  }
}, 60 * 1000);

module.exports = {
  ExamSecurityMonitor,
  securityMonitor
};
