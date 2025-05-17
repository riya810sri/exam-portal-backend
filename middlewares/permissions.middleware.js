const Permission = require("../models/permissions.model");
const User = require("../models/user.model");
const Role = require("../models/role.model");

// Since all users are students, this function will automatically assign the student role
async function assignRoleToUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Always set role to student
  user.role = "student";
  await user.save();

  return { success: true, message: "User assigned to student role" };
}

// Always returns true since all users are students
async function userHasRole(userId, roleName) {
  if (roleName !== "student") {
    return false;
  }
  
  const user = await User.findById(userId);
  return user ? true : false;
}

async function getUserRole(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  
  return { name: "student" };
}

// Simplified role checking - supporting both single role and array of roles
function checkRole(roleNames) {
  return function(req, res, next) {
    // Convert roleNames to array if it's a string
    const roles = Array.isArray(roleNames) ? roleNames : [roleNames];
    
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        message: "Unauthorized: Authentication required" 
      });
    }
    
    // Admin has access to everything
    if (req.user.role === "admin" || req.user.isAdmin) {
      return next();
    }
    
    // Check if user's role is in the allowed roles list
    if (roles.includes(req.user.role)) {
      return next();
    }
    
    // Deny access if role doesn't match
    return res.status(403).json({ 
      message: `Forbidden: Requires one of these roles: ${roles.join(', ')}` 
    });
  };
}

module.exports = {
  assignRoleToUser,
  userHasRole,
  getUserRole,
  checkRole
};
