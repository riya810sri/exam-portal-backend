/**
 * Comprehensive Security Event Monitor
 * Enhanced monitoring system for all exam security events
 */

const { securityEventLogger } = require('./securityEventLogger');
const ExamAttendance = require('../models/examAttendance.model');

class ComprehensiveSecurityMonitor {
  constructor() {
    this.activeMonitors = new Map(); // exam_id-student_id -> monitor data
    this.alertThresholds = {
      MOUSE_ANOMALY: 60,
      KEYBOARD_ANOMALY: 50,
      PROHIBITED_KEYBINDING: 30,
      TAB_SWITCH: 40,
      WINDOW_BLUR: 35,
      COPY_PASTE: 60,
      FULLSCREEN_EXIT: 45,
      DEVTOOLS_DETECTED: 90,
      MULTIPLE_TABS: 80,
      AUTOMATION_DETECTED: 95
    };
    
    this.consecutiveAlertThreshold = 3; // Number of consecutive alerts before escalation
    this.timeWindowMinutes = 10; // Time window for analyzing patterns
  }

  /**
   * Initialize monitoring for a student exam session
   * @param {string} monit_id - Monitoring session ID
   * @param {string} exam_id - Exam ID
   * @param {string} student_id - Student ID
   * @param {Object} socket - Socket connection
   */
  initializeMonitoring(monit_id, exam_id, student_id, socket) {
    const monitorKey = `${exam_id}-${student_id}`;
    
    this.activeMonitors.set(monitorKey, {
      monit_id,
      exam_id,
      student_id,
      socket,
      startTime: new Date(),
      eventHistory: [],
      alertCount: 0,
      consecutiveAlerts: 0,
      lastAlertTime: null,
      riskLevel: 'LOW',
      behaviorProfile: {
        mousePatterns: [],
        keyboardPatterns: [],
        securityViolations: []
      }
    });

    console.log(`🔍 [COMPREHENSIVE-MONITOR] Initialized monitoring for ${student_id} in exam ${exam_id}`);
  }

  /**
   * Process and analyze a security event
   * @param {Object} eventData - Security event data
   */
  async processSecurityEvent(eventData) {
    const { exam_id, student_id, event_type, risk_score, details } = eventData;
    const monitorKey = `${exam_id}-${student_id}`;
    const monitor = this.activeMonitors.get(monitorKey);

    if (!monitor) {
      console.warn(`⚠️ [COMPREHENSIVE-MONITOR] No active monitor found for ${student_id} in exam ${exam_id}`);
      return;
    }

    // Add event to history
    const event = {
      ...eventData,
      timestamp: new Date(),
      processed: true
    };

    monitor.eventHistory.push(event);
    
    // Keep only recent events (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    monitor.eventHistory = monitor.eventHistory.filter(e => e.timestamp > oneHourAgo);

    // Check if this is a high-risk event
    const threshold = this.alertThresholds[event_type] || 50;
    const isHighRisk = risk_score >= threshold;

    if (isHighRisk) {
      monitor.alertCount++;
      
      // Check for consecutive alerts
      if (monitor.lastAlertTime && (Date.now() - monitor.lastAlertTime.getTime()) < 5 * 60 * 1000) {
        monitor.consecutiveAlerts++;
      } else {
        monitor.consecutiveAlerts = 1;
      }
      
      monitor.lastAlertTime = new Date();
      
      // Update risk level
      monitor.riskLevel = this.calculateRiskLevel(monitor);
      
      console.log(`🚨 [COMPREHENSIVE-MONITOR] High-risk event detected: ${event_type} (Risk: ${risk_score}) for ${student_id}`);
      
      // Log the security event
      const loggedEvent = await securityEventLogger.logEvent(eventData);
      
      // Check for escalation conditions
      if (monitor.consecutiveAlerts >= this.consecutiveAlertThreshold || risk_score >= 90) {
        await this.escalateSecurityAlert(monitor, event);
      }
      
      // Update behavior patterns
      this.updateBehaviorProfile(monitor, event);
      
      // Send real-time notification
      this.sendRealTimeNotification(monitor, event);
    }

    // Always update the attendance record
    await this.updateAttendanceRecord(monitor, event);

    return event;
  }

  /**
   * Calculate current risk level for a monitor
   * @param {Object} monitor - Monitor data
   * @returns {string} Risk level
   */
  calculateRiskLevel(monitor) {
    const recentEvents = monitor.eventHistory.filter(
      e => e.timestamp > new Date(Date.now() - this.timeWindowMinutes * 60 * 1000)
    );

    if (recentEvents.length === 0) return 'LOW';

    const avgRiskScore = recentEvents.reduce((sum, e) => sum + e.risk_score, 0) / recentEvents.length;
    const highRiskCount = recentEvents.filter(e => e.risk_score >= 70).length;
    const criticalEventTypes = ['DEVTOOLS_DETECTED', 'AUTOMATION_DETECTED', 'TAMPERING_DETECTED'];
    const hasCriticalEvents = recentEvents.some(e => criticalEventTypes.includes(e.event_type));

    if (hasCriticalEvents || avgRiskScore >= 80 || monitor.consecutiveAlerts >= 5) {
      return 'CRITICAL';
    } else if (avgRiskScore >= 60 || highRiskCount >= 3 || monitor.consecutiveAlerts >= 3) {
      return 'HIGH';
    } else if (avgRiskScore >= 40 || highRiskCount >= 1) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Escalate security alert for critical events
   * @param {Object} monitor - Monitor data
   * @param {Object} event - Security event
   */
  async escalateSecurityAlert(monitor, event) {
    console.log(`🔥 [COMPREHENSIVE-MONITOR] ESCALATING ALERT for ${monitor.student_id} in exam ${monitor.exam_id}`);

    // Log escalation event
    await securityEventLogger.logEvent({
      monit_id: monitor.monit_id,
      exam_id: monitor.exam_id,
      student_id: monitor.student_id,
      event_type: 'SECURITY_ESCALATION',
      details: {
        originalEvent: event.event_type,
        consecutiveAlerts: monitor.consecutiveAlerts,
        riskLevel: monitor.riskLevel,
        eventHistory: monitor.eventHistory.slice(-5) // Last 5 events
      },
      risk_score: 95,
      is_suspicious: true,
      socket: monitor.socket
    });

    // Send critical alert to admin dashboard
    if (global.io) {
      global.io.to('admin-dashboard').emit('critical_security_alert', {
        monit_id: monitor.monit_id,
        exam_id: monitor.exam_id,
        student_id: monitor.student_id,
        alertType: 'ESCALATED_THREAT',
        riskLevel: monitor.riskLevel,
        consecutiveAlerts: monitor.consecutiveAlerts,
        triggerEvent: event,
        recentEvents: monitor.eventHistory.slice(-5),
        timestamp: new Date()
      });
    }

    // Optionally, warn the student
    if (monitor.socket && monitor.consecutiveAlerts >= 3) {
      monitor.socket.emit('security_warning', {
        type: 'FINAL_WARNING',
        message: 'Multiple security violations detected. Your exam session may be terminated.',
        details: {
          violationCount: monitor.consecutiveAlerts,
          riskLevel: monitor.riskLevel
        },
        timestamp: new Date()
      });
    }

    // Consider terminating the session for critical violations
    if (monitor.consecutiveAlerts >= 5 || event.risk_score >= 95) {
      await this.terminateSession(monitor, 'Excessive security violations');
    }
  }

  /**
   * Update behavior profile with new event data
   * @param {Object} monitor - Monitor data
   * @param {Object} event - Security event
   */
  updateBehaviorProfile(monitor, event) {
    const { event_type, risk_score, details } = event;
    
    switch (event_type) {
      case 'MOUSE_ANOMALY':
        monitor.behaviorProfile.mousePatterns.push({
          timestamp: event.timestamp,
          riskScore: risk_score,
          patterns: details.patterns,
          anomalies: details.anomalies
        });
        // Keep only last 10 mouse patterns
        monitor.behaviorProfile.mousePatterns = monitor.behaviorProfile.mousePatterns.slice(-10);
        break;
        
      case 'KEYBOARD_ANOMALY':
      case 'PROHIBITED_KEYBINDING':
        monitor.behaviorProfile.keyboardPatterns.push({
          timestamp: event.timestamp,
          riskScore: risk_score,
          patterns: details.keyboardPatterns || details.patterns,
          violations: details.keybindingViolations || []
        });
        // Keep only last 10 keyboard patterns
        monitor.behaviorProfile.keyboardPatterns = monitor.behaviorProfile.keyboardPatterns.slice(-10);
        break;
        
      default:
        monitor.behaviorProfile.securityViolations.push({
          timestamp: event.timestamp,
          type: event_type,
          riskScore: risk_score,
          details: details
        });
        // Keep only last 20 security violations
        monitor.behaviorProfile.securityViolations = monitor.behaviorProfile.securityViolations.slice(-20);
        break;
    }
  }

  /**
   * Send real-time notification to admin dashboard
   * @param {Object} monitor - Monitor data
   * @param {Object} event - Security event
   */
  sendRealTimeNotification(monitor, event) {
    if (global.io) {
      global.io.to('admin-dashboard').emit('security_event_notification', {
        monit_id: monitor.monit_id,
        exam_id: monitor.exam_id,
        student_id: monitor.student_id,
        event: {
          type: event.event_type,
          riskScore: event.risk_score,
          timestamp: event.timestamp
        },
        monitor: {
          riskLevel: monitor.riskLevel,
          alertCount: monitor.alertCount,
          consecutiveAlerts: monitor.consecutiveAlerts
        },
        timestamp: new Date()
      });
    }
  }

  /**
   * Update attendance record with security data
   * @param {Object} monitor - Monitor data
   * @param {Object} event - Security event
   */
  async updateAttendanceRecord(monitor, event) {
    try {
      const attendance = await ExamAttendance.findOne({
        examId: monitor.exam_id,
        userId: monitor.student_id
      });

      if (attendance) {
        // Initialize security monitoring data if it doesn't exist
        if (!attendance.securityMonitoring) {
          attendance.securityMonitoring = {
            totalEvents: 0,
            riskLevel: 'LOW',
            alertCount: 0,
            lastEventTime: null,
            behaviorProfile: monitor.behaviorProfile
          };
        }

        // Update security monitoring data
        attendance.securityMonitoring.totalEvents++;
        attendance.securityMonitoring.riskLevel = monitor.riskLevel;
        attendance.securityMonitoring.alertCount = monitor.alertCount;
        attendance.securityMonitoring.lastEventTime = event.timestamp;
        attendance.securityMonitoring.behaviorProfile = monitor.behaviorProfile;

        await attendance.save();
      }
    } catch (error) {
      console.error('❌ [COMPREHENSIVE-MONITOR] Error updating attendance record:', error);
    }
  }

  /**
   * Terminate a session due to security violations
   * @param {Object} monitor - Monitor data
   * @param {string} reason - Termination reason
   */
  async terminateSession(monitor, reason) {
    console.log(`🔒 [COMPREHENSIVE-MONITOR] TERMINATING SESSION for ${monitor.student_id}: ${reason}`);

    // Log session termination
    await securityEventLogger.logEvent({
      monit_id: monitor.monit_id,
      exam_id: monitor.exam_id,
      student_id: monitor.student_id,
      event_type: 'SESSION_TERMINATED',
      details: {
        reason,
        totalAlerts: monitor.alertCount,
        consecutiveAlerts: monitor.consecutiveAlerts,
        riskLevel: monitor.riskLevel,
        sessionDuration: Date.now() - monitor.startTime.getTime()
      },
      risk_score: 100,
      is_suspicious: true,
      socket: monitor.socket
    });

    // Notify student
    if (monitor.socket) {
      monitor.socket.emit('session_terminated', {
        reason,
        message: 'Your exam session has been terminated due to security violations.',
        timestamp: new Date()
      });

      // Disconnect after a delay
      setTimeout(() => {
        monitor.socket.disconnect(true);
      }, 3000);
    }

    // Update attendance record
    try {
      await ExamAttendance.updateOne(
        { examId: monitor.exam_id, userId: monitor.student_id },
        {
          $set: {
            status: 'TERMINATED',
            'securityMonitoring.sessionTerminated': true,
            'securityMonitoring.terminationReason': reason,
            'securityMonitoring.terminationTime': new Date()
          }
        }
      );
    } catch (error) {
      console.error('❌ [COMPREHENSIVE-MONITOR] Error updating attendance for termination:', error);
    }

    // Remove from active monitors
    const monitorKey = `${monitor.exam_id}-${monitor.student_id}`;
    this.activeMonitors.delete(monitorKey);
  }

  /**
   * Clean up monitoring for a completed session
   * @param {string} exam_id - Exam ID
   * @param {string} student_id - Student ID
   */
  cleanupMonitoring(exam_id, student_id) {
    const monitorKey = `${exam_id}-${student_id}`;
    const monitor = this.activeMonitors.get(monitorKey);

    if (monitor) {
      console.log(`🧹 [COMPREHENSIVE-MONITOR] Cleaning up monitoring for ${student_id} in exam ${exam_id}`);
      
      // Log session completion
      securityEventLogger.logEvent({
        monit_id: monitor.monit_id,
        exam_id: monitor.exam_id,
        student_id: monitor.student_id,
        event_type: 'SESSION_COMPLETED',
        details: {
          totalEvents: monitor.eventHistory.length,
          totalAlerts: monitor.alertCount,
          finalRiskLevel: monitor.riskLevel,
          sessionDuration: Date.now() - monitor.startTime.getTime()
        },
        risk_score: 0,
        is_suspicious: false,
        socket: monitor.socket
      });

      this.activeMonitors.delete(monitorKey);
    }
  }

  /**
   * Get monitoring statistics for an exam session
   * @param {string} exam_id - Exam ID
   * @param {string} student_id - Student ID
   * @returns {Object} Monitoring statistics
   */
  getMonitoringStats(exam_id, student_id) {
    const monitorKey = `${exam_id}-${student_id}`;
    const monitor = this.activeMonitors.get(monitorKey);

    if (!monitor) {
      return null;
    }

    return {
      session: {
        startTime: monitor.startTime,
        duration: Date.now() - monitor.startTime.getTime(),
        riskLevel: monitor.riskLevel
      },
      events: {
        total: monitor.eventHistory.length,
        alerts: monitor.alertCount,
        consecutiveAlerts: monitor.consecutiveAlerts,
        lastAlertTime: monitor.lastAlertTime
      },
      behaviorProfile: monitor.behaviorProfile,
      recentEvents: monitor.eventHistory.slice(-10)
    };
  }

  /**
   * Get all active monitoring sessions
   * @returns {Array} Array of active monitoring sessions
   */
  getActiveMonitors() {
    return Array.from(this.activeMonitors.entries()).map(([key, monitor]) => ({
      key,
      exam_id: monitor.exam_id,
      student_id: monitor.student_id,
      riskLevel: monitor.riskLevel,
      alertCount: monitor.alertCount,
      eventCount: monitor.eventHistory.length,
      startTime: monitor.startTime
    }));
  }
}

// Create singleton instance
const comprehensiveSecurityMonitor = new ComprehensiveSecurityMonitor();

module.exports = {
  ComprehensiveSecurityMonitor,
  comprehensiveSecurityMonitor
};
