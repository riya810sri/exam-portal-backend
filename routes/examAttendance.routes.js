const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const {
  attendExam,
  submitAnswer,
  completeExam,
  getExamStatus,
  getExamResult
} = require("../controllers/examAttendance.controller");
const { downloadCertificate } = require("../controllers/certificate.controller");

// All routes require authentication
router.use(authenticateUser);

// Start attending exam
router.get("/:examId/attend", attendExam);

// Submit answer for current question
router.post("/:examId/submit-answer", submitAnswer);

// Complete exam
router.post("/:examId/complete", completeExam);

// Get exam status and progress
router.get("/:examId/status", getExamStatus);

// Get exam result
router.get("/:examId/result", getExamResult);

// Download certificate for completed exam
router.get("/:examId/certificate", downloadCertificate);

module.exports = router;