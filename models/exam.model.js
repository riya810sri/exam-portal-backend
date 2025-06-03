const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const examSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 5,
    max: 240
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT'
  },
  sections: {
    mcqs: [{
      type: Schema.Types.ObjectId,
      ref: 'Question'
    }],
    shortAnswers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
  },
  passingScore: {
    type: Number,
    default: 60,
    min: 1,
    max: 100
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1,
    max: 10,
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
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
    default: null
  }
}, { 
  timestamps: true 
});

// Virtual for calculating total questions
examSchema.virtual('totalQuestions').get(function() {
  return this.sections.mcqs.length;
});

// Pre-save hook to update the updatedAt field
examSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Exam = mongoose.model("Exam", examSchema);
module.exports = Exam;
