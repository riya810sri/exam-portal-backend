/**
 * Student Restrictions Model
 * Handles granular restrictions: exam-specific bans, account suspensions, and global bans
 */

const mongoose = require('mongoose');

const studentRestrictionSchema = new mongoose.Schema({
  // Student identification
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Restriction type and scope
  restriction_type: {
    type: String,
    required: true,
    enum: [
      'exam_ban',           // Banned from specific exam
      'account_suspension', // Temporary account suspension
      'ip_ban',            // IP-based ban (severe)
      'global_ban'         // Permanent global ban (extreme)
    ]
  },
  
  // Scope of restriction
  scope: {
    // For exam-specific bans
    exam_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam'
    },
    
    // For IP bans
    ip_address: String,
    
    // For global restrictions
    is_global: {
      type: Boolean,
      default: false
    }
  },
  
  // Restriction details
  reason: {
    type: String,
    required: true,
    enum: [
      'cheating_detected',
      'automation_tools',
      'multiple_violations',
      'suspicious_behavior',
      'tampering_attempt',
      'proxy_usage',
      'invalid_browser',
      'admin_action',
      'security_threat'
    ]
  },
  
  // Duration and timing
  restricted_at: {
    type: Date,
    default: Date.now
  },
  
  restricted_until: {
    type: Date,
    required: function() {
      return this.restriction_type !== 'global_ban';
    }
  },
  
  is_permanent: {
    type: Boolean,
    default: false
  },
  
  // Violation tracking
  violation_count: {
    type: Number,
    default: 1,
    min: 1
  },
  
  violation_history: [{
    date: {
      type: Date,
      default: Date.now
    },
    exam_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam'
    },
    monit_id: String,
    violation_type: String,
    details: mongoose.Schema.Types.Mixed,
    ip_address: String,
    user_agent: String
  }],
  
  // Administrative details
  imposed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who imposed restriction
  },
  
  admin_notes: String,
  
  // Appeal system
  appeal_status: {
    type: String,
    enum: ['none', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'none'
  },
  
  appeal_date: Date,
  appeal_reason: String,
  appeal_reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Auto-removal
  auto_remove: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'student_restrictions'
});

// Compound indexes for efficient queries
studentRestrictionSchema.index({ student_id: 1, restriction_type: 1 });
studentRestrictionSchema.index({ 'scope.exam_id': 1, student_id: 1 });
studentRestrictionSchema.index({ 'scope.ip_address': 1 });
studentRestrictionSchema.index({ restricted_until: 1, is_permanent: 1 });

// TTL index for non-permanent restrictions
studentRestrictionSchema.index({ restricted_until: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { 
    is_permanent: false,
    auto_remove: true 
  }
});

// Instance methods
studentRestrictionSchema.methods.isActive = function() {
  if (this.is_permanent) return true;
  if (!this.restricted_until) return false;
  return this.restricted_until > new Date();
};

studentRestrictionSchema.methods.addViolation = function(violationData) {
  this.violation_count += 1;
  this.violation_history.push(violationData);
  
  // Escalate restriction duration based on violation count
  if (!this.is_permanent && this.auto_remove) {
    const escalationMap = {
      'exam_ban': [
        2 * 60 * 60 * 1000,    // 2 hours
        24 * 60 * 60 * 1000,   // 1 day
        7 * 24 * 60 * 60 * 1000, // 1 week
        30 * 24 * 60 * 60 * 1000 // 1 month
      ],
      'account_suspension': [
        60 * 60 * 1000,        // 1 hour
        6 * 60 * 60 * 1000,    // 6 hours
        24 * 60 * 60 * 1000,   // 1 day
        7 * 24 * 60 * 60 * 1000 // 1 week
      ],
      'ip_ban': [
        24 * 60 * 60 * 1000,   // 1 day
        7 * 24 * 60 * 60 * 1000, // 1 week
        30 * 24 * 60 * 60 * 1000, // 1 month
        90 * 24 * 60 * 60 * 1000  // 3 months
      ]
    };
    
    const durations = escalationMap[this.restriction_type];
    if (durations) {
      const durationIndex = Math.min(this.violation_count - 1, durations.length - 1);
      this.restricted_until = new Date(Date.now() + durations[durationIndex]);
      
      // Make permanent after too many violations
      if (this.violation_count >= 5) {
        this.is_permanent = true;
        this.restriction_type = 'global_ban';
        this.scope.is_global = true;
      }
    }
  }
};

// Static methods for checking restrictions
studentRestrictionSchema.statics.checkExamRestriction = async function(studentId, examId) {
  const restriction = await this.findOne({
    student_id: studentId,
    $or: [
      { 
        restriction_type: 'exam_ban',
        'scope.exam_id': examId
      },
      { 
        restriction_type: 'account_suspension'
      },
      { 
        restriction_type: 'global_ban'
      }
    ]
  }).sort({ restricted_at: -1 });
  
  if (restriction && restriction.isActive()) {
    return {
      restricted: true,
      type: restriction.restriction_type,
      reason: restriction.reason,
      until: restriction.restricted_until,
      is_permanent: restriction.is_permanent,
      violation_count: restriction.violation_count
    };
  }
  
  return { restricted: false };
};

studentRestrictionSchema.statics.checkIPRestriction = async function(ipAddress) {
  const restriction = await this.findOne({
    $or: [
      { 
        restriction_type: 'ip_ban',
        'scope.ip_address': ipAddress
      },
      { 
        restriction_type: 'global_ban',
        'scope.is_global': true
      }
    ]
  }).sort({ restricted_at: -1 });
  
  if (restriction && restriction.isActive()) {
    return {
      restricted: true,
      type: restriction.restriction_type,
      reason: restriction.reason,
      until: restriction.restricted_until,
      is_permanent: restriction.is_permanent
    };
  }
  
  return { restricted: false };
};

studentRestrictionSchema.statics.getStudentRestrictions = async function(studentId) {
  return await this.find({
    student_id: studentId
  }).populate('scope.exam_id', 'title').sort({ restricted_at: -1 });
};

// Pre-save middleware for validation
studentRestrictionSchema.pre('save', function(next) {
  // Validate scope based on restriction type
  if (this.restriction_type === 'exam_ban' && !this.scope.exam_id) {
    next(new Error('Exam ID required for exam-specific bans'));
  } else if (this.restriction_type === 'ip_ban' && !this.scope.ip_address) {
    next(new Error('IP address required for IP bans'));
  } else if (this.restriction_type === 'global_ban') {
    this.scope.is_global = true;
    this.is_permanent = true;
  }
  
  next();
});

module.exports = mongoose.model('StudentRestriction', studentRestrictionSchema);
