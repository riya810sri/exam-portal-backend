const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const authController = require("../controllers/authUsers.controller");

// Public routes with fallbacks for missing methods
router.post("/login", authController.loginUser || 
  ((req, res) => res.status(501).json({ message: "Login not implemented yet" })));
  
router.post("/register", authController.registerUser);

// OTP verification routes
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);

// Password reset flow routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-reset-otp", authController.verifyResetOTP);
router.post("/resend-reset-otp", authController.resendResetOTP);
router.post("/reset-password", authController.resetPassword);

// Protected routes with fallbacks
router.get("/me", authenticateUser, authController.getCurrentUser || 
  ((req, res) => res.status(501).json({ message: "Get current user not implemented yet" })));
  
router.post("/logout", authenticateUser, authController.logout || 
  ((req, res) => res.status(501).json({ message: "Logout not implemented yet" })));
  
router.post("/change-password", authenticateUser, authController.changePassword || 
  ((req, res) => res.status(501).json({ message: "Change password not implemented yet" })));

module.exports = router;
