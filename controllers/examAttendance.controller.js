// Helper function to get user-friendly status display
function getStatusDisplay(status) {
  switch(status) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'COMPLETED': return 'Completed';
    case 'TIMED_OUT': return 'Timed Out';
    default: return status;
  }
}
const Exam = require("../models/exam.model");
const ExamAttendance = require("../models/examAttendance.model");
const Question = require("../models/question.model");
const { generateCertificate } = require("./certificate.controller");
const User = require("../models/user.model");
const TmpExamStudentData = require('../models/tmp.model');
const { mailSender, sendCertificateEmail } = require('../utils/mailSender'); // Add this import
const mongoose = require('mongoose'); // Import mongoose
const attendanceUtils = require('../utils/attendanceUtils'); // Import attendance utilities
const { processAntiAbuseData } = require('../middlewares/antiAbuse.middleware'); // Add anti-abuse detection

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
    // Use our utility function to fix attempt numbers if needed
    const fixedCount = await attendanceUtils.fixAttemptNumbers(userId, examId);
    
    if (fixedCount > 0) {
      console.log(`Fixed ${fixedCount} attempt numbers for user ${userId}, exam ${examId}`);
    }
    
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
    const MAX_ATTEMPTS = 5; // Maximum allowed attempts

    console.log(`Request parameters - examId: ${examId}, userId: ${userId}, newAttempt: ${newAttempt}`);
    
    // Check if user has already passed this exam (score >= 60%)
    const passedAttempt = await ExamAttendance.findOne({
      examId,
      userId,
      status: { $in: ["COMPLETED", "TIMED_OUT"] }
    }).sort({ score: -1 }); // Get their best score
    
    if (passedAttempt && passedAttempt.totalQuestions > 0) {
      const percentage = (passedAttempt.score / passedAttempt.totalQuestions) * 100;
      
      // If they scored 60% or higher, don't allow retaking the exam
      if (percentage >= 60) {
        console.log(`User ${userId} has already passed exam ${examId} with ${percentage.toFixed(2)}%`);
        return res.status(403).json({
          message: "You have already passed this exam. No additional attempts are permitted.",
          score: passedAttempt.score,
          totalQuestions: passedAttempt.totalQuestions,
          percentage: percentage.toFixed(2),
          attemptNumber: passedAttempt.attemptNumber,
          passedAt: passedAttempt.endTime,
          status: "PASSED"
        });
      }
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
    
    // Check if the user has already passed this exam
    const highestScoreAttempt = await ExamAttendance.findOne({
      examId,
      userId,
      status: "COMPLETED"
    }).sort({ score: -1 });  // Get the highest score attempt

    if (highestScoreAttempt) {
      const percentage = (highestScoreAttempt.score / highestScoreAttempt.totalQuestions) * 100;
      if (percentage >= 60) {
        console.log(`User has already passed this exam with ${percentage.toFixed(2)}%`);
        return res.status(403).json({
          message: "You have already passed this exam. No additional attempts are permitted.",
          score: highestScoreAttempt.score,
          totalQuestions: highestScoreAttempt.totalQuestions,
          percentage: percentage.toFixed(2),
          attemptNumber: highestScoreAttempt.attemptNumber,
          startDate: new Date(highestScoreAttempt.startTime).toLocaleDateString(),
          passed: true
        });
      }
    }
    
    // Get count of completed attempts to enforce MAX_ATTEMPTS limit
    const completedAttemptsCount = await ExamAttendance.countDocuments({
      examId,
      userId,
      status: { $in: ["COMPLETED", "TIMED_OUT"] }
    });
    
    if (completedAttemptsCount >= MAX_ATTEMPTS) {
      console.log(`User ${userId} has reached the maximum number of attempts (${MAX_ATTEMPTS}) for exam ${examId}`);
      return res.status(403).json({
        message: `You have reached the maximum number of attempts (${MAX_ATTEMPTS}) for this exam.`,
        completedAttempts: completedAttemptsCount,
        maxAttempts: MAX_ATTEMPTS
      });
    }
    
    // Get real attempt count and fix inconsistencies
    const realAttemptCount = await getRealAttemptCount(examId, userId);
    
    // Check for existing in-progress attempts that need to be canceled when starting a new attempt
    if (newAttempt === 'true') {
      console.log(`Creating new attempt (attempt #${realAttemptCount + 1}) as requested`);
      
      try {
        // First, cancel any existing in-progress attempts
        const cancelResult = await ExamAttendance.updateMany(
          { examId, userId, status: "IN_PROGRESS" },
          { status: "TIMED_OUT", endTime: new Date() }
        );
        
        console.log(`Canceled ${cancelResult.modifiedCount} in-progress attempts`);
        
        // Calculate next attempt number based on real attempt count
        const nextAttemptNumber = realAttemptCount + 1;
        console.log(`Using attempt number: ${nextAttemptNumber}`);
        
        // Double check and delete any duplicate documents that might cause conflicts
        try {
          const existingAttempts = await ExamAttendance.find({
            examId, 
            userId, 
            attemptNumber: nextAttemptNumber
          });
          
          if (existingAttempts.length > 0) {
            console.log(`Found ${existingAttempts.length} conflicting attempts with number ${nextAttemptNumber}, removing them`);
            await ExamAttendance.deleteMany({
              examId, 
              userId, 
              attemptNumber: nextAttemptNumber
            });
          }
        } catch (cleanupError) {
          console.log("Cleanup failed but continuing:", cleanupError.message);
        }
        
        // Use the already calculated nextAttemptNumber or get it from utility if needed
        // We'll use the utility approach and override the previous value for consistency
        console.log(`Using utility function to confirm attempt number (previously calculated as ${nextAttemptNumber})`);
        const confirmedAttemptNumber = await attendanceUtils.getNextAttemptNumber(userId, examId);
        console.log(`Confirmed attempt number: ${confirmedAttemptNumber} from utility function`);
        
        // Create a new attempt with explicit attempt number
        attendance = new ExamAttendance({
          examId,
          userId,
          totalQuestions: exam.sections.mcqs.length,
          startTime: new Date(),
          status: "IN_PROGRESS",
          attemptNumber: confirmedAttemptNumber
        });
        
        await attendance.save();
        console.log(`New attendance record created with ID: ${attendance._id} and attempt #${confirmedAttemptNumber}`);
        
        // Process anti-abuse data and initialize session fingerprinting
        try {
          const riskAssessment = await processAntiAbuseData(req, examId, userId);
          if (riskAssessment) {
            console.log(`Anti-abuse assessment completed with risk score: ${riskAssessment.overallRiskScore}`);
            
            // Log high-risk sessions for monitoring
            if (riskAssessment.overallRiskScore > 60) {
              console.warn(`HIGH RISK SESSION: User ${userId}, Exam ${examId}, Risk: ${riskAssessment.overallRiskScore}%`);
            }
          }
        } catch (antiAbuseError) {
          console.error('Anti-abuse processing failed:', antiAbuseError);
          // Don't block exam start if anti-abuse fails
        }
        
        // Randomize questions and store in memory
        const randomizedQuestions = shuffleArray(exam.sections.mcqs);
        
        // Initialize user exam data in memory
        if (!userExamData[userId]) {
          userExamData[userId] = {};
        }
        
        userExamData[userId][examId] = {
          randomizedQuestions,
          userAnswers: {},
          attemptId: attendance._id,
          attemptNumber: confirmedAttemptNumber // Store attempt number in memory
        };
        
        // Also store in the database for persistence
        try {
          // Delete any existing temporary data for this attempt number first
          await TmpExamStudentData.deleteMany({ 
            userId, 
            examId, 
            attemptNumber: confirmedAttemptNumber 
          });
          
          // Create new temporary data for this attempt
          const tmpData = new TmpExamStudentData({
            userId,
            examId,
            attemptNumber: confirmedAttemptNumber,
            questionIds: randomizedQuestions.map(q => q._id),
            answers: []
          });
          
          await tmpData.save();
          console.log(`Created temporary data storage for attempt #${confirmedAttemptNumber}`);
        } catch (tmpError) {
          console.error("Error saving temporary data:", tmpError);
          // Continue anyway, as we have the data in memory
        }
      } catch (saveError) {
        console.error("Error creating new attempt:", saveError);
        
        if (saveError.code === 11000) {
          console.log("Duplicate key error detected - this usually means an index conflict");
          
          // Provide more user-friendly error message
          return res.status(409).json({
            message: "Could not create a new attempt due to a database conflict. Please wait a moment and try again.",
            error: "DuplicateKeyError",
            details: process.env.NODE_ENV === 'development' ? saveError.message : undefined
          });
        }
        
        // For any other error
        return res.status(500).json({
          message: "Failed to start a new exam session. Please try again.",
          error: "DatabaseError",
          details: process.env.NODE_ENV === 'development' ? saveError.message : undefined
        });
      }
    } else {
      console.log("Looking for existing in-progress attempt");
      // Find the latest active attempt
      attendance = await ExamAttendance.findOne({ 
        examId, 
        userId,
        status: "IN_PROGRESS" 
      }).sort({ createdAt: -1 });

      if (!attendance) {
        console.log("No in-progress attempt found, creating a first attempt");
        
        try {
          // Get the next attempt number using utility function
          const attemptNumber = await attendanceUtils.getNextAttemptNumber(userId, examId);
          console.log(`Creating first attempt with number: ${attemptNumber}`);
          
          // Create first attempt
          attendance = new ExamAttendance({
            examId,
            userId,
            totalQuestions: exam.sections.mcqs.length,
            startTime: new Date(),
            status: "IN_PROGRESS",
            attemptNumber: attemptNumber
          });
          
          await attendance.save();
          console.log(`New first attendance record created with ID: ${attendance._id}`);
          
          // Randomize questions and store in memory
          const randomizedQuestions = shuffleArray(exam.sections.mcqs);
          
          // Initialize user exam data in memory
          if (!userExamData[userId]) {
            userExamData[userId] = {};
          }
          
          userExamData[userId][examId] = {
            randomizedQuestions,
            userAnswers: {},
            attemptId: attendance._id,
            attemptNumber: 1 // Store attempt number in memory
          };
          
          // Also store in the database for persistence
          try {
            // Delete any existing temporary data for first attempt
            await TmpExamStudentData.deleteMany({ 
              userId, 
              examId, 
              attemptNumber: 1 
            });
            
            // Create new temporary data
            const tmpData = new TmpExamStudentData({
              userId,
              examId,
              attemptNumber: 1,
              questionIds: randomizedQuestions.map(q => q._id),
              answers: []
            });
            
            await tmpData.save();
            console.log("Created temporary data storage for first attempt");
          } catch (tmpError) {
            console.error("Error saving temporary data:", tmpError);
            // Continue anyway, as we have the data in memory
          }
          
          console.log("Questions randomized and stored in memory for first attempt");
        } catch (saveError) {
          console.error("Error saving first attendance record:", saveError);
          // Check if it's a duplicate key error
          if (saveError.code === 11000) {
            return res.status(409).json({
              message: "You already have an attempt for this exam in progress.",
              error: "DuplicateKeyError"
            });
          } else {
            return res.status(500).json({ 
              message: "Failed to create exam session. Please try again.",
              error: "DatabaseError", 
              details: process.env.NODE_ENV === 'development' ? saveError.message : undefined
            });
          }
        }
      } else {
        console.log(`Found existing in-progress attempt: ${attendance._id}`);
        
        const attemptNumber = attendance.attemptNumber || 1;
        
        if (!userExamData[userId] || !userExamData[userId][examId] || 
                  userExamData[userId][examId].attemptId.toString() !== attendance._id.toString()) {
          console.log("No in-memory data found for existing attempt, reinitializing");
          
          // Try to get existing temporary data from database first
          let tmpData = await TmpExamStudentData.findOne({ 
            userId, 
            examId,
            attemptNumber
          });
          
          let randomizedQuestions;
          
          if (tmpData && tmpData.questionIds && tmpData.questionIds.length > 0) {
            console.log("Found existing temporary data, using stored question order");
            // Get the full question objects based on IDs
            const questionIds = tmpData.questionIds.map(id => id.toString());
            randomizedQuestions = [];
            
            // Map IDs back to question objects
            exam.sections.mcqs.forEach(q => {
              const index = questionIds.indexOf(q._id.toString());
              if (index !== -1) {
                randomizedQuestions[index] = q;
              }
            });
            
            // Fill any gaps with questions
            if (randomizedQuestions.filter(q => q).length < exam.sections.mcqs.length) {
              randomizedQuestions = shuffleArray(exam.sections.mcqs);
            }
          } else {
            // Generate new random order
            console.log("No stored question order found, generating new one");
            randomizedQuestions = shuffleArray(exam.sections.mcqs);
            
            // Create temporary data in database
            try {
              tmpData = new TmpExamStudentData({
                userId,
                examId,
                attemptNumber,
                questionIds: randomizedQuestions.map(q => q._id),
                answers: []
              });
              
              await tmpData.save();
              console.log(`Created temporary data storage for attempt #${attemptNumber}`);
            } catch (tmpError) {
              console.error("Error creating temporary data:", tmpError);
            }
          }
          
          // Re-initialize user exam data
          if (!userExamData[userId]) {
            userExamData[userId] = {};
          }
          
          userExamData[userId][examId] = {
            randomizedQuestions,
            userAnswers: {},
            attemptId: attendance._id,
            attemptNumber: attemptNumber
          };
          
          // If we have stored answers, load them into memory
          if (tmpData && tmpData.answers && tmpData.answers.length > 0) {
            tmpData.questionIds.forEach((qId, index) => {
              if (tmpData.answers[index]) {
                userExamData[userId][examId].userAnswers[qId] = tmpData.answers[index];
              }
            });
            console.log(`Loaded ${Object.keys(userExamData[userId][examId].userAnswers).length} stored answers from database`);
          }
          
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
      error: "InternalServerError", 
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
    
    const attemptNumber = attendance.attemptNumber || 1;
    console.log(`Saving answer for attempt #${attemptNumber}`);

    // Anti-abuse: Comprehensive analysis and real-time monitoring
    try {
      const cheatDetection = require('../utils/cheatDetection');
      const { patternDetector } = require('../utils/serverPatternDetection');
      const { securityMonitor } = require('../utils/securityMonitor');
      
      // Extract timing and behavioral metadata from request
      const metaData = {
        timeTaken: req.body.timeTaken || 0,
        mouseData: req.body.mouseData || {},
        keyboardData: req.body.keyboardData || {},
        timestamp: Date.now()
      };

      // 1. Analyze request headers for proxy tool indicators
      const headerAnalysis = cheatDetection.analyzeRequestHeaders(req.headers);
      if (headerAnalysis.isSuspicious && headerAnalysis.anomalyScore > 0.7) {
        const violation = {
          evidenceType: 'PROXY_TOOL_DETECTED',
          confidence: headerAnalysis.anomalyScore,
          details: {
            source: 'header_analysis',
            anomalyScore: headerAnalysis.anomalyScore,
            anomalies: headerAnalysis.anomalies,
            timestamp: new Date(),
            endpoint: 'submitAnswer'
          }
        };
        
        await cheatDetection.reportServerDetectedCheating(userId, examId, violation.evidenceType, violation.details);
        await securityMonitor.monitorSession(userId, examId, violation);
      }

      // 2. Analyze request timing patterns
      const patternAnalysis = await cheatDetection.analyzeRequestPattern(userId, examId);
      if (patternAnalysis.isSuspicious && patternAnalysis.anomalyScore > 0.6) {
        const violation = {
          evidenceType: 'AUTOMATED_BEHAVIOR',
          confidence: patternAnalysis.anomalyScore,
          details: {
            source: 'pattern_analysis',
            anomalyScore: patternAnalysis.anomalyScore,
            anomalies: patternAnalysis.anomalies,
            stats: patternAnalysis.stats,
            timestamp: new Date(),
            endpoint: 'submitAnswer'
          }
        };
        
        await cheatDetection.reportServerDetectedCheating(userId, examId, violation.evidenceType, violation.details);
        await securityMonitor.monitorSession(userId, examId, violation);
      }

      // 3. Advanced behavioral pattern analysis
      const behaviorAnalysis = await patternDetector.analyzeAnswerPattern(
        userId, 
        examId, 
        questionId, 
        selectedAnswer, 
        metaData
      );
      
      if (behaviorAnalysis.isSuspicious) {
        const violation = {
          evidenceType: 'AUTOMATED_BEHAVIOR',
          confidence: behaviorAnalysis.riskScore / 100,
          details: {
            source: 'behavioral_analysis',
            riskScore: behaviorAnalysis.riskScore,
            patterns: behaviorAnalysis.patterns,
            suspiciousPatterns: behaviorAnalysis.suspiciousPatterns,
            timestamp: new Date(),
            endpoint: 'submitAnswer'
          }
        };
        
        await cheatDetection.reportServerDetectedCheating(userId, examId, violation.evidenceType, violation.details);
        await securityMonitor.monitorSession(userId, examId, violation);
      }

      // 4. Update request log for continuous monitoring
      if (attendance.requestLog) {
        attendance.requestLog.push({
          timestamp: Date.now(),
          method: req.method,
          path: req.path,
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          ip: req.ip || req.connection.remoteAddress,
          questionId: questionId,
          timeTaken: metaData.timeTaken
        });
        
        // Keep only last 100 requests to prevent memory bloat
        if (attendance.requestLog.length > 100) {
          attendance.requestLog = attendance.requestLog.slice(-100);
        }
      } else {
        attendance.requestLog = [{
          timestamp: Date.now(),
          method: req.method,
          path: req.path,
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          ip: req.ip || req.connection.remoteAddress,
          questionId: questionId,
          timeTaken: metaData.timeTaken
        }];
      }

      // 5. Update behavioral metrics in attendance record
      if (!attendance.behaviorProfile) {
        attendance.behaviorProfile = {
          averageResponseTime: 0,
          responseTimeVariance: 0,
          totalResponses: 0,
          suspiciousPatternCount: 0
        };
      }

      // Update response time statistics
      const profile = attendance.behaviorProfile;
      profile.totalResponses++;
      
      if (metaData.timeTaken > 0) {
        const newAverage = ((profile.averageResponseTime * (profile.totalResponses - 1)) + metaData.timeTaken) / profile.totalResponses;
        profile.averageResponseTime = newAverage;
      }

      if (behaviorAnalysis.isSuspicious) {
        profile.suspiciousPatternCount++;
      }

    } catch (antiAbuseError) {
      console.error('Anti-abuse processing failed in submitAnswer:', antiAbuseError);
      // Don't block legitimate users if anti-abuse system fails
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
        userAnswers: {},
        attemptId: attendance._id,
        attemptNumber: attemptNumber
      };
    }

    // Store answer in memory
    userExamData[userId][examId].userAnswers[questionId] = selectedAnswer;

    // Store answer in database for persistence
    try {
      // Get temporary data
      let tmpData = await TmpExamStudentData.findOne({
        userId,
        examId,
        attemptNumber
      });
      
      if (!tmpData) {
        // Create new temporary data if not exists
        const exam = await Exam.findById(examId).populate({
          path: 'sections.mcqs',
          select: '_id'
        });
        
        if (!exam) {
          return res.status(404).json({ message: "Exam not found" });
        }
        
        tmpData = new TmpExamStudentData({
          userId,
          examId,
          attemptNumber,
          questionIds: exam.sections.mcqs.map(q => q._id),
          answers: []
        });
      }
      
      // Find the index of the question in the questionIds array
      const questionIndex = tmpData.questionIds.findIndex(qid => 
        qid.toString() === questionId.toString()
      );
      
      if (questionIndex >= 0) {
        // Make sure the answers array is at least as long as needed
        while (tmpData.answers.length <= questionIndex) {
          tmpData.answers.push(null);
        }
        
        // Update the answer at the right position
        tmpData.answers[questionIndex] = selectedAnswer;
      } else {
        // If question not found in the sequence (which shouldn't happen), 
        // add it to the end
        tmpData.questionIds.push(questionId);
        tmpData.answers.push(selectedAnswer);
      }
      
      await tmpData.save();
      console.log(`Saved answer to database for question ${questionId}, attempt #${attemptNumber}`);
    } catch (tmpError) {
      console.error("Error saving answer to database:", tmpError);
      // Continue anyway as we have the answer in memory
    }

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
    const { examId } = req.params;
    const userId = req.user._id;
    
    console.log(`User ${userId} is completing exam ${examId}`);

    // Find the in-progress attendance record
    const attendance = await ExamAttendance.findOne({
      examId,
      userId,
      status: "IN_PROGRESS"
    });

    if (!attendance) {
      return res.status(404).json({ message: "No active exam found to complete" });
    }

    const attemptNumber = attendance.attemptNumber || 1;
    console.log(`Processing completion of attempt #${attemptNumber}`);

    // Get the exam with questions
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options correctAnswer _id'
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Get temporary data with question order and answers
    let tmpData = await TmpExamStudentData.findOne({
      userId,
      examId,
      attemptNumber
    });

    if (!tmpData || !tmpData.questionIds || tmpData.questionIds.length === 0) {
      console.log("No temporary data found, using memory data if available");
      // Fall back to memory data if available
      if (!userExamData[userId] || !userExamData[userId][examId]) {
        console.log("No memory data available either, cannot score exam");
        return res.status(400).json({ 
          message: "Cannot complete exam: no answer data found"
        });
      }
    }

    // Get user answers from temporary data or memory
    const userAnswersMap = {};
    
    // Check if we have answers in temporary data
    if (tmpData && tmpData.questionIds && tmpData.answers) {
      for (let i = 0; i < tmpData.questionIds.length; i++) {
        if (tmpData.answers[i]) {
          userAnswersMap[tmpData.questionIds[i].toString()] = tmpData.answers[i];
        }
      }
      console.log(`Found ${Object.keys(userAnswersMap).length} answers in temporary data`);
    }
    // If no answers in temporary data or not enough, try memory
    else if (userExamData[userId] && userExamData[userId][examId]) {
      Object.assign(userAnswersMap, userExamData[userId][examId].userAnswers);
      console.log(`Found ${Object.keys(userAnswersMap).length} answers in memory`);
    }

    // Create a map of questions for easy lookup
    const questionsMap = {};
    exam.sections.mcqs.forEach(question => {
      questionsMap[question._id.toString()] = question;
    });

    console.log("Processing answers and calculating score");
    
    // Process answers and calculate score
    const processedAnswers = [];
    let score = 0;
    let totalAnswered = 0;
    
    Object.entries(userAnswersMap).forEach(([questionId, selectedAnswer]) => {
      const question = questionsMap[questionId];
      
      if (question) {
        totalAnswered++;
        // Always use correctAnswer field from the question model (don't check correctOption)
        const correctValue = question.correctAnswer;
        
        // Add debug logs to see what's happening
        console.log(`Question ${questionId}:`);
        console.log(`- Selected answer: "${selectedAnswer}"`);
        console.log(`- Correct answer: "${correctValue}"`);
        
        // Do string comparison and trim to handle whitespace issues
        const isCorrect = String(correctValue).trim() === String(selectedAnswer).trim();
        console.log(`- Is correct: ${isCorrect}`);
        
        if (isCorrect) {
          score++;
          console.log(`- Score increased to ${score}`);
        }
        
        processedAnswers.push({
          questionId,
          selectedAnswer,
          isCorrect
        });
      }
    });
    
    // Calculate percentage for pass/fail determination
    const totalQuestions = exam.sections.mcqs.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    const passed = percentage >= 60;
    
    console.log(`Exam results: Score ${score}/${totalQuestions} (${percentage.toFixed(2)}%), ${passed ? 'PASSED' : 'FAILED'}`);

    // Update attendance record with results
    attendance.status = "COMPLETED";
    attendance.endTime = new Date();
    attendance.score = score;
    attendance.totalQuestions = totalQuestions;
    attendance.attemptedQuestions = totalAnswered;
    attendance.answers = processedAnswers;
    
    await attendance.save();
    console.log("Attendance record updated with results");

    // Generate certificate if passed
    let certificateInfo = null;
    let emailSent = false;
    
    if (passed) {
      try {
        console.log("User passed the exam, generating certificate");
        
        certificateInfo = await generateCertificate(userId, examId, attendance._id, score, totalQuestions);
        
        if (certificateInfo) {
          console.log(`Certificate generated with ID: ${certificateInfo.certificateId}`);
          
          // Try to send certificate email
          try {
            await sendCertificateEmail(
              req.user.email,
              req.user.firstName || req.user.username,
              exam.title,
              `${percentage.toFixed(2)}%`,
              certificateInfo.certificateId
            );
            emailSent = true;
            console.log("Certificate email sent successfully");
          } catch (emailError) {
            console.error("Error sending certificate email:", emailError);
            // Continue anyway, user can download certificate later
          }
        }
      } catch (certError) {
        console.error("Error generating certificate:", certError);
        // Continue anyway, we'll return the exam results
      }
    } else {
      console.log("User did not pass the exam, no certificate generated");
    }

    console.log("Preparing final response");
    
    // Make sure we explicitly send a response
    return res.status(200).json({
      // message: "Exam completed successfully",
      score: score,
      totalQuestions: attendance.totalQuestions,
      attemptedQuestions: attendance.attemptedQuestions,
      percentage: percentage.toFixed(2),
      result: passed ? "pass" : "failed",
      certificateGenerated: certificateInfo ? "yes" : "no",
      certificateId: certificateInfo?.certificateId || null,
      emailSent: emailSent
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

    // Find the most recent attendance record for this user and exam
    const attendance = await ExamAttendance.findOne({ 
      examId, 
      userId 
    }).sort({ startTime: -1 });
    
    if (!attendance) {
      return res.status(404).json({ message: "No exam session found" });
    }

    // Clean up any stale attendances for this user automatically
    await attendanceUtils.cleanupStaleAttendances();
    
    // Get detailed status using utility function
    const statusInfo = attendanceUtils.getDetailedStatus(attendance, userExamData);
    
    // Get total attempts information
    const completedAttempts = await ExamAttendance.countDocuments({
      examId,
      userId,
      status: { $in: ["COMPLETED", "TIMED_OUT"] }
    });
    
    const inProgressAttempts = await ExamAttendance.countDocuments({
      examId,
      userId,
      status: "IN_PROGRESS"
    });
    
    // Add attempts information to the response
    statusInfo.totalAttempts = completedAttempts + inProgressAttempts;
    statusInfo.completedAttempts = completedAttempts;
    statusInfo.remainingAttempts = Math.max(0, 5 - completedAttempts); // Using MAX_ATTEMPTS = 5
    
    // For debugging purposes, log the actual status from the database
    console.log(`Exam status for user ${userId}, exam ${examId}: ${statusInfo.status}, attempts: ${statusInfo.totalAttempts}`);

    res.status(200).json(statusInfo);

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
    const { attemptNumber } = req.query; // Get attempt number from query params
    const userId = req.user._id;
    
    // Find the specific attendance record based on attempt number if provided
    const query = { 
      examId, 
      userId,
      status: { $in: ["COMPLETED", "TIMED_OUT"] } // Only review completed or timed out exams
    };
    
    if (attemptNumber) {
      query.attemptNumber = parseInt(attemptNumber);
    }
    
    // Get user's attendance record - get the most recent one if attempt number not specified
    const attendance = await ExamAttendance.findOne(query)
      .sort({ attemptNumber: attemptNumber ? 1 : -1 }); // Sort by newest if attempt not specified
    
    if (!attendance) {
      return res.status(404).json({ message: "Exam attendance record not found or exam not completed" });
    }
    
    console.log(`Reviewing exam ${examId}, attempt #${attendance.attemptNumber}`);
    
    // Get temporary exam data with randomized questions for this specific attempt
    const tmpData = await TmpExamStudentData.findOne({ 
      userId, 
      examId,
      attemptNumber: attendance.attemptNumber
    });
    
    // Get exam with all questions
    const exam = await Exam.findById(examId).populate({
      path: 'sections.mcqs',
      select: 'questionText options correctAnswer explanation'
    });
    
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // If we have temporary data with question order and answers, use it
    if (tmpData && tmpData.questionIds && tmpData.questionIds.length > 0) {
      console.log(`Found temporary data for attempt #${attendance.attemptNumber} with ${tmpData.questionIds.length} questions`);
      
      // Map questions with user answers based on questionIds in tmpData
      const reviewData = [];
      
      for (let i = 0; i < tmpData.questionIds.length; i++) {
        const questionId = tmpData.questionIds[i];
        const userAnswer = tmpData.answers[i];
        
        // Find question details
        let questionDetails = null;
        exam.sections.mcqs.forEach(mcq => {
          if (mcq._id.toString() === questionId.toString()) {
            questionDetails = mcq;
          }
        });
        
        if (questionDetails) {
          reviewData.push({
            questionId: questionDetails._id,
            questionText: questionDetails.questionText,
            options: questionDetails.options,
            userAnswer: userAnswer,
            correctAnswer: questionDetails.correctAnswer,
            isCorrect: userAnswer === questionDetails.correctAnswer,
            explanation: questionDetails.explanation || "No explanation provided"
          });
        }
      }
      
      return res.status(200).json({
        examTitle: exam.title,
        attemptNumber: attendance.attemptNumber,
        totalQuestions: reviewData.length,
        correctAnswers: reviewData.filter(q => q.isCorrect).length,
        score: attendance.score,
        percentage: ((attendance.score / attendance.totalQuestions) * 100).toFixed(2),
        passed: ((attendance.score / attendance.totalQuestions) * 100) >= 60,
        reviewData: reviewData
      });
    } else {
      // If no temporary data found, use the attendance record answers
      console.log("No temporary data found, using attendance record answers");
      
      // Get questions from attendance answers
      const reviewData = [];
      
      // Create a map of all questions for quick lookup
      const questionsMap = {};
      exam.sections.mcqs.forEach(mcq => {
        questionsMap[mcq._id.toString()] = mcq;
      });
      
      // Map the answers from attendance record
      attendance.answers.forEach(answer => {
        const questionId = answer.questionId.toString();
        const questionDetails = questionsMap[questionId];
        
        if (questionDetails) {
          reviewData.push({
            questionId: questionDetails._id,
            questionText: questionDetails.questionText,
            options: questionDetails.options,
            userAnswer: answer.selectedAnswer,
            correctAnswer: questionDetails.correctAnswer,
            isCorrect: answer.isCorrect,
            explanation: questionDetails.explanation || "No explanation provided"
          });
        }
      });
      
      return res.status(200).json({
        examTitle: exam.title,
        attemptNumber: attendance.attemptNumber,
        totalQuestions: attendance.totalQuestions,
        correctAnswers: attendance.score,
        score: attendance.score,
        percentage: ((attendance.score / attendance.totalQuestions) * 100).toFixed(2),
        passed: ((attendance.score / attendance.totalQuestions) * 100) >= 60,
        reviewData: reviewData
      });
    }
  } catch (error) {
    console.error("Error in reviewExamQuestions:", error);
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
    const { statusFilter, search, sort = 'recent', showAll = 'false' } = req.query;
    const MAX_ATTEMPTS = 5; // Maximum allowed attempts (increased from 2 to 5)
    
    // Build the query based on filters
    const query = { userId };
    
    // Apply status filter if provided
    if (statusFilter) {
      if (['passed', 'failed'].includes(statusFilter)) {
        // Handle passed/failed status (requires post-filtering)
      } else if (['IN_PROGRESS', 'COMPLETED', 'TIMED_OUT'].includes(statusFilter)) {
        query.status = statusFilter;
      }
    }
    
    // Find all exam attendances for this user
    const examAttendances = await ExamAttendance.find(query)
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

    // Group exams by their ID to show multiple attempts together
    const examMap = {};
    
    examAttendances.forEach(attendance => {
      const examId = attendance.examId?._id?.toString() || 'unknown';
      
      if (!examId || examId === 'unknown' || !attendance.examId) {
        // Skip entries with missing exam data
        return;
      }
      
      // Filter by search term if provided
      if (search && attendance.examId.title && 
          !attendance.examId.title.toLowerCase().includes(search.toLowerCase())) {
        return; // Skip this exam if it doesn't match the search term
      }
      
      if (!examMap[examId]) {
        examMap[examId] = {
          examId: examId,
          examTitle: attendance.examId.title || 'Unknown Exam',
          examDescription: attendance.examId.description || '',
          examDuration: attendance.examId.duration || 0,
          bestScore: 0,
          bestPercentage: '0.00',
          bestAttemptNumber: 0,
          hasPassed: false,
          latestAttemptDate: attendance.startTime,
          attempts: [],
          completedAttempts: 0,
          shouldHide: false // Will be set to true for passed or maxed attempts
        };
      }
      
      // Calculate percentage
      const percentage = attendance.totalQuestions > 0 
        ? ((attendance.score / attendance.totalQuestions) * 100).toFixed(2) 
        : '0.00';
      
      // Determine if the user passed (60% is passing threshold)
      const passed = parseFloat(percentage) >= 60;
      
      // Count completed attempts
      if (attendance.status === 'COMPLETED' || attendance.status === 'TIMED_OUT') {
        examMap[examId].completedAttempts++;
      }
      
      // Update best score if this attempt is better
      if (passed && parseFloat(percentage) > parseFloat(examMap[examId].bestPercentage)) {
        examMap[examId].bestScore = attendance.score;
        examMap[examId].bestPercentage = percentage;
        examMap[examId].bestAttemptNumber = attendance.attemptNumber || 1;
        examMap[examId].hasPassed = true;
      }
      
      // Update latest attempt date
      if (new Date(attendance.startTime) > new Date(examMap[examId].latestAttemptDate)) {
        examMap[examId].latestAttemptDate = attendance.startTime;
      }
      
      // Format timestamp for better readability
      const startDate = new Date(attendance.startTime);
      const formattedStartTime = startDate.toLocaleDateString() + ' ' + 
                                startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      let formattedEndTime = 'N/A';
      if (attendance.endTime) {
        const endDate = new Date(attendance.endTime);
        formattedEndTime = endDate.toLocaleDateString() + ' ' + 
                          endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Calculate duration in minutes (if completed)
      let attemptDuration = 'N/A';
      if (attendance.endTime && attendance.status !== 'IN_PROGRESS') {
        const durationMs = new Date(attendance.endTime) - new Date(attendance.startTime);
        const durationMin = Math.round(durationMs / 60000);
        attemptDuration = `${durationMin} min`;
      }
      
      // Add this attempt to the exam's attempts array
      examMap[examId].attempts.push({
        attendanceId: attendance._id,
        attemptNumber: attendance.attemptNumber || 1,
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        formattedStartTime,
        formattedEndTime,
        attemptDuration,
        status: attendance.status,
        statusDisplay: getStatusDisplay(attendance.status),
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptedQuestions: attendance.attemptedQuestions,
        percentage: percentage,
        passed: passed,
        resultDisplay: passed ? 'PASSED' : (attendance.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'NOT PASSED')
      });
    });
    
    // Determine which exams should be hidden (passed or max attempts reached)
    // and mark them accordingly
    Object.values(examMap).forEach(exam => {
      if (exam.hasPassed || exam.completedAttempts >= MAX_ATTEMPTS) {
        exam.shouldHide = true;
      }
    });
    
    // Apply filters and hiding logic
    let filteredExams = Object.values(examMap);
    
    // Apply passed/failed filter
    if (statusFilter === 'passed') {
      filteredExams = filteredExams.filter(exam => exam.hasPassed);
    } else if (statusFilter === 'failed') {
      filteredExams = filteredExams.filter(exam => 
        exam.attempts.some(a => a.status === 'COMPLETED' || a.status === 'TIMED_OUT') && !exam.hasPassed
      );
    }
    
    // If not showing all exams, hide passed or max attempts reached
    if (showAll !== 'true') {
      filteredExams = filteredExams.filter(exam => !exam.shouldHide);
    }
    
    // Sort exams based on sort parameter
    if (sort === 'recent') {
      filteredExams.sort((a, b) => new Date(b.latestAttemptDate) - new Date(a.latestAttemptDate));
    } else if (sort === 'best') {
      filteredExams.sort((a, b) => parseFloat(b.bestPercentage) - parseFloat(a.bestPercentage));
    } else if (sort === 'title') {
      filteredExams.sort((a, b) => a.examTitle.localeCompare(b.examTitle));
    }
    
    // Sort attempts within each exam by most recent first
    filteredExams.forEach(exam => {
      exam.attempts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      
      // Add remaining attempts info
      exam.remainingAttempts = Math.max(0, MAX_ATTEMPTS - exam.completedAttempts);
      exam.canAttempt = !exam.hasPassed && exam.completedAttempts < MAX_ATTEMPTS;
    });
    
    // Prepare summary stats
    const totalExams = filteredExams.length;
    const totalAttempts = filteredExams.reduce((sum, exam) => sum + exam.attempts.length, 0);
    const completedAttempts = filteredExams.reduce((sum, exam) => 
      sum + exam.attempts.filter(a => a.status === 'COMPLETED' || a.status === 'TIMED_OUT').length, 0);
    const passedExams = filteredExams.filter(exam => exam.hasPassed).length;
    
    res.status(200).json({
      message: "Exam history retrieved successfully",
      summary: {
        totalExams,
        totalAttempts,
        completedAttempts,
        passedExams,
        passRate: totalExams > 0 ? `${((passedExams / totalExams) * 100).toFixed(1)}%` : '0%',
        hiddenExams: Object.values(examMap).filter(exam => exam.shouldHide).length,
        showAll: showAll === 'true',
        maxAttemptsAllowed: MAX_ATTEMPTS
      },
      exams: filteredExams.map(exam => ({
        ...exam,
        attemptsInfo: {
          total: exam.attempts.length,
          completed: exam.completedAttempts,
          inProgress: exam.attempts.filter(a => a.status === 'IN_PROGRESS').length,
          remaining: exam.remainingAttempts,
          canAttempt: exam.canAttempt,
          maxAttemptsReached: exam.completedAttempts >= MAX_ATTEMPTS,
          maxAttempts: MAX_ATTEMPTS
        }
      }))
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

// Get user's exam history with detailed information and statistics
const myExamHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, search, sort = 'recent', includeUnpublished = 'true', showAll = 'false' } = req.query;
    
    // Get user details to personalize the response
    const user = await User.findById(userId).select('username firstName lastName email');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find all exams the user has attended
    const examAttendances = await ExamAttendance.find({ userId })
      .populate({
        path: 'examId',
        select: 'title description duration status'
      })
      .sort({ startTime: -1 });
    
    // If the user is an admin and includeUnpublished is true, also fetch unpublished exams
    let unpublishedExams = [];
    if (req.user.role === 'admin' && includeUnpublished === 'true') {
      // Unpublished exams are those that were previously published (publishedAt is not null)
      // but have been reverted to APPROVED status
      unpublishedExams = await Exam.find({ 
        status: "APPROVED", 
        publishedAt: { $ne: null } 
      })
      .select('title description duration status publishedAt createdBy updatedAt')
      .populate("createdBy", "username firstName lastName")
      .sort({ updatedAt: -1 });
      
      // Apply search filter if provided
      if (search) {
        unpublishedExams = unpublishedExams.filter(exam => 
          exam.title.toLowerCase().includes(search.toLowerCase())
        );
      }
    }
    
    if (!examAttendances || examAttendances.length === 0) {
      // Even if the user hasn't taken exams, we might still show unpublished exams to admin
      if (unpublishedExams.length > 0) {
        return res.status(200).json({ 
          message: "You haven't taken any exams yet, but there are unpublished exams available",
          user: {
            username: user.username,
            name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username
          },
          summary: {
            totalExams: 0,
            totalAttempts: 0,
            completedExams: 0,
            passedExams: 0,
            passRate: "0%"
          },
          exams: [],
          unpublishedExams: formatUnpublishedExams(unpublishedExams)
        });
      }
      
      return res.status(200).json({ 
        message: "You haven't taken any exams yet",
        user: {
          username: user.username,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username
        },
        summary: {
          totalExams: 0,
          totalAttempts: 0,
          completedExams: 0,
          passedExams: 0,
          passRate: "0%"
        },
        exams: []
      });
    }

    // Group exams by their ID to organize multiple attempts
    const examMap = {};
    let totalCompletedAttempts = 0;
    let totalPassedAttempts = 0;
    
    examAttendances.forEach(attendance => {
      if (!attendance.examId) return; // Skip if exam was deleted
      
      const examId = attendance.examId._id.toString();
      
      // Apply search filter if provided
      if (search && !attendance.examId.title.toLowerCase().includes(search.toLowerCase())) {
        return;
      }
      
      // Apply status filter if provided
      if (status) {
        if (status === 'passed' && !(attendance.score / attendance.totalQuestions >= 0.6)) {
          return;
        } else if (status === 'failed' && (attendance.score / attendance.totalQuestions >= 0.6)) {
          return;
        } else if (status !== 'all' && attendance.status !== status) {
          return;
        }
      }
      
      // Count completed and passed attempts
      if (attendance.status === 'COMPLETED') {
        totalCompletedAttempts++;
        if (attendance.score / attendance.totalQuestions >= 0.6) {
          totalPassedAttempts++;
        }
      }
      
      if (!examMap[examId]) {
        examMap[examId] = {
          examId: examId,
          title: attendance.examId.title,
          description: attendance.examId.description || '',
          duration: attendance.examId.duration || 0,
          bestScore: 0,
          bestPercentage: 0,
          attempts: [],
          latestAttemptDate: attendance.startTime,
          hasPassed: false
        };
      }
      
      // Calculate percentage score
      const percentage = attendance.totalQuestions > 0 
        ? (attendance.score / attendance.totalQuestions) * 100 
        : 0;
      
      // Update best score if this attempt is better
      if (percentage > examMap[examId].bestPercentage) {
        examMap[examId].bestScore = attendance.score;
        examMap[examId].bestPercentage = percentage;
        examMap[examId].hasPassed = percentage >= 60;
      }
      
      // Update latest attempt date if this is more recent
      if (new Date(attendance.startTime) > new Date(examMap[examId].latestAttemptDate)) {
        examMap[examId].latestAttemptDate = attendance.startTime;
      }
      
      // Format dates for better readability
      const startDate = new Date(attendance.startTime);
      const formattedStartDate = startDate.toLocaleDateString('en-GB');
      const formattedStartTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      let formattedEndDate = 'N/A';
      let formattedEndTime = 'N/A';
      let attemptDuration = 'N/A';
      
      if (attendance.endTime) {
        const endDate = new Date(attendance.endTime);
        formattedEndDate = endDate.toLocaleDateString('en-GB');
        formattedEndTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Calculate duration in minutes
        const durationMinutes = Math.round((endDate - startDate) / 60000);
        attemptDuration = durationMinutes <= 60 
          ? `${durationMinutes} minutes` 
          : `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`;
      }
      
      // Add this attempt to the exam's attempts array
      examMap[examId].attempts.push({
        attendanceId: attendance._id,
        attemptNumber: attendance.attemptNumber || 1,
        startDate: formattedStartDate,
        startTime: formattedStartTime, 
        endDate: formattedEndDate,
        endTime: formattedEndTime,
        duration: attemptDuration,
        status: attendance.status,
        statusText: getStatusDisplay(attendance.status),
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptedQuestions: attendance.attemptedQuestions,
        percentage: percentage.toFixed(2),
        isPassed: percentage >= 60,
        result: percentage >= 60 ? 'PASSED' : 
          (attendance.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'NOT PASSED'),
        canContinue: attendance.status === 'IN_PROGRESS',
        canViewResults: attendance.status !== 'IN_PROGRESS'
      });
    });
    
    // Convert the map to an array of exams
    let exams = Object.values(examMap);
    
    // Apply sorting
    if (sort === 'recent') {
      exams.sort((a, b) => new Date(b.latestAttemptDate) - new Date(a.latestAttemptDate));
    } else if (sort === 'score') {
      exams.sort((a, b) => b.bestPercentage - a.bestPercentage);
    } else if (sort === 'title') {
      exams.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    // Sort attempts within each exam by most recent first
    exams.forEach(exam => {
      exam.attempts.sort((a, b) => b.attemptNumber - a.attemptNumber);
      exam.formattedBestScore = `${exam.bestScore}/${exam.attempts[0].totalQuestions} (${exam.bestPercentage.toFixed(2)}%)`;
    });
    
    // Build summary statistics
    const totalUniqueExams = exams.length;
    const totalAttempts = examAttendances.length;
    const passedExams = exams.filter(exam => exam.hasPassed).length;
    const passRate = totalUniqueExams > 0 
      ? ((passedExams / totalUniqueExams) * 100).toFixed(1) + '%'
      : '0%';
    
    // Prepare the response object
    const response = {
      message: "Exam history retrieved successfully",
      user: {
        username: user.username,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
        email: user.email
      },
      summary: {
        totalExams: totalUniqueExams,
        totalAttempts,
        completedExams: exams.filter(exam => 
          exam.attempts.some(a => a.status === 'COMPLETED' || a.status === 'TIMED_OUT')
        ).length,
        passedExams,
        passRate,
        averageScore: totalCompletedAttempts > 0 
          ? (totalPassedAttempts / totalCompletedAttempts * 100).toFixed(1) + '%'
          : '0%'
      },
      exams: exams,
      filters: {
        available: {
          status: ['all', 'IN_PROGRESS', 'COMPLETED', 'TIMED_OUT', 'passed', 'failed'],
          sort: ['recent', 'score', 'title']
        },
        applied: {
          status: status || 'all',
          sort: sort || 'recent',
          search: search || ''
        }
      }
    };
    
    // Add unpublished exams for admin users
    if (unpublishedExams.length > 0) {
      response.unpublishedExams = formatUnpublishedExams(unpublishedExams);
      response.summary.unpublishedExamsCount = unpublishedExams.length;
    }
    
    // Return formatted response
    res.status(200).json(response);
    
  } catch (error) {
    console.error("Error retrieving exam history:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Helper function to format unpublished exams for the response
const formatUnpublishedExams = (unpublishedExams) => {
  return unpublishedExams.map(exam => {
    // Calculate time since unpublished
    const lastUpdated = new Date(exam.updatedAt || exam.publishedAt);
    const now = new Date();
    const diffMs = now - lastUpdated;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const timeAgo = diffDays > 0 
      ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` 
      : `${Math.floor(diffMs / (1000 * 60 * 60))} hour${Math.floor(diffMs / (1000 * 60 * 60)) > 1 ? 's' : ''} ago`;
    
    return {
      _id: exam._id,
      title: exam.title,
      description: exam.description,
      duration: exam.duration,
      status: exam.status,
      publishedAt: exam.publishedAt,
      wasPublished: true,
      unpublishedAt: exam.updatedAt,
      timeAgo: timeAgo,
      createdBy: exam.createdBy ? {
        _id: exam.createdBy._id,
        username: exam.createdBy.username,
        name: `${exam.createdBy.firstName || ''} ${exam.createdBy.lastName || ''}`.trim() || exam.createdBy.username
      } : null
    };
  });
};

// Cancel an in-progress exam attempt
const cancelInProgressAttempt = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;
    
    console.log(`Attempting to cancel in-progress exam ${examId} for user ${userId}`);
    
    // Find the in-progress attendance record
    const inProgressAttempt = await ExamAttendance.findOne({
      examId,
      userId,
      status: "IN_PROGRESS"
    });
    
    if (!inProgressAttempt) {
      console.log(`No in-progress attempt found for exam ${examId}, user ${userId}`);
      return res.status(404).json({ 
        message: "No in-progress exam attempt found to cancel",
        success: false
      });
    }
    
    // Update the attempt status to TIMED_OUT
    inProgressAttempt.status = "TIMED_OUT";
    inProgressAttempt.endTime = new Date();
    await inProgressAttempt.save();
    
    // Also clear any temporary data
    try {
      await TmpExamStudentData.deleteMany({
        userId,
        examId,
        attemptNumber: inProgressAttempt.attemptNumber
      });
      console.log(`Temporary data cleared for attempt #${inProgressAttempt.attemptNumber}`);
    } catch (tmpError) {
      console.error("Error clearing temporary data:", tmpError);
      // Continue anyway as the main operation succeeded
    }
    
    // Clear memory data if exists
    if (userExamData[userId] && userExamData[userId][examId]) {
      delete userExamData[userId][examId];
      console.log("Cleared in-memory exam data");
    }
    
    console.log(`Successfully canceled in-progress attempt #${inProgressAttempt.attemptNumber} for exam ${examId}`);
    
    return res.status(200).json({
      message: "Exam attempt canceled successfully",
      success: true,
      attemptNumber: inProgressAttempt.attemptNumber
    });
    
  } catch (error) {
    console.error("Error canceling exam attempt:", error);
    return res.status(500).json({
      message: "Failed to cancel exam attempt",
      error: "InternalServerError",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      success: false
    });
  }
};

// Cancel all in-progress exam attempts for a user
const cancelAllAttempts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`Attempting to cancel all in-progress exams for user ${userId}`);
    
    // Find all in-progress attendance records for this user
    const inProgressAttempts = await ExamAttendance.find({
      userId,
      status: "IN_PROGRESS"
    });
    
    if (!inProgressAttempts || inProgressAttempts.length === 0) {
      console.log(`No in-progress attempts found for user ${userId}`);
      return res.status(200).json({ 
        message: "No in-progress exam attempts found to cancel",
        count: 0,
        success: true
      });
    }
    
    // Get exam IDs for logging purposes
    const examIds = inProgressAttempts.map(attempt => attempt.examId);
    console.log(`Found ${inProgressAttempts.length} in-progress attempts for exams: ${examIds.join(', ')}`);
    
    // Update all attempts to TIMED_OUT status
    const updateResult = await ExamAttendance.updateMany(
      { 
        userId, 
        status: "IN_PROGRESS" 
      },
      { 
        status: "TIMED_OUT", 
        endTime: new Date() 
      }
    );
    
    // Clean up temporary data for all canceled attempts
    const attemptNumbers = inProgressAttempts.map(attempt => attempt.attemptNumber);
    
    try {
      // Delete all temporary data for these attempts
      await TmpExamStudentData.deleteMany({
        userId,
        attemptNumber: { $in: attemptNumbers }
      });
      console.log(`Temporary data cleared for ${attemptNumbers.length} attempts`);
    } catch (tmpError) {
      console.error("Error clearing temporary data:", tmpError);
      // Continue anyway as the main operation succeeded
    }
    
    // Clear memory data for all exams
    if (userExamData[userId]) {
      for (const examId of examIds) {
        if (userExamData[userId][examId]) {
          delete userExamData[userId][examId];
        }
      }
      console.log("Cleared in-memory exam data");
    }
    
    console.log(`Successfully canceled ${updateResult.modifiedCount} in-progress attempts`);
    
    return res.status(200).json({
      message: `Successfully canceled ${updateResult.modifiedCount} in-progress exam attempts`,
      count: updateResult.modifiedCount,
      success: true
    });
    
  } catch (error) {
    console.error("Error canceling all exam attempts:", error);
    return res.status(500).json({
      message: "Failed to cancel exam attempts",
      error: "InternalServerError",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      success: false
    });
  }
};

// Get all users' exam history (admin only)
const adminGetAllUserHistory = async (req, res) => {
  try {
    // Query parameters for filtering and pagination
    const { 
      examId, userId, status, search, 
      page = 1, limit = 10, sort = 'recent',
      fromDate, toDate
    } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Build the initial query
    let query = {};
    
    // Apply filters if provided
    if (examId) {
      query.examId = mongoose.Types.ObjectId(examId);
    }
    
    if (userId) {
      query.userId = mongoose.Types.ObjectId(userId);
    }
    
    if (status && ['IN_PROGRESS', 'COMPLETED', 'TIMED_OUT'].includes(status)) {
      query.status = status;
    }
    
    // Date range filters
    if (fromDate || toDate) {
      query.startTime = {};
      
      if (fromDate) {
        query.startTime.$gte = new Date(fromDate);
      }
      
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        query.startTime.$lte = endDate;
      }
    }
    
    // Get total count for pagination
    const total = await ExamAttendance.countDocuments(query);
    
    // Create sorting configuration
    let sortConfig = {};
    if (sort === 'recent') {
      sortConfig = { startTime: -1 };
    } else if (sort === 'score') {
      sortConfig = { score: -1 };
    } else if (sort === 'username') {
      // We'll handle this after populating
    }
    
    // Find exam attendances with populated data
    let examAttendances = await ExamAttendance.find(query)
      .populate({
        path: 'examId',
        select: 'title description duration status'
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName email'
      })
      .sort(sortConfig)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    
    // Apply text search filter if provided (for populated fields)
    if (search) {
      const searchLower = search.toLowerCase();
      examAttendances = examAttendances.filter(attendance => {
        // Check if exam title matches
        const examTitle = attendance.examId?.title?.toLowerCase() || '';
        
        // Check if user details match
        const username = attendance.userId?.username?.toLowerCase() || '';
        const firstName = attendance.userId?.firstName?.toLowerCase() || '';
        const lastName = attendance.userId?.lastName?.toLowerCase() || '';
        const email = attendance.userId?.email?.toLowerCase() || '';
        
        return examTitle.includes(searchLower) ||
               username.includes(searchLower) ||
               firstName.includes(searchLower) ||
               lastName.includes(searchLower) ||
               email.includes(searchLower);
      });
    }
    
    // Sort by username if requested (after population)
    if (sort === 'username') {
      examAttendances.sort((a, b) => {
        const usernameA = a.userId?.username?.toLowerCase() || '';
        const usernameB = b.userId?.username?.toLowerCase() || '';
        return usernameA.localeCompare(usernameB);
      });
    }
    
    // Format the exam attendance records
    const formattedHistory = examAttendances.map(attendance => {
      // Calculate percentage
      const percentage = attendance.totalQuestions > 0 
        ? ((attendance.score / attendance.totalQuestions) * 100).toFixed(2) 
        : 0;
      
      // Determine if passed (60% threshold)
      const passed = parseFloat(percentage) >= 60;
      
      // Format user details
      const user = attendance.userId || { username: 'Unknown' };
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
      
      // Calculate duration
      let duration = null;
      if (attendance.endTime && attendance.startTime) {
        duration = Math.round((new Date(attendance.endTime) - new Date(attendance.startTime)) / 60000); // in minutes
      }
      
      return {
        attendanceId: attendance._id,
        examId: attendance.examId?._id,
        examTitle: attendance.examId?.title || 'Unknown Exam',
        examDescription: attendance.examId?.description || '',
        user: {
          userId: user._id,
          name: userName,
          username: user.username || 'Unknown',
          email: user.email || 'Unknown'
        },
        attemptNumber: attendance.attemptNumber || 1,
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        status: attendance.status,
        statusText: getStatusDisplay(attendance.status),
        duration: duration ? `${duration} min` : 'N/A',
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptedQuestions: attendance.attemptedQuestions,
        percentage: `${percentage}%`,
        result: passed ? 'PASSED' : 'FAILED',
        passed: passed
      };
    });
    
    // Get exam summary statistics
    const examSummary = {};
    examAttendances.forEach(attendance => {
      const examId = attendance.examId?._id?.toString();
      if (!examId) return;
      
      if (!examSummary[examId]) {
        examSummary[examId] = {
          examId,
          title: attendance.examId?.title || 'Unknown',
          attemptsCount: 0,
          passedCount: 0,
          failedCount: 0
        };
      }
      
      examSummary[examId].attemptsCount++;
      
      if (attendance.status === 'COMPLETED' || attendance.status === 'TIMED_OUT') {
        const percentage = attendance.totalQuestions > 0 
          ? (attendance.score / attendance.totalQuestions) * 100
          : 0;
        
        if (percentage >= 60) {
          examSummary[examId].passedCount++;
        } else {
          examSummary[examId].failedCount++;
        }
      }
    });
    
    // Prepare user summary statistics
    const userSummary = {};
    examAttendances.forEach(attendance => {
      const userId = attendance.userId?._id?.toString();
      if (!userId) return;
      
      if (!userSummary[userId]) {
        const user = attendance.userId;
        userSummary[userId] = {
          userId,
          username: user.username,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
          attemptsCount: 0,
          examsCount: new Set(),
          passedCount: 0,
          failedCount: 0
        };
      }
      
      userSummary[userId].attemptsCount++;
      userSummary[userId].examsCount.add(attendance.examId?._id?.toString());
      
      if (attendance.status === 'COMPLETED' || attendance.status === 'TIMED_OUT') {
        const percentage = attendance.totalQuestions > 0 
          ? (attendance.score / attendance.totalQuestions) * 100
          : 0;
        
        if (percentage >= 60) {
          userSummary[userId].passedCount++;
        } else {
          userSummary[userId].failedCount++;
        }
      }
    });
    
    // Convert Sets to counts in userSummary
    Object.values(userSummary).forEach(user => {
      user.examsCount = user.examsCount.size;
    });
    
    res.status(200).json({
      message: "All users' exam history retrieved successfully",
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      count: formattedHistory.length,
      history: formattedHistory,
      summary: {
        exams: Object.values(examSummary),
        users: Object.values(userSummary)
      },
      filters: {
        available: {
          status: ['all', 'IN_PROGRESS', 'COMPLETED', 'TIMED_OUT'],
          sort: ['recent', 'score', 'username']
        },
        applied: {
          status: status || 'all',
          sort: sort || 'recent',
          search: search || '',
          examId: examId || null,
          userId: userId || null,
          fromDate: fromDate || null,
          toDate: toDate || null
        }
      }
    });
    
  } catch (error) {
    console.error("Error retrieving all users' exam history:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Report cheating incident
const reportCheating = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;
    const { evidenceType, details = {}, source = "CLIENT" } = req.body;

    // Validate required fields
    if (!evidenceType) {
      return res.status(400).json({ 
        message: "Evidence type is required" 
      });
    }

    // First try to find an in-progress attendance record
    let attendance = await ExamAttendance.findOne({
      examId,
      userId,
      status: "IN_PROGRESS"
    });

    // If no active exam, try to find the most recent attendance record for this exam
    if (!attendance) {
      attendance = await ExamAttendance.findOne({
        examId,
        userId
      }).sort({ startTime: -1 }); // Get most recent attempt
    }

    // If still no attendance record found, create a basic record to store the evidence
    if (!attendance) {
      console.log(`Creating placeholder record for cheating report: User ${userId}, Exam ${examId}`);
      
      // Create a basic record to track the suspicious activity
      attendance = new ExamAttendance({
        examId,
        userId,
        status: "SUSPICIOUS_ACTIVITY",
        startTime: new Date(),
        flaggedForReview: true,
        cheatDetected: true,
        cheatEvidence: [] // Initialize an empty array
      });
    }

    // Initialize cheatEvidence array if it doesn't exist
    if (!attendance.cheatEvidence) {
      attendance.cheatEvidence = [];
    }

    // Add new evidence to the attendance record
    const newEvidence = {
      timestamp: new Date(),
      evidenceType,
      details,
      source
    };

    // Update the attendance record
    attendance.cheatEvidence.push(newEvidence);
    attendance.cheatDetected = true;
    attendance.flaggedForReview = true;
    
    await attendance.save();
    
    console.log(`Cheating incident reported for user ${userId}, exam ${examId}, type: ${evidenceType}`);

    res.status(200).json({
      message: "Cheating incident reported successfully",
      evidenceId: attendance.cheatEvidence[attendance.cheatEvidence.length - 1]._id
    });

  } catch (error) {
    console.error("Error in reportCheating:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message
    });
  }
};

// Get cheating reports for an exam (admin only)
const getCheatingReports = async (req, res) => {
  try {
    const { examId } = req.params;
    
    // Find all attendance records with cheating detected
    const attendances = await ExamAttendance.find({
      examId,
      cheatDetected: true
    }).populate('userId', 'username firstName lastName email');
    
    if (!attendances || attendances.length === 0) {
      return res.status(200).json({
        message: "No cheating incidents found for this exam",
        reports: []
      });
    }
    
    // Format the cheating reports
    const reports = attendances.map(attendance => {
      return {
        attendanceId: attendance._id,
        user: {
          userId: attendance.userId._id,
          username: attendance.userId.username,
          name: attendance.userId.firstName && attendance.userId.lastName ? 
                `${attendance.userId.firstName} ${attendance.userId.lastName}` : 
                attendance.userId.username,
          email: attendance.userId.email
        },
        attemptNumber: attendance.attemptNumber,
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        status: attendance.status,
        flaggedForReview: attendance.flaggedForReview,
        evidenceCount: attendance.cheatEvidence.length,
        evidence: attendance.cheatEvidence.map(e => ({
          id: e._id,
          timestamp: e.timestamp,
          evidenceType: e.evidenceType,
          details: e.details,
          source: e.source
        }))
      };
    });
    
    res.status(200).json({
      message: "Cheating reports retrieved successfully",
      count: reports.length,
      reports
    });
    
  } catch (error) {
    console.error("Error in getCheatingReports:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message
    });
  }
};

// Start monitoring for cheating detection
const startMonitoring = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user._id;
    
    // Find the in-progress attendance record
    const attendance = await ExamAttendance.findOne({
      examId,
      userId,
      status: "IN_PROGRESS"
    });

    if (!attendance) {
      return res.status(404).json({ 
        message: "No active exam found to monitor",
        success: false
      });
    }
    
    // Initialize monitoring data if not exists
    if (!attendance.riskAssessment) {
      attendance.riskAssessment = {
        overallRiskScore: 0,
        riskFactors: [],
        lastUpdated: new Date(),
        violationCount: 0,
        confidence: 0
      };
    }
    
    // Check if user has already been flagged for suspicious activity
    const isHighRisk = attendance.riskAssessment.overallRiskScore > 70;
    
    // Update the attendance record with monitoring enabled
    attendance.monitoringActive = true;
    attendance.monitoringStartTime = new Date();
    await attendance.save();
    
    // Return appropriate risk level
    const riskLevel = isHighRisk ? 'HIGH' : (attendance.riskAssessment.violationCount > 0 ? 'MEDIUM' : 'LOW');
    
    console.log(`Monitoring started for user ${userId}, exam ${examId}, risk level: ${riskLevel}`);
    
    res.status(200).json({
      message: "Monitoring started successfully",
      success: true,
      monitoringId: attendance._id,
      riskLevel,
      status: 'MONITORING_ACTIVE'
    });
    
  } catch (error) {
    console.error("Error in startMonitoring:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      success: false
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
  getUserExams,
  myExamHistory,
  cancelInProgressAttempt,
  cancelAllAttempts,
  adminGetAllUserHistory,
  reportCheating,
  getCheatingReports,
  startMonitoring
};