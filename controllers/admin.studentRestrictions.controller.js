/**
 * Admin Student Restrictions Controller
 * Manages granular student restrictions (exam bans, account suspensions, IP bans, global bans)
 */

const StudentRestriction = require('../models/studentRestriction.model');
const { StudentRestrictionManager, studentRestrictionManager } = require('../utils/studentRestrictionManager');
const User = require('../models/user.model');
const Exam = require('../models/exam.model');

// Using the pre-instantiated singleton instance instead of creating a new one
// const studentRestrictionManager = new StudentRestrictionManager();

/**
 * Get all active restrictions with pagination and filters
 */
const getAllRestrictions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      restrictionType,
      studentId,
      examId,
      status = 'active'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Build query
    const query = {};
    
    if (restrictionType) {
      query.restriction_type = restrictionType;
    }
    
    if (studentId) {
      query.student_id = studentId;
    }
    
    if (examId) {
      query['scope.exam_id'] = examId;
    }
    
    if (status === 'active') {
      query.$or = [
        { is_permanent: true },
        { restricted_until: { $gt: new Date() } }
      ];
    } else if (status === 'expired') {
      query.is_permanent = false;
      query.restricted_until = { $lte: new Date() };
    }

    // Get total count
    const total = await StudentRestriction.countDocuments(query);

    // Get restrictions with populated data
    const restrictions = await StudentRestriction.find(query)
      .populate('student_id', 'username firstName lastName email')
      .populate('scope.exam_id', 'title description')
      .populate('imposed_by', 'username firstName lastName')
      .populate('appeal_reviewed_by', 'username firstName lastName')
      .sort({ restricted_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Format response
    const formattedRestrictions = restrictions.map(restriction => ({
      _id: restriction._id,
      student: {
        id: restriction.student_id._id,
        username: restriction.student_id.username,
        name: `${restriction.student_id.firstName || ''} ${restriction.student_id.lastName || ''}`.trim() || restriction.student_id.username,
        email: restriction.student_id.email
      },
      restrictionType: restriction.restriction_type,
      scope: {
        examId: restriction.scope.exam_id?._id,
        examTitle: restriction.scope.exam_id?.title,
        ipAddress: restriction.scope.ip_address,
        isGlobal: restriction.scope.is_global
      },
      reason: restriction.reason,
      restrictedAt: restriction.restricted_at,
      restrictedUntil: restriction.restricted_until,
      isPermanent: restriction.is_permanent,
      isActive: restriction.isActive(),
      violationCount: restriction.violation_count,
      imposedBy: restriction.imposed_by ? {
        id: restriction.imposed_by._id,
        username: restriction.imposed_by.username,
        name: `${restriction.imposed_by.firstName || ''} ${restriction.imposed_by.lastName || ''}`.trim() || restriction.imposed_by.username
      } : null,
      adminNotes: restriction.admin_notes,
      appealStatus: restriction.appeal_status,
      appealDate: restriction.appeal_date,
      appealReason: restriction.appeal_reason,
      appealReviewedBy: restriction.appeal_reviewed_by ? {
        id: restriction.appeal_reviewed_by._id,
        username: restriction.appeal_reviewed_by.username,
        name: `${restriction.appeal_reviewed_by.firstName || ''} ${restriction.appeal_reviewed_by.lastName || ''}`.trim() || restriction.appeal_reviewed_by.username
      } : null
    }));

    res.status(200).json({
      message: "Restrictions retrieved successfully",
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      restrictions: formattedRestrictions,
      summary: {
        totalActive: await StudentRestriction.countDocuments({
          $or: [
            { is_permanent: true },
            { restricted_until: { $gt: new Date() } }
          ]
        }),
        totalExpired: await StudentRestriction.countDocuments({
          is_permanent: false,
          restricted_until: { $lte: new Date() }
        }),
        byType: {
          examBan: await StudentRestriction.countDocuments({ restriction_type: 'exam_ban' }),
          accountSuspension: await StudentRestriction.countDocuments({ restriction_type: 'account_suspension' }),
          ipBan: await StudentRestriction.countDocuments({ restriction_type: 'ip_ban' }),
          globalBan: await StudentRestriction.countDocuments({ restriction_type: 'global_ban' })
        }
      }
    });

  } catch (error) {
    console.error('Error getting restrictions:', error);
    res.status(500).json({
      message: "Failed to retrieve restrictions",
      error: error.message
    });
  }
};

/**
 * Impose a new restriction on a student
 */
const imposeRestriction = async (req, res) => {
  try {
    const {
      studentId,
      restrictionType,
      reason,
      examId = null,
      ipAddress = null,
      duration = null,
      isPermanent = false,
      adminNotes = ''
    } = req.body;

    // Validate required fields
    if (!studentId || !restrictionType || !reason) {
      return res.status(400).json({
        message: "Student ID, restriction type, and reason are required"
      });
    }

    // Validate restriction type
    const validTypes = ['exam_ban', 'account_suspension', 'ip_ban', 'global_ban'];
    if (!validTypes.includes(restrictionType)) {
      return res.status(400).json({
        message: "Invalid restriction type"
      });
    }

    // Validate exam-specific restriction
    if (restrictionType === 'exam_ban' && !examId) {
      return res.status(400).json({
        message: "Exam ID is required for exam ban"
      });
    }

    // Validate IP restriction
    if (restrictionType === 'ip_ban' && !ipAddress) {
      return res.status(400).json({
        message: "IP address is required for IP ban"
      });
    }

    // Check if student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    // Check if exam exists (for exam bans)
    if (examId) {
      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({
          message: "Exam not found"
        });
      }
    }

    // Impose the restriction
    const restriction = await studentRestrictionManager.imposeRestriction({
      studentId,
      restrictionType,
      reason,
      examId,
      ipAddress,
      duration,
      isPermanent,
      adminId: req.user._id,
      adminNotes,
      violationDetails: {
        source: 'admin_action',
        admin_username: req.user.username,
        timestamp: new Date()
      }
    });

    res.status(201).json({
      message: "Restriction imposed successfully",
      restriction: {
        id: restriction._id,
        type: restriction.restriction_type,
        reason: restriction.reason,
        restrictedUntil: restriction.restricted_until,
        isPermanent: restriction.is_permanent
      }
    });

  } catch (error) {
    console.error('Error imposing restriction:', error);
    res.status(500).json({
      message: "Failed to impose restriction",
      error: error.message
    });
  }
};

/**
 * Remove/lift a restriction
 */
const removeRestriction = async (req, res) => {
  try {
    const { restrictionId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        message: "Reason for removal is required"
      });
    }

    const restriction = await studentRestrictionManager.removeRestriction(
      restrictionId,
      req.user._id,
      reason
    );

    res.status(200).json({
      message: "Restriction removed successfully",
      restriction: {
        id: restriction._id,
        type: restriction.restriction_type,
        removedAt: new Date(),
        removedBy: req.user.username,
        reason
      }
    });

  } catch (error) {
    console.error('Error removing restriction:', error);
    res.status(500).json({
      message: "Failed to remove restriction",
      error: error.message
    });
  }
};

/**
 * Get student's active restrictions
 */
const getStudentRestrictions = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const restrictions = await studentRestrictionManager.getActiveRestrictions(studentId);

    res.status(200).json({
      message: "Student restrictions retrieved successfully",
      student: {
        id: student._id,
        username: student.username,
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username,
        email: student.email
      },
      restrictions: restrictions.map(r => ({
        id: r._id,
        type: r.restriction_type,
        reason: r.reason,
        restrictedAt: r.restricted_at,
        restrictedUntil: r.restricted_until,
        isPermanent: r.is_permanent,
        isActive: r.isActive(),
        scope: r.scope,
        violationCount: r.violation_count,
        appealStatus: r.appeal_status
      })),
      canTakeExams: restrictions.length === 0 || !restrictions.some(r => 
        r.restriction_type === 'global_ban' || 
        r.restriction_type === 'account_suspension'
      )
    });

  } catch (error) {
    console.error('Error getting student restrictions:', error);
    res.status(500).json({
      message: "Failed to retrieve student restrictions",
      error: error.message
    });
  }
};

/**
 * Process student appeal
 */
const processAppeal = async (req, res) => {
  try {
    const { restrictionId } = req.params;
    const { decision, reviewNotes } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        message: "Decision must be either 'approved' or 'rejected'"
      });
    }

    const restriction = await StudentRestriction.findById(restrictionId);
    if (!restriction) {
      return res.status(404).json({
        message: "Restriction not found"
      });
    }

    if (restriction.appeal_status !== 'submitted') {
      return res.status(400).json({
        message: "No pending appeal found for this restriction"
      });
    }

    // Update appeal status
    restriction.appeal_status = decision;
    restriction.appeal_reviewed_by = req.user._id;
    restriction.admin_notes += `\nAppeal ${decision} by ${req.user.username} on ${new Date()}: ${reviewNotes || 'No notes provided'}`;

    // If approved, remove the restriction
    if (decision === 'approved') {
      restriction.restricted_until = new Date(); // Expire immediately
    }

    await restriction.save();

    res.status(200).json({
      message: `Appeal ${decision} successfully`,
      restriction: {
        id: restriction._id,
        appealStatus: restriction.appeal_status,
        reviewedBy: req.user.username,
        reviewedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error processing appeal:', error);
    res.status(500).json({
      message: "Failed to process appeal",
      error: error.message
    });
  }
};

/**
 * Get restriction statistics
 */
const getRestrictionStats = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get overall statistics
    const totalRestrictions = await StudentRestriction.countDocuments({});
    const activeRestrictions = await StudentRestriction.countDocuments({
      $or: [
        { is_permanent: true },
        { restricted_until: { $gt: new Date() } }
      ]
    });

    // Get restrictions by type
    const restrictionsByType = await StudentRestriction.aggregate([
      {
        $group: {
          _id: '$restriction_type',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$is_permanent', true] },
                    { $gt: ['$restricted_until', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get recent restrictions
    const recentRestrictions = await StudentRestriction.find({
      restricted_at: { $gte: startDate }
    }).countDocuments();

    // Get appeal statistics
    const appealStats = await StudentRestriction.aggregate([
      {
        $group: {
          _id: '$appeal_status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top reasons for restrictions
    const topReasons = await StudentRestriction.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      message: "Restriction statistics retrieved successfully",
      timeframe,
      stats: {
        total: totalRestrictions,
        active: activeRestrictions,
        expired: totalRestrictions - activeRestrictions,
        recent: recentRestrictions,
        byType: restrictionsByType.reduce((acc, item) => {
          acc[item._id] = {
            total: item.count,
            active: item.activeCount
          };
          return acc;
        }, {}),
        appeals: appealStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topReasons: topReasons.map(item => ({
          reason: item._id,
          count: item.count
        }))
      }
    });

  } catch (error) {
    console.error('Error getting restriction stats:', error);
    res.status(500).json({
      message: "Failed to retrieve restriction statistics",
      error: error.message
    });
  }
};

/**
 * Check if student can take exam
 */
const checkStudentAccess = async (req, res) => {
  try {
    const { studentId, examId } = req.params;
    const { ipAddress } = req.body;

    const accessCheck = await studentRestrictionManager.canTakeExam(
      studentId,
      examId,
      ipAddress || req.ip
    );

    res.status(200).json({
      message: "Access check completed",
      allowed: accessCheck.allowed,
      restriction: accessCheck.restriction || null,
      message: accessCheck.message || "Access granted"
    });

  } catch (error) {
    console.error('Error checking student access:', error);
    res.status(500).json({
      message: "Failed to check student access",
      error: error.message
    });
  }
};

module.exports = {
  getAllRestrictions,
  imposeRestriction,
  removeRestriction,
  getStudentRestrictions,
  processAppeal,
  getRestrictionStats,
  checkStudentAccess
};
