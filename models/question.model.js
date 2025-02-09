const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  type: {
    type: String,
    enum: ["MCQ", "ShortAnswer", "Practical"],
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: function () {
      return this.type === "MCQ"; 
    },
    validate: {
      validator: function (v) {
        return this.type === "MCQ" ? v.length > 1 : true;
      },
      message: "MCQs must have at least two options.",
    },
  },
  correctAnswer: {
    type: String,
    required: true,
  },
});

const Question = mongoose.model("Question", questionSchema);
module.exports = Question;
