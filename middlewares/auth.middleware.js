const Session = require("../models/session.model");
const User = require("../models/user.model");

const authenticateUser = async (req, res, next) => {
  const authHeader = req.header("Authorization"); // Auth header from headers

  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No authorization header provided" });
  }

  // Extract session ID from Bearer token format if present
  let sessionId = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  try {
    // Use projection to get only necessary fields
    const session = await Session.findById(sessionId).lean();
    if (!session) {
      return res.status(401).json({ message: "Session invalid or expired" });
    }

    // Use projection to get only necessary user fields
    const user = await User.findById(session.userId).select('_id email isAdmin role username').lean();
    if (!user) {
      // Clean up the invalid session
      await Session.findByIdAndDelete(sessionId);
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // Attach user info to request
    req.sessionId = sessionId;
    next();
  } catch (error) {
    res.status(500).json({ message: "Authentication error occurred" });
  }
};

// Admin check middleware
const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "Forbidden: Admin access required" });
  }
  next();
};

// Middleware to authorize admin users only
const authorizeAdmin = (req, res, next) => {
  // Check both role === 'admin' and isAdmin flag
  if (req.user && (req.user.role === 'admin' || req.user.isAdmin === true)) {
    next();
  } else {
    console.log("Admin access denied. User data:", req.user);
    res.status(403).json({
      message: "Access denied. Admin privileges required."
    });
  }
};

module.exports = { 
  verifyAdmin, 
  authenticateUser, 
  authorizeAdmin 
};
