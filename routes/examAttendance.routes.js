const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const {
  attendExam,
  submitAnswer,
  completeExam,
  getExamStatus,
  getExamResult,
  reviewExamQuestions
} = require("../controllers/examAttendance.controller");
const { downloadCertificate } = require("../controllers/certificate.controller");

// Fallback function for missing implementations
const fallback = (methodName) => (req, res) => 
  res.status(501).json({ message: `${methodName} not implemented yet` });

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