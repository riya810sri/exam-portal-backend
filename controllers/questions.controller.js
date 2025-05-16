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

const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionText, options, correctAnswer, type } = req.body;
    
    // Find the question
    const question = await Question.findById(id);
    
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    // Find the associated exam to check if updates are allowed
    const exam = await Exam.findById(question.examId);
    
    if (!exam) {
      return res.status(404).json({ message: "Associated exam not found" });
    }
    
    // For admin users, allow updates regardless of exam status
    const isAdmin = req.user.role === "admin";
    
    // If user is an admin, allow the update
    // For non-admin users, revert exam to pending if it was previously approved/published
    if (!isAdmin && exam.status !== "PENDING") {
      console.log(`Reverting exam ${exam._id} status from ${exam.status} to PENDING due to question update by non-admin`);
      exam.status = "PENDING";
      exam.approvedBy = null;
      exam.approvedAt = null;
      await exam.save();
    }
    
    // Update the question fields
    question.questionText = questionText || question.questionText;
    
    // Update options only if the question is an MCQ and options are provided
    if (type === "MCQ" || question.type === "MCQ") {
      if (options && Array.isArray(options)) {
        // Validate that MCQs have at least two options
        if (options.length < 2) {
          return res.status(400).json({ 
            message: "MCQ questions must have at least two options" 
          });
        }
        question.options = options;
      }
    }
    
    // Update correct answer if provided
    if (correctAnswer) {
      question.correctAnswer = correctAnswer;
    }
    
    // Save the updated question
    const updatedQuestion = await question.save();
    
    res.status(200).json({ 
      message: "Question updated successfully",
      question: updatedQuestion,
      examStatus: exam.status // Include exam status in response for clarity
    });
    
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { 
  addQuestion, 
  getQuestionsByExam, 
  deleteQuestion,
  getQuestionById,
  updateQuestion
};
