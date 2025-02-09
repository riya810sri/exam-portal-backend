const Permission = require("../models/permissions.model");
const User = require("../models/user.model");
async function assignRoleToUser(userId, roleId) {
  const user = await User.findById(userId);

  if (user) {
    // Check if the user is already an admin
    if (user.isAdmin && roleId === 1) {
      console.log(
        "User is already an admin and cannot assign role to themselves."
      );
      return;
    }

    // Assign the role and update the user's isAdmin field
    const permission = new Permission({
      userId,
      roleId,
    });

    await permission.save();

    if (roleId === 1) {
      user.isAdmin = true;
      console.log("User assigned to admin role.");
    } else {
      user.isAdmin = false;
      console.log("User assigned to non-admin role.");
    }

    await user.save();
  } else {
    console.log("User not found.");
  }
}

async function userHasRole(userId, roleId) {
  const permission = await Permission.findOne({ userId, roleId });
  return permission != null;
}

// Middleware function to check if user is an admin
async function checkAdminRole(req, res, next) {
  const isAdmin = req.user.isAdmin;
  // console.log(req.user)
  if (!isAdmin) {
    return res.status(403).send({ message: "Forbidden: Admin role required" });
  }
  next();
}

module.exports = {
  assignRoleToUser,
  userHasRole,
  checkAdminRole,
};
