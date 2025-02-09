const express = require("express");
const {
  addQuestion,
  getQuestionsByExam,
  deleteQuestion,
} = require("../controllers/questions.controller");

const router = express.Router();

router.post("/", addQuestion); // Add a question
router.get("/:examId", getQuestionsByExam); // Get all questions for an exam
router.delete("/:id", deleteQuestion); // Delete a question

module.exports = router;
