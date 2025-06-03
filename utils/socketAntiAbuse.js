/**
 * Enhanced Anti-Abuse Middleware for Dynamic Socket Connections
 * Provides comprehensive protection against automation, proxy usage, and repeated violations
 */

const BannedClient = require('../models/bannedClient.model');
const rateLimit = require('express-rate-limit');

class SocketAntiAbuseManager {
  constructor() {
    this.connectionAttempts = new Map(); // IP -> attempt data
    this.suspiciousIPs = new Set();
    this.rateLimiters = new Map(); // IP -> rate limiter instance
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
   * Validate socket connection attempt
   */
  async validateSocketConnection(socket, monit_id) {
    const ip = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];
    const origin = socket.handshake.headers.origin;

    console.log(`🔍 Validating socket connection from ${ip}`);

    // 1. Check if client is banned
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

    // 2. Rate limiting per IP
    if (this.isRateLimited(ip)) {
      await this.logSuspiciousActivity(ip, userAgent, 'rate_limit_exceeded', {
        monit_id,
        attempts: this.getConnectionAttempts(ip)
      });
      
      socket.emit('connection_rejected', {
        reason: 'Rate limit exceeded',
        message: 'Too many connection attempts. Please wait before trying again.'
      });
      socket.disconnect(true);
      return false;
    }

    // 3. Validate origin (if provided)
    if (origin && !this.isValidOrigin(origin)) {
      await this.logSuspiciousActivity(ip, userAgent, 'invalid_origin', {
        monit_id,
        origin
      });
      
      socket.emit('connection_rejected', {
        reason: 'Invalid origin',
        message: 'Connection from unauthorized origin'
      });
      socket.disconnect(true);
      return false;
    }

    // 4. Basic User-Agent validation
    if (!this.isValidUserAgent(userAgent)) {
      await this.logSuspiciousActivity(ip, userAgent, 'invalid_user_agent', {
        monit_id,
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
   * Log suspicious activity and potentially ban client
   */
  async logSuspiciousActivity(ip, userAgent, reason, details = {}) {
    try {
      console.log(`🚨 Suspicious activity from ${ip}: ${reason}`);

      // Check if this IP is already flagged
      const existingBan = await BannedClient.findOne({ ip_address: ip });
      
      if (existingBan) {
        // Add violation to existing record
        await existingBan.addViolation({
          exam_id: details.exam_id,
          student_id: details.student_id,
          monit_id: details.monit_id,
          violation_details: { reason, details }
        });
      } else {
        // Create new ban for repeated violations
        const violations = this.getConnectionAttempts(ip);
        
        if (violations.length >= 5 || this.suspiciousIPs.has(ip)) {
          await BannedClient.banClient({
            ip_address: ip,
            user_agent: userAgent,
            ban_reason: reason,
            ban_duration: 2 * 60 * 60 * 1000, // 2 hours
            violation_details: {
              exam_id: details.exam_id,
              student_id: details.student_id,
              monit_id: details.monit_id,
              violation_details: { reason, details }
            }
          });
          
          console.log(`🔒 Banned client ${ip} for ${reason}`);
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
   * Handle failed browser validation
   */
  async handleFailedValidation(socket, monit_id, validationReasons) {
    const ip = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];

    await this.logSuspiciousActivity(ip, userAgent, 'browser_validation_failed', {
      monit_id,
      reasons: validationReasons
    });

    // Immediate ban for clear automation tools
    const highRiskReasons = [
      'Automation tool detected via navigator properties',
      'Invalid or suspicious User-Agent',
      'Suspicious WebGL renderer'
    ];

    if (validationReasons.some(reason => highRiskReasons.includes(reason))) {
      await BannedClient.banClient({
        ip_address: ip,
        user_agent: userAgent,
        ban_reason: 'automation_detected',
        ban_duration: 24 * 60 * 60 * 1000, // 24 hours
        violation_details: {
          monit_id,
          violation_details: { validationReasons }
        }
      });

      console.log(`🔒 Immediately banned ${ip} for automation detection`);
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
