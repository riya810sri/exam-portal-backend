/**
 * Admin routes for anti-abuse system management
 * Provides comprehensive security monitoring and configuration
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth.middleware');
const {
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
  bulkSessionAction
} = require('../controllers/admin.antiAbuse.controller');

// Middleware to ensure admin access
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Security Dashboard Routes
/**
 * @route GET /api/admin/security/dashboard
 * @desc Get security dashboard overview with real-time metrics
 * @access Admin
 */
router.get('/dashboard', authenticateUser, requireAdmin, getSecurityDashboard);

/**
 * @route GET /api/admin/security/metrics
 * @desc Get detailed system performance metrics
 * @access Admin
 */
router.get('/metrics', authenticateUser, requireAdmin, getSystemMetrics);

/**
 * @route GET /api/admin/security/threats
 * @desc Get currently active security threats
 * @access Admin
 */
router.get('/threats', authenticateUser, requireAdmin, getActiveThreats);

// Session Management Routes
/**
 * @route GET /api/admin/security/sessions/:sessionId/analysis
 * @desc Get detailed analysis of a specific exam session
 * @access Admin
 */
router.get('/sessions/:sessionId/analysis', authenticateUser, requireAdmin, getSessionAnalysis);

/**
 * @route GET /api/admin/security/sessions/:sessionId/history
 * @desc Get detailed violation history for a session
 * @access Admin
 */
router.get('/sessions/:sessionId/history', authenticateUser, requireAdmin, getDetailedSessionHistory);

/**
 * @route POST /api/admin/security/sessions/:sessionId/suspend
 * @desc Manually suspend an exam session
 * @access Admin
 */
router.post('/sessions/:sessionId/suspend', authenticateUser, requireAdmin, suspendSession);

/**
 * @route POST /api/admin/security/sessions/:sessionId/review
 * @desc Mark a session as reviewed and update status
 * @access Admin
 */
router.post('/sessions/:sessionId/review', authenticateUser, requireAdmin, reviewSession);

/**
 * @route POST /api/admin/security/sessions/bulk-action
 * @desc Perform bulk actions on multiple sessions
 * @access Admin
 */
router.post('/sessions/bulk-action', authenticateUser, requireAdmin, bulkSessionAction);

// Risk Configuration Routes
/**
 * @route GET /api/admin/security/config/risk-thresholds
 * @desc Get current risk assessment thresholds
 * @access Admin
 */
router.get('/config/risk-thresholds', authenticateUser, requireAdmin, getRiskConfiguration);

/**
 * @route PUT /api/admin/security/config/risk-thresholds
 * @desc Update risk assessment thresholds
 * @access Admin
 */
router.put('/config/risk-thresholds', authenticateUser, requireAdmin, updateRiskThresholds);

// Alert Management Routes
/**
 * @route GET /api/admin/security/alerts
 * @desc Get security alerts with filtering options
 * @access Admin
 */
router.get('/alerts', authenticateUser, requireAdmin, getSecurityAlerts);

/**
 * @route PUT /api/admin/security/alerts/:alertId/reviewed
 * @desc Mark a security alert as reviewed
 * @access Admin
 */
router.put('/alerts/:alertId/reviewed', authenticateUser, requireAdmin, markAlertReviewed);

// Reporting Routes
/**
 * @route GET /api/admin/security/reports/export
 * @desc Export comprehensive security report
 * @access Admin
 */
router.get('/reports/export', authenticateUser, requireAdmin, exportSecurityReport);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Admin Anti-Abuse Route Error:', error);
  
  // Log security-related errors
  if (error.name === 'SecurityError') {
    console.error('Security Error in Admin Routes:', {
      error: error.message,
      route: req.path,
      admin: req.user?.username,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in security management',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;
