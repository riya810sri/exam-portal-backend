const Exam = require("../models/exam.model");
const ExamAttendance = require("../models/examAttendance.model");

const createExam = async (req, res) => {
  try {
    const { title, description, duration, createdBy } = req.body;

    // Create the exam
    const newExam = new Exam({
      title,
      description,
      duration,
      sections: {
        mcqs: [],
        shortAnswers: [],
      },
      createdBy,
    });

    await newExam.save();

    res.status(201).json({
      message: "Exam created successfully",
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
    const exams = await Exam.find().populate(
      "sections.mcqs sections.shortAnswers"
    );
    res.status(200).json(exams);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate(
      "sections.mcqs sections.shortAnswers"
    );

    if (!exam) return res.status(404).json({ message: "Exam not found" });

    res.status(200).json(exam);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
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
    const { title, description, duration, sections, createdBy } = req.body;

    // Find and update the exam
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      { title, description, duration, sections, createdBy },
      { new: true }
    ).populate("sections.mcqs sections.shortAnswers"); // Populate questions

    if (!updatedExam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    res.json({ message: "Exam updated successfully", exam: updatedExam });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
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
  getExamById,
  deleteExam,
  updateExam,
  attendExam,
};
