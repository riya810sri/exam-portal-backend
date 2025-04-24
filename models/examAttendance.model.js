const mongoose = require("mongoose");

const examAttendanceSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  attemptedQuestions: {
    type: Number,
    default: 0,
  },
  score: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["IN_PROGRESS", "COMPLETED", "TIMED_OUT"],
    default: "IN_PROGRESS",
  },
  answers: [
    {
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
      selectedAnswer: {
        type: String,
      },
      isCorrect: {
        type: Boolean,
      },
    },
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  attemptNumber: {
    type: Number,
    default: 1
  }
});

// Index for faster queries but non-unique to allow multiple attempts
examAttendanceSchema.index({ examId: 1, userId: 1, attemptNumber: 1 });

const ExamAttendance = mongoose.model("ExamAttendance", examAttendanceSchema);

module.exports = ExamAttendance;