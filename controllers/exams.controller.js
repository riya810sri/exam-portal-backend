const Exam = require("../models/exam.model");
const ExamAttendance = require("../models/examAttendance.model");
const ExamHistory = require("../models/examHistory.model");
const attendanceUtils = require('../utils/attendanceUtils'); // Import attendance utilities

const createExam = async (req, res) => {
  try {
    const { title, description, duration, maxAttempts, passingScore } = req.body;

    // Create the exam
    const newExam = new Exam({
      title,
      description,
      duration,
      maxAttempts: maxAttempts || 3, // Default to 3 if not provided
      passingScore: passingScore || 60, // Default to 60% if not provided
      sections: {
        mcqs: [],
        shortAnswers: [],
      },
      createdBy: req.user._id, // Using the authenticated user's ID
      status: "PENDING", // All new exams are set to pending by default
    });

    await newExam.save();

    res.status(201).json({
      message: "Exam created successfully and is pending approval",
      exam: newExam,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const getAllExams = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const userId = req.user._id;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Build the query
    let filter = {};
    
    // If status is provided, filter by status
    if (status && ["PENDING", "APPROVED", "PUBLISHED"].includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    } else if (req.user.role !== "admin") {
      // Non-admin users can only see published exams
      filter.status = "PUBLISHED";
    }
    
    // Add search filter if provided
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Find all exams matching the filter (before pagination)
    // We need this to apply user-specific filtering afterward
    const allFilteredExams = await Exam.find(filter)
      .select('title description duration sections.mcqs createdBy status publishedAt maxAttempts passingScore')
      .sort({ publishedAt: -1 });
    
    // Get user's attempts for each exam to check status
    const examIds = allFilteredExams.map(exam => exam._id);
    const userAttempts = await ExamAttendance.find({
      userId,
      examId: { $in: examIds }
    }).select('examId status score totalQuestions attemptNumber');
    
    // Group attempts by exam ID
    const examAttemptsMap = {};
    userAttempts.forEach(attempt => {
      const examId = attempt.examId.toString();
      if (!examAttemptsMap[examId]) {
        examAttemptsMap[examId] = [];
      }
      examAttemptsMap[examId].push(attempt);
    });
    
    // Filter exams based on attempts - remove exams that user has passed or reached max attempts
    const availableExams = allFilteredExams.filter(exam => {
      const examId = exam._id.toString();
      const attempts = examAttemptsMap[examId] || [];
      const maxAttempts = exam.maxAttempts || 3; // Get max attempts from exam model or default
      const passingScore = exam.passingScore || 60; // Get passing score from exam model or default
      
      // If no attempts, keep the exam
      if (attempts.length === 0) return true;
      
      // Check for passed attempts (score >= passing score)
      let hasPassed = false;
      let attemptCount = 0;
      
      attempts.forEach(attempt => {
        if (attempt.status === "COMPLETED" || attempt.status === "TIMED_OUT") {
          attemptCount++;
          const percentage = (attempt.score / attempt.totalQuestions) * 100;
          if (percentage >= passingScore) {
            hasPassed = true;
          }
        }
      });
      
      // Remove exam if user has passed it or reached max attempts
      return !(hasPassed || attemptCount >= maxAttempts);
    });
    
    // Apply pagination after filtering
    const totalAvailable = availableExams.length;
    const paginatedExams = availableExams.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    
    // Add attempt information to exams
    const examsList = paginatedExams.map(exam => {
      const examId = exam._id.toString();
      const attempts = examAttemptsMap[examId] || [];
      const maxAttempts = exam.maxAttempts || 3; // Get max attempts from exam model or default
      const passingScore = exam.passingScore || 60; // Get passing score from exam model or default
      
      // Check for in-progress attempts and attempt count
      let inProgress = false;
      let attemptCount = 0;
      let bestScore = 0;
      let bestPercentage = 0;
      
      attempts.forEach(attempt => {
        // Use the attendance utility function to check status properly
        const statusInfo = attendanceUtils.getDetailedStatus(attempt);
        if (statusInfo.inProgress) {
          inProgress = true;
        }
        
        if (attempt.status === "COMPLETED" || attempt.status === "TIMED_OUT") {
          attemptCount++;
          const percentage = (attempt.score / attempt.totalQuestions) * 100;
          if (percentage > bestPercentage) {
            bestScore = attempt.score;
            bestPercentage = percentage;
          }
        }
      });
      
      // Calculate total questions (MCQs + Short Answers)
      const mcqCount = exam.sections?.mcqs?.length || 0;
      const shortAnswerCount = exam.sections?.shortAnswers?.length || 0;
      const totalQuestions = mcqCount + shortAnswerCount;
      
      return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        status: exam.status,
        totalQuestions: totalQuestions,
        questionCount: totalQuestions, // Keep for backward compatibility
        attempts: attempts.length,
        publishedAt: exam.publishedAt,
        maxAttempts: maxAttempts,
        passingScore: passingScore,
        // User's attempt status for this exam
        userStatus: {
          inProgress,
          bestScore,
          bestPercentage: bestPercentage.toFixed(1),
          attemptCount,
          canAttempt: attemptCount < maxAttempts,
          remainingAttempts: Math.max(0, maxAttempts - attemptCount)
        }
      };
    });
    
    res.status(200).json({
      message: "Exams retrieved successfully",
      page: pageNum,
      limit: limitNum,
      total: totalAvailable,
      totalPages: Math.ceil(totalAvailable / limitNum),
      exams: examsList
    });
    
  } catch (error) {
    console.error("Error getting exams:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getPendingExams = async (req, res) => {
  try {
    const pendingExams = await Exam.find({ status: "PENDING" })
      .populate("createdBy", "username firstName lastName")
      .select("title description duration createdBy createdAt");
      
    res.status(200).json(pendingExams);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const getExamById = async (req, res) => {
  try {
    console.log(`Getting exam with ID: ${req.params.id} for user role: ${req.user.role}`);
    
    const exam = await Exam.findById(req.params.id)
      .populate("sections.mcqs sections.shortAnswers")
      .populate("createdBy", "username firstName lastName")
      .populate("approvedBy", "username firstName lastName");

    if (!exam) {
      console.log(`Exam with ID ${req.params.id} not found`);
      return res.status(404).json({ message: "Exam not found" });
    }

    console.log(`Exam found. Status: ${exam.status}, User role: ${req.user.role}`);

    // Check access permissions based on user role and relationship to the exam
    const isAdmin = req.user.role === "admin";
    const isCreator = exam.createdBy && exam.createdBy._id.toString() === req.user._id.toString();
    const isPublished = exam.status === "PUBLISHED";
    
    // Grant access if:
    // 1. User is an admin
    // 2. User is the creator of the exam
    // 3. Exam is published and accessible to all users
    if (isAdmin || isCreator || isPublished) {
      return res.status(200).json(exam);
    }
    
    // For all other cases, deny access
    console.log(`Access denied for user ${req.user._id} to exam ${exam._id}`);
    return res.status(403).json({ 
      message: "Access denied. You don't have permission to view this exam." 
    });
  } catch (error) {
    console.error("Error in getExamById:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};

const deleteExam = async (req, res) => {
  try {
    const deletedExam = await Exam.findByIdAndDelete(req.params.id);

    if (!deletedExam)
      return res.status(404).json({ message: "Exam not found" });

    res.status(200).json({ message: "Exam deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const updateExam = async (req, res) => {
  try {
    console.log(`Updating exam ${req.params.id} by user ${req.user._id} with role ${req.user.role}`);
    const { title, description, duration, sections, maxAttempts, passingScore } = req.body;
    const examId = req.params.id;
    
    // Get the current exam
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      console.log(`Exam ${examId} not found`);
      return res.status(404).json({ message: "Exam not found" });
    }
    
    console.log(`Found exam with status: ${exam.status}`);
    
    // Check if the user is the creator of the exam or an admin
    const isAdmin = req.user.role === "admin";
    const isCreator = exam.createdBy && exam.createdBy.toString() === req.user._id.toString();
    
    if (!isAdmin && !isCreator) {
      console.log(`User ${req.user._id} is not authorized to update exam ${examId}`);
      return res.status(403).json({
        message: "You don't have permission to update this exam. Only creators and admins can update exams."
      });
    }
    
    // Check for attempts if it's a published exam
    let hasAttempts = false;
    let attemptCount = 0;
    
    if (exam.status === "PUBLISHED") {
      attemptCount = await ExamAttendance.countDocuments({ examId });
      hasAttempts = attemptCount > 0;
      console.log(`Exam has ${attemptCount} attempt(s)`);
    }
    
    // Prepare update data
    let updateData = { 
      title, 
      description, 
      duration
    };
    
    // Add maxAttempts and passingScore to update data if provided
    if (maxAttempts !== undefined) {
      updateData.maxAttempts = maxAttempts;
    }
    
    if (passingScore !== undefined) {
      updateData.passingScore = passingScore;
    }
    
    // Handle sections update based on exam status and attempts
    if (hasAttempts) {
      // For exams with attempts, we need to be careful with question modifications
      console.log("Exam has attempts - applying restricted update rules");
      
      // Allow adding new questions but don't modify existing ones
      if (sections && sections.mcqs) {
        // Get existing questions from the database
        const existingMcqs = (exam.sections?.mcqs || []).map(q => q.toString());
        
        // Split provided questions into existing and new
        const providedMcqs = sections.mcqs.filter(q => q._id); // Questions with IDs
        const newMcqs = sections.mcqs.filter(q => !q._id); // Questions without IDs (new ones)
        
        // Verify no existing questions were modified or removed
        const modifiedExistingQuestions = providedMcqs.some(q => !existingMcqs.includes(q._id.toString()));
        
        if (modifiedExistingQuestions) {
          return res.status(403).json({
            message: "Cannot modify or remove existing questions for an exam with attempts. You can only add new questions.",
            attempts: attemptCount
          });
        }
        
        // Only allow adding new questions
        if (newMcqs.length > 0) {
          console.log(`Adding ${newMcqs.length} new questions to exam with attempts`);
          updateData.sections = {
            mcqs: [...existingMcqs, ...newMcqs],
            shortAnswers: exam.sections?.shortAnswers || []
          };
        }
      }
    } else {
      // No attempts, allow full section update
      updateData.sections = sections;
    }
    
    // Admin case - admins can update any exam
    if (isAdmin) {
      console.log("Admin user - full update rights granted");
      
      // Find and update the exam
      const updatedExam = await Exam.findByIdAndUpdate(
        examId,
        updateData,
        { new: true }
      ).populate("sections.mcqs sections.shortAnswers");
      
      console.log(`Admin successfully updated exam ${examId}`);
      return res.json({ 
        message: hasAttempts 
          ? "Exam updated successfully by admin (restricted mode due to existing attempts)" 
          : "Exam updated successfully by admin", 
        exam: updatedExam,
        status: updatedExam.status,
        hasAttempts,
        attemptCount
      });
    }
    
    // Non-admin case - additional restrictions based on status
    if (exam.status === "PUBLISHED" && !isAdmin) {
      console.log("Non-admin updating published exam");
      
      // For published exams, non-admins can only update certain fields
      delete updateData.sections; // Non-admins cannot modify sections of published exams
      
      const updatedExam = await Exam.findByIdAndUpdate(
        examId,
        updateData,
        { new: true }
      ).populate("sections.mcqs sections.shortAnswers");
      
      console.log(`Non-admin successfully updated published exam ${examId} (restricted to metadata only)`);
      return res.json({
        message: "Exam metadata updated successfully. Note: Question modifications for published exams require admin privileges.",
        exam: updatedExam,
        status: updatedExam.status,
        hasAttempts,
        attemptCount
      });
    } else if (exam.status !== "PENDING" && !isAdmin) {
      // For approved but not published exams
      console.log(`Non-admin updating exam with status ${exam.status}`);
      
      const updatedExam = await Exam.findByIdAndUpdate(
        examId,
        updateData,
        { new: true }
      ).populate("sections.mcqs sections.shortAnswers");
      
      console.log(`Non-admin successfully updated ${exam.status} exam ${examId}`);
      return res.json({
        message: `Exam updated successfully (${exam.status} status)`,
        exam: updatedExam,
        status: updatedExam.status
      });
    }
    
    // Non-admin users updating a pending exam (original behavior preserved)
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      updateData,
      { new: true }
    ).populate("sections.mcqs sections.shortAnswers");
    
    console.log(`Non-admin successfully updated pending exam ${examId}`);
    res.json({ 
      message: "Exam updated successfully", 
      exam: updatedExam,
      status: updatedExam.status 
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const approveExam = async (req, res) => {
  try {
    const examId = req.params.id;
    
    // Find the exam
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // Update exam status to APPROVED
    exam.status = "APPROVED";
    exam.approvedBy = req.user._id;
    exam.approvedAt = new Date();
    
    await exam.save();
    
    res.status(200).json({
      message: "Exam approved successfully",
      exam: {
        _id: exam._id,
        title: exam.title,
        status: exam.status,
        approvedAt: exam.approvedAt
      }
    });
    
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const publishExam = async (req, res) => {
  try {
    const examId = req.params.id;
    
    // Find the exam
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // Can only publish approved exams
    if (exam.status !== "APPROVED") {
      return res.status(400).json({ 
        message: "Cannot publish exam. Exam must be approved first." 
      });
    }
    
    // Update exam status to PUBLISHED
    exam.status = "PUBLISHED";
    exam.publishedAt = new Date();
    
    await exam.save();
    
    res.status(200).json({
      message: "Exam published successfully",
      exam: {
        _id: exam._id,
        title: exam.title,
        status: exam.status,
        publishedAt: exam.publishedAt
      }
    });
    
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const unpublishExam = async (req, res) => {
  try {
    const examId = req.params.id;
    
    // Find the exam
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // Can only unpublish exams that are currently published
    if (exam.status !== "PUBLISHED") {
      return res.status(400).json({ 
        message: "Cannot unpublish exam. Only published exams can be unpublished." 
      });
    }
    
    // Check for existing attempts (for logging purposes only)
    const attemptCount = await ExamAttendance.countDocuments({ examId });
    
    // Note: Previously, exams with attempts couldn't be unpublished
    // Now allowing unpublishing even if there are attempts for administrative flexibility
    
    // Update exam status back to APPROVED
    exam.status = "APPROVED";
    exam.publishedAt = null; // Clear the published date
    
    await exam.save();
    
    res.status(200).json({
      message: "Exam unpublished successfully",
      exam: {
        _id: exam._id,
        title: exam.title,
        status: exam.status
      },
      ...(attemptCount > 0 && { 
        note: `This exam had ${attemptCount} attempt(s) before being unpublished.`,
        attempts: attemptCount 
      })
    });
    
  } catch (error) {
    console.error("Error unpublishing exam:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getApprovedExams = async (req, res) => {
  try {
    const approvedExams = await Exam.find({ status: "APPROVED" })
      .populate("createdBy", "username firstName lastName")
      .populate("approvedBy", "username firstName lastName")
      .select("title description duration createdBy approvedBy approvedAt createdAt");
      
    res.status(200).json(approvedExams);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const getUnpublishedExams = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Build query to find approved exams that have a non-null publishedAt field
    // This indicates they were published before and then unpublished
    let query = { 
      status: "APPROVED",
      publishedAt: { $ne: null }  // Has been published before
    };
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await Exam.countDocuments(query);
    
    // Determine sort order
    const sortOptions = {};
    sortOptions[sortBy || 'updatedAt'] = sortOrder === 'asc' ? 1 : -1;
    
    // Find unpublished exams with pagination and sorting
    const unpublishedExams = await Exam.find(query)
      .populate("createdBy", "username firstName lastName")
      .populate("approvedBy", "username firstName lastName")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort(sortOptions);
    
    // Format response data with additional metadata
    const formattedExams = await Promise.all(unpublishedExams.map(async (exam) => {
      // Calculate total questions (MCQs + Short Answers)
      const questionCount = exam.sections.mcqs.length + exam.sections.shortAnswers.length;
      
      // Check if there are any attempts
      const attemptCount = await ExamAttendance.countDocuments({ examId: exam._id });
      
      return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        status: exam.status,
        questionCount,
        createdBy: exam.createdBy ? {
          _id: exam.createdBy._id,
          username: exam.createdBy.username,
          name: `${exam.createdBy.firstName || ''} ${exam.createdBy.lastName || ''}`.trim() || exam.createdBy.username
        } : null,
        approvedBy: exam.approvedBy ? {
          _id: exam.approvedBy._id,
          username: exam.approvedBy.username,
          name: `${exam.approvedBy.firstName || ''} ${exam.approvedBy.lastName || ''}`.trim() || exam.approvedBy.username
        } : null,
        createdAt: exam.createdAt,
        approvedAt: exam.approvedAt,
        publishedAt: exam.publishedAt,  // This will be non-null for unpublished exams
        wasPublished: true,  // Flag indicating this exam was published before
        hasAttempts: attemptCount > 0,
        attemptCount
      };
    }));
    
    res.status(200).json({
      message: "Unpublished exams retrieved successfully",
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      exams: formattedExams
    });
    
  } catch (error) {
    console.error("Error getting unpublished exams:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const attendExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { page = 1, limit = 1 } = req.query;
    const userId = req.user._id; // Assuming user info is added by auth middleware

    // Find the exam and populate MCQ questions
    const exam = await Exam.findById(examId)
      .populate({
        path: 'sections.mcqs',
        select: 'questionText options'
      });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // Only allow attending published exams
    if (exam.status !== "PUBLISHED") {
      return res.status(403).json({ 
        message: "This exam is not available for attendance yet." 
      });
    }

    // Check if user has already started the exam
    let attendance = await ExamAttendance.findOne({ 
      examId, 
      userId,
      status: "IN_PROGRESS"
    });

    if (!attendance) {
      // Create new attendance record with proper attempt number
      const mcqCount = exam.sections?.mcqs?.length || 0;
      const shortAnswerCount = exam.sections?.shortAnswers?.length || 0;
      const nextAttemptNumber = await attendanceUtils.getNextAttemptNumber(userId, examId);
      
      console.log(`Creating new attendance with attempt number: ${nextAttemptNumber}`);
      
      attendance = new ExamAttendance({
        examId,
        userId,
        totalQuestions: mcqCount + shortAnswerCount,
        startTime: new Date(),
        status: "IN_PROGRESS",
        attemptNumber: nextAttemptNumber
      });
      await attendance.save();
    }

    // Get total number of MCQ questions
    const totalQuestions = exam.sections?.mcqs?.length || 0;
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Get questions for current page
    const currentPageQuestions = exam.sections.mcqs.slice(startIndex, endIndex);

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
      return res.status(400).json({ 
        message: "Exam time is up!",
        status: "TIMED_OUT"
      });
    }

    res.status(200).json({
      examTitle: exam.title,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalQuestions / limit),
      totalQuestions,
      question: currentPageQuestions[0],
      timeRemaining: Math.round(timeRemaining),
      attendanceId: attendance._id,
      currentQuestionIndex: attendance.currentQuestionIndex
    });

  } catch (error) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

// Identify and archive completed exams
const archiveCompletedExams = async (req, res) => {
  try {
    console.log("Starting exam archiving process");
    const MAX_ATTEMPTS = 5; // Maximum allowed attempts per exam (increased from 2 to 5)
    const archivedBy = req.user._id;
    let archivedCount = 0;
    let errorCount = 0;
    
    // Find all published exams
    const publishedExams = await Exam.find({ status: "PUBLISHED" });
    
    if (!publishedExams || publishedExams.length === 0) {
      return res.status(200).json({ 
        message: "No published exams found to archive",
        examsArchived: 0
      });
    }
    
    console.log(`Found ${publishedExams.length} published exams to check for archiving`);
    
    // For each exam, check if all allowed attempts are completed
    for (const exam of publishedExams) {
      try {
        const examId = exam._id;
        
        // Get all attendance records for this exam
        const attendanceRecords = await ExamAttendance.find({ examId });
        
        if (!attendanceRecords || attendanceRecords.length === 0) {
          // No attempts yet, skip this exam
          continue;
        }
        
        // Group attendance records by user
        const userAttemptsMap = {};
        attendanceRecords.forEach(record => {
          const userId = record.userId.toString();
          if (!userAttemptsMap[userId]) {
            userAttemptsMap[userId] = [];
          }
          userAttemptsMap[userId].push(record);
        });
        
        // Check if all users have completed their attempts
        let allAttemptsCompleted = true;
        let totalCompletedAttempts = 0;
        let totalPassedAttempts = 0;
        
        Object.values(userAttemptsMap).forEach(attempts => {
          // Count completed/timed out attempts
          const completedAttempts = attempts.filter(a => 
            a.status === "COMPLETED" || a.status === "TIMED_OUT"
          );
          
          // Count attempts where user passed (score >= 60%)
          const passedAttempts = completedAttempts.filter(a => {
            const percentage = (a.score / a.totalQuestions) * 100;
            return percentage >= 60;
          });
          
          totalCompletedAttempts += completedAttempts.length;
          totalPassedAttempts += passedAttempts.length;
          
          // If a user has at least one pass OR has reached max attempts, they're done
          const userIsDone = passedAttempts.length > 0 || completedAttempts.length >= MAX_ATTEMPTS;
          
          // If any user still has attempts available, don't archive
          if (!userIsDone) {
            allAttemptsCompleted = false;
          }
        });
        
        // Skip exams that don't have all attempts completed
        if (!allAttemptsCompleted) {
          continue;
        }
        
        // Calculate pass rate
        const totalUsers = Object.keys(userAttemptsMap).length;
        const passedUsers = Object.values(userAttemptsMap).filter(attempts => {
          return attempts.some(a => {
            if (a.status !== "COMPLETED" && a.status !== "TIMED_OUT") return false;
            const percentage = (a.score / a.totalQuestions) * 100;
            return percentage >= 60;
          });
        }).length;
        
        const passRate = totalUsers > 0 ? (passedUsers / totalUsers) * 100 : 0;
        
        console.log(`Exam "${exam.title}" (${examId}) has all attempts completed. Archiving...`);
        
        // Create a history record
        const examHistory = new ExamHistory({
          originalExamId: examId,
          title: exam.title,
          description: exam.description,
          duration: exam.duration,
          sections: exam.sections,
          createdBy: exam.createdBy,
          createdAt: exam.createdAt,
          approvedBy: exam.approvedBy,
          approvedAt: exam.approvedAt,
          publishedAt: exam.publishedAt,
          archivedAt: new Date(),
          archivedBy: archivedBy,
          totalAttempts: totalCompletedAttempts,
          totalPassedAttempts: totalPassedAttempts,
          passRate: passRate.toFixed(2)
        });
        
        await examHistory.save();
        
        // Delete the original exam
        await Exam.findByIdAndDelete(examId);
        
        archivedCount++;
        console.log(`Successfully archived exam "${exam.title}" (${examId})`);
      } catch (examError) {
        console.error(`Error processing exam ${exam._id}:`, examError);
        errorCount++;
      }
    }
    
    if (archivedCount > 0) {
      return res.status(200).json({
        message: `Successfully archived ${archivedCount} completed exams`,
        examsArchived: archivedCount,
        errors: errorCount
      });
    } else {
      return res.status(200).json({
        message: "No exams were eligible for archiving at this time",
        examsArchived: 0,
        errors: errorCount
      });
    }
    
  } catch (error) {
    console.error("Error archiving completed exams:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get archived exam history with filters and pagination
const getArchivedExams = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'archivedAt', sortOrder = 'desc' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Build query with search filter if provided
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await ExamHistory.countDocuments(query);
    
    // Determine sort order
    const sortOptions = {};
    sortOptions[sortBy || 'archivedAt'] = sortOrder === 'asc' ? 1 : -1;
    
    // Find archived exams with pagination and sorting
    const archivedExams = await ExamHistory.find(query)
      .populate("createdBy", "username firstName lastName")
      .populate("approvedBy", "username firstName lastName")
      .populate("archivedBy", "username firstName lastName")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort(sortOptions);
    
    // Format response data
    const formattedExams = archivedExams.map(exam => {
      return {
        _id: exam._id,
        originalExamId: exam.originalExamId,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        totalAttempts: exam.totalAttempts,
        totalPassedAttempts: exam.totalPassedAttempts,
        passRate: `${exam.passRate}%`,
        questionCount: exam.sections.mcqs.length,
        createdBy: exam.createdBy ? {
          _id: exam.createdBy._id,
          username: exam.createdBy.username,
          name: `${exam.createdBy.firstName || ''} ${exam.createdBy.lastName || ''}`.trim() || exam.createdBy.username
        } : null,
        approvedBy: exam.approvedBy ? {
          _id: exam.approvedBy._id,
          username: exam.approvedBy.username,
          name: `${exam.approvedBy.firstName || ''} ${exam.approvedBy.lastName || ''}`.trim() || exam.approvedBy.username
        } : null,
        archivedBy: exam.archivedBy ? {
          _id: exam.archivedBy._id,
          username: exam.archivedBy.username,
          name: `${exam.archivedBy.firstName || ''} ${exam.archivedBy.lastName || ''}`.trim() || exam.archivedBy.username
        } : null,
        createdAt: exam.createdAt,
        publishedAt: exam.publishedAt,
        archivedAt: exam.archivedAt
      };
    });
    
    res.status(200).json({
      message: "Archived exams retrieved successfully",
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      exams: formattedExams
    });
    
  } catch (error) {
    console.error("Error getting archived exams:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get details of a specific archived exam
const getArchivedExamById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const archivedExam = await ExamHistory.findById(id)
      .populate("createdBy", "username firstName lastName")
      .populate("approvedBy", "username firstName lastName")
      .populate("archivedBy", "username firstName lastName")
      .populate("sections.mcqs sections.shortAnswers");
    
    if (!archivedExam) {
      return res.status(404).json({ message: "Archived exam not found" });
    }
    
    res.status(200).json(archivedExam);
    
  } catch (error) {
    console.error("Error getting archived exam:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

module.exports = {
  createExam,
  getAllExams,
  getPendingExams,
  getExamById,
  deleteExam,
  updateExam,
  approveExam,
  publishExam,
  unpublishExam,
  getApprovedExams,
  getUnpublishedExams,
  attendExam,
  archiveCompletedExams,
  getArchivedExams,
  getArchivedExamById,
};
