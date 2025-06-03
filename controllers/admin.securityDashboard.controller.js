/**
 * Admin Security Dashboard Controller
 * Provides real-time monitoring and management of exam security events
 */

const SecurityEvent = require('../models/securityEvent.model');
const BannedClient = require('../models/bannedClient.model');
const ExamAttendance = require('../models/examAttendance.model');
const { socketAntiAbuseManager } = require('../utils/socketAntiAbuse');
const { DynamicSocketManager } = require('../utils/dynamicSocketManager');

/**
 * Get real-time security dashboard data
 */
const getSecurityDashboard = async (req, res) => {
  try {
    const {
      timeframe = '24h',
      examId,
      riskLevel = 'all'
    } = req.query;

    // Calculate time range
    let startTime;
    switch (timeframe) {
      case '1h':
        startTime = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Build query filters
    const query = {
      createdAt: { $gte: startTime }
    };

    if (examId) {
      query.exam_id = examId;
    }

    if (riskLevel !== 'all') {
      switch (riskLevel) {
        case 'high':
          query.risk_score = { $gte: 70 };
          break;
        case 'medium':
          query.risk_score = { $gte: 30, $lt: 70 };
          break;
        case 'low':
          query.risk_score = { $lt: 30 };
          break;
        case 'suspicious':
          query.is_suspicious = true;
          break;
      }
    }

    // Get overview statistics
    const [
      totalEvents,
      suspiciousEvents,
      highRiskEvents,
      criticalEvents,
      eventsByType,
      recentEvents,
      activeSessions,
      bannedClients
    ] = await Promise.all([
      SecurityEvent.countDocuments(query),
      SecurityEvent.countDocuments({ ...query, is_suspicious: true }),
      SecurityEvent.countDocuments({ ...query, risk_score: { $gte: 70 } }),
      SecurityEvent.countDocuments({ ...query, risk_score: { $gte: 90 } }),
      SecurityEvent.aggregate([
        { $match: query },
        { 
          $group: {
            _id: '$event_type',
            count: { $sum: 1 },
            avg_risk: { $avg: '$risk_score' },
            suspicious_count: { $sum: { $cond: ['$is_suspicious', 1, 0] } }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      SecurityEvent.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('student_id', 'email firstName lastName')
        .populate('exam_id', 'title'),
      ExamAttendance.countDocuments({ 
        status: 'IN_PROGRESS',
        monitoringActive: true 
      }),
      BannedClient.countDocuments({
        $or: [
          { is_permanent: true },
          { ban_until: { $gt: new Date() } }
        ]
      })
    ]);

    // Get socket server statistics
    const socketManager = DynamicSocketManager.getInstance();
    const socketStats = socketManager.getServerStats();
    const antiAbuseStats = socketAntiAbuseManager.getStats();

    // Calculate trends (compare with previous period)
    const previousPeriod = new Date(startTime.getTime() - (Date.now() - startTime.getTime()));
    const previousQuery = {
      ...query,
      createdAt: { $gte: previousPeriod, $lt: startTime }
    };

    const [prevTotal, prevSuspicious] = await Promise.all([
      SecurityEvent.countDocuments(previousQuery),
      SecurityEvent.countDocuments({ ...previousQuery, is_suspicious: true })
    ]);

    const trends = {
      total_events: totalEvents - prevTotal,
      suspicious_events: suspiciousEvents - prevSuspicious
    };

    res.status(200).json({
      success: true,
      timeframe,
      data: {
        overview: {
          total_events: totalEvents,
          suspicious_events: suspiciousEvents,
          high_risk_events: highRiskEvents,
          critical_events: criticalEvents,
          active_sessions: activeSessions,
          banned_clients: bannedClients,
          trends
        },
        socket_infrastructure: {
          active_servers: socketStats.active_servers,
          total_connections: socketStats.total_connections,
          used_ports: socketStats.used_ports,
          servers: socketStats.servers
        },
        anti_abuse: antiAbuseStats,
        event_types: eventsByType,
        recent_events: recentEvents.map(event => ({
          id: event._id,
          monit_id: event.monit_id,
          event_type: event.event_type,
          risk_score: event.risk_score,
          is_suspicious: event.is_suspicious,
          timestamp: event.timestamp,
          student: event.student_id ? {
            id: event.student_id._id,
            email: event.student_id.email,
            name: `${event.student_id.firstName} ${event.student_id.lastName}`
          } : null,
          exam: event.exam_id ? {
            id: event.exam_id._id,
            title: event.exam_id.title
          } : null,
          details: event.details,
          created_at: event.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Error getting security dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security dashboard data',
      error: error.message
    });
  }
};

/**
 * Get detailed security events for a specific session
 */
const getSessionEvents = async (req, res) => {
  try {
    const { monit_id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;

    const [events, totalCount] = await Promise.all([
      SecurityEvent.find({ monit_id })
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('student_id', 'email firstName lastName')
        .populate('exam_id', 'title'),
      SecurityEvent.countDocuments({ monit_id })
    ]);

    // Calculate session statistics
    const sessionStats = await SecurityEvent.aggregate([
      { $match: { monit_id } },
      {
        $group: {
          _id: null,
          total_events: { $sum: 1 },
          suspicious_events: { $sum: { $cond: ['$is_suspicious', 1, 0] } },
          avg_risk_score: { $avg: '$risk_score' },
          max_risk_score: { $max: '$risk_score' },
          session_duration: { 
            $max: { $subtract: ['$timestamp', { $min: '$timestamp' }] }
          },
          event_types: { $addToSet: '$event_type' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        monit_id,
        statistics: sessionStats[0] || {
          total_events: 0,
          suspicious_events: 0,
          avg_risk_score: 0,
          max_risk_score: 0,
          session_duration: 0,
          event_types: []
        },
        events: events.map(event => ({
          id: event._id,
          event_type: event.event_type,
          timestamp: event.timestamp,
          risk_score: event.risk_score,
          is_suspicious: event.is_suspicious,
          details: event.details,
          session_duration: event.session_duration,
          user_agent: event.user_agent,
          ip_address: event.ip_address,
          created_at: event.createdAt
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_events: totalCount,
          events_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting session events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session events',
      error: error.message
    });
  }
};

/**
 * Get banned clients management data
 */
const getBannedClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      ban_type = 'all',
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (ban_type === 'permanent') {
      query.is_permanent = true;
    } else if (ban_type === 'temporary') {
      query.is_permanent = false;
      query.ban_until = { $gt: new Date() };
    } else if (ban_type === 'expired') {
      query.is_permanent = false;
      query.ban_until = { $lte: new Date() };
    }

    if (search) {
      query.$or = [
        { ip_address: { $regex: search, $options: 'i' } },
        { user_agent: { $regex: search, $options: 'i' } },
        { ban_reason: { $regex: search, $options: 'i' } }
      ];
    }

    const [bannedClients, totalCount, banStats] = await Promise.all([
      BannedClient.find(query)
        .sort({ last_violation: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BannedClient.countDocuments(query),
      BannedClient.getBanStats()
    ]);

    res.status(200).json({
      success: true,
      data: {
        banned_clients: bannedClients.map(client => ({
          id: client._id,
          ip_address: client.ip_address,
          user_agent: client.user_agent,
          ban_reason: client.ban_reason,
          violation_count: client.violation_count,
          is_permanent: client.is_permanent,
          ban_until: client.ban_until,
          first_violation: client.first_violation,
          last_violation: client.last_violation,
          exam_attempts: client.exam_attempts.length,
          is_currently_banned: client.isBanned(),
          created_at: client.createdAt
        })),
        statistics: {
          total_bans: totalCount,
          ban_breakdown: banStats
        },
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_clients: totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error getting banned clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get banned clients data',
      error: error.message
    });
  }
};

/**
 * Unban a client
 */
const unbanClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { reason = 'Manual unban by admin' } = req.body;

    const bannedClient = await BannedClient.findById(clientId);
    if (!bannedClient) {
      return res.status(404).json({
        success: false,
        message: 'Banned client not found'
      });
    }

    await bannedClient.unban();

    console.log(`🔓 Admin unbanned client ${bannedClient.ip_address}: ${reason}`);

    res.status(200).json({
      success: true,
      message: 'Client unbanned successfully',
      data: {
        ip_address: bannedClient.ip_address,
        unbanned_at: new Date(),
        reason
      }
    });

  } catch (error) {
    console.error('Error unbanning client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban client',
      error: error.message
    });
  }
};

/**
 * Manually ban a client
 */
const banClient = async (req, res) => {
  try {
    const {
      ip_address,
      user_agent = 'Manual ban',
      ban_reason,
      ban_duration_hours = 24,
      is_permanent = false
    } = req.body;

    if (!ip_address || !ban_reason) {
      return res.status(400).json({
        success: false,
        message: 'IP address and ban reason are required'
      });
    }

    const ban_duration = is_permanent ? 0 : ban_duration_hours * 60 * 60 * 1000;

    const bannedClient = await BannedClient.banClient({
      ip_address,
      user_agent,
      ban_reason,
      ban_duration,
      violation_details: {
        violation_details: {
          manual_ban: true,
          admin_id: req.user._id,
          timestamp: new Date()
        }
      }
    });

    if (is_permanent) {
      bannedClient.is_permanent = true;
      await bannedClient.save();
    }

    console.log(`🔒 Admin manually banned client ${ip_address}: ${ban_reason}`);

    res.status(200).json({
      success: true,
      message: 'Client banned successfully',
      data: {
        ip_address: bannedClient.ip_address,
        ban_reason: bannedClient.ban_reason,
        is_permanent: bannedClient.is_permanent,
        ban_until: bannedClient.ban_until,
        banned_at: bannedClient.createdAt
      }
    });

  } catch (error) {
    console.error('Error banning client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ban client',
      error: error.message
    });
  }
};

/**
 * Get active monitoring sessions
 */
const getActiveMonitoringSessions = async (req, res) => {
  try {
    const socketManager = DynamicSocketManager.getInstance();
    const socketStats = socketManager.getServerStats();

    // Get active exam attendance records
    const activeSessions = await ExamAttendance.find({
      status: 'IN_PROGRESS',
      monitoringActive: true
    })
    .populate('userId', 'email firstName lastName')
    .populate('examId', 'title duration')
    .select('userId examId startTime riskAssessment monitoringStartTime');

    // Combine with socket data
    const sessionsWithSocket = activeSessions.map(session => {
      const socketInfo = socketStats.servers.find(server => 
        server.monit_id.includes(session.userId._id.toString()) &&
        server.monit_id.includes(session.examId._id.toString())
      );

      return {
        id: session._id,
        student: {
          id: session.userId._id,
          email: session.userId.email,
          name: `${session.userId.firstName} ${session.userId.lastName}`
        },
        exam: {
          id: session.examId._id,
          title: session.examId.title,
          duration: session.examId.duration
        },
        session_info: {
          start_time: session.startTime,
          monitoring_start: session.monitoringStartTime,
          duration_minutes: Math.floor((Date.now() - session.startTime.getTime()) / 60000),
          risk_score: session.riskAssessment?.overallRiskScore || 0,
          violation_count: session.riskAssessment?.violationCount || 0
        },
        socket_info: socketInfo ? {
          monit_id: socketInfo.monit_id,
          port: socketInfo.port,
          connections: socketInfo.connections,
          uptime_minutes: Math.floor(socketInfo.uptime / 60000),
          last_activity: socketInfo.last_activity
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        total_active_sessions: activeSessions.length,
        socket_servers: socketStats.active_servers,
        total_connections: socketStats.total_connections,
        sessions: sessionsWithSocket
      }
    });

  } catch (error) {
    console.error('Error getting active monitoring sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active monitoring sessions',
      error: error.message
    });
  }
};

module.exports = {
  getSecurityDashboard,
  getSessionEvents,
  getBannedClients,
  unbanClient,
  banClient,
  getActiveMonitoringSessions
};
