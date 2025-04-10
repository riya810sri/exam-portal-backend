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

// Simplified role checking for user and admin roles
function checkRole(roleName) {
  return function(req, res, next) {
    // For admin role check
    if (roleName === "admin") {
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ 
          message: "Forbidden: Admin role required" 
        });
      }
      return next();
    }
    
    // For normal user role check - all authenticated users have normal user access
    if (roleName === "user") {
      if (!req.user) {
        return res.status(401).json({ 
          message: "Unauthorized: Authentication required" 
        });
      }
      return next();
    }
    
    // Any other role is not supported
    return res.status(403).json({ 
      message: `Forbidden: ${roleName} role not supported` 
    });
  };
}

module.exports = {
  assignRoleToUser,
  userHasRole,
  getUserRole,
  checkRole
};
