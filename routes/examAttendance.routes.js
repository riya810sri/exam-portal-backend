const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const {
  attendExam,
  submitAnswer,
  completeExam,
  getExamStatus,
  getExamResult,
  reviewExamQuestions,
  getUserExams,
  myExamHistory
} = require("../controllers/examAttendance.controller");
const { downloadCertificate } = require("../controllers/certificate.controller");

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

// Get user's exam history filtered by status
router.get("/my-exams/:status", authenticateUser, (req, res) => {
  req.query.statusFilter = req.params.status;
  getUserExams(req, res);
});

// Normal users can attend, submit answers, and complete exams
router.get("/:examId/attend", authenticateUser, 
  attendExam ? attendExam : fallback("attendExam"));
  
router.post("/:examId/submit-answer", authenticateUser, 
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

module.exports = router;