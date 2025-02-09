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
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(401).json({ message: "Session invalid or expired" });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // Attach user info to request
    next();
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "Forbidden: Admin access required" });
  }
  next();
};

module.exports = { verifyAdmin, authenticateUser };
