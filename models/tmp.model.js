const mongoose = require('mongoose');

const tmpExamStudentDataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true
    },
    attemptNumber: {
      type: Number,
      default: 1,
      required: true
    },
    questionIds: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    answers: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
  },
  { timestamps: true }
);

// Create a compound index to ensure uniqueness of records per attempt
tmpExamStudentDataSchema.index({ userId: 1, examId: 1, attemptNumber: 1 }, { unique: true });

const TmpExamStudentData = mongoose.model('TmpExamStudentData', tmpExamStudentDataSchema);
module.exports = TmpExamStudentData;