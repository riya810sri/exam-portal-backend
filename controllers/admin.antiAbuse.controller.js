/**
 * Admin endpoints for anti-abuse system management
 * Provides configuration, monitoring, and review capabilities
 */

const ExamAttendance = require('../models/examAttendance.model');
const User = require('../models/user.model');
const { securityMonitor } = require('../utils/securityMonitor');
const { patternDetector } = require('../utils/serverPatternDetection');

/**
 * Get security dashboard overview
 */
const getSecurityDashboard = async (req, res) => {
  try {
    // Get current monitoring statistics
    const monitorStats = securityMonitor.getStats();
    const sessionStats = patternDetector.getSessionStats();
    
    // Get recent high-risk sessions
    const highRiskSessions = await ExamAttendance.find({
      'riskAssessment.overallRiskScore': { $gte: 70 },
      status: { $in: ['IN_PROGRESS', 'COMPLETED', 'TIMED_OUT', 'SUSPENDED'] },
      startTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).populate('userId', 'username firstName lastName email')
      .populate('examId', 'title')
      .sort({ 'riskAssessment.lastUpdated': -1 })
      .limit(20);

    // Get sessions flagged for review
    const flaggedSessions = await ExamAttendance.find({
      flaggedForReview: true,
      reviewCompletedAt: { $exists: false }
    }).populate('userId', 'username firstName lastName email')
      .populate('examId', 'title')
      .sort({ reviewRequestedAt: -1 })
      .limit(10);

    // Get recent violations by type
    const violationStats = await ExamAttendance.aggregate([
      {
        $match: {
          cheatEvidence: { $exists: true, $ne: [] },
          startTime: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }
      },
      { $unwind: '$cheatEvidence' },
      {
        $group: {
          _id: '$cheatEvidence.evidenceType',
          count: { $sum: 1 },
          latestIncident: { $max: '$cheatEvidence.timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      message: 'Security dashboard data retrieved successfully',
      overview: {
        totalActiveAlerts: monitorStats.totalAlertsToday,
        highRiskSessions: monitorStats.highRiskSessions,
        suspendedSessions: monitorStats.suspendedSessions,
        activeSessions: sessionStats.activeSessions,
        flaggedForReview: flaggedSessions.length
      },
      detectionTypes: monitorStats.detectionTypes,
      violationStats,
      recentHighRiskSessions: highRiskSessions.map(session => ({
        attendanceId: session._id,
        user: {
          id: session.userId._id,
          username: session.userId.username,
          name: `${session.userId.firstName || ''} ${session.userId.lastName || ''}`.trim()
        },
        exam: {
          id: session.examId._id,
          title: session.examId.title
        },
        riskScore: session.riskAssessment.overallRiskScore,
        violationCount: session.riskAssessment.violationCount,
        status: session.status,
        lastUpdated: session.riskAssessment.lastUpdated,
        flaggedForReview: session.flaggedForReview
      })),
      flaggedSessions: flaggedSessions.map(session => ({
        attendanceId: session._id,
        user: {
          id: session.userId._id,
          username: session.userId.username,
          name: `${session.userId.firstName || ''} ${session.userId.lastName || ''}`.trim()
        },
        exam: {
          id: session.examId._id,
          title: session.examId.title
        },
        reviewPriority: session.reviewPriority,
        reviewReason: session.reviewReason,
        reviewRequestedAt: session.reviewRequestedAt,
        riskScore: session.riskAssessment?.overallRiskScore || 0
      })),
      sessionStats: sessionStats.sessions,
      config: monitorStats.config
    });

  } catch (error) {
    console.error('Error in getSecurityDashboard:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Get detailed analysis of a specific session
 */
const getSessionAnalysis = async (req, res) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await ExamAttendance.findById(attendanceId)
      .populate('userId', 'username firstName lastName email')
      .populate('examId', 'title description duration');

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Calculate risk timeline
    const riskTimeline = [];
    if (attendance.cheatEvidence && attendance.cheatEvidence.length > 0) {
      attendance.cheatEvidence.forEach((evidence, index) => {
        riskTimeline.push({
          timestamp: evidence.timestamp,
          type: evidence.evidenceType,
          source: evidence.source,
          details: evidence.details,
          severity: calculateSeverity(evidence.evidenceType)
        });
      });
    }

    // Analyze request patterns
    const requestAnalysis = analyzeRequestLog(attendance.requestLog || []);

    // Calculate session metrics
    const sessionMetrics = {
      duration: attendance.endTime ? 
        (new Date(attendance.endTime) - new Date(attendance.startTime)) / 1000 / 60 : 
        (new Date() - new Date(attendance.startTime)) / 1000 / 60,
      answersSubmitted: attendance.attemptedQuestions || 0,
      averageResponseTime: attendance.behaviorProfile?.averageResponseTime || 0,
      suspiciousPatternCount: attendance.behaviorProfile?.suspiciousPatternCount || 0
    };

    res.status(200).json({
      message: 'Session analysis retrieved successfully',
      attendance: {
        id: attendance._id,
        user: {
          id: attendance.userId._id,
          username: attendance.userId.username,
          name: `${attendance.userId.firstName || ''} ${attendance.userId.lastName || ''}`.trim(),
          email: attendance.userId.email
        },
        exam: {
          id: attendance.examId._id,
          title: attendance.examId.title,
          description: attendance.examId.description,
          duration: attendance.examId.duration
        },
        status: attendance.status,
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptNumber: attendance.attemptNumber
      },
      riskAssessment: attendance.riskAssessment || {
        overallRiskScore: 0,
        riskFactors: [],
        violationCount: 0,
        confidence: 0
      },
      sessionMetrics,
      riskTimeline: riskTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      requestAnalysis,
      sessionFingerprint: attendance.sessionFingerprint || {},
      requestMetrics: attendance.requestMetrics || {},
      behaviorProfile: attendance.behaviorProfile || {}
    });

  } catch (error) {
    console.error('Error in getSessionAnalysis:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Update risk thresholds configuration
 */
const updateRiskThresholds = async (req, res) => {
  try {
    const { 
      highRiskThreshold, 
      criticalRiskThreshold, 
      autoSuspendThreshold,
      maxViolationsPerSession,
      alertCooldown 
    } = req.body;

    // Validate thresholds
    if (highRiskThreshold >= criticalRiskThreshold || 
        criticalRiskThreshold >= autoSuspendThreshold ||
        highRiskThreshold < 0 || autoSuspendThreshold > 100) {
      return res.status(400).json({
        message: 'Invalid threshold values. Must be: 0 <= high < critical < autoSuspend <= 100'
      });
    }

    // Update security monitor configuration
    if (highRiskThreshold !== undefined) securityMonitor.config.highRiskThreshold = highRiskThreshold;
    if (criticalRiskThreshold !== undefined) securityMonitor.config.criticalRiskThreshold = criticalRiskThreshold;
    if (autoSuspendThreshold !== undefined) securityMonitor.config.autoSuspendThreshold = autoSuspendThreshold;
    if (maxViolationsPerSession !== undefined) securityMonitor.config.maxViolationsPerSession = maxViolationsPerSession;
    if (alertCooldown !== undefined) securityMonitor.config.alertCooldown = alertCooldown;

    res.status(200).json({
      message: 'Risk thresholds updated successfully',
      config: securityMonitor.config
    });

  } catch (error) {
    console.error('Error in updateRiskThresholds:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Mark session as reviewed
 */
const markSessionReviewed = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { reviewNotes, disciplinaryAction, reviewerDecision } = req.body;

    const attendance = await ExamAttendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Update review status
    attendance.flaggedForReview = false;
    attendance.reviewCompletedAt = new Date();
    attendance.reviewedBy = req.user._id;
    attendance.reviewNotes = reviewNotes || '';
    attendance.disciplinaryAction = disciplinaryAction || 'NONE';
    attendance.reviewerDecision = reviewerDecision || 'NO_ACTION';

    await attendance.save();

    res.status(200).json({
      message: 'Session marked as reviewed successfully',
      attendanceId: attendance._id,
      reviewedAt: attendance.reviewCompletedAt
    });

  } catch (error) {
    console.error('Error in markSessionReviewed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Suspend or unsuspend a session
 */
const toggleSessionSuspension = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { action, reason } = req.body; // action: 'suspend' or 'unsuspend'

    const attendance = await ExamAttendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (action === 'suspend') {
      if (attendance.status === 'SUSPENDED') {
        return res.status(400).json({ message: 'Session is already suspended' });
      }

      attendance.previousStatus = attendance.status;
      attendance.status = 'SUSPENDED';
      attendance.suspensionReason = reason || 'Manually suspended by administrator';
      attendance.suspendedAt = new Date();
      attendance.suspendedBy = req.user._id;
      attendance.flaggedForReview = true;

    } else if (action === 'unsuspend') {
      if (attendance.status !== 'SUSPENDED') {
        return res.status(400).json({ message: 'Session is not suspended' });
      }

      attendance.status = attendance.previousStatus || 'IN_PROGRESS';
      attendance.unsuspendedAt = new Date();
      attendance.unsuspendedBy = req.user._id;
      attendance.unsuspensionReason = reason || 'Suspension lifted by administrator';

    } else {
      return res.status(400).json({ message: 'Invalid action. Use "suspend" or "unsuspend"' });
    }

    await attendance.save();

    res.status(200).json({
      message: `Session ${action}ed successfully`,
      attendanceId: attendance._id,
      newStatus: attendance.status,
      actionDate: action === 'suspend' ? attendance.suspendedAt : attendance.unsuspendedAt
    });

  } catch (error) {
    console.error('Error in toggleSessionSuspension:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Get anti-abuse system performance metrics
 */
const getSystemMetrics = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Calculate time range
    let startTime;
    switch (timeRange) {
      case '1h':
        startTime = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Get detection metrics
    const detectionMetrics = await ExamAttendance.aggregate([
      {
        $match: {
          cheatEvidence: { $exists: true, $ne: [] },
          startTime: { $gte: startTime }
        }
      },
      {
        $project: {
          cheatEvidence: 1,
          riskScore: '$riskAssessment.overallRiskScore',
          status: 1,
          hourOfDay: { $hour: '$startTime' }
        }
      },
      { $unwind: '$cheatEvidence' },
      {
        $group: {
          _id: {
            type: '$cheatEvidence.evidenceType',
            hour: '$hourOfDay'
          },
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$riskScore' }
        }
      }
    ]);

    // Get session status distribution
    const statusDistribution = await ExamAttendance.aggregate([
      {
        $match: {
          startTime: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$riskAssessment.overallRiskScore' }
        }
      }
    ]);

    // Calculate system performance
    const totalSessions = await ExamAttendance.countDocuments({
      startTime: { $gte: startTime }
    });

    const suspiciousSessions = await ExamAttendance.countDocuments({
      startTime: { $gte: startTime },
      'riskAssessment.overallRiskScore': { $gte: 50 }
    });

    const falsePositiveRate = suspiciousSessions > 0 ? 
      (suspiciousSessions - securityMonitor.stats.suspendedSessions) / suspiciousSessions : 0;

    res.status(200).json({
      message: 'System metrics retrieved successfully',
      timeRange,
      period: {
        start: startTime,
        end: new Date()
      },
      overview: {
        totalSessions,
        suspiciousSessions,
        detectionRate: totalSessions > 0 ? (suspiciousSessions / totalSessions * 100).toFixed(2) + '%' : '0%',
        falsePositiveRate: (falsePositiveRate * 100).toFixed(2) + '%',
        systemUptime: process.uptime()
      },
      detectionMetrics,
      statusDistribution,
      currentConfig: securityMonitor.config,
      monitoringStats: securityMonitor.getStats()
    });

  } catch (error) {
    console.error('Error in getSystemMetrics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Helper function to calculate severity of evidence type
 */
const calculateSeverity = (evidenceType) => {
  const severityMap = {
    'PROXY_TOOL_DETECTED': 90,
    'AUTOMATED_BEHAVIOR': 85,
    'TAB_SWITCH': 40,
    'COPY_PASTE_ATTEMPT': 60,
    'MULTIPLE_TABS': 50,
    'FULLSCREEN_EXIT': 30,
    'SUSPICIOUS_TIMING': 70,
    'HEADER_ANOMALY': 80,
    'RAPID_RESPONSES': 65,
    'IDENTICAL_TIMING': 75,
    'SEQUENTIAL_ANSWERS': 70
  };

  return severityMap[evidenceType] || 50;
};

/**
 * Analyze request log patterns
 */
const analyzeRequestLog = (requestLog) => {
  if (!requestLog || requestLog.length === 0) {
    return { totalRequests: 0, analysis: 'No request data available' };
  }

  const analysis = {
    totalRequests: requestLog.length,
    timeSpan: requestLog.length > 1 ? 
      requestLog[requestLog.length - 1].timestamp - requestLog[0].timestamp : 0,
    averageInterval: 0,
    suspiciousPatterns: []
  };

  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < requestLog.length; i++) {
    intervals.push(requestLog[i].timestamp - requestLog[i - 1].timestamp);
  }

  if (intervals.length > 0) {
    analysis.averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Check for suspicious patterns
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - analysis.averageInterval, 2);
    }, 0) / intervals.length;
    
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / analysis.averageInterval;
    
    if (coefficientOfVariation < 0.1) {
      analysis.suspiciousPatterns.push('Highly regular request timing (potential automation)');
    }
    
    if (analysis.averageInterval < 2000) {
      analysis.suspiciousPatterns.push('Very rapid requests (less than 2 seconds average)');
    }
  }

  return analysis;
};

/**
 * Get detailed session history with violation timeline
 */
const getDetailedSessionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const attendance = await ExamAttendance.findById(sessionId)
      .populate('userId', 'username firstName lastName email')
      .populate('examId', 'title');

    if (!attendance) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Session history retrieved successfully',
      session: attendance
    });

  } catch (error) {
    console.error('Error in getDetailedSessionHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Suspend a session
 */
const suspendSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const attendance = await ExamAttendance.findById(sessionId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    attendance.status = 'SUSPENDED';
    attendance.suspensionReason = reason || 'Manually suspended by administrator';
    attendance.suspendedAt = new Date();
    attendance.suspendedBy = req.user._id;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Session suspended successfully',
      sessionId: attendance._id
    });

  } catch (error) {
    console.error('Error in suspendSession:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Review a session
 */
const reviewSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reviewNotes, action } = req.body;

    const attendance = await ExamAttendance.findById(sessionId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    attendance.flaggedForReview = false;
    attendance.reviewCompletedAt = new Date();
    attendance.reviewedBy = req.user._id;
    attendance.reviewNotes = reviewNotes || '';
    attendance.reviewerDecision = action || 'NO_ACTION';

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Session reviewed successfully',
      sessionId: attendance._id
    });

  } catch (error) {
    console.error('Error in reviewSession:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Get risk configuration
 */
const getRiskConfiguration = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Risk configuration retrieved successfully',
      config: securityMonitor.config
    });
  } catch (error) {
    console.error('Error in getRiskConfiguration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Get security alerts
 */
const getSecurityAlerts = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const alerts = await ExamAttendance.find({
      'riskAssessment.overallRiskScore': { $gte: 70 }
    })
    .populate('userId', 'username firstName lastName')
    .populate('examId', 'title')
    .sort({ 'riskAssessment.lastUpdated': -1 })
    .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Security alerts retrieved successfully',
      alerts: alerts.map(alert => ({
        id: alert._id,
        user: alert.userId,
        exam: alert.examId,
        riskScore: alert.riskAssessment.overallRiskScore,
        lastUpdated: alert.riskAssessment.lastUpdated,
        status: alert.status
      }))
    });

  } catch (error) {
    console.error('Error in getSecurityAlerts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Mark alert as reviewed
 */
const markAlertReviewed = async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const attendance = await ExamAttendance.findById(alertId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    attendance.alertReviewed = true;
    attendance.alertReviewedBy = req.user._id;
    attendance.alertReviewedAt = new Date();

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Alert marked as reviewed',
      alertId: attendance._id
    });

  } catch (error) {
    console.error('Error in markAlertReviewed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Export security report
 */
const exportSecurityReport = async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const reportData = await ExamAttendance.aggregate([
      {
        $match: {
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          suspiciousSessions: {
            $sum: {
              $cond: [{ $gte: ['$riskAssessment.overallRiskScore', 50] }, 1, 0]
            }
          },
          suspendedSessions: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUSPENDED'] }, 1, 0]
            }
          },
          averageRiskScore: { $avg: '$riskAssessment.overallRiskScore' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Security report generated successfully',
      report: {
        period: { start, end },
        data: reportData[0] || {
          totalSessions: 0,
          suspiciousSessions: 0,
          suspendedSessions: 0,
          averageRiskScore: 0
        }
      }
    });

  } catch (error) {
    console.error('Error in exportSecurityReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Get active threats
 */
const getActiveThreats = async (req, res) => {
  try {
    const activeThreats = await ExamAttendance.find({
      status: 'IN_PROGRESS',
      'riskAssessment.overallRiskScore': { $gte: 80 }
    })
    .populate('userId', 'username firstName lastName')
    .populate('examId', 'title')
    .sort({ 'riskAssessment.lastUpdated': -1 });

    res.status(200).json({
      success: true,
      message: 'Active threats retrieved successfully',
      threats: activeThreats.map(threat => ({
        id: threat._id,
        user: threat.userId,
        exam: threat.examId,
        riskScore: threat.riskAssessment.overallRiskScore,
        violationCount: threat.riskAssessment.violationCount,
        lastUpdated: threat.riskAssessment.lastUpdated
      }))
    });

  } catch (error) {
    console.error('Error in getActiveThreats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

/**
 * Bulk session actions
 */
const bulkSessionAction = async (req, res) => {
  try {
    const { sessionIds, action, reason } = req.body;

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session IDs provided'
      });
    }

    let updateQuery = {};
    
    switch (action) {
      case 'suspend':
        updateQuery = {
          status: 'SUSPENDED',
          suspensionReason: reason || 'Bulk suspended by administrator',
          suspendedAt: new Date(),
          suspendedBy: req.user._id
        };
        break;
      case 'review':
        updateQuery = {
          flaggedForReview: false,
          reviewCompletedAt: new Date(),
          reviewedBy: req.user._id,
          reviewNotes: reason || 'Bulk reviewed'
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action specified'
        });
    }

    const result = await ExamAttendance.updateMany(
      { _id: { $in: sessionIds } },
      updateQuery
    );

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      affectedSessions: result.modifiedCount
    });

  } catch (error) {
    console.error('Error in bulkSessionAction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

module.exports = {
  getSecurityDashboard,
  getSessionAnalysis,
  getDetailedSessionHistory,
  suspendSession,
  reviewSession,
  updateRiskThresholds,
  getRiskConfiguration,
  getSecurityAlerts,
  markAlertReviewed,
  exportSecurityReport,
  getSystemMetrics,
  getActiveThreats,
  bulkSessionAction,
  markSessionReviewed,
  toggleSessionSuspension
};
