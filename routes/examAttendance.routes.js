const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { collectAntiAbuseData, validateJSChallenge } = require("../middlewares/antiAbuse.middleware");
const {
  attendExam,
  submitAnswer,
  completeExam,
  getExamStatus,
  getExamResult,
  reviewExamQuestions,
  getUserExams,
  myExamHistory,
  cancelInProgressAttempt,
  cancelAllAttempts,
  adminGetAllUserHistory,
  reportCheating,
  getCheatingReports,
  startMonitoring
} = require("../controllers/examAttendance.controller");
const { downloadCertificate } = require("../controllers/certificate.controller");

// Custom middleware to check if user has admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ 
      message: "Access denied. Admin privileges required." 
    });
  }
};

// Helper function to get user-friendly status display
function getStatusDisplay(status) {
  switch(status) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'COMPLETED': return 'Completed';
    case 'TIMED_OUT': return 'Timed Out';
    default: return status;
  }
}

// Fallback function for missing implementations
const fallback = (methodName) => (req, res) => 
  res.status(501).json({ message: `${methodName} not implemented yet` });

// Get user's exam history with optional filtering
router.get("/my-exams", authenticateUser, getUserExams);

// Get user's enhanced exam history with better formatting and statistics
router.get("/my-exam-history", authenticateUser, myExamHistory);

// Route for canceling all in-progress attempts for the user (across all exams)
router.post("/cancel-all-attempts", authenticateUser, cancelAllAttempts);

// Get user's exam history filtered by status
router.get("/my-exams/:status", authenticateUser, (req, res) => {
  req.query.statusFilter = req.params.status;
  getUserExams(req, res);
});

// Normal users can attend, submit answers, and complete exams
router.get("/:examId/attend", authenticateUser, collectAntiAbuseData, attendExam);

// Explicit route for creating a new attempt
router.get("/:examId/new-attempt", authenticateUser, collectAntiAbuseData, (req, res) => {
  // Ensure newAttempt is explicitly set to true
  req.query.newAttempt = 'true';
  attendExam(req, res);
});

// Route for canceling an in-progress exam attempt
router.post("/:examId/cancel-in-progress", authenticateUser, cancelInProgressAttempt);

// Route for canceling all attempts for an exam
router.post("/:examId/cancel-all-attempts", authenticateUser, cancelAllAttempts);
  
router.post("/:examId/submit-answer", authenticateUser, collectAntiAbuseData, validateJSChallenge,
  submitAnswer ? submitAnswer : fallback("submitAnswer"));
  
router.post("/:examId/complete", authenticateUser, 
  completeExam ? completeExam : fallback("completeExam"));

// Normal users can view their exam status, results and review questions
router.get("/:examId/status", authenticateUser, 
  getExamStatus ? getExamStatus : fallback("getExamStatus"));
  
router.get("/:examId/result", authenticateUser, 
  getExamResult ? getExamResult : fallback("getExamResult"));
  
router.get("/:examId/review", authenticateUser, 
  reviewExamQuestions ? reviewExamQuestions : fallback("reviewExamQuestions"));

// Normal users can download their certificates
router.get("/:examId/certificate", authenticateUser, 
  downloadCertificate ? downloadCertificate : fallback("downloadCertificate"));

// Admin routes
router.get("/admin/history", authenticateUser, isAdmin, adminGetAllUserHistory);

// Cheating detection routes
// Client-side reporting of cheating incidents
router.post("/:examId/report-cheating", authenticateUser, 
  reportCheating ? reportCheating : fallback("reportCheating"));

// Start monitoring for cheating detection
router.post("/:examId/start-monitoring", authenticateUser, collectAntiAbuseData,
  startMonitoring ? startMonitoring : fallback("startMonitoring"));

// Admin-only route to get all cheating reports for an exam
router.get("/admin/:examId/cheating-reports", authenticateUser, isAdmin, 
  getCheatingReports ? getCheatingReports : fallback("getCheatingReports"));

module.exports = router;