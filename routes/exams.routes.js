const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRoleAccess } = require("../middlewares/role.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const examController = require("../controllers/exams.controller");

// Define fallback for missing controller methods
const fallback = (methodName) => (req, res) => 
  res.status(501).json({ message: `${methodName} not implemented yet` });

// All authenticated users can view exams
router.get("/", authenticateUser, 
  examController.getAllExams ? examController.getAllExams : fallback("getAllExams"));

// All authenticated users can view a single exam
router.get("/:id", authenticateUser, 
  examController.getExamById ? examController.getExamById : fallback("getExamById"));

// Only admin users can create, update, delete exams
router.post("/", authenticateUser, checkRole("admin"), 
  examController.createExam ? examController.createExam : fallback("createExam"));
  
router.put("/:id", authenticateUser, checkRole("admin"), 
  examController.updateExam ? examController.updateExam : fallback("updateExam"));
  
router.delete("/:id", authenticateUser, checkRole("admin"), 
  examController.deleteExam ? examController.deleteExam : fallback("deleteExam"));

module.exports = router;
