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

const TmpExamStudentData = mongoose.model('TmpExamStudentData', tmpExamStudentDataSchema);
module.exports = TmpExamStudentData;