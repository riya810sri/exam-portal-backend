const Question = require("../models/question.model");
const Exam = require("../models/exam.model");

const addQuestion = async (req, res) => {
  try {
    const { examId, questions } = req.body;

    const examExists = await Exam.findById(examId);
    if (!examExists) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const createdQuestions = [];
    for (const questionData of questions) {
      // Map incoming fields to match schema
      const questionDoc = {
        examId,
        type: questionData.type,
        questionText: questionData.text || questionData.questionText, // Handle both field names
        options: questionData.options,
        correctAnswer: questionData.correctAnswer,
      };

      // Create and save the question
      const question = new Question(questionDoc);
      const savedQuestion = await question.save();
      createdQuestions.push(savedQuestion);

      // Update the exam's sections with the newly created question ID
      if (question.type === "MCQ") {
        examExists.sections.mcqs.push(savedQuestion._id);
      } else if (question.type === "ShortAnswer") {
        examExists.sections.shortAnswers.push(savedQuestion._id);
      }
    }

    // Save the updated exam
    await examExists.save();

    res.status(201).json({
      message: "Questions created successfully",
      questions: createdQuestions,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const getQuestionsByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const questions = await Question.find({ examId });

    if (!questions.length)
      return res
        .status(404)
        .json({ message: "No questions found for this exam" });

    res.status(200).json(questions);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const deletedQuestion = await Question.findByIdAndDelete(req.params.id);

    if (!deletedQuestion)
      return res.status(404).json({ message: "Question not found" });

    res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    res.status(200).json(question);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

module.exports = { 
  addQuestion, 
  getQuestionsByExam, 
  deleteQuestion,
  getQuestionById
};
