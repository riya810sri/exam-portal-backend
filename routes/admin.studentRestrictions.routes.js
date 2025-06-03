/**
 * Admin Student Restrictions Routes
 * Provides endpoints for managing granular student restrictions
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth.middleware');
const {
  getAllRestrictions,
  imposeRestriction,
  removeRestriction,
  getStudentRestrictions,
  processAppeal,
  getRestrictionStats,
  checkStudentAccess
} = require('../controllers/admin.studentRestrictions.controller');

// Middleware to ensure admin access
const requireAdmin = (req, res, next) => {
  // Check both role field and isAdmin flag for compatibility
  const isAdmin = req.user.role === 'admin' || 
                 req.user.role === 'super_admin' || 
                 req.user.isAdmin === true;
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required for student restrictions management'
    });
  }
  next();
};

// Student Restrictions Management Routes

/**
 * @route GET /api/admin/student-restrictions/
 * @desc Get all restrictions with pagination and filters
 * @access Admin
 * @query {Number} page - Page number (default: 1)
 * @query {Number} limit - Restrictions per page (default: 20)
 * @query {String} restrictionType - Filter by type: 'exam_ban', 'account_suspension', 'ip_ban', 'global_ban'
 * @query {String} studentId - Filter by student ID
 * @query {String} examId - Filter by exam ID
 * @query {String} status - Filter by status: 'active', 'expired', 'all' (default: 'active')
 */
router.get('/', authenticateUser, requireAdmin, getAllRestrictions);

/**
 * @route POST /api/admin/student-restrictions/impose
 * @desc Impose a new restriction on a student
 * @access Admin
 * @body {String} studentId - Required: Student's user ID
 * @body {String} restrictionType - Required: 'exam_ban', 'account_suspension', 'ip_ban', 'global_ban'
 * @body {String} reason - Required: Reason for the restriction
 * @body {String} examId - Required for exam_ban type
 * @body {String} ipAddress - Required for ip_ban type
 * @body {Number} duration - Duration in milliseconds (optional for defaults)
 * @body {Boolean} isPermanent - Whether restriction is permanent (default: false)
 * @body {String} adminNotes - Additional admin notes
 */
router.post('/impose', authenticateUser, requireAdmin, imposeRestriction);

/**
 * @route DELETE /api/admin/student-restrictions/:restrictionId
 * @desc Remove/lift a restriction
 * @access Admin
 * @param {String} restrictionId - The restriction ID to remove
 * @body {String} reason - Required: Reason for removal
 */
router.delete('/:restrictionId', authenticateUser, requireAdmin, removeRestriction);

/**
 * @route GET /api/admin/student-restrictions/student/:studentId
 * @desc Get all restrictions for a specific student
 * @access Admin
 * @param {String} studentId - The student's user ID
 */
router.get('/student/:studentId', authenticateUser, requireAdmin, getStudentRestrictions);

/**
 * @route PUT /api/admin/student-restrictions/:restrictionId/appeal
 * @desc Process a student's appeal for restriction removal
 * @access Admin
 * @param {String} restrictionId - The restriction ID being appealed
 * @body {String} decision - Required: 'approved' or 'rejected'
 * @body {String} reviewNotes - Optional review notes
 */
router.put('/:restrictionId/appeal', authenticateUser, requireAdmin, processAppeal);

/**
 * @route GET /api/admin/student-restrictions/stats
 * @desc Get restriction statistics and analytics
 * @access Admin
 * @query {String} timeframe - Optional: '24h', '7d', '30d', 'all' (default: '30d')
 */
router.get('/stats', authenticateUser, requireAdmin, getRestrictionStats);

/**
 * @route POST /api/admin/student-restrictions/check-access/:studentId/:examId
 * @desc Check if a student can access a specific exam
 * @access Admin
 * @param {String} studentId - The student's user ID
 * @param {String} examId - The exam ID
 * @body {String} ipAddress - Optional IP address to check
 */
router.post('/check-access/:studentId/:examId', authenticateUser, requireAdmin, checkStudentAccess);

// Error handling middleware specific to student restrictions
router.use((error, req, res, next) => {
  console.error('Student Restrictions Route Error:', error);
  
  // Log restriction-related errors
  if (error.name === 'ValidationError') {
    console.error('Validation Error in Student Restrictions:', {
      error: error.message,
      route: req.path,
      admin: req.user?.username,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in restrictions management',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;
