const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { blockPostman, blockPostmanLenient } = require("../middlewares/postmanBlocker.middleware");
const authController = require("../controllers/authUsers.controller");

// Public routes with postman blocking and fallbacks for missing methods
router.post("/login", blockPostman, authController.loginUser || 
  ((req, res) => res.status(501).json({ message: "Login not implemented yet" })));
  
router.post("/register", blockPostman, authController.registerUser);

// OTP verification routes
router.post("/verify-otp", blockPostman, authController.verifyOTP);
router.post("/resend-otp", blockPostman, authController.resendOTP);

// Password reset flow routes
router.post("/forgot-password", blockPostman, authController.forgotPassword);
router.post("/verify-reset-otp", blockPostman, authController.verifyResetOTP);
router.post("/resend-reset-otp", blockPostman, authController.resendResetOTP);
router.post("/reset-password", blockPostman, authController.resetPassword);

// Admin OTP verification routes
router.post("/admin/generate-otp", blockPostman, authController.generateAdminOTP);
router.post("/admin/verify-otp", blockPostman, authController.verifyAdminOTP);

// Protected routes with fallbacks
router.get("/me", blockPostmanLenient, authenticateUser, authController.getCurrentUser || 
  ((req, res) => res.status(501).json({ message: "Get current user not implemented yet" })));
  
router.post("/logout", blockPostmanLenient, authenticateUser, authController.logout || 
  ((req, res) => res.status(501).json({ message: "Logout not implemented yet" })));
  
router.post("/change-password", authenticateUser, authController.changePassword || 
  ((req, res) => res.status(501).json({ message: "Change password not implemented yet" })));

module.exports = router;
