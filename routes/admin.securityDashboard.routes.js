/**
 * Admin Security Dashboard Routes
 * Provides real-time monitoring and management endpoints for exam security
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth.middleware');
const {
  getSecurityDashboard,
  getSessionEvents,
  getBannedClients,
  unbanClient,
  banClient,
  getActiveMonitoringSessions
} = require('../controllers/admin.securityDashboard.controller');

// Middleware to ensure admin access
const requireAdmin = (req, res, next) => {
  // Check both role field and isAdmin flag for compatibility
  const isAdmin = req.user.role === 'admin' || 
                 req.user.role === 'super_admin' || 
                 req.user.isAdmin === true;
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required for security dashboard'
    });
  }
  next();
};

// Security Dashboard Core Routes
/**
 * @route GET /api/admin/security-dashboard/overview
 * @desc Get comprehensive security dashboard overview with real-time data
 * @access Admin
 * @query {String} timeframe - Time range: '1h', '6h', '24h', '7d' (default: '24h')
 * @query {String} examId - Optional: Filter by specific exam ID
 * @query {String} riskLevel - Filter by risk level: 'all', 'high', 'medium', 'low', 'suspicious' (default: 'all')
 */
router.get('/overview', authenticateUser, requireAdmin, getSecurityDashboard);

/**
 * @route GET /api/admin/security-dashboard/sessions/:monit_id/events
 * @desc Get detailed security events for a specific monitoring session
 * @access Admin
 * @param {String} monit_id - The monitoring session ID
 * @query {Number} page - Page number for pagination (default: 1)
 * @query {Number} limit - Events per page (default: 50)
 */
router.get('/sessions/:monit_id/events', authenticateUser, requireAdmin, getSessionEvents);

// Banned Clients Management Routes
/**
 * @route GET /api/admin/security-dashboard/banned-clients
 * @desc Get paginated list of banned clients with management capabilities
 * @access Admin
 * @query {Number} page - Page number (default: 1)
 * @query {Number} limit - Clients per page (default: 20)
 * @query {String} ban_type - Filter: 'all', 'permanent', 'temporary', 'expired' (default: 'all')
 * @query {String} search - Search by IP, user agent, or ban reason
 */
router.get('/banned-clients', authenticateUser, requireAdmin, getBannedClients);

/**
 * @route POST /api/admin/security-dashboard/banned-clients/:clientId/unban
 * @desc Unban a previously banned client
 * @access Admin
 * @param {String} clientId - The banned client's database ID
 * @body {String} reason - Optional reason for unbanning
 */
router.post('/banned-clients/:clientId/unban', authenticateUser, requireAdmin, unbanClient);

/**
 * @route POST /api/admin/security-dashboard/ban-client
 * @desc Manually ban a client by IP address
 * @access Admin
 * @body {String} ip_address - Required: IP address to ban
 * @body {String} user_agent - User agent string (default: 'Manual ban')
 * @body {String} ban_reason - Required: Reason for the ban
 * @body {Number} ban_duration_hours - Duration in hours (default: 24)
 * @body {Boolean} is_permanent - Whether the ban is permanent (default: false)
 */
router.post('/ban-client', authenticateUser, requireAdmin, banClient);

// Active Monitoring Sessions Routes
/**
 * @route GET /api/admin/security-dashboard/active-sessions
 * @desc Get all currently active monitoring sessions with socket info
 * @access Admin
 * @returns {Object} Active sessions with socket server status and connection details
 */
router.get('/active-sessions', authenticateUser, requireAdmin, getActiveMonitoringSessions);

// Error handling middleware specific to security dashboard
router.use((error, req, res, next) => {
  console.error('Security Dashboard Route Error:', {
    error: error.message,
    route: req.path,
    method: req.method,
    admin: req.user?.username || req.user?.email,
    timestamp: new Date().toISOString(),
    stack: error.stack
  });
  
  // Log security-related errors for audit
  if (error.name === 'SecurityError' || error.name === 'UnauthorizedError') {
    console.error('SECURITY ALERT - Dashboard Access Error:', {
      error: error.message,
      route: req.path,
      admin: req.user?.username,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in security dashboard',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;
