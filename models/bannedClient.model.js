/**
 * Banned Clients Model
 * Tracks and stores information about banned IPs, user agents, and suspicious clients
 */

const mongoose = require('mongoose');

const bannedClientSchema = new mongoose.Schema({
  // Client identification
  ip_address: {
    type: String,
    required: true
  },
  
  user_agent: {
    type: String,
    required: true
  },
  
  // Ban details
  ban_reason: {
    type: String,
    required: true,
    enum: [
      'automation_detected',
      'proxy_detected', 
      'repeated_violations',
      'suspicious_behavior',
      'invalid_browser',
      'tampering_detected',
      'multiple_failed_validations',
      'security_threat'
    ]
  },
  
  // Attempt tracking
  violation_count: {
    type: Number,
    default: 1,
    min: 1
  },
  
  first_violation: {
    type: Date,
    default: Date.now
  },
  
  last_violation: {
    type: Date,
    default: Date.now
  },
  
  // Ban duration
  ban_until: {
    type: Date,
    required: true
  },
  
  is_permanent: {
    type: Boolean,
    default: false
  },
  
  // Additional context
  exam_attempts: [{
    exam_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam'
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    monit_id: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    violation_details: mongoose.Schema.Types.Mixed
  }],
  
  // Fingerprinting data
  browser_fingerprint: {
    canvas: String,
    webGL: String,
    fonts: [String],
    plugins: [String],
    screen_resolution: String,
    timezone: String,
    hardware_concurrency: Number,
    device_memory: Number
  },
  
  // Geographic data
  country: String,
  region: String,
  isp: String,
  
  // Administrative
  admin_notes: String,
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  review_date: Date,
  
  // Auto-unban
  auto_unban: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'banned_clients'
});

// Indexes for performance
bannedClientSchema.index({ ip_address: 1, ban_until: 1 });
bannedClientSchema.index({ user_agent: 1 });
bannedClientSchema.index({ ban_until: 1, is_permanent: 1 });

// TTL index to auto-remove non-permanent bans
bannedClientSchema.index({ ban_until: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { is_permanent: false }
});

// Instance methods
bannedClientSchema.methods.isBanned = function() {
  if (this.is_permanent) return true;
  return this.ban_until > new Date();
};

bannedClientSchema.methods.addViolation = function(violationData) {
  this.violation_count += 1;
  this.last_violation = new Date();
  
  if (violationData) {
    this.exam_attempts.push(violationData);
  }
  
  // Increase ban duration based on violation count
  const baseDuration = 60 * 60 * 1000; // 1 hour
  const multiplier = Math.min(this.violation_count, 10); // Max 10x
  this.ban_until = new Date(Date.now() + (baseDuration * multiplier));
  
  // Make permanent after 10 violations
  if (this.violation_count >= 10) {
    this.is_permanent = true;
  }
  
  return this.save();
};

bannedClientSchema.methods.unban = function() {
  this.ban_until = new Date();
  this.is_permanent = false;
  return this.save();
};

// Static methods
bannedClientSchema.statics.isBanned = async function(ip, userAgent) {
  const bannedClient = await this.findOne({
    ip_address: ip,
    $or: [
      { is_permanent: true },
      { ban_until: { $gt: new Date() } }
    ]
  });
  
  return bannedClient ? bannedClient : null;
};

bannedClientSchema.statics.banClient = async function(clientData) {
  const {
    ip_address,
    user_agent,
    ban_reason,
    ban_duration = 60 * 60 * 1000, // 1 hour default
    violation_details,
    browser_fingerprint
  } = clientData;
  
  // Check if client is already banned
  let bannedClient = await this.findOne({ ip_address });
  
  if (bannedClient) {
    // Add violation to existing ban
    await bannedClient.addViolation(violation_details);
    return bannedClient;
  } else {
    // Create new ban
    bannedClient = new this({
      ip_address,
      user_agent,
      ban_reason,
      ban_until: new Date(Date.now() + ban_duration),
      browser_fingerprint,
      exam_attempts: violation_details ? [violation_details] : []
    });
    
    await bannedClient.save();
    return bannedClient;
  }
};

bannedClientSchema.statics.getBanStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$ban_reason',
        count: { $sum: 1 },
        permanent_bans: { 
          $sum: { $cond: ['$is_permanent', 1, 0] } 
        },
        temp_bans: { 
          $sum: { $cond: ['$is_permanent', 0, 1] } 
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('BannedClient', bannedClientSchema);
