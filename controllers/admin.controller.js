const Exam = require("../models/exam.model");
const Question = require("../models/question.model");
const ExamAttendance = require("../models/examAttendance.model");
const User = require("../models/user.model");

// Manage Virtual Machines for Practical Exams
const manageMachines = async (req, res) => {
  try {
    // Logic for adding/removing virtual machines (depends on implementation)
    res.json({ message: "Virtual machines updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Get User Exam Results
const getUserResults = async (req, res) => {
  try {
    // Fetch user results (depends on result model)
    res.json({ message: "User results retrieved successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Modify Exam Settings
const modifyExamSettings = async (req, res) => {
  try {
    const { duration, attempts } = req.body;
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      { duration, attempts },
      { new: true }
    );

    if (!updatedExam)
      return res.status(404).json({ message: "Exam not found" });

    res.json({
      message: "Exam settings updated successfully",
      exam: updatedExam,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Get all exam attendance records (admin-only)
const getAllExamHistory = async (req, res) => {
  try {
    // Query parameters for filtering and pagination
    const { 
      examId, userId, status, startDate, endDate, 
      page = 1, limit = 20, sortBy = 'startTime', order = 'desc' 
    } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build the filter query based on provided parameters
    const filter = {};
    
    if (examId) filter.examId = examId;
    if (userId) filter.userId = userId;
    if (status && ["IN_PROGRESS", "COMPLETED", "TIMED_OUT"].includes(status)) {
      filter.status = status;
    }
    
    // Date range filters if provided
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }
    
    // Create sort configuration
    const sortConfig = {};
    sortConfig[sortBy || 'startTime'] = order === 'asc' ? 1 : -1;
    
    // Count total documents matching the filter for pagination
    const total = await ExamAttendance.countDocuments(filter);
    
    // Find and populate exam attendance records
    const examHistory = await ExamAttendance.find(filter)
      .populate({
        path: 'examId',
        select: 'title description duration status'
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName email'
      })
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum);
    
    // Format the response data
    const formattedHistory = examHistory.map(attendance => {
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
      
      return {
        attendanceId: attendance._id,
        exam: {
          id: attendance.examId?._id || 'Unknown',
          title: attendance.examId?.title || 'Unknown Exam',
          description: attendance.examId?.description || '',
          duration: attendance.examId?.duration || 0
        },
        user: {
          id: user._id || 'Unknown',
          name: userName,
          username: user.username || 'Unknown',
          email: user.email || 'Unknown'
        },
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        duration: attendance.endTime 
          ? Math.round((attendance.endTime - attendance.startTime) / 60000) 
          : null, // in minutes
        status: attendance.status,
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptedQuestions: attendance.attemptedQuestions,
        percentage: percentage,
        passed: passed,
        attemptNumber: attendance.attemptNumber || 1
      };
    });
    
    res.status(200).json({
      message: "Exam history retrieved successfully",
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      count: formattedHistory.length,
      history: formattedHistory
    });
    
  } catch (error) {
    console.error("Error retrieving exam history:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get exam attendance records for a specific user (admin-only)
const getUserExamHistory = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if user exists
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find all exam attendances for this user
    const examAttendances = await ExamAttendance.find({ userId })
      .populate({
        path: 'examId',
        select: 'title description duration status'
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName email'
      })
      .sort({ startTime: -1 }); // Sort by most recent first
    
    if (!examAttendances || examAttendances.length === 0) {
      return res.status(200).json({ 
        message: "This user has not taken any exams yet",
        exams: [] 
      });
    }
    
    // Get user details
    const user = await User.findById(userId).select('username firstName lastName email');
    
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
        exam: {
          id: attendance.examId?._id || 'Unknown',
          title: attendance.examId?.title || 'Unknown Exam',
          description: attendance.examId?.description || '',
          duration: attendance.examId?.duration || 0
        },
        startTime: attendance.startTime,
        endTime: attendance.endTime,
        duration: attendance.endTime 
          ? Math.round((attendance.endTime - attendance.startTime) / 60000) 
          : null, // in minutes
        status: attendance.status,
        score: attendance.score,
        totalQuestions: attendance.totalQuestions,
        attemptedQuestions: attendance.attemptedQuestions,
        percentage: percentage,
        passed: passed,
        attemptNumber: attendance.attemptNumber || 1
      };
    });
    
    res.status(200).json({
      message: "User's exam history retrieved successfully",
      user: {
        id: user._id,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username,
        username: user.username,
        email: user.email
      },
      count: userExams.length,
      exams: userExams
    });
    
  } catch (error) {
    console.error("Error retrieving user exam history:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get pass/fail statistics for a specific exam (admin-only)
const getExamPassFailStats = async (req, res) => {
  try {
    const { examId } = req.params;
    
    // Check if exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    
    // Find all completed attendance records for this exam
    const attendanceRecords = await ExamAttendance.find({
      examId,
      status: "COMPLETED"
    }).populate({
      path: 'userId',
      select: 'username firstName lastName email'
    }).sort({ score: -1 }); // Sort by highest score first
    
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return res.status(200).json({ 
        message: "No completed attempts found for this exam",
        exam: {
          id: exam._id,
          title: exam.title,
          description: exam.description,
          status: exam.status
        },
        stats: {
          totalAttempts: 0,
          passCount: 0,
          failCount: 0,
          passRate: "0.00%"
        },
        students: []
      });
    }
    
    // Process student results
    const passThreshold = 60; // 60% is passing
    const studentsData = [];
    let passCount = 0;
    let failCount = 0;
    
    attendanceRecords.forEach(record => {
      const percentage = record.totalQuestions > 0 
        ? ((record.score / record.totalQuestions) * 100).toFixed(2) 
        : 0;
      
      const passed = parseFloat(percentage) >= passThreshold;
      
      if (passed) passCount++;
      else failCount++;
      
      // Format user details
      const user = record.userId || { username: 'Unknown' };
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
      
      studentsData.push({
        student: {
          id: user._id,
          name: userName,
          username: user.username,
          email: user.email
        },
        attemptId: record._id,
        score: record.score,
        totalQuestions: record.totalQuestions,
        attemptedQuestions: record.attemptedQuestions,
        percentage: percentage,
        passed: passed,
        startTime: record.startTime,
        endTime: record.endTime,
        attemptNumber: record.attemptNumber || 1
      });
    });
    
    // Calculate pass rate
    const passRate = attendanceRecords.length > 0 
      ? ((passCount / attendanceRecords.length) * 100).toFixed(2) + '%' 
      : '0.00%';
    
    res.status(200).json({
      message: "Exam pass/fail statistics retrieved successfully",
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        status: exam.status
      },
      stats: {
        totalAttempts: attendanceRecords.length,
        passCount,
        failCount,
        passRate
      },
      students: studentsData
    });
    
  } catch (error) {
    console.error("Error retrieving exam pass/fail stats:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get all currently active exam sessions (in-progress exams)
const getActiveExams = async (req, res) => {
  try {
    // Optional filters
    const { examId, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter for active exams (status = IN_PROGRESS)
    let filter = { status: "IN_PROGRESS" };
    
    // Add exam filter if provided
    if (examId) filter.examId = examId;
    
    // Find active exam sessions with populated details
    const activeExams = await ExamAttendance.find(filter)
      .populate({
        path: 'examId',
        select: 'title description duration'
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName email'
      })
      .sort({ startTime: -1 }) // Most recently started first
      .skip(skip)
      .limit(parseInt(limit));
    
    // Count total for pagination
    const total = await ExamAttendance.countDocuments(filter);
    
    // If text search is provided, filter results in memory
    let filteredExams = activeExams;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredExams = activeExams.filter(exam => {
        const examTitle = exam.examId?.title?.toLowerCase() || '';
        const username = exam.userId?.username?.toLowerCase() || '';
        const firstName = exam.userId?.firstName?.toLowerCase() || '';
        const lastName = exam.userId?.lastName?.toLowerCase() || '';
        const email = exam.userId?.email?.toLowerCase() || '';
        
        return examTitle.includes(searchLower) ||
               username.includes(searchLower) ||
               firstName.includes(searchLower) ||
               lastName.includes(searchLower) ||
               email.includes(searchLower);
      });
    }
    
    // Calculate time elapsed and remaining for each session
    const activeSessionsData = filteredExams.map(session => {
      const startTime = new Date(session.startTime);
      const currentTime = new Date();
      const elapsedMinutes = Math.round((currentTime - startTime) / 60000);
      
      // Calculate remaining time based on exam duration
      const examDuration = session.examId?.duration || 0;
      const remainingMinutes = Math.max(0, examDuration - elapsedMinutes);
      
      // Format user details
      const user = session.userId || { username: 'Unknown' };
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
      
      return {
        sessionId: session._id,
        exam: {
          id: session.examId?._id || 'Unknown',
          title: session.examId?.title || 'Unknown Exam',
          description: session.examId?.description || '',
          duration: examDuration
        },
        user: {
          id: user._id || 'Unknown',
          name: userName,
          username: user.username || 'Unknown',
          email: user.email || 'Unknown'
        },
        startTime: session.startTime,
        elapsedTime: `${elapsedMinutes} min`,
        remainingTime: `${remainingMinutes} min`,
        progress: {
          attemptedQuestions: session.attemptedQuestions,
          totalQuestions: session.totalQuestions,
          percentComplete: session.totalQuestions > 0 
            ? Math.round((session.attemptedQuestions / session.totalQuestions) * 100) 
            : 0
        },
        attemptNumber: session.attemptNumber || 1,
        timeStatus: remainingMinutes < 5 ? 'critical' : 
                   remainingMinutes < 15 ? 'warning' : 'normal'
      };
    });
    
    // Group by exam for summary statistics
    const examSummary = {};
    activeExams.forEach(session => {
      const examId = session.examId?._id?.toString() || 'unknown';
      const examTitle = session.examId?.title || 'Unknown Exam';
      
      if (!examSummary[examId]) {
        examSummary[examId] = {
          examId: examId,
          title: examTitle,
          activeSessions: 0
        };
      }
      
      examSummary[examId].activeSessions++;
    });
    
    res.status(200).json({
      message: "Active exam sessions retrieved successfully",
      totalActive: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      count: filteredExams.length,
      examSummary: Object.values(examSummary),
      activeSessions: activeSessionsData
    });
    
  } catch (error) {
    console.error("Error retrieving active exams:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { 
  manageMachines, 
  getUserResults, 
  modifyExamSettings,
  getAllExamHistory,
  getUserExamHistory,
  getExamPassFailStats,
  getActiveExams
};
