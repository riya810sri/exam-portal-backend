/**
 * Security Event Logger
 * Centralized logging system for all security events during exams
 */

const SecurityEvent = require('../models/securityEvent.model');
const ExamAttendance = require('../models/examAttendance.model');

class SecurityEventLogger {
  constructor() {
    this.eventQueue = [];
    this.batchSize = 10;
    this.batchTimeout = 5000; // 5 seconds
    this.isProcessing = false;
    
    // Start batch processing
    this.startBatchProcessor();
  }

  /**
   * Log a security event
   * @param {Object} eventData - Event data to log
   */
  async logEvent(eventData) {
    const {
      monit_id,
      exam_id,
      student_id,
      event_type,
      details = {},
      risk_score = 0,
      is_suspicious = false,
      user_agent = null,
      ip_address = null,
      socket = null
    } = eventData;

    try {
      // Validate required fields
      if (!monit_id || !exam_id || !student_id || !event_type) {
        console.error('❌ [SECURITY-LOGGER] Missing required fields:', eventData);
        return null;
      }

      // Create security event
      const securityEvent = new SecurityEvent({
        monit_id,
        exam_id,
        student_id,
        event_type,
        timestamp: Date.now(), // Use numeric timestamp instead of Date object
        details,
        risk_score,
        is_suspicious,
        user_agent: user_agent || (socket?.handshake?.headers?.['user-agent']),
        ip_address: ip_address || (socket?.handshake?.address)
      });

      console.log(`🔄 [SECURITY-LOGGER] About to save event:`, {
        event_type,
        monit_id,
        exam_id,
        student_id,
        timestamp: Date.now()
      });

      const savedEvent = await securityEvent.save();
      
      console.log(`📊 [SECURITY-LOGGER] Event logged: ${event_type} (Risk: ${risk_score}) - ID: ${savedEvent._id}`);

      // Update attendance record with security data
      await this.updateAttendanceSecurityData(exam_id, student_id, event_type, risk_score, details);

      // Send real-time alerts for high-risk events
      if (is_suspicious || risk_score > 70) {
        this.sendRealTimeAlert({
          monit_id,
          exam_id,
          student_id,
          event_type,
          risk_score,
          timestamp: new Date(),
          details
        });
      }

      return savedEvent;

    } catch (error) {
      console.error('❌ [SECURITY-LOGGER] Error logging security event:', {
        error: error.message,
        stack: error.stack,
        eventData: {
          monit_id,
          exam_id,
          student_id,
          event_type,
          timestamp: Date.now()
        },
        validationErrors: error.errors || null
      });
      return null;
    }
  }

  /**
   * Log multiple events in batch
   * @param {Array} events - Array of security events
   */
  async logBatchEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    try {
      const securityEvents = events.map(eventData => new SecurityEvent({
        monit_id: eventData.monit_id,
        exam_id: eventData.exam_id,
        student_id: eventData.student_id,
        event_type: eventData.event_type,
        timestamp: eventData.timestamp || new Date(),
        details: eventData.details || {},
        risk_score: eventData.risk_score || 0,
        is_suspicious: eventData.is_suspicious || false,
        user_agent: eventData.user_agent,
        ip_address: eventData.ip_address
      }));

      const savedEvents = await SecurityEvent.insertMany(securityEvents);
      console.log(`📊 [SECURITY-LOGGER] Batch logged ${savedEvents.length} events`);

      return savedEvents;

    } catch (error) {
      console.error('❌ [SECURITY-LOGGER] Error batch logging events:', error);
      return [];
    }
  }

  /**
   * Update attendance record with security data
   * @param {string} exam_id - Exam ID
   * @param {string} student_id - Student ID
   * @param {string} event_type - Type of security event
   * @param {number} risk_score - Risk score of the event
   * @param {Object} details - Event details
   */
  async updateAttendanceSecurityData(exam_id, student_id, event_type, risk_score, details) {
    try {
      const attendance = await ExamAttendance.findOne({
        examId: exam_id,
        userId: student_id
      });

      if (!attendance) {
        console.warn(`⚠️ [SECURITY-LOGGER] No attendance record found for ${student_id} in exam ${exam_id}`);
        return;
      }

      // Initialize security data structures if they don't exist
      if (!attendance.securityEvents) {
        attendance.securityEvents = [];
      }
      
      if (!attendance.riskAssessment) {
        attendance.riskAssessment = {
          overallRiskScore: 0,
          riskFactors: [],
          violationCount: 0,
          lastUpdated: new Date()
        };
      }

      // Add security event summary
      attendance.securityEvents.push({
        event_type,
        risk_score,
        timestamp: new Date(),
        details: {
          summary: this.getEventSummary(event_type, details),
          risk_level: this.getRiskLevel(risk_score)
        }
      });

      // Keep only the last 50 security events
      if (attendance.securityEvents.length > 50) {
        attendance.securityEvents = attendance.securityEvents.slice(-50);
      }

      // Update risk assessment for high-risk events
      if (risk_score > 50) {
        attendance.riskAssessment.riskFactors.push({
          factor: event_type,
          score: risk_score,
          description: this.getEventDescription(event_type, details),
          timestamp: new Date()
        });

        // Increment violation count for suspicious events
        if (risk_score > 70) {
          attendance.riskAssessment.violationCount += 1;
        }

        // Recalculate overall risk score
        const recentFactors = attendance.riskAssessment.riskFactors.slice(-20); // Consider last 20 factors
        const totalRisk = recentFactors.reduce((sum, factor) => sum + factor.score, 0);
        attendance.riskAssessment.overallRiskScore = Math.min(100, totalRisk / recentFactors.length);
        attendance.riskAssessment.lastUpdated = new Date();
      }

      await attendance.save();
      console.log(`📝 [SECURITY-LOGGER] Updated attendance security data for ${student_id}`);

    } catch (error) {
      console.error('❌ [SECURITY-LOGGER] Error updating attendance security data:', error);
    }
  }

  /**
   * Send real-time alert to admin dashboard
   * @param {Object} alertData - Alert data
   */
  sendRealTimeAlert(alertData) {
    try {
      if (global.io) {
        global.io.to('admin-dashboard').emit('security_alert', {
          ...alertData,
          alert_level: this.getAlertLevel(alertData.risk_score),
          timestamp: new Date()
        });
        
        console.log(`🚨 [SECURITY-LOGGER] Real-time alert sent: ${alertData.event_type} (Risk: ${alertData.risk_score})`);
      }
    } catch (error) {
      console.error('❌ [SECURITY-LOGGER] Error sending real-time alert:', error);
    }
  }

  /**
   * Get event summary for display
   * @param {string} event_type - Event type
   * @param {Object} details - Event details
   * @returns {string} Event summary
   */
  getEventSummary(event_type, details) {
    const summaries = {
      'MOUSE_ANOMALY': `Mouse behavior anomaly detected`,
      'KEYBOARD_ANOMALY': `Keyboard pattern anomaly detected`,
      'PROHIBITED_KEYBINDING': `Prohibited keyboard shortcut used`,
      'TAB_SWITCH': `Tab switching detected`,
      'WINDOW_BLUR': `Window lost focus`,
      'COPY_PASTE': `Copy/paste activity detected`,
      'FULLSCREEN_EXIT': `Fullscreen mode exited`,
      'DEVTOOLS_DETECTED': `Developer tools opened`,
      'MULTIPLE_TABS': `Multiple tabs detected`,
      'AUTOMATION_DETECTED': `Automation tools detected`,
      'TAMPERING_DETECTED': `System tampering detected`
    };

    let summary = summaries[event_type] || `Security event: ${event_type}`;
    
    // Add specific details based on event type
    if (event_type === 'MOUSE_ANOMALY' && details.riskScore) {
      summary += ` (Risk: ${details.riskScore})`;
    }
    
    if (event_type === 'KEYBOARD_ANOMALY' && details.keyCount) {
      summary += ` (${details.keyCount} keys)`;
    }
    
    return summary;
  }

  /**
   * Get event description
   * @param {string} event_type - Event type
   * @param {Object} details - Event details
   * @returns {string} Event description
   */
  getEventDescription(event_type, details) {
    const descriptions = {
      'MOUSE_ANOMALY': 'Suspicious mouse movement patterns detected indicating possible automation',
      'KEYBOARD_ANOMALY': 'Unusual keyboard typing patterns detected',
      'PROHIBITED_KEYBINDING': 'Student used prohibited keyboard shortcuts',
      'TAB_SWITCH': 'Student switched away from exam tab',
      'WINDOW_BLUR': 'Exam window lost focus',
      'COPY_PASTE': 'Copy or paste operation detected',
      'FULLSCREEN_EXIT': 'Student exited fullscreen exam mode',
      'DEVTOOLS_DETECTED': 'Browser developer tools were opened',
      'MULTIPLE_TABS': 'Multiple browser tabs detected',
      'AUTOMATION_DETECTED': 'Automation or bot activity detected',
      'TAMPERING_DETECTED': 'System or browser tampering detected'
    };

    return descriptions[event_type] || `Security violation: ${event_type}`;
  }

  /**
   * Get risk level string
   * @param {number} risk_score - Risk score
   * @returns {string} Risk level
   */
  getRiskLevel(risk_score) {
    if (risk_score >= 90) return 'CRITICAL';
    if (risk_score >= 70) return 'HIGH';
    if (risk_score >= 50) return 'MEDIUM';
    if (risk_score >= 30) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Get alert level
   * @param {number} risk_score - Risk score
   * @returns {string} Alert level
   */
  getAlertLevel(risk_score) {
    if (risk_score >= 90) return 'CRITICAL';
    if (risk_score >= 70) return 'HIGH';
    if (risk_score >= 50) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Start batch processor for queued events
   */
  startBatchProcessor() {
    setInterval(async () => {
      if (this.eventQueue.length > 0 && !this.isProcessing) {
        await this.processBatch();
      }
    }, this.batchTimeout);
  }

  /**
   * Process queued events in batch
   */
  async processBatch() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const eventsToProcess = this.eventQueue.splice(0, this.batchSize);
      await this.logBatchEvents(eventsToProcess);
    } catch (error) {
      console.error('❌ [SECURITY-LOGGER] Error processing batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Add event to queue for batch processing
   * @param {Object} eventData - Event data
   */
  queueEvent(eventData) {
    this.eventQueue.push(eventData);
    
    // Process immediately if queue is full
    if (this.eventQueue.length >= this.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Get security statistics for a student/exam
   * @param {string} exam_id - Exam ID
   * @param {string} student_id - Student ID
   * @returns {Object} Security statistics
   */
  async getSecurityStats(exam_id, student_id) {
    try {
      const events = await SecurityEvent.find({
        exam_id,
        student_id
      }).sort({ timestamp: -1 });

      const stats = {
        totalEvents: events.length,
        suspiciousEvents: events.filter(e => e.is_suspicious).length,
        highRiskEvents: events.filter(e => e.risk_score > 70).length,
        eventTypes: {},
        averageRiskScore: 0,
        recentEvents: events.slice(0, 10)
      };

      // Count event types
      events.forEach(event => {
        stats.eventTypes[event.event_type] = (stats.eventTypes[event.event_type] || 0) + 1;
      });

      // Calculate average risk score
      if (events.length > 0) {
        const totalRisk = events.reduce((sum, event) => sum + event.risk_score, 0);
        stats.averageRiskScore = Math.round(totalRisk / events.length);
      }

      return stats;

    } catch (error) {
      console.error('❌ [SECURITY-LOGGER] Error getting security stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const securityEventLogger = new SecurityEventLogger();

module.exports = {
  SecurityEventLogger,
  securityEventLogger
};
