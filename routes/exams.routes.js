const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRoleAccess } = require("../middlewares/role.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const examController = require("../controllers/exams.controller");

// Define fallback for missing controller methods
const fallback = (methodName) => (req, res) => 
  res.status(501).json({ message: `${methodName} not implemented yet` });

// All authenticated users can view published exams only
router.get("/", authenticateUser, 
  examController.getAllExams ? examController.getAllExams : fallback("getAllExams"));

// Only admin users can view pending exams
router.get("/pending", authenticateUser, checkRole("admin"), 
  examController.getPendingExams ? examController.getPendingExams : fallback("getPendingExams"));

// Only admin users can view approved exams
router.get("/approved", authenticateUser, checkRole("admin"), 
  examController.getApprovedExams ? examController.getApprovedExams : fallback("getApprovedExams"));

// Only admin users can view unpublished exams (previously published exams)
router.get("/unpublished", authenticateUser, checkRole("admin"), 
  examController.getUnpublishedExams ? examController.getUnpublishedExams : fallback("getUnpublishedExams"));

// All authenticated users can view a single exam (but only published ones for non-admins)
router.get("/:id", authenticateUser, 
  examController.getExamById ? examController.getExamById : fallback("getExamById"));

// Only admin users can create, update, delete exams
router.post("/", authenticateUser, checkRole("admin"), 
  examController.createExam ? examController.createExam : fallback("createExam"));
  
router.put("/:id", authenticateUser, checkRole("admin"), 
  examController.updateExam ? examController.updateExam : fallback("updateExam"));
  
router.delete("/:id", authenticateUser, checkRole("admin"), 
  examController.deleteExam ? examController.deleteExam : fallback("deleteExam"));

// Admin approval, publishing, and unpublishing endpoints
router.patch("/:id/approve", authenticateUser, checkRole("admin"), 
  examController.approveExam ? examController.approveExam : fallback("approveExam"));

router.patch("/:id/publish", authenticateUser, checkRole("admin"), 
  examController.publishExam ? examController.publishExam : fallback("publishExam"));

router.patch("/:id/unpublish", authenticateUser, checkRole("admin"), 
  examController.unpublishExam ? examController.unpublishExam : fallback("unpublishExam"));

module.exports = router;
