const express = require("express");
const {
  verifyAdmin,
  authenticateUser,
} = require("../middlewares/auth.middleware");
const {
  getUserResults,
  modifyExamSettings,
} = require("../controllers/admin.controller");
const { updateExam } = require("../controllers/exams.controller");
const { deleteQuestion } = require("../controllers/questions.controller");

const router = express.Router();

router.put("/exam/:id", authenticateUser, verifyAdmin, updateExam);
router.delete("/question/:id", authenticateUser, verifyAdmin, deleteQuestion);
router.get("/user-results", authenticateUser, verifyAdmin, getUserResults);
router.put(
  "/exam-settings/:id",
  authenticateUser,
  verifyAdmin,
  modifyExamSettings
);

module.exports = router;
