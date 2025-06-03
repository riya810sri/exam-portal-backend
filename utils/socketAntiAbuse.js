/**
 * Enhanced Anti-Abuse Middleware for Dynamic Socket Connections
 * Provides comprehensive protection against automation, proxy usage, and repeated violations
 * Integrates with granular student restriction system
 */

const BannedClient = require('../models/bannedClient.model');
const { StudentRestrictionManager } = require('./studentRestrictionManager');
const rateLimit = require('express-rate-limit');

class SocketAntiAbuseManager {
  constructor() {
    this.connectionAttempts = new Map(); // IP -> attempt data
    this.suspiciousIPs = new Set();
    this.rateLimiters = new Map(); // IP -> rate limiter instance
    this.studentRestrictionManager = new StudentRestrictionManager();
  }

  /**
   * Check if client is banned before allowing socket connection
   */
  async checkBannedClient(ip, userAgent) {
    try {
      const bannedClient = await BannedClient.isBanned(ip, userAgent);
      
      if (bannedClient && bannedClient.isBanned()) {
        console.log(`🚫 Blocked banned client: ${ip} (${bannedClient.ban_reason})`);
        return {
          banned: true,
          reason: bannedClient.ban_reason,
          ban_until: bannedClient.ban_until,
          is_permanent: bannedClient.is_permanent,
          violation_count: bannedClient.violation_count
        };
      }
      
      return { banned: false };
    } catch (error) {
      console.error('Error checking banned client:', error);
      return { banned: false };
    }
  }

  /**
   * Validate socket connection attempt with granular restrictions
   */
  async validateSocketConnection(socket, monit_id, studentId = null, examId = null) {
    const ip = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];
    const origin = socket.handshake.headers.origin;

    console.log(`🔍 Validating socket connection from ${ip} for student: ${studentId}, exam: ${examId}`);

    // 1. Check granular student restrictions first (if student/exam provided)
    if (studentId && examId) {
      const restrictionCheck = await this.studentRestrictionManager.canTakeExam(studentId, examId, ip);
      if (!restrictionCheck.allowed) {
        console.log(`🚫 Student restriction blocked connection: ${restrictionCheck.restriction.type}`);
        socket.emit('connection_rejected', {
          reason: 'Student restricted',
          restrictionType: restrictionCheck.restriction.type,
          message: restrictionCheck.message,
          details: {
            type: restrictionCheck.restriction.type,
            reason: restrictionCheck.restriction.reason,
            restrictedUntil: restrictionCheck.restriction.restricted_until
          }
        });
        socket.disconnect(true);
        return false;
      }
    }

    // 2. Check legacy IP bans
    const banCheck = await this.checkBannedClient(ip, userAgent);
    if (banCheck.banned) {
      socket.emit('connection_rejected', {
        reason: 'Client is banned',
        details: banCheck,
        message: banCheck.is_permanent 
          ? 'Your access has been permanently restricted'
          : `Access restricted until ${banCheck.ban_until}`
      });
      socket.disconnect(true);
      return false;
    }

    // 3. Rate limiting per IP
    if (this.isRateLimited(ip)) {
      await this.logSuspiciousActivity(ip, userAgent, 'rate_limit_exceeded', {
        monit_id,
        student_id: studentId,
        exam_id: examId,
        attempts: this.getConnectionAttempts(ip)
      });
      
      socket.emit('connection_rejected', {
        reason: 'Rate limit exceeded',
        message: 'Too many connection attempts. Please wait before trying again.'
      });
      socket.disconnect(true);
      return false;
    }

    // 4. Validate origin (if provided)
    if (origin && !this.isValidOrigin(origin)) {
      await this.logSuspiciousActivity(ip, userAgent, 'invalid_origin', {
        monit_id,
        student_id: studentId,
        exam_id: examId,
        origin
      });
      
      socket.emit('connection_rejected', {
        reason: 'Invalid origin',
        message: 'Connection from unauthorized origin'
      });
      socket.disconnect(true);
      return false;
    }

    // 5. Basic User-Agent validation
    if (!this.isValidUserAgent(userAgent)) {
      await this.logSuspiciousActivity(ip, userAgent, 'invalid_user_agent', {
        monit_id,
        student_id: studentId,
        exam_id: examId,
        user_agent: userAgent
      });
      
      socket.emit('connection_rejected', {
        reason: 'Invalid client',
        message: 'Client validation failed'
      });
      socket.disconnect(true);
      return false;
    }

    // 5. Track connection attempt
    this.trackConnectionAttempt(ip, monit_id);

    console.log(`✅ Socket connection validated for ${ip}`);
    return true;
  }

  /**
   * Check if IP is rate limited
   */
  isRateLimited(ip) {
    const attempts = this.getConnectionAttempts(ip);
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const maxAttempts = 10;

    // Clean old attempts
    const cutoff = Date.now() - timeWindow;
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
    this.connectionAttempts.set(ip, recentAttempts);

    return recentAttempts.length >= maxAttempts;
  }

  /**
   * Get connection attempts for IP
   */
  getConnectionAttempts(ip) {
    return this.connectionAttempts.get(ip) || [];
  }

  /**
   * Track connection attempt
   */
  trackConnectionAttempt(ip, monit_id) {
    const attempts = this.getConnectionAttempts(ip);
    attempts.push({
      timestamp: Date.now(),
      monit_id
    });
    this.connectionAttempts.set(ip, attempts);
  }

  /**
   * Validate origin header
   */
  isValidOrigin(origin) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost:5000',
      'https://localhost:3000',
      'https://localhost:3001'
    ];

    // Add environment-specific origins
    if (process.env.FRONTEND_URLS) {
      allowedOrigins.push(...process.env.FRONTEND_URLS.split(','));
    }

    return allowedOrigins.includes(origin);
  }

  /**
   * Basic User-Agent validation
   */
  isValidUserAgent(userAgent) {
    if (!userAgent || userAgent.length < 10) return false;
    
    // Block known automation tools
    const blockedAgents = [
      'curl',
      'wget',
      'postman',
      'insomnia',
      'python-requests',
      'node-fetch',
      'axios',
      'headless',
      'phantom',
      'selenium',
      'webdriver',
      'bot',
      'crawler',
      'spider'
    ];

    const lowerAgent = userAgent.toLowerCase();
    return !blockedAgents.some(blocked => lowerAgent.includes(blocked));
  }

  /**
   * Log suspicious activity and apply appropriate restrictions
   */
  async logSuspiciousActivity(ip, userAgent, reason, details = {}) {
    try {
      console.log(`🚨 Suspicious activity from ${ip}: ${reason}`);

      const { student_id, exam_id, monit_id } = details;

      // If we have student context, use granular restrictions
      if (student_id) {
        const violations = this.getConnectionAttempts(ip);
        const violationCount = violations.length;

        // Escalate restrictions based on violation severity and count
        if (violationCount >= 10 || reason === 'automation_detected') {
          // Severe violations -> Global Ban
          await this.studentRestrictionManager.imposeRestriction({
            studentId: student_id,
            restrictionType: 'global_ban',
            reason: `Severe security violation: ${reason}`,
            examId: exam_id,
            ipAddress: ip,
            isPermanent: violationCount >= 15, // Permanent after 15 violations
            violationDetails: {
              source: 'anti_abuse_system',
              violation_type: reason,
              details: details,
              timestamp: new Date()
            }
          });
          console.log(`🔒 Applied global ban to student ${student_id} for ${reason}`);
          
        } else if (violationCount >= 5 || reason.includes('rate_limit') || reason.includes('invalid_origin')) {
          // Moderate violations -> Account Suspension
          const duration = Math.min(violationCount * 30 * 60 * 1000, 7 * 24 * 60 * 60 * 1000); // Max 1 week
          await this.studentRestrictionManager.imposeRestriction({
            studentId: student_id,
            restrictionType: 'account_suspension',
            reason: `Security violation: ${reason}`,
            duration: duration,
            ipAddress: ip,
            violationDetails: {
              source: 'anti_abuse_system',
              violation_type: reason,
              details: details,
              timestamp: new Date()
            }
          });
          console.log(`🔒 Applied account suspension to student ${student_id} for ${reason}`);
          
        } else if (exam_id && violationCount >= 2) {
          // Exam-specific violations -> Exam Ban
          await this.studentRestrictionManager.imposeRestriction({
            studentId: student_id,
            restrictionType: 'exam_ban',
            reason: `Exam security violation: ${reason}`,
            examId: exam_id,
            duration: Math.max(2 * 60 * 60 * 1000, violationCount * 30 * 60 * 1000), // Min 2 hours
            ipAddress: ip,
            violationDetails: {
              source: 'anti_abuse_system',
              violation_type: reason,
              details: details,
              timestamp: new Date()
            }
          });
          console.log(`🔒 Applied exam ban to student ${student_id} for exam ${exam_id}`);
        }
      }

      // Also apply IP-level restrictions for severe cases
      const existingBan = await BannedClient.findOne({ ip_address: ip });
      
      if (existingBan) {
        // Add violation to existing record
        await existingBan.addViolation({
          exam_id: exam_id,
          student_id: student_id,
          monit_id: monit_id,
          violation_details: { reason, details }
        });
      } else {
        // Create new ban for repeated violations from unknown users
        const violations = this.getConnectionAttempts(ip);
        
        if (violations.length >= 8 || this.suspiciousIPs.has(ip)) {
          await BannedClient.banClient({
            ip_address: ip,
            user_agent: userAgent,
            ban_reason: reason,
            ban_duration: 2 * 60 * 60 * 1000, // 2 hours
            violation_details: {
              exam_id: exam_id,
              student_id: student_id,
              monit_id: monit_id,
              violation_details: { reason, details }
            }
          });
          
          console.log(`🔒 IP banned ${ip} for ${reason}`);
        } else {
          // Mark as suspicious for future tracking
          this.suspiciousIPs.add(ip);
        }
      }
    } catch (error) {
      console.error('Error logging suspicious activity:', error);
    }
  }

  /**
   * Handle failed browser validation with granular restrictions
   */
  async handleFailedValidation(socket, monit_id, validationReasons, studentId = null, examId = null) {
    const ip = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];

    await this.logSuspiciousActivity(ip, userAgent, 'browser_validation_failed', {
      monit_id,
      student_id: studentId,
      exam_id: examId,
      reasons: validationReasons
    });

    // Immediate restrictions for clear automation tools
    const highRiskReasons = [
      'Automation tool detected via navigator properties',
      'Invalid or suspicious User-Agent',
      'Suspicious WebGL renderer'
    ];

    if (validationReasons.some(reason => highRiskReasons.includes(reason))) {
      // Apply immediate restrictions based on context
      if (studentId) {
        await this.studentRestrictionManager.imposeRestriction({
          studentId,
          restrictionType: 'global_ban',
          reason: 'Automation tool detected',
          examId,
          ipAddress: ip,
          duration: 24 * 60 * 60 * 1000, // 24 hours
          violationDetails: {
            source: 'automation_detection',
            validation_failures: validationReasons,
            timestamp: new Date()
          }
        });
        console.log(`🔒 Applied global ban to student ${studentId} for automation detection`);
      }

      // Also apply IP ban for severe automation detection
      await BannedClient.banClient({
        ip_address: ip,
        user_agent: userAgent,
        ban_reason: 'automation_detected',
        ban_duration: 24 * 60 * 60 * 1000, // 24 hours
        violation_details: {
          monit_id,
          student_id: studentId,
          exam_id: examId,
          violation_details: { validationReasons }
        }
      });

      console.log(`🔒 Immediately banned IP ${ip} for automation detection`);
    }
  }

  /**
   * Clean up old connection tracking data
   */
  cleanupOldData() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [ip, attempts] of this.connectionAttempts.entries()) {
      const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
      if (recentAttempts.length === 0) {
        this.connectionAttempts.delete(ip);
        this.suspiciousIPs.delete(ip);
      } else {
        this.connectionAttempts.set(ip, recentAttempts);
      }
    }
  }

  /**
   * Get anti-abuse statistics
   */
  getStats() {
    return {
      tracked_ips: this.connectionAttempts.size,
      suspicious_ips: this.suspiciousIPs.size,
      total_attempts: Array.from(this.connectionAttempts.values())
        .reduce((sum, attempts) => sum + attempts.length, 0),
      recent_attempts: Array.from(this.connectionAttempts.values())
        .reduce((sum, attempts) => {
          const recent = attempts.filter(a => Date.now() - a.timestamp < 60000);
          return sum + recent.length;
        }, 0)
    };
  }
}

// Create singleton instance
const socketAntiAbuseManager = new SocketAntiAbuseManager();

// Cleanup old data every hour
setInterval(() => {
  socketAntiAbuseManager.cleanupOldData();
}, 60 * 60 * 1000);

module.exports = {
  SocketAntiAbuseManager,
  socketAntiAbuseManager
};
