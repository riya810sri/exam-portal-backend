const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true },
        firstName: { type: String, required: true },
        lastName: { type: String, default: "" },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        isAdmin: { type: Boolean, default: false },
        role: { type: String, default: "user", enum: ["user", "admin"] },
        isVerified: { type: Boolean, default: false },
        verificationOTP: { type: String },
        otpExpiry: { type: Date },
        verificationAttempts: { type: Number, default: 0 },
        resetPasswordToken: { type: String },
        resetPasswordExpiry: { type: Date },
        resetOTPVerified: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
module.exports = User;
