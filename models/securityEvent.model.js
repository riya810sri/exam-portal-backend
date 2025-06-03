/**
 * Security Events Model
 * Stores all browser monitoring events for security analysis
 */

const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  // Monitoring session details
  monit_id: {
    type: String,
    required: true
  },
  exam_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Event details
  event_type: {
    type: String,
    required: true,
    enum: [
      'keydown', 'keyup', 'keypress',
      'copy', 'cut', 'paste',
      'contextmenu', 'blur', 'focus',
      'visibilitychange', 'fullscreenchange',
      'devtools_detected', 'mousemove', 'click', 
      'scroll', 'resize', 'beforeunload',
      'popstate', 'hashchange', 'storage',
      'window_focus', 'window_blur',
      'tab_switch', 'browser_switch',
      'multiple_tabs', 'automation_detected'
    ],
  },
  
  timestamp: {
    type: Number,
    required: true
  },
  
  // Event-specific details
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Security analysis
  risk_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  is_suspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Session context
  session_duration: Number, // Time since exam start (ms)
  question_number: Number,
  page_url: String,
  
  // Browser fingerprint
  user_agent: String,
  screen_resolution: String,
  timezone: String,
  
  // Network details
  ip_address: String,
  country: String,
  
  // Processing status
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  flagged_for_review: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'security_events'
});

// Indexes for performance
securityEventSchema.index({ monit_id: 1, timestamp: 1 });
securityEventSchema.index({ exam_id: 1, student_id: 1, timestamp: 1 });
securityEventSchema.index({ event_type: 1, is_suspicious: 1 });
securityEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

// Static methods for analytics
securityEventSchema.statics.getEventsBySession = function(monit_id) {
  return this.find({ monit_id }).sort({ timestamp: 1 });
};

securityEventSchema.statics.getSuspiciousEvents = function(exam_id, student_id) {
  return this.find({ 
    exam_id, 
    student_id, 
    is_suspicious: true 
  }).sort({ timestamp: -1 });
};

securityEventSchema.statics.getEventStats = function(exam_id) {
  return this.aggregate([
    { $match: { exam_id: mongoose.Types.ObjectId(exam_id) } },
    { 
      $group: {
        _id: '$event_type',
        count: { $sum: 1 },
        suspicious_count: { 
          $sum: { $cond: ['$is_suspicious', 1, 0] } 
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
