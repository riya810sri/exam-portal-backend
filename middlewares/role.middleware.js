const { authenticateUser } = require('./auth.middleware');

// Middleware to check role access
const checkRoleAccess = async (req, res, next) => {
  // If admin, allow access to everything
  if (req.user && req.user.isAdmin) {
    return next();
  }
  
  // For normal users, they're allowed to access basic routes
  // You could customize this further based on specific routes
  next();
};

module.exports = {
  checkRoleAccess
};
