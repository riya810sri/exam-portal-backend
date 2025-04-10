const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRoleAccess } = require("../middlewares/role.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const questionsController = require("../controllers/questions.controller");

// Check if controller methods exist and provide fallbacks if they don't
const getAllQuestions = questionsController.getAllQuestions || 
  ((req, res) => res.status(501).json({ message: "Not implemented yet" }));

const getQuestionById = questionsController.getQuestionById || 
  ((req, res) => res.status(501).json({ message: "Not implemented yet" }));

const createQuestion = questionsController.createQuestion || 
  ((req, res) => res.status(501).json({ message: "Not implemented yet" }));

const updateQuestion = questionsController.updateQuestion || 
  ((req, res) => res.status(501).json({ message: "Not implemented yet" }));

const deleteQuestion = questionsController.deleteQuestion || 
  ((req, res) => res.status(501).json({ message: "Not implemented yet" }));

// All users can view questions
router.get("/", authenticateUser, getAllQuestions);
router.get("/:id", authenticateUser, getQuestionById);

// Only admin can create, update, delete questions
router.post("/", authenticateUser, checkRole("admin"), createQuestion);
router.put("/:id", authenticateUser, checkRole("admin"), updateQuestion);
router.delete("/:id", authenticateUser, checkRole("admin"), deleteQuestion);

module.exports = router;
