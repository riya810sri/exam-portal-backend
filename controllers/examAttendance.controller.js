const Exam = require("../models/exam.model");
const ExamAttendance = require("../models/examAttendance.model");
const Question = require("../models/question.model");
const { generateCertificate } = require("./certificate.controller");
const User = require("../models/user.model");
const TmpExamStudentData = require('../models/tmp.model');

// Store user answers and randomized questions temporarily in memory
const userExamData = {};

// Function to randomize array (Fisher-Yates shuffle)
const shuffleArray = (array) => {
  const newArray = [...array]; // Create a copy to not modify the original
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Start attending exam
const attendExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { page = 1, limit = 1 } = req.query;
    const userId = req.user._id;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Find the exam and populate the MCQ questions
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options'
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // Debug - log the exam structure
    console.log("Exam:", JSON.stringify(exam, null, 2));
    
    // Check if user has already started the exam
    let attendance = await ExamAttendance.findOne({ examId, userId });

    if (!attendance) {
      // Create new attendance record
      attendance = new ExamAttendance({
        examId,
        userId,
        totalQuestions: exam.sections.mcqs.length,
        startTime: new Date(),
        status: "IN_PROGRESS"
      });
      await attendance.save();

      // Randomize questions and store in memory
      const randomizedQuestions = shuffleArray(exam.sections.mcqs);
      
      // Initialize user exam data
      if (!userExamData[userId]) {
        userExamData[userId] = {};
      }
      
      userExamData[userId][examId] = {
        randomizedQuestions,
        userAnswers: {}
      };
    } else if (!userExamData[userId] || !userExamData[userId][examId]) {
      // If memory was cleared (server restart), re-randomize questions
      const randomizedQuestions = shuffleArray(exam.sections.mcqs);
      
      // Re-initialize user exam data
      if (!userExamData[userId]) {
        userExamData[userId] = {};
      }
      
      userExamData[userId][examId] = {
        randomizedQuestions,
        userAnswers: {}
      };
    }

    // Get randomized questions
    const questions = userExamData[userId][examId].randomizedQuestions;
    
    // Calculate pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = Math.min(pageNum * limitNum, questions.length);
    
    // Get questions for current page
    const currentPageQuestions = questions.slice(startIndex, endIndex);

    // Calculate time remaining
    const startTime = new Date(attendance.startTime);
    const currentTime = new Date();
    const timeElapsed = (currentTime - startTime) / 1000 / 60; // in minutes
    const timeRemaining = Math.max(0, exam.duration - timeElapsed);

    // Check if exam time is up
    if (timeRemaining <= 0 && attendance.status === "IN_PROGRESS") {
      attendance.status = "TIMED_OUT";
      attendance.endTime = new Date();
      await attendance.save();
      
      // Clean up memory
      if (userExamData[userId] && userExamData[userId][examId]) {
        delete userExamData[userId][examId];
      }
      
      return res.status(400).json({ 
        message: "Exam time is up!",
        status: "TIMED_OUT"
      });
    }

    // Get any saved answers for this question
    let savedAnswer = null;
    if (currentPageQuestions.length > 0) {
      const questionId = currentPageQuestions[0]._id.toString();
      savedAnswer = userExamData[userId][examId].userAnswers[questionId];
    }
    
    // Format response
    const responseData = {
      examTitle: exam.title,
      currentPage: pageNum,
      totalPages: Math.ceil(questions.length / limitNum),
      totalQuestions: questions.length,
      timeRemaining: Math.round(timeRemaining),
      attendanceId: attendance._id,
      currentQuestionIndex: (pageNum - 1)
    };
    
    // Add question data if available
    if (currentPageQuestions.length > 0) {
      responseData.question = currentPageQuestions[0];
      responseData.userAnswer = savedAnswer || null;
    } else {
      responseData.message = "No questions found for this page";
    }

    // Include debug info in development
    if (process.env.NODE_ENV === 'development') {
      responseData.debug = {
        questionCount: questions.length,
        currentPageCount: currentPageQuestions.length,
        examHasMcqs: exam.sections && exam.sections.mcqs && exam.sections.mcqs.length > 0,
        pagination: { startIndex, endIndex, page: pageNum, limit: limitNum }
      };
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Error in attendExam:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Store answer temporarily in memory
const submitAnswer = async (req, res) => {
  try {
    const { examId } = req.params;
    const { questionId, selectedAnswer } = req.body;
    const userId = req.user._id;

    // Find attendance record to verify exam is in progress
    const attendance = await ExamAttendance.findOne({ examId, userId });
    if (!attendance) {
      return res.status(404).json({ message: "No active exam session found" });
    }

    if (attendance.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Exam is not in progress" });
    }

    // Check if we have data for this user/exam
    if (!userExamData[userId] || !userExamData[userId][examId]) {
      return res.status(400).json({ 
        message: "Exam session data not found, please restart the exam" 
      });
    }

    // Save answer in memory
    userExamData[userId][examId].userAnswers[questionId] = selectedAnswer;

    // Count total answers
    const totalAnswers = Object.keys(userExamData[userId][examId].userAnswers).length;

    res.status(200).json({
      message: "Answer stored temporarily",
      totalAnswered: totalAnswers,
      totalQuestions: attendance.totalQuestions
    });

  } catch (error) {
    console.error("Error in submitAnswer:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

// Complete exam and submit all answers at once
const completeExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;

    // Get submitted answers from request body if provided
    const { answers } = req.body || {};

    // Find attendance record
    const attendance = await ExamAttendance.findOne({ examId, userId });
    if (!attendance) {
      return res.status(404).json({ message: "No active exam session found" });
    }

    if (attendance.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Exam is already completed or timed out" });
    }

    // Get user details for certificate
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get exam details with correct answers
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options correctAnswer _id'
    });
    
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Get user answers either from memory or request body
    let userAnswersMap = {};
    
    if (answers && typeof answers === 'object') {
      // If answers provided in request body as {questionId: selectedAnswer, ...}
      userAnswersMap = answers;
    } else if (userExamData[userId] && userExamData[userId][examId]) {
      // If answers stored in memory
      userAnswersMap = userExamData[userId][examId].userAnswers;
    }
    
    // Create a map of questions for quick lookup
    const questionsMap = {};
    exam.sections.mcqs.forEach(q => {
      questionsMap[q._id.toString()] = q;
    });
    
    // Process answers and calculate score
    const processedAnswers = [];
    let score = 0;
    
    Object.entries(userAnswersMap).forEach(([questionId, selectedAnswer]) => {
      const question = questionsMap[questionId];
      
      if (question) {
        const isCorrect = question.correctAnswer === selectedAnswer;
        if (isCorrect) score++;
        
        processedAnswers.push({
          questionId,
          selectedAnswer,
          isCorrect
        });
      }
    });
    
    // Update attendance with answers and score
    attendance.answers = processedAnswers;
    attendance.score = score;
    attendance.attemptedQuestions = processedAnswers.length;
    attendance.status = "COMPLETED";
    attendance.endTime = new Date();
    
    await attendance.save();
    
    // Clean up memory
    if (userExamData[userId] && userExamData[userId][examId]) {
      delete userExamData[userId][examId];
    }
    
    // Calculate percentage
    const percentage = (score / attendance.totalQuestions) * 100;
    const passed = percentage >= 60;

    let certificateInfo = null;

    // Only generate certificate if score is at least 60%
    if (passed) {
      try {
        // Current date in DD/MM/YYYY format
        const dateOfIssue = new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        // Call certificate generator with all required data
        certificateInfo = await generateCertificate({
          name: user.username,
          directorName: "TechOnquer Director",
          dateOfIssue,
          email: user.email,
          // Add additional exam info
          examTitle: exam.title,
          score: `${score}/${attendance.totalQuestions} (${percentage.toFixed(2)}%)`,
          passed: true
        });

        console.log("Certificate generated successfully:", certificateInfo?.certificateId || "Unknown ID");
      } catch (certError) {
        console.error("Failed to generate certificate:", certError.message);
        // Continue execution - don't fail the exam completion if certificate fails
      }
    } else {
      console.log(`No certificate generated for user ${user.username} - failed with ${percentage.toFixed(2)}%`);
    }

    res.status(200).json({
      message: "Exam completed successfully",
      score: score,
      totalQuestions: attendance.totalQuestions,
      attemptedQuestions: attendance.attemptedQuestions,
      percentage: percentage.toFixed(2),
      result: passed ? "pass" : "failed",
      certificateGenerated: certificateInfo ? "yes" : "no",
      certificateId: certificateInfo?.certificateId || null
    });

  } catch (error) {
    console.error("Error in completeExam:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

// Get exam status and progress
const getExamStatus = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;

    const attendance = await ExamAttendance.findOne({ examId, userId });
    if (!attendance) {
      return res.status(404).json({ message: "No exam session found" });
    }

    // Get answer count from memory if available
    let answeredCount = 0;
    if (userExamData[userId] && userExamData[userId][examId]) {
      answeredCount = Object.keys(userExamData[userId][examId].userAnswers).length;
    }

    res.status(200).json({
      status: attendance.status,
      score: attendance.status === "IN_PROGRESS" ? null : attendance.score,
      totalQuestions: attendance.totalQuestions,
      attemptedQuestions: attendance.status === "IN_PROGRESS" ? answeredCount : attendance.attemptedQuestions,
      startTime: attendance.startTime,
      endTime: attendance.endTime
    });

  } catch (error) {
    console.error("Error in getExamStatus:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

// Get exam result
const getExamResult = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;

    const attendance = await ExamAttendance.findOne({ examId, userId })
      .populate({
        path: 'answers.questionId',
        select: 'questionText options correctAnswer'
      });

    if (!attendance) {
      return res.status(404).json({ message: "No exam session found" });
    }

    if (attendance.status === "IN_PROGRESS") {
      return res.status(400).json({ message: "Exam is still in progress" });
    }

    // Calculate percentage and result
    const percentage = (attendance.score / attendance.totalQuestions) * 100;
    const result = percentage >= 60 ? "pass" : "failed";

    res.status(200).json({
      status: attendance.status,
      score: attendance.score,
      totalQuestions: attendance.totalQuestions,
      attemptedQuestions: attendance.attemptedQuestions,
      startTime: attendance.startTime,
      endTime: attendance.endTime,
      result: result,
      answers: attendance.answers
    });

  } catch (error) {
    console.error("Error in getExamResult:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

// Review exam questions with user answers
const reviewExamQuestions = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;
    
    // Get user's attendance record
    const attendance = await ExamAttendance.findOne({ 
      examId, 
      userId,
      status: 'completed' 
    });
    
    if (!attendance) {
      return res.status(404).json({ message: "Exam attendance record not found or exam not completed" });
    }
    
    // Get temporary exam data with randomized questions
    const tmpData = await TmpExamStudentData.findOne({ userId, examId });
    
    if (!tmpData) {
      return res.status(404).json({ message: "Temporary exam data not found" });
    }
    
    // Get exam with all questions
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options correctOption explanation'
    });
    
    // Map questions with user answers based on questionIds in tmpData
    const reviewData = [];
    
    for (let i = 0; i < tmpData.questionIds.length; i++) {
      const questionId = tmpData.questionIds[i];
      const userAnswer = tmpData.answers[i];
      
      // Find question details
      let questionDetails = null;
      exam.sections.forEach(section => {
        section.mcqs.forEach(mcq => {
          if (mcq._id.toString() === questionId.toString()) {
            questionDetails = mcq;
          }
        });
      });
      
      if (questionDetails) {
        reviewData.push({
          questionId: questionDetails._id,
          questionText: questionDetails.questionText,
          options: questionDetails.options,
          userAnswer: userAnswer,
          correctAnswer: questionDetails.correctOption,
          isCorrect: userAnswer === questionDetails.correctOption,
          explanation: questionDetails.explanation || "No explanation provided"
        });
      }
    }
    
    res.status(200).json({
      examTitle: exam.title,
      totalQuestions: reviewData.length,
      correctAnswers: reviewData.filter(q => q.isCorrect).length,
      reviewData: reviewData
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

module.exports = {
  attendExam,
  submitAnswer,
  completeExam,
  getExamStatus,
  getExamResult,
  reviewExamQuestions
};