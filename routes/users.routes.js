const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRoleAccess } = require("../middlewares/role.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const userController = require("../controllers/users.controller");

// Get user profile - any authenticated user can access their own profile
router.get("/profile", authenticateUser, userController.getUserProfile || 
  ((req, res) => res.status(501).json({ message: "Get profile not implemented yet" })));

// Update user profile - any authenticated user can update their own profile
router.put("/profile", authenticateUser, userController.updateProfile || 
  ((req, res) => res.status(501).json({ message: "Update profile not implemented yet" })));

// Get all users - only admin can access
router.get("/", authenticateUser, checkRole("admin"), userController.getAllUsers || 
  ((req, res) => res.status(501).json({ message: "Get all users not implemented yet" })));

// Get user by ID - admin can access any user, users can only access themselves
router.get("/:id", authenticateUser, (req, res, next) => {
  // Allow users to access their own profile
  if (req.user._id.toString() === req.params.id) {
    return next();
  }
  // Otherwise, only admin can access
  checkRole("admin")(req, res, next);
}, userController.getUserById || 
   ((req, res) => res.status(501).json({ message: "Get user by ID not implemented yet" })));

// Update user - admin can update any user, users can only update themselves
router.put("/:id", authenticateUser, (req, res, next) => {
  // Allow users to update their own profile
  if (req.user._id.toString() === req.params.id) {
    return next();
  }
  // Otherwise, only admin can update
  checkRole("admin")(req, res, next);
}, userController.updateUser || 
   ((req, res) => res.status(501).json({ message: "Update user not implemented yet" })));

// Delete user - only admin can delete users
router.delete("/:id", authenticateUser, checkRole("admin"), userController.deleteUser || 
  ((req, res) => res.status(501).json({ message: "Delete user not implemented yet" })));

module.exports = router;
