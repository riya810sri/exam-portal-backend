const Exam = require("../models/exam.model");
const ExamAttendance = require("../models/examAttendance.model");

const createExam = async (req, res) => {
  try {
    const { title, description, duration } = req.body;

    // Create the exam
    const newExam = new Exam({
      title,
      description,
      duration,
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
    const MAX_ATTEMPTS = 2; // Maximum allowed attempts per exam
    
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
      .select('title description duration sections.mcqs createdBy status publishedAt')
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
      
      // If no attempts, keep the exam
      if (attempts.length === 0) return true;
      
      // Check for passed attempts (score >= 60%)
      let hasPassed = false;
      let attemptCount = 0;
      
      attempts.forEach(attempt => {
        if (attempt.status === "COMPLETED" || attempt.status === "TIMED_OUT") {
          attemptCount++;
          const percentage = (attempt.score / attempt.totalQuestions) * 100;
          if (percentage >= 60) {
            hasPassed = true;
          }
        }
      });
      
      // Remove exam if user has passed it or reached max attempts
      return !(hasPassed || attemptCount >= MAX_ATTEMPTS);
    });
    
    // Apply pagination after filtering
    const totalAvailable = availableExams.length;
    const paginatedExams = availableExams.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    
    // Add attempt information to exams
    const examsList = paginatedExams.map(exam => {
      const examId = exam._id.toString();
      const attempts = examAttemptsMap[examId] || [];
      
      // Check for in-progress attempts and attempt count
      let inProgress = false;
      let attemptCount = 0;
      let bestScore = 0;
      let bestPercentage = 0;
      
      attempts.forEach(attempt => {
        if (attempt.status === "IN_PROGRESS") {
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
      
      return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        status: exam.status,
        questionCount: exam.sections.mcqs.length,
        attempts: attempts.length,
        publishedAt: exam.publishedAt,
        // User's attempt status for this exam
        userStatus: {
          inProgress,
          bestScore,
          bestPercentage: bestPercentage.toFixed(1),
          attemptCount,
          canAttempt: attemptCount < MAX_ATTEMPTS,
          remainingAttempts: Math.max(0, MAX_ATTEMPTS - attemptCount)
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

    // If user is not an admin and the exam is not published, deny access
    if (req.user.role !== "admin" && exam.status !== "PUBLISHED") {
      console.log(`Access denied for non-admin user to ${exam.status} exam`);
      return res.status(403).json({ message: "Access denied. Exam is not published yet." });
    }

    // For admin users or published exams, allow access
    res.status(200).json(exam);
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
    const { title, description, duration, sections } = req.body;
    const examId = req.params.id;
    
    // Get the current exam
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      console.log(`Exam ${examId} not found`);
      return res.status(404).json({ message: "Exam not found" });
    }
    
    console.log(`Found exam with status: ${exam.status}`);
    
    // Check for attempts if it's a published exam
    if (exam.status === "PUBLISHED") {
      const attemptCount = await ExamAttendance.countDocuments({ examId });
      console.log(`Exam has ${attemptCount} attempt(s)`);
      
      // If there are attempts, we don't allow certain changes
      if (attemptCount > 0) {
        console.log(`Cannot modify exam with ${attemptCount} attempts`);
        return res.status(403).json({
          message: "Cannot update exam with existing attempts. Please create a new version instead.",
          attempts: attemptCount
        });
      }
    }
    
    // Admin case - admins can update any exam with proper status handling
    if (req.user.role === "admin") {
      console.log("Admin user - full update rights granted");
      let updateData = { title, description, duration, sections };
      
      // Find and update the exam
      const updatedExam = await Exam.findByIdAndUpdate(
        examId,
        updateData,
        { new: true }
      ).populate("sections.mcqs sections.shortAnswers");
      
      console.log(`Admin successfully updated exam ${examId}`);
      return res.json({ 
        message: "Exam updated successfully by admin", 
        exam: updatedExam,
        status: updatedExam.status 
      });
    }
    
    // Non-admin case - restrict updates based on status
    if (exam.status !== "PENDING") {
      console.log(`Non-admin cannot update exam with status ${exam.status}`);
      return res.status(403).json({
        message: "Cannot update exam. Only pending exams can be updated by non-admin users."
      });
    }
    
    // Non-admin users updating a pending exam
    let updateData = { title, description, duration, sections };
    
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
    
    // Check for existing attempts
    const attemptCount = await ExamAttendance.countDocuments({ examId });
    
    if (attemptCount > 0) {
      return res.status(400).json({ 
        message: "Cannot unpublish exam that has already been attempted by users.",
        attempts: attemptCount
      });
    }
    
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
      }
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
      // Get question count
      const questionCount = exam.sections.mcqs.length;
      
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
    }

    // Get total number of MCQ questions
    const totalQuestions = exam.sections.mcqs.length;
    
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
};
