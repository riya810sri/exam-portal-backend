const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roleId: {
    type: Number,
    ref: "Role",
    required: true,
    localField: "roleId",
    foreignField: "id", // Refers to the 'id' field in the 'Roles' model
  },
});

module.exports = mongoose.model("Permission", permissionSchema);
