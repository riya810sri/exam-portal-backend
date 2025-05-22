const mongoose = require("mongoose");

const examHistorySchema = new mongoose.Schema({
  originalExamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  duration: {
    type: Number, 
    required: true,
  },
  sections: {
    mcqs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    shortAnswers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: {
    type: Date,
  },
  publishedAt: {
    type: Date,
  },
  archivedAt: {
    type: Date,
    default: Date.now,
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  totalPassedAttempts: {
    type: Number,
    default: 0
  },
  passRate: {
    type: Number,
    default: 0
  }
});

// Add text indexes for better search functionality
examHistorySchema.index({ title: 'text', description: 'text' });

const ExamHistory = mongoose.model("ExamHistory", examHistorySchema);
module.exports = ExamHistory;