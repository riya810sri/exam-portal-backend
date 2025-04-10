const Session = require("../models/session.model");
const User = require("../models/user.model");

const authenticateUser = async (req, res, next) => {
  const sessionId = req.header("Authorization"); // Session ID from headers

  if (!sessionId) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No session ID provided" });
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

module.exports = { verifyAdmin, authenticateUser };
