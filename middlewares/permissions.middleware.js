const Permission = require("../models/permissions.model");
const User = require("../models/user.model");
async function assignRoleToUser(userId, roleId) {
  const permission = new Permission({
    userId,
    roleId,
  });

  await permission.save();

  // Update the user's isAdmin field
  const user = await User.findById(userId);
  if (user && roleId == 1) {
    console.log("user assigned to admin role")
    user.isAdmin = true;
    await user.save();
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
