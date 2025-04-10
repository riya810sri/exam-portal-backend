const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const authController = require("../controllers/authUsers.controller");

// Public routes with fallbacks for missing methods
router.post("/login", authController.loginUser || 
  ((req, res) => res.status(501).json({ message: "Login not implemented yet" })));
  
router.post("/forgot-password", authController.forgotPassword || 
  ((req, res) => res.status(501).json({ message: "Forgot password not implemented yet" })));
  
router.post("/reset-password", authController.resetPassword || 
  ((req, res) => res.status(501).json({ message: "Reset password not implemented yet" })));

// Protected routes with fallbacks
router.get("/me", authenticateUser, authController.getCurrentUser || 
  ((req, res) => res.status(501).json({ message: "Get current user not implemented yet" })));
  
router.post("/logout", authenticateUser, authController.logout || 
  ((req, res) => res.status(501).json({ message: "Logout not implemented yet" })));
  
router.post("/change-password", authenticateUser, authController.changePassword || 
  ((req, res) => res.status(501).json({ message: "Change password not implemented yet" })));

module.exports = router;
