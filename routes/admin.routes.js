const express = require("express");
const {
  verifyAdmin,
  authenticateUser,
} = require("../middlewares/auth.middleware");
const {
  getUserResults,
  modifyExamSettings,
  getAllExamHistory,
  getUserExamHistory,
  manageMachines,
  getExamPassFailStats
} = require("../controllers/admin.controller");
const { updateExam } = require("../controllers/exams.controller");
const { deleteQuestion } = require("../controllers/questions.controller");
const { checkRole } = require("../middlewares/permissions.middleware");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

// Define fallback functions for any missing controller methods
const fallbackFunction = (methodName) => {
  return (req, res) => {
    res.status(501).json({
      message: `Method ${methodName} not implemented yet`,
      status: "Not Implemented"
    });
  };
};

// Ensure all admin routes require admin role
router.use(authenticateUser, checkRole("admin"));

// Check if the functions exist before adding routes
router.put("/exam/:id", typeof updateExam === 'function' ? updateExam : fallbackFunction("updateExam"));
router.delete("/question/:id", typeof deleteQuestion === 'function' ? deleteQuestion : fallbackFunction("deleteQuestion"));
router.get("/user-results", typeof getUserResults === 'function' ? getUserResults : fallbackFunction("getUserResults"));
router.put(
  "/exam-settings/:id",
  typeof modifyExamSettings === 'function' ? modifyExamSettings : fallbackFunction("modifyExamSettings")
);

// Get dashboard stats
router.get("/dashboard", 
  adminController.getDashboardStats || 
  fallbackFunction("getDashboardStats")
);

// Get all users
router.get("/users", 
  adminController.getAllUsers || 
  fallbackFunction("getAllUsers")
);

// Update user status
router.put("/users/:id/status", 
  adminController.updateUserStatus || 
  fallbackFunction("updateUserStatus")
);

// Delete user
router.delete("/users/:id", 
  adminController.deleteUser || 
  fallbackFunction("deleteUser")
);

// Get all exams with detailed stats
router.get("/exams", 
  adminController.getAllExamsWithStats || 
  fallbackFunction("getAllExamsWithStats")
);

// Exam history routes
router.get("/exam-history", 
  typeof getAllExamHistory === 'function' ? getAllExamHistory : fallbackFunction("getAllExamHistory"));

router.get("/exam-history/user/:userId", 
  typeof getUserExamHistory === 'function' ? getUserExamHistory : fallbackFunction("getUserExamHistory"));

// Get pass/fail statistics for a specific exam
router.get("/exam/:examId/stats", 
  typeof getExamPassFailStats === 'function' ? getExamPassFailStats : fallbackFunction("getExamPassFailStats"));

// Virtual machine management
router.post("/machines", 
  typeof manageMachines === 'function' ? manageMachines : fallbackFunction("manageMachines"));

module.exports = router;
