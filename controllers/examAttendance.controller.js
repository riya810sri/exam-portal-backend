const Exam = require("../models/exam.model");
const ExamAttendance = require("../models/examAttendance.model");
const Question = require("../models/question.model");
const { generateCertificate } = require("./certificate.controller");
const User = require("../models/user.model");
const TmpExamStudentData = require('../models/tmp.model');
const { mailSender, sendCertificateEmail } = require('../utils/mailSender'); // Add this import
const mongoose = require('mongoose'); // Import mongoose

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

// Helper function to get real attempt count and fix inconsistencies
const getRealAttemptCount = async (examId, userId) => {
  try {
    // Get all completed or timed out attempts
    const completedAttempts = await ExamAttendance.find({
      examId, 
      userId,
      status: { $in: ["COMPLETED", "TIMED_OUT"] }
    }).sort({ attemptNumber: 1 });
    
    // Get in-progress attempts
    const inProgressAttempts = await ExamAttendance.find({
      examId,
      userId,
      status: "IN_PROGRESS"
    });
    
    // Calculate real attempt count (only count completed/timed out and one in-progress)
    const realCount = completedAttempts.length + (inProgressAttempts.length > 0 ? 1 : 0);
    
    // Check if database has inconsistent attempt numbers
    if (completedAttempts.length > 0) {
      // Check if attempt numbers are sequential starting from 1
      let needsFixing = false;
      for (let i = 0; i < completedAttempts.length; i++) {
        if (completedAttempts[i].attemptNumber !== i + 1) {
          needsFixing = true;
          break;
        }
      }
      
      // Fix attempt numbers if needed
      if (needsFixing) {
        console.log(`Fixing inconsistent attempt numbers for user ${userId}, exam ${examId}`);
        for (let i = 0; i < completedAttempts.length; i++) {
          completedAttempts[i].attemptNumber = i + 1;
          await completedAttempts[i].save();
        }
        
        // Also update any in-progress attempt
        if (inProgressAttempts.length > 0) {
          inProgressAttempts[0].attemptNumber = completedAttempts.length + 1;
          await inProgressAttempts[0].save();
          
          // Cancel any extra in-progress attempts
          if (inProgressAttempts.length > 1) {
            for (let i = 1; i < inProgressAttempts.length; i++) {
              await ExamAttendance.findByIdAndDelete(inProgressAttempts[i]._id);
            }
          }
        }
      }
    }
    
    return realCount;
  } catch (error) {
    console.error("Error in getRealAttemptCount:", error);
    return 0; // Default to 0 on error
  }
};

// Start attending exam
const attendExam = async (req, res) => {
  try {
    console.log("Starting exam attendance process");
    const { examId } = req.params;
    const { page = 1, limit = 1, newAttempt = false } = req.query;
    const userId = req.user._id;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const MAX_ATTEMPTS = 2; // Maximum allowed attempts

    console.log(`Request parameters - examId: ${examId}, userId: ${userId}, newAttempt: ${newAttempt}`);
    
    // Fix the duplicate key issue by dropping the old index
    try {
      // Only try to fix the index if we are creating a new attempt
      if (newAttempt === 'true') {
        console.log("Attempting to fix index issues for multiple attempts...");
        const connection = mongoose.connection;
        
        if (connection.readyState === 1) { // 1 = connected
          try {
            await connection.db.collection('examattendances').dropIndex('examId_1_userId_1');
            console.log("Successfully dropped old index");
          } catch (indexError) {
            console.log("Index might be already fixed or not exist:", indexError.message);
            // Continue execution regardless
          }
        }
      }
    } catch (indexError) {
      console.log("Index operation failed but continuing:", indexError.message);
      // We continue as the exam might still work
    }

    // Find the exam and populate the MCQ questions
    console.log(`Looking for exam with ID: ${examId}`);
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options'
    });

    if (!exam) {
      console.log("Exam not found");
      return res.status(404).json({ message: "Exam not found" });
    }
    
    console.log(`Found exam: ${exam.title}, status: ${exam.status}`);
    
    // Check if the exam is published
    if (exam.status !== "PUBLISHED") {
      console.log(`Exam is not published, current status: ${exam.status}`);
      return res.status(403).json({ 
        message: "This exam is not available for attendance. Only published exams can be attended." 
      });
    }
    
    // Get real attempt count and fix inconsistencies
    const realAttemptCount = await getRealAttemptCount(examId, userId);
    console.log(`User has ${realAttemptCount} real attempts for this exam`);
    
    // Check if user has already completed the maximum allowed attempts
    if (realAttemptCount >= MAX_ATTEMPTS) {
      // Get the completed attempts to show details
      const completedAttempts = await ExamAttendance.find({
        examId,
        userId,
        status: { $in: ["COMPLETED", "TIMED_OUT"] }
      }).select('attemptNumber score totalQuestions status');
      
      console.log(`User reached maximum attempts (${MAX_ATTEMPTS})`);
      
      return res.status(403).json({ 
        message: "Maximum attempts reached. You can only take this exam twice.",
        maxAttempts: MAX_ATTEMPTS,
        currentAttempts: realAttemptCount,
        attempts: completedAttempts
      });
    }
    
    // Check if user has already started the exam
    let attendance;
    
    if (newAttempt === 'true') {
      console.log("Creating new attempt as requested");
      
      // Check if previous attempt is completed or timed out
      const prevAttempt = await ExamAttendance.findOne({ 
        examId, 
        userId,
        status: { $in: ["COMPLETED", "TIMED_OUT"] } 
      }).sort({ createdAt: -1 });
      
      if (prevAttempt) {
        console.log(`Previous attempt found with status: ${prevAttempt.status}`);
      } else {
        console.log("No previous attempts found");
      }
      
      // Calculate next attempt number based on real attempt count
      const nextAttemptNumber = realAttemptCount + 1;
      console.log(`Creating new attempt with number: ${nextAttemptNumber}`);
      
      try {
        // First, cancel any existing in-progress attempts
        await ExamAttendance.updateMany(
          { examId, userId, status: "IN_PROGRESS" },
          { status: "TIMED_OUT", endTime: new Date() }
        );
        
        // Try to fix the duplicate key issue explicitly
        try {
          const connection = mongoose.connection;
          if (connection && connection.readyState === 1) {
            // Try to drop the problematic index directly
            try {
              // Get all indexes
              const indexes = await connection.db.collection('examattendances').indexes();
              // Check if the index exists
              const oldIndex = indexes.find(idx => 
                idx.name === 'examId_1_userId_1' || 
                (idx.key && idx.key.examId === 1 && idx.key.userId === 1 && !idx.key.attemptNumber)
              );
              
              if (oldIndex) {
                await connection.db.collection('examattendances').dropIndex(oldIndex.name);
                console.log(`Successfully dropped problematic index: ${oldIndex.name}`);
              }
            } catch (indexError) {
              console.log("Index drop failed or not needed:", indexError.message);
            }
            
            // Create the compound index with attemptNumber if it doesn't exist
            try {
              await connection.db.collection('examattendances').createIndex(
                { examId: 1, userId: 1, attemptNumber: 1 },
                { unique: true }
              );
              console.log("Created or verified proper index with attemptNumber");
            } catch (indexCreateError) {
              console.log("Index creation failed or already exists:", indexCreateError.message);
            }
          }
        } catch (indexOpsError) {
          console.log("Index operations failed but continuing:", indexOpsError.message);
        }
        
        // Double check and delete any duplicate documents that might cause conflicts
        try {
          const existingAttempts = await ExamAttendance.find({
            examId, 
            userId, 
            attemptNumber: nextAttemptNumber
          });
          
          if (existingAttempts.length > 0) {
            console.log(`Found ${existingAttempts.length} conflicting attempts, removing them`);
            await ExamAttendance.deleteMany({
              examId, 
              userId, 
              attemptNumber: nextAttemptNumber
            });
          }
        } catch (cleanupError) {
          console.log("Cleanup failed but continuing:", cleanupError.message);
        }
        
        // Create a new attempt
        attendance = new ExamAttendance({
          examId,
          userId,
          totalQuestions: exam.sections.mcqs.length,
          startTime: new Date(),
          status: "IN_PROGRESS",
          attemptNumber: nextAttemptNumber
        });
        
        await attendance.save();
        console.log(`New attendance record created with ID: ${attendance._id}`);
      } catch (saveError) {
        console.error("Error saving attendance record:", saveError);
        // Check if it's a duplicate key error
        if (saveError.code === 11000) {
          // Cleanup any stray records and try again with a more aggressive approach
          try {
            console.log("Duplicate key detected. Performing thorough cleanup...");
            
            // Cancel all in-progress attempts
            await ExamAttendance.updateMany(
              { examId, userId, status: "IN_PROGRESS" },
              { status: "TIMED_OUT", endTime: new Date() }
            );
            
            // Delete any problematic attempts with the next attempt number
            await ExamAttendance.deleteMany({
              examId, 
              userId, 
              attemptNumber: nextAttemptNumber
            });
            
            // Wait a moment for MongoDB to process the deletes
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try creating the attempt one more time
            attendance = new ExamAttendance({
              examId,
              userId,
              totalQuestions: exam.sections.mcqs.length,
              startTime: new Date(),
              status: "IN_PROGRESS",
              attemptNumber: nextAttemptNumber
            });
            
            await attendance.save();
            console.log(`Successfully created attendance record after cleanup: ${attendance._id}`);
          } catch (retryError) {
            console.error("Final attempt to create record failed:", retryError);
            return res.status(500).json({
              message: "Could not create a new exam attempt. Please try again later.",
              error: "Database error"
            });
          }
        } else {
          throw saveError; // rethrow for the outer catch block
        }
      }

      // Randomize questions and store in memory
      const randomizedQuestions = shuffleArray(exam.sections.mcqs);
      
      // Initialize user exam data
      if (!userExamData[userId]) {
        userExamData[userId] = {};
      }
      
      userExamData[userId][examId] = {
        randomizedQuestions,
        userAnswers: {},
        attemptId: attendance._id
      };
      
      console.log("Questions randomized and stored in memory");
    } else {
      console.log("Looking for existing in-progress attempt");
      // Find the latest active attempt
      attendance = await ExamAttendance.findOne({ 
        examId, 
        userId,
        status: "IN_PROGRESS" 
      }).sort({ createdAt: -1 });

      if (!attendance) {
        console.log("No in-progress attempt found, creating a new one");
        
        try {
          // Create first attempt
          attendance = new ExamAttendance({
            examId,
            userId,
            totalQuestions: exam.sections.mcqs.length,
            startTime: new Date(),
            status: "IN_PROGRESS",
            attemptNumber: 1
          });
          
          await attendance.save();
          console.log(`New first attendance record created with ID: ${attendance._id}`);
        } catch (saveError) {
          console.error("Error saving first attendance record:", saveError);
          // Check if it's a duplicate key error
          if (saveError.code === 11000) {
            return res.status(409).json({
              message: "You already have an attempt for this exam in progress.",
              error: "DuplicateKeyError"
            });
          } else {
            throw saveError; // rethrow for the outer catch block
          }
        }

        // Randomize questions and store in memory
        const randomizedQuestions = shuffleArray(exam.sections.mcqs);
        
        // Initialize user exam data
        if (!userExamData[userId]) {
          userExamData[userId] = {};
        }
        
        userExamData[userId][examId] = {
          randomizedQuestions,
          userAnswers: {},
          attemptId: attendance._id
        };
        
        console.log("Questions randomized and stored in memory for first attempt");
      } else {
        console.log(`Found existing in-progress attempt: ${attendance._id}`);
        
        if (!userExamData[userId] || !userExamData[userId][examId] || 
                  userExamData[userId][examId].attemptId.toString() !== attendance._id.toString()) {
          console.log("No in-memory data found for existing attempt, reinitializing");
          // If memory was cleared (server restart) or mismatch in attempt ID
          const randomizedQuestions = shuffleArray(exam.sections.mcqs);
          
          // Re-initialize user exam data
          if (!userExamData[userId]) {
            userExamData[userId] = {};
          }
          
          userExamData[userId][examId] = {
            randomizedQuestions,
            userAnswers: {},
            attemptId: attendance._id
          };
          
          console.log("Re-initialized question data in memory");
        }
      }
    }
    
    // Get randomized questions - using let instead of const for questions variable
    let questions = userExamData[userId]?.[examId]?.randomizedQuestions || [];
    if (questions.length === 0) {
      console.log("Warning: No questions found in memory, using exam questions directly");
      // Fallback to using all questions from the exam
      questions = exam.sections.mcqs;
    }
    
    console.log(`Total questions available: ${questions.length}`);
    
    // Calculate pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = Math.min(pageNum * limitNum, questions.length);
    
    console.log(`Pagination: page ${pageNum}, limit ${limitNum}, startIndex ${startIndex}, endIndex ${endIndex}`);
    
    // Get questions for current page
    const currentPageQuestions = questions.slice(startIndex, endIndex);
    console.log(`Retrieved ${currentPageQuestions.length} questions for current page`);

    // Calculate time remaining
    const startTime = new Date(attendance.startTime);
    const currentTime = new Date();
    const timeElapsed = (currentTime - startTime) / 1000 / 60; // in minutes
    const timeRemaining = Math.max(0, exam.duration - timeElapsed);
    console.log(`Time elapsed: ${timeElapsed.toFixed(2)} minutes, remaining: ${timeRemaining.toFixed(2)} minutes`);

    // Check if exam time is up
    if (timeRemaining <= 0 && attendance.status === "IN_PROGRESS") {
      console.log("Exam time is up, marking as timed out");
      attendance.status = "TIMED_OUT";
      attendance.endTime = new Date();
      await attendance.save();
      return res.status(400).json({ 
        message: "Exam time is up!",
        status: "TIMED_OUT"
      });
    }

    console.log("Sending exam question to client");
    res.status(200).json({
      examTitle: exam.title,
      currentPage: parseInt(page),
      totalPages: Math.ceil(questions.length / limitNum),
      totalQuestions: questions.length,
      question: currentPageQuestions.length > 0 ? currentPageQuestions[0] : null,
      timeRemaining: Math.round(timeRemaining),
      attendanceId: attendance._id,
      attemptNumber: attendance.attemptNumber
    });

  } catch (error) {
    console.error("Error in attendExam:", error);
    res.status(500).json({ 
      message: "Failed to start exam session. Please try again.",
      error: "Internal Server Error", 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
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

    if (!questionId || !selectedAnswer) {
      return res.status(400).json({ 
        message: "Question ID and selected answer are required" 
      });
    }

    // First check if this user has an in-progress attendance for this exam
    const attendance = await ExamAttendance.findOne({
      examId,
      userId,
      status: "IN_PROGRESS"
    });

    if (!attendance) {
      return res.status(404).json({ 
        message: "No active exam session found. Please start the exam first." 
      });
    }

    // Initialize user exam data if it doesn't exist
    if (!userExamData[userId]) {
      userExamData[userId] = {};
    }
    
    if (!userExamData[userId][examId]) {
      // Find the exam to get question sequence
      const exam = await Exam.findById(examId).populate({
        path: 'sections.mcqs',
        select: '_id'
      });
      
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      // Initialize with all question IDs
      const allQuestionIds = exam.sections.mcqs.map(q => q._id.toString());
      userExamData[userId][examId] = {
        questionSequence: shuffleArray([...allQuestionIds]),
        userAnswers: {}
      };
    }

    // Store answer in memory
    userExamData[userId][examId].userAnswers[questionId] = selectedAnswer;

    // Update attendance
    attendance.attemptedQuestions = Object.keys(userExamData[userId][examId].userAnswers).length;
    attendance.lastUpdated = new Date();
    await attendance.save();

    res.status(200).json({ 
      message: "Answer submitted successfully",
      nextQuestion: null // You can add logic to return the next question if needed
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
    console.log("Starting exam completion process");
    const { examId } = req.params;
    const userId = req.user._id;
    const MAX_ATTEMPTS = 2;

    // Log important info for debugging
    console.log(`ExamID: ${examId}, UserID: ${userId}`);
    
    // Get submitted answers from request body
    const { answers } = req.body || {};
    console.log(`Received answers: ${answers ? Object.keys(answers).length : 0} questions`);
    
    // Find attendance record
    const attendance = await ExamAttendance.findOne({ 
      examId, 
      userId, 
      status: "IN_PROGRESS" 
    }).sort({ createdAt: -1 });
    
    if (!attendance) {
      console.log("No active exam session found");
      return res.status(404).json({ message: "No active exam session found" });
    }

    console.log(`Found attendance record: ${attendance._id}, status: ${attendance.status}`);

    if (attendance.status !== "IN_PROGRESS") {
      console.log(`Exam is already in status: ${attendance.status}`);
      return res.status(400).json({ message: "Exam is already completed or timed out" });
    }

    // Get user details for certificate
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    // Get exam details with correct answers
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options correctAnswer correctOption _id'
    });
    
    if (!exam) {
      console.log("Exam not found");
      return res.status(404).json({ message: "Exam not found" });
    }

    console.log(`Loaded exam: ${exam.title} with ${exam.sections.mcqs.length} questions`);

    // Get user answers from memory or submitted answers
    let userAnswersMap = {};
    
    if (answers && typeof answers === 'object') {
      // If answers provided in request body, process them
      userAnswersMap = answers;
      console.log(`Using ${Object.keys(userAnswersMap).length} answers from request body`);
    } else if (userExamData[userId] && userExamData[userId][examId]) {
      // If answers stored in memory
      userAnswersMap = userExamData[userId][examId].userAnswers;
      console.log(`Using ${Object.keys(userAnswersMap).length} answers from memory`);
    } else {
      console.log("No answers found in request or memory");
    }
    
    // Create a map of questions for quick lookup
    const questionsMap = {};
    exam.sections.mcqs.forEach(q => {
      questionsMap[q._id.toString()] = q;
    });
    
    // Process answers and calculate score
    const processedAnswers = [];
    let score = 0;
    let totalAnswered = 0;
    
    Object.entries(userAnswersMap).forEach(([questionId, selectedAnswer]) => {
      const question = questionsMap[questionId];
      
      if (question) {
        totalAnswered++;
        // Check for correct answer using either correctAnswer or correctOption field
        const correctValue = question.correctOption || question.correctAnswer;
        const isCorrect = correctValue === selectedAnswer;
        if (isCorrect) score++;
        
        processedAnswers.push({
          questionId,
          selectedAnswer,
          isCorrect
        });
      }
    });
    
    console.log(`Processed ${processedAnswers.length} answers, score: ${score}/${attendance.totalQuestions}`);
    
    // Update attendance with answers and score
    attendance.answers = processedAnswers;
    attendance.score = score;
    attendance.attemptedQuestions = totalAnswered;
    attendance.status = "COMPLETED";
    attendance.endTime = new Date();
    
    await attendance.save();
    console.log("Updated attendance record with results");
    
    // Clean up memory
    if (userExamData[userId] && userExamData[userId][examId]) {
      delete userExamData[userId][examId];
      console.log("Cleaned up memory storage");
    }
    
    // Calculate percentage
    const percentage = (score / attendance.totalQuestions) * 100;
    const passed = percentage >= 60; // Pass threshold is 60%
    console.log(`Final score: ${percentage.toFixed(2)}%, Result: ${passed ? "PASS" : "FAIL"}`);

    let certificateInfo = null;
    let certificatePath = null;

    // Only generate certificate if score is at least 60%
    if (passed) {
      try {
        console.log("Generating certificate...");
        // Current date in DD/MM/YYYY format
        const dateOfIssue = new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        // Call certificate generator with all required data
        certificateInfo = await generateCertificate({
          name: user.username || `${user.firstName} ${user.lastName}`,
          directorName: "TechOnquer Director",
          dateOfIssue,
          email: user.email,
          // Add additional exam info
          examTitle: exam.title,
          score: `${score}/${attendance.totalQuestions} (${percentage.toFixed(2)}%)`,
          passed: true
        });

        // Store certificate path for email attachment
        certificatePath = certificateInfo.certificatePath;
        console.log(`Certificate generated: ${certificateInfo.certificateId}`);

        // Send certificate via email if generated
        if (certificatePath) {
          console.log("Preparing to send certificate email");
          const emailSubject = `Congratulations! Your Certificate for ${exam.title}`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4a86e8;">Congratulations, ${user.firstName || user.username}!</h1>
              <p>You have successfully completed the exam: <strong>${exam.title}</strong></p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Your Results:</h3>
                <p><strong>Score:</strong> ${score}/${attendance.totalQuestions}</p>
                <p><strong>Percentage:</strong> ${percentage.toFixed(2)}%</p>
                <p><strong>Status:</strong> <span style="color: green; font-weight: bold;">PASSED</span></p>
                <p><strong>Attempt:</strong> ${attendance.attemptNumber} of ${MAX_ATTEMPTS}</p>
              </div>
              
              <p>Your certificate is attached to this email. You can also access your results and certificate from your account dashboard.</p>
              
              <p>We appreciate your dedication to learning!</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
                <p>This is an automated message from TechOnquer Exam Portal. Please do not reply to this email.</p>
              </div>
            </div>
          `;

          // Send email with certificate
          await sendCertificateEmail({
            email: user.email,
            subject: emailSubject,
            name: user.firstName || user.username,
            certificateId: certificateInfo.certificateId,
            examTitle: exam.title,
            passed: true,
            certificatePath: certificatePath
          });
          
          console.log(`Certificate email sent to ${user.email}`);
        }
      } catch (certError) {
        console.error("Error generating or sending certificate:", certError);
        // Continue execution - don't fail the exam completion if certificate fails
      }
    } else {
      // Send failure notification if user didn't pass
      try {
        console.log("Preparing to send failure notification email");
        const emailSubject = `Exam Results: ${exam.title}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4a86e8;">Exam Results</h1>
            <p>Hello ${user.firstName || user.username},</p>
            <p>You have completed the exam: <strong>${exam.title}</strong></p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Results:</h3>
              <p><strong>Score:</strong> ${score}/${attendance.totalQuestions}</p>
              <p><strong>Percentage:</strong> ${percentage.toFixed(2)}%</p>
              <p><strong>Status:</strong> <span style="color: #e74c3c; font-weight: bold;">NOT PASSED</span></p>
              <p><strong>Attempt:</strong> ${attendance.attemptNumber} of ${MAX_ATTEMPTS}</p>
            </div>
            
            <p>${attendance.attemptNumber < MAX_ATTEMPTS ? 
              'You can try the exam again to improve your score.' : 
              'You have reached the maximum number of attempts for this exam.'}</p>
            
            <p>Keep learning and improving!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
              <p>This is an automated message from TechOnquer Exam Portal. Please do not reply to this email.</p>
            </div>
          </div>
        `;

        await mailSender(user.email, emailSubject, emailHtml);
        console.log(`Exam results email sent to ${user.email}`);
      } catch (emailError) {
        console.error("Error sending results email:", emailError);
      }
    }

    console.log("Preparing final response");
    
    // Make sure we explicitly send a response
    return res.status(200).json({
      message: "Exam completed successfully",
      score: score,
      totalQuestions: attendance.totalQuestions,
      attemptedQuestions: attendance.attemptedQuestions,
      percentage: percentage.toFixed(2),
      result: passed ? "pass" : "failed",
      certificateGenerated: certificateInfo ? "yes" : "no",
      certificateId: certificateInfo?.certificateId || null,
      emailSent: true
    });

  } catch (error) {
    console.error("Error in completeExam:", error);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Get all exams taken/attempted by the user
const getUserExams = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find all exam attendances for this user
    const examAttendances = await ExamAttendance.find({ userId })
      .populate({
        path: 'examId',
        select: 'title description duration status publishedAt',
      })
      .sort({ startTime: -1 }); // Sort by most recent first
    
    if (!examAttendances || examAttendances.length === 0) {
      return res.status(200).json({ 
        message: "You have not taken any exams yet",
        exams: [] 
      });
    }
    
    // Format the response
    const userExams = examAttendances.map(attendance => {
      // Calculate percentage
      const percentage = attendance.totalQuestions > 0 
        ? ((attendance.score / attendance.totalQuestions) * 100).toFixed(2) 
        : 0;
      
      // Determine if the user passed (60% is passing threshold)
      const passed = parseFloat(percentage) >= 60;
      
      return {
        attendanceId: attendance._id,
        examId: attendance.examId._id,
        examTitle: attendance.examId.title,
        examDescription: attendance.examId.description,
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        status: attendance.status,
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptedQuestions: attendance.attemptedQuestions,
        percentage: percentage,
        passed: passed,
        duration: attendance.examId.duration,
        attemptNumber: attendance.attemptNumber || 1
      };
    });
    
    res.status(200).json({
      message: "Exam history retrieved successfully",
      count: userExams.length,
      exams: userExams
    });
    
  } catch (error) {
    console.error("Error retrieving user exams:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  attendExam,
  submitAnswer,
  completeExam,
  getExamStatus,
  getExamResult,
  reviewExamQuestions,
  getUserExams
};