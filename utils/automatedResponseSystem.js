/**
 * Automated Response System for Anti-Abuse Detection
 * Handles automatic actions based on risk levels and security events
 */

const ExamAttendance = require('../models/examAttendance.model');
const User = require('../models/user.model');
const { securityMonitor } = require('./securityMonitor');
const { emailUtils } = require('./emailUtils');

class AutomatedResponseSystem {
  constructor() {
    this.config = {
      thresholds: {
        suspicious: 40,    // Start monitoring
        highRisk: 70,      // Increase scrutiny
        critical: 90,      // Immediate intervention
        autoSuspend: 95    // Automatic suspension
      },
      actions: {
        suspicious: ['LOG', 'MONITOR'],
        highRisk: ['LOG', 'MONITOR', 'NOTIFY_ADMIN', 'INCREASE_VERIFICATION'],
        critical: ['LOG', 'MONITOR', 'NOTIFY_ADMIN', 'FLAG_SESSION', 'REQUIRE_VERIFICATION'],
        autoSuspend: ['LOG', 'SUSPEND_SESSION', 'NOTIFY_ADMIN', 'NOTIFY_STUDENT']
      },
      cooldowns: {
        adminNotification: 300000,    // 5 minutes
        studentWarning: 60000,        // 1 minute
        suspensionCheck: 30000        // 30 seconds
      }
    };
    
    this.recentActions = new Map(); // Track recent actions to avoid spam
    this.suspendedSessions = new Set();
    this.flaggedSessions = new Set();
  }

  /**
   * Process security event and determine automated response
   */
  async processSecurityEvent(attendanceId, eventData) {
    try {
      const attendance = await ExamAttendance.findById(attendanceId)
        .populate('userId', 'username firstName lastName email')
        .populate('examId', 'title');

      if (!attendance) {
        console.error('Attendance record not found:', attendanceId);
        return;
      }

      const riskScore = attendance.riskAssessment?.overallRiskScore || 0;
      const riskLevel = this.determineRiskLevel(riskScore);
      
      console.log(`🚨 Security Event - Session: ${attendanceId}, Risk: ${riskScore}, Level: ${riskLevel}`);

      // Execute automated responses based on risk level
      await this.executeAutomatedResponses(attendance, riskLevel, eventData);

      // Update monitoring statistics
      securityMonitor.recordSecurityEvent({
        sessionId: attendanceId,
        riskLevel,
        riskScore,
        eventType: eventData.type,
        automated: true,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error processing security event:', error);
    }
  }

  /**
   * Determine risk level based on score
   */
  determineRiskLevel(riskScore) {
    if (riskScore >= this.config.thresholds.autoSuspend) return 'autoSuspend';
    if (riskScore >= this.config.thresholds.critical) return 'critical';
    if (riskScore >= this.config.thresholds.highRisk) return 'highRisk';
    if (riskScore >= this.config.thresholds.suspicious) return 'suspicious';
    return 'normal';
  }

  /**
   * Execute automated responses for the given risk level
   */
  async executeAutomatedResponses(attendance, riskLevel, eventData) {
    const actions = this.config.actions[riskLevel] || [];
    const sessionId = attendance._id.toString();

    for (const action of actions) {
      try {
        switch (action) {
          case 'LOG':
            await this.logSecurityEvent(attendance, riskLevel, eventData);
            break;
          case 'MONITOR':
            await this.increaseMonitoring(attendance);
            break;
          case 'NOTIFY_ADMIN':
            await this.notifyAdministrators(attendance, riskLevel, eventData);
            break;
          case 'NOTIFY_STUDENT':
            await this.notifyStudent(attendance, riskLevel);
            break;
          case 'INCREASE_VERIFICATION':
            await this.increaseVerificationRequirements(attendance);
            break;
          case 'FLAG_SESSION':
            await this.flagSessionForReview(attendance);
            break;
          case 'SUSPEND_SESSION':
            await this.suspendSession(attendance, 'Automatic suspension due to high-risk activity');
            break;
          case 'REQUIRE_VERIFICATION':
            await this.requireAdditionalVerification(attendance);
            break;
        }
      } catch (error) {
        console.error(`Error executing action ${action}:`, error);
      }
    }
  }

  /**
   * Log security event with detailed information
   */
  async logSecurityEvent(attendance, riskLevel, eventData) {
    const logEntry = {
      timestamp: new Date(),
      sessionId: attendance._id,
      userId: attendance.userId._id,
      examId: attendance.examId._id,
      riskLevel,
      riskScore: attendance.riskAssessment?.overallRiskScore,
      eventType: eventData.type,
      eventDetails: eventData,
      userAgent: attendance.sessionFingerprint?.userAgent,
      ipAddress: attendance.sessionFingerprint?.ipAddress,
      automated: true
    };

    console.log('📝 Security Event Logged:', logEntry);

    // Add to exam attendance cheat evidence
    await ExamAttendance.findByIdAndUpdate(attendance._id, {
      $push: {
        cheatEvidence: {
          type: eventData.type || 'AUTOMATED_DETECTION',
          detectedAt: new Date(),
          source: 'SERVER_AUTOMATED',
          details: {
            riskLevel,
            eventData,
            automatedResponse: true
          },
          severity: this.mapRiskLevelToSeverity(riskLevel)
        }
      }
    });
  }

  /**
   * Increase monitoring for suspicious sessions
   */
  async increaseMonitoring(attendance) {
    const sessionId = attendance._id.toString();
    
    // Enable enhanced monitoring
    securityMonitor.enableEnhancedMonitoring(sessionId, {
      increaseFrequency: true,
      requireJSChallenges: true,
      validateAllRequests: true
    });

    console.log(`🔍 Enhanced monitoring enabled for session: ${sessionId}`);
  }

  /**
   * Notify administrators of security events
   */
  async notifyAdministrators(attendance, riskLevel, eventData) {
    const notificationKey = `admin_${attendance._id}_${riskLevel}`;
    
    // Check cooldown to avoid notification spam
    if (this.isInCooldown(notificationKey, this.config.cooldowns.adminNotification)) {
      return;
    }

    try {
      // Get all admin users
      const admins = await User.find({ 
        role: { $in: ['admin', 'super_admin'] },
        isActive: true 
      });

      const emailSubject = `🚨 Security Alert - ${riskLevel.toUpperCase()} Risk Detected`;
      const emailContent = this.generateAdminEmailContent(attendance, riskLevel, eventData);

      // Send notifications to all admins
      for (const admin of admins) {
        await emailUtils.sendEmail({
          to: admin.email,
          subject: emailSubject,
          html: emailContent
        });
      }

      this.setLastAction(notificationKey);
      console.log(`📧 Admin notifications sent for session: ${attendance._id}`);

    } catch (error) {
      console.error('Error sending admin notifications:', error);
    }
  }

  /**
   * Notify student of security monitoring
   */
  async notifyStudent(attendance, riskLevel) {
    const notificationKey = `student_${attendance._id}_${riskLevel}`;
    
    if (this.isInCooldown(notificationKey, this.config.cooldowns.studentWarning)) {
      return;
    }

    try {
      const subject = 'Exam Security Notice';
      const content = this.generateStudentEmailContent(attendance, riskLevel);

      await emailUtils.sendEmail({
        to: attendance.userId.email,
        subject: subject,
        html: content
      });

      this.setLastAction(notificationKey);
      console.log(`📧 Student notification sent for session: ${attendance._id}`);

    } catch (error) {
      console.error('Error sending student notification:', error);
    }
  }

  /**
   * Increase verification requirements for suspicious sessions
   */
  async increaseVerificationRequirements(attendance) {
    await ExamAttendance.findByIdAndUpdate(attendance._id, {
      $set: {
        'securitySettings.requireAdditionalVerification': true,
        'securitySettings.jsChallengeFrequency': 'EVERY_QUESTION',
        'securitySettings.behaviorValidationLevel': 'STRICT'
      }
    });

    console.log(`🔒 Increased verification requirements for session: ${attendance._id}`);
  }

  /**
   * Flag session for manual review
   */
  async flagSessionForReview(attendance) {
    const sessionId = attendance._id.toString();
    this.flaggedSessions.add(sessionId);

    await ExamAttendance.findByIdAndUpdate(attendance._id, {
      $set: {
        'adminReview.flaggedForReview': true,
        'adminReview.flaggedAt': new Date(),
        'adminReview.flagReason': 'Automated security detection',
        'adminReview.reviewRequired': true
      }
    });

    console.log(`🚩 Session flagged for review: ${sessionId}`);
  }

  /**
   * Suspend exam session
   */
  async suspendSession(attendance, reason) {
    const sessionId = attendance._id.toString();
    
    if (this.suspendedSessions.has(sessionId)) {
      return; // Already suspended
    }

    const suspensionKey = `suspend_${sessionId}`;
    if (this.isInCooldown(suspensionKey, this.config.cooldowns.suspensionCheck)) {
      return;
    }

    try {
      await ExamAttendance.findByIdAndUpdate(attendance._id, {
        $set: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspensionReason: reason,
          'adminReview.suspendedAutomatically': true,
          'adminReview.suspensionDetails': {
            reason,
            timestamp: new Date(),
            riskScore: attendance.riskAssessment?.overallRiskScore,
            automated: true
          }
        }
      });

      this.suspendedSessions.add(sessionId);
      this.setLastAction(suspensionKey);

      console.log(`⛔ Session suspended: ${sessionId} - ${reason}`);

      // Notify both admin and student
      await this.notifyAdministrators(attendance, 'autoSuspend', { reason });
      await this.notifyStudent(attendance, 'autoSuspend');

    } catch (error) {
      console.error('Error suspending session:', error);
    }
  }

  /**
   * Require additional verification steps
   */
  async requireAdditionalVerification(attendance) {
    await ExamAttendance.findByIdAndUpdate(attendance._id, {
      $set: {
        'verificationRequirements.identityVerification': true,
        'verificationRequirements.biometricCheck': true,
        'verificationRequirements.additionalDocuments': true,
        'verificationRequirements.videoProctoring': true
      }
    });

    console.log(`🔐 Additional verification required for session: ${attendance._id}`);
  }

  /**
   * Generate email content for admin notifications
   */
  generateAdminEmailContent(attendance, riskLevel, eventData) {
    const riskColor = this.getRiskLevelColor(riskLevel);
    const riskScore = attendance.riskAssessment?.overallRiskScore || 0;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: ${riskColor};">🚨 Security Alert - ${riskLevel.toUpperCase()} Risk</h2>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Session Details</h3>
          <p><strong>Student:</strong> ${attendance.userId.firstName} ${attendance.userId.lastName} (${attendance.userId.username})</p>
          <p><strong>Email:</strong> ${attendance.userId.email}</p>
          <p><strong>Exam:</strong> ${attendance.examId.title}</p>
          <p><strong>Session ID:</strong> ${attendance._id}</p>
          <p><strong>Risk Score:</strong> <span style="color: ${riskColor}; font-weight: bold;">${riskScore}/100</span></p>
          <p><strong>Detection Time:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Event Details</h3>
          <p><strong>Event Type:</strong> ${eventData.type || 'Unknown'}</p>
          <p><strong>Details:</strong> ${JSON.stringify(eventData, null, 2)}</p>
        </div>

        <div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Automated Actions Taken</h3>
          <ul>
            ${this.config.actions[riskLevel]?.map(action => `<li>${this.getActionDescription(action)}</li>`).join('') || '<li>No actions configured</li>'}
          </ul>
        </div>

        <p style="margin-top: 20px;">
          <a href="${process.env.ADMIN_DASHBOARD_URL}/security/sessions/${attendance._id}" 
             style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Review Session
          </a>
        </p>

        <p style="color: #6c757d; font-size: 12px; margin-top: 20px;">
          This is an automated security alert. Please review the session immediately if the risk level is critical.
        </p>
      </div>
    `;
  }

  /**
   * Generate email content for student notifications
   */
  generateStudentEmailContent(attendance, riskLevel) {
    const isHighRisk = ['critical', 'autoSuspend'].includes(riskLevel);

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: ${isHighRisk ? '#dc3545' : '#ffc107'};">
          ${isHighRisk ? '⚠️ Important Security Notice' : '📋 Exam Security Monitoring'}
        </h2>
        
        <p>Dear ${attendance.userId.firstName},</p>
        
        ${isHighRisk ? `
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Your exam session has been flagged for security review.</strong></p>
            <p>Our automated security system has detected potentially suspicious activity during your exam session.</p>
          </div>
        ` : `
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p>Your exam session is being monitored for security purposes to ensure academic integrity.</p>
          </div>
        `}

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Exam Session Information</h3>
          <p><strong>Exam:</strong> ${attendance.examId.title}</p>
          <p><strong>Session ID:</strong> ${attendance._id}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>

        ${isHighRisk ? `
          <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>What to do next:</h3>
            <ul>
              <li>Contact your instructor or exam administrator immediately</li>
              <li>Prepare to provide additional verification if requested</li>
              <li>Review the exam guidelines and academic integrity policies</li>
            </ul>
          </div>
        ` : `
          <div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>Guidelines:</h3>
            <ul>
              <li>Keep your browser focused on the exam tab</li>
              <li>Do not use external tools or resources</li>
              <li>Follow all exam instructions carefully</li>
              <li>Contact support if you experience technical issues</li>
            </ul>
          </div>
        `}

        <p style="color: #6c757d; font-size: 12px; margin-top: 20px;">
          This is an automated message from the exam security system. 
          If you believe this is an error, please contact your instructor immediately.
        </p>
      </div>
    `;
  }

  /**
   * Helper methods
   */
  isInCooldown(key, cooldownPeriod) {
    const lastAction = this.recentActions.get(key);
    return lastAction && (Date.now() - lastAction) < cooldownPeriod;
  }

  setLastAction(key) {
    this.recentActions.set(key, Date.now());
  }

  getRiskLevelColor(riskLevel) {
    const colors = {
      suspicious: '#ffc107',
      highRisk: '#fd7e14',
      critical: '#dc3545',
      autoSuspend: '#6f42c1'
    };
    return colors[riskLevel] || '#17a2b8';
  }

  getActionDescription(action) {
    const descriptions = {
      'LOG': 'Security event logged',
      'MONITOR': 'Enhanced monitoring enabled',
      'NOTIFY_ADMIN': 'Administrators notified',
      'NOTIFY_STUDENT': 'Student notified',
      'INCREASE_VERIFICATION': 'Verification requirements increased',
      'FLAG_SESSION': 'Session flagged for manual review',
      'SUSPEND_SESSION': 'Session automatically suspended',
      'REQUIRE_VERIFICATION': 'Additional verification required'
    };
    return descriptions[action] || action;
  }

  mapRiskLevelToSeverity(riskLevel) {
    const mapping = {
      suspicious: 'LOW',
      highRisk: 'MEDIUM',
      critical: 'HIGH',
      autoSuspend: 'CRITICAL'
    };
    return mapping[riskLevel] || 'LOW';
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Automated response configuration updated:', this.config);
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    return {
      recentActions: this.recentActions.size,
      suspendedSessions: this.suspendedSessions.size,
      flaggedSessions: this.flaggedSessions.size,
      configuration: this.config
    };
  }
}

// Create singleton instance
const automatedResponseSystem = new AutomatedResponseSystem();

module.exports = {
  automatedResponseSystem,
  AutomatedResponseSystem
};
