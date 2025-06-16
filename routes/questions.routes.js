const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRoleAccess } = require("../middlewares/role.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const { 
  addQuestion, 
  getQuestionsByExam, 
  deleteQuestion, 
  getQuestionById, 
  updateQuestion,
  exportQuestions
} = require("../controllers/questions.controller");

// All users can view questions
router.get("/", authenticateUser, getQuestionById ? getQuestionById : (req, res) => res.status(501).json({ message: "Not implemented yet" }));
router.get("/:id", authenticateUser, getQuestionById);

// Route to get questions by exam ID
router.get('/exam/:examId', getQuestionsByExam);

// Route to export questions by exam ID
router.get('/export/:examId', authenticateUser, exportQuestions);

// Route to add questions
router.post('/', addQuestion);

// Only admin can create and delete questions
router.post("/", authenticateUser, checkRole("admin"), (req, res) => {
  if (typeof createQuestion === 'function') {
    createQuestion(req, res);
  } else {
    res.status(501).json({ message: "Not implemented yet" });
  }
});

router.delete("/:id", authenticateUser, checkRole("admin"), deleteQuestion);

// Any authenticated user can update questions (but controller will enforce permissions)
router.put("/:id", authenticateUser, updateQuestion);

module.exports = router;
