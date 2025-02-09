const Exam = require("../models/exam.model");

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

module.exports = {
  createExam,
  getAllExams,
  getExamById,
  deleteExam,
  updateExam,
};
