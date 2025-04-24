const mongoose = require("mongoose");

const examSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "PUBLISHED"],
    default: "PENDING",
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
    default: Date.now,
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
  }
});

const Exam = mongoose.model("Exam", examSchema);
module.exports = Exam;
