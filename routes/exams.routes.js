const express = require("express");
const {
  createExam,
  getAllExams,
  getExamById,
  deleteExam,
  updateExam
} = require("../controllers/exams.controller");

const router = express.Router();

router.post("/", createExam); // Create an exam
router.get("/", getAllExams); // Get all exams
router.get("/:id", getExamById); // Get exam by ID
router.delete("/:id", deleteExam); // Delete exam
router.put("/:id", updateExam);

module.exports = router;
