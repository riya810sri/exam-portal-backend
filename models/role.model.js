const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  id: {
    type: Number,  // 1: Admin, 2: User, 3: Guest
    required: true,
  },
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
});

module.exports = mongoose.model("Role", roleSchema);
