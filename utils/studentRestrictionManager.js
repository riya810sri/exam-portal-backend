/**
 * Student Restriction Manager
 * Handles granular restriction enforcement and management
 */

const StudentRestriction = require('../models/studentRestriction.model');
const SecurityEvent = require('../models/securityEvent.model');

class StudentRestrictionManager {
  /**
   * Check if student can take a specific exam
   */
  async canTakeExam(studentId, examId, ipAddress) {
    try {
      // Check exam-specific restrictions
      const examRestriction = await StudentRestriction.checkExamRestriction(studentId, examId);
      if (examRestriction.restricted) {
        return {
          allowed: false,
          restriction: examRestriction,
          message: this.getRestrictionMessage(examRestriction)
        };
      }
      
      // Check IP-based restrictions
      const ipRestriction = await StudentRestriction.checkIPRestriction(ipAddress);
      if (ipRestriction.restricted) {
        return {
          allowed: false,
          restriction: ipRestriction,
          message: this.getRestrictionMessage(ipRestriction)
        };
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Error checking exam restrictions:', error);
      return { allowed: true }; // Fail open for availability
    }
  }
  
  /**
   * Impose restriction on student
   */
  async imposeRestriction(restrictionData) {
    try {
      const {
        studentId,
        restrictionType,
        reason,
        examId = null,
        ipAddress = null,
        duration = null,
        isPermanent = false,
        adminId = null,
        adminNotes = '',
        violationDetails = {}
      } = restrictionData;
      
      // Check for existing restriction
      let existingRestriction = null;
      
      if (restrictionType === 'exam_ban' && examId) {
        existingRestriction = await StudentRestriction.findOne({
          student_id: studentId,
          restriction_type: 'exam_ban',
          'scope.exam_id': examId
        });
      } else if (restrictionType === 'account_suspension') {
        existingRestriction = await StudentRestriction.findOne({
          student_id: studentId,
          restriction_type: 'account_suspension'
        });
      } else if (restrictionType === 'ip_ban' && ipAddress) {
        existingRestriction = await StudentRestriction.findOne({
          restriction_type: 'ip_ban',
          'scope.ip_address': ipAddress
        });
      }
      
      if (existingRestriction && existingRestriction.isActive()) {
        // Add violation to existing restriction
        existingRestriction.addViolation({
          exam_id: examId,
          violation_type: reason,
          details: violationDetails,
          ip_address: ipAddress,
          user_agent: violationDetails.user_agent
        });
        
        await existingRestriction.save();
        return existingRestriction;
      }
      
      // Create new restriction
      const restrictionScope = {};
      if (restrictionType === 'exam_ban') {
        restrictionScope.exam_id = examId;
      } else if (restrictionType === 'ip_ban') {
        restrictionScope.ip_address = ipAddress;
      } else if (restrictionType === 'global_ban') {
        restrictionScope.is_global = true;
      }
      
      const restrictedUntil = isPermanent ? null : 
        duration ? new Date(Date.now() + duration) :
        this.getDefaultDuration(restrictionType);
      
      const newRestriction = new StudentRestriction({
        student_id: studentId,
        restriction_type: restrictionType,
        scope: restrictionScope,
        reason,
        restricted_until: restrictedUntil,
        is_permanent: isPermanent,
        imposed_by: adminId,
        admin_notes: adminNotes,
        violation_history: [{
          exam_id: examId,
          violation_type: reason,
          details: violationDetails,
          ip_address: ipAddress,
          user_agent: violationDetails.user_agent
        }]
      });
      
      await newRestriction.save();
      
      // Log security event
      await this.logRestrictionEvent(studentId, examId, restrictionType, reason, violationDetails);
      
      console.log(`🚫 Imposed ${restrictionType} on student ${studentId}: ${reason}`);
      return newRestriction;
      
    } catch (error) {
      console.error('Error imposing restriction:', error);
      throw error;
    }
  }
  
  /**
   * Remove restriction (for appeals or admin action)
   */
  async removeRestriction(restrictionId, removedBy, reason) {
    try {
      const restriction = await StudentRestriction.findById(restrictionId);
      if (!restriction) {
        throw new Error('Restriction not found');
      }
      
      restriction.restricted_until = new Date(); // Immediate expiry
      restriction.admin_notes += `\nRemoved by admin on ${new Date()}: ${reason}`;
      restriction.appeal_status = 'approved';
      restriction.appeal_reviewed_by = removedBy;
      
      await restriction.save();
      
      console.log(`✅ Removed restriction ${restrictionId}: ${reason}`);
      return restriction;
    } catch (error) {
      console.error('Error removing restriction:', error);
      throw error;
    }
  }
  
  /**
   * Get default duration for restriction types
   */
  getDefaultDuration(restrictionType) {
    const durations = {
      'exam_ban': 2 * 60 * 60 * 1000,        // 2 hours
      'account_suspension': 60 * 60 * 1000,   // 1 hour
      'ip_ban': 24 * 60 * 60 * 1000,         // 1 day
      'global_ban': null                      // Permanent
    };
    
    const duration = durations[restrictionType];
    return duration ? new Date(Date.now() + duration) : null;
  }
  
  /**
   * Get user-friendly restriction message
   */
  getRestrictionMessage(restriction) {
    const messages = {
      'exam_ban': `You are temporarily banned from this exam due to ${restriction.reason}. Access will be restored ${restriction.is_permanent ? 'after review' : `on ${restriction.until}`}.`,
      'account_suspension': `Your account is temporarily suspended due to ${restriction.reason}. Access will be restored ${restriction.is_permanent ? 'after review' : `on ${restriction.until}`}.`,
      'ip_ban': `Access from this network is restricted due to ${restriction.reason}. ${restriction.is_permanent ? 'This restriction is permanent.' : `Restriction will be lifted on ${restriction.until}.`}`,
      'global_ban': `Your access has been permanently restricted due to ${restriction.reason}. Please contact support for assistance.`
    };
    
    return messages[restriction.type] || 'Access is currently restricted.';
  }
  
  /**
   * Auto-escalate restrictions based on violation patterns
   */
  async autoEscalateRestriction(studentId, examId, violationType, violationDetails) {
    try {
      // Get recent violations for this student
      const recentRestrictions = await StudentRestriction.find({
        student_id: studentId,
        restricted_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });
      
      const violationCount = recentRestrictions.reduce((count, r) => count + r.violation_count, 0);
      
      // Escalation logic
      let restrictionType = 'exam_ban';
      let duration = null;
      let isPermanent = false;
      
      if (violationCount >= 5) {
        restrictionType = 'global_ban';
        isPermanent = true;
      } else if (violationCount >= 3) {
        restrictionType = 'account_suspension';
        duration = 7 * 24 * 60 * 60 * 1000; // 1 week
      } else if (violationCount >= 2) {
        restrictionType = 'account_suspension';
        duration = 24 * 60 * 60 * 1000; // 1 day
      } else {
        duration = 2 * 60 * 60 * 1000; // 2 hours exam ban
      }
      
      return await this.imposeRestriction({
        studentId,
        restrictionType,
        reason: violationType,
        examId: restrictionType === 'exam_ban' ? examId : null,
        ipAddress: violationDetails.ip_address,
        duration,
        isPermanent,
        adminNotes: `Auto-escalated restriction (${violationCount + 1} violations)`,
        violationDetails
      });
      
    } catch (error) {
      console.error('Error auto-escalating restriction:', error);
      throw error;
    }
  }
  
  /**
   * Get student's active restrictions
   */
  async getActiveRestrictions(studentId) {
    try {
      const restrictions = await StudentRestriction.find({
        student_id: studentId
      }).populate('scope.exam_id', 'title').sort({ restricted_at: -1 });
      
      return restrictions.filter(r => r.isActive());
    } catch (error) {
      console.error('Error getting active restrictions:', error);
      return [];
    }
  }
  
  /**
   * Get restriction statistics for admin dashboard
   */
  async getRestrictionStats(timeRange = 24) {
    try {
      const since = new Date(Date.now() - timeRange * 60 * 60 * 1000);
      
      const stats = await StudentRestriction.aggregate([
        { $match: { restricted_at: { $gte: since } } },
        {
          $group: {
            _id: '$restriction_type',
            count: { $sum: 1 },
            violations: { $sum: '$violation_count' }
          }
        }
      ]);
      
      const activeRestrictions = await StudentRestriction.countDocuments({
        $or: [
          { is_permanent: true },
          { restricted_until: { $gt: new Date() } }
        ]
      });
      
      return {
        recent_restrictions: stats,
        active_restrictions: activeRestrictions,
        time_range: `${timeRange} hours`
      };
    } catch (error) {
      console.error('Error getting restriction stats:', error);
      return {};
    }
  }
  
  /**
   * Log restriction-related security event
   */
  async logRestrictionEvent(studentId, examId, restrictionType, reason, details) {
    try {
      const securityEvent = new SecurityEvent({
        student_id: studentId,
        exam_id: examId,
        monit_id: details.monit_id,
        event_type: 'restriction_imposed',
        timestamp: Date.now(),
        details: {
          restriction_type: restrictionType,
          reason,
          ...details
        },
        risk_score: 95,
        is_suspicious: true,
        ip_address: details.ip_address,
        user_agent: details.user_agent
      });
      
      await securityEvent.save();
    } catch (error) {
      console.error('Error logging restriction event:', error);
    }
  }
  
  /**
   * Handle student appeal
   */
  async submitAppeal(restrictionId, studentId, appealReason) {
    try {
      const restriction = await StudentRestriction.findOne({
        _id: restrictionId,
        student_id: studentId
      });
      
      if (!restriction) {
        throw new Error('Restriction not found');
      }
      
      if (restriction.appeal_status !== 'none') {
        throw new Error('Appeal already submitted');
      }
      
      restriction.appeal_status = 'submitted';
      restriction.appeal_date = new Date();
      restriction.appeal_reason = appealReason;
      
      await restriction.save();
      
      console.log(`📝 Appeal submitted for restriction ${restrictionId}`);
      return restriction;
    } catch (error) {
      console.error('Error submitting appeal:', error);
      throw error;
    }
  }
}

// Create singleton instance
const studentRestrictionManager = new StudentRestrictionManager();

module.exports = {
  StudentRestrictionManager,
  studentRestrictionManager
};
