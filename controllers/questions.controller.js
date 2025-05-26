const Question = require("../models/question.model");
const Exam = require("../models/exam.model");

const addQuestion = async (req, res) => {
  try {
    const { examId, questions, question } = req.body;

    // Validate examId
    if (!examId) {
      return res.status(400).json({ message: "Exam ID is required" });
    }

    // Check if exam exists
    const examExists = await Exam.findById(examId);
    if (!examExists) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Handle both single question object and multiple questions array
    let questionsToProcess = [];
    
    if (questions && Array.isArray(questions)) {
      // Multiple questions scenario
      questionsToProcess = questions;
    } else if (question && typeof question === 'object') {
      // Single question scenario
      questionsToProcess = [question];
    } else if (questions && !Array.isArray(questions)) {
      // Single question passed as 'questions' field
      questionsToProcess = [questions];
    } else {
      return res.status(400).json({ 
        message: "Please provide either 'question' object or 'questions' array" 
      });
    }

    // Validate that we have at least one question
    if (questionsToProcess.length === 0) {
      return res.status(400).json({ message: "At least one question is required" });
    }

    // Validate questions before processing
    for (let i = 0; i < questionsToProcess.length; i++) {
      const questionData = questionsToProcess[i];
      
      if (!questionData.type) {
        return res.status(400).json({ 
          message: `Question ${i + 1}: Type is required (MCQ, ShortAnswer, or Practical)` 
        });
      }
      
      if (!questionData.text && !questionData.questionText) {
        return res.status(400).json({ 
          message: `Question ${i + 1}: Question text is required` 
        });
      }
      
      if (!questionData.correctAnswer) {
        return res.status(400).json({ 
          message: `Question ${i + 1}: Correct answer is required` 
        });
      }
      
      // Validate MCQ specific requirements
      if (questionData.type === "MCQ") {
        if (!questionData.options || !Array.isArray(questionData.options) || questionData.options.length < 2) {
          return res.status(400).json({ 
            message: `Question ${i + 1}: MCQ questions must have at least 2 options` 
          });
        }
      }
    }

    const createdQuestions = [];
    const addedMCQs = [];
    const addedShortAnswers = [];

    // Process each question
    for (let i = 0; i < questionsToProcess.length; i++) {
      const questionData = questionsToProcess[i];
      
      try {
        // Map incoming fields to match schema
        const questionDoc = {
          examId,
          type: questionData.type,
          questionText: questionData.text || questionData.questionText,
          options: questionData.options,
          correctAnswer: questionData.correctAnswer,
        };

        // Create and save the question
        const question = new Question(questionDoc);
        const savedQuestion = await question.save();
        createdQuestions.push(savedQuestion);

        // Track questions by type for exam sections update
        if (question.type === "MCQ") {
          addedMCQs.push(savedQuestion._id);
        } else if (question.type === "ShortAnswer") {
          addedShortAnswers.push(savedQuestion._id);
        }
        
      } catch (questionError) {
        console.error(`Error creating question ${i + 1}:`, questionError);
        return res.status(400).json({ 
          message: `Error creating question ${i + 1}: ${questionError.message}` 
        });
      }
    }

    // Update exam sections with all newly created question IDs
    if (addedMCQs.length > 0) {
      examExists.sections.mcqs.push(...addedMCQs);
    }
    if (addedShortAnswers.length > 0) {
      examExists.sections.shortAnswers.push(...addedShortAnswers);
    }

    // Save the updated exam
    await examExists.save();

    // Prepare response
    const responseMessage = questionsToProcess.length === 1 
      ? "Question created successfully" 
      : `${questionsToProcess.length} questions created successfully`;

    res.status(201).json({
      message: responseMessage,
      questions: createdQuestions,
      summary: {
        total: createdQuestions.length,
        mcqs: addedMCQs.length,
        shortAnswers: addedShortAnswers.length,
        examId: examId
      }
    });
    
  } catch (error) {
    console.error("Error in addQuestion:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
