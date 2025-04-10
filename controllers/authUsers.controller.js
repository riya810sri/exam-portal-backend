const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const Session = require("../models/session.model");

const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({
      email: email,
      username: username,
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email or username" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      isAdmin: false, // Default to normal user
      role: "user"    // Default to user role
    });
    await newUser.save();

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res
      .status(201)
      .json({ message: "User registered successfully", user: userResponse });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  
  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  
  try {
    // Use lean() and projection for better performance
    const user = await User.findOne({ email }).select('+password').lean();
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const authenticate = await bcrypt.compare(password, user.password);
    if (!authenticate) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Clean up any existing sessions for this user (optional)
    await Session.deleteMany({ userId: user._id });
    
    // Create new session
    const session = new Session({ userId: user._id });
    await session.save();
    
    // Don't send password in response
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(200).json({
      message: "Login successful",
      user: userWithoutPassword,
      sessionId: session._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed, please try again" });
  }
};

// Add missing methods if needed
const login = (req, res) => {
  // Implementation
};

const forgotPassword = (req, res) => {
  // Implementation
};

const resetPassword = (req, res) => {
  // Implementation
};

const getCurrentUser = (req, res) => {
  // Implementation
};

const logout = (req, res) => {
  // Implementation
};

const changePassword = (req, res) => {
  // Implementation
};

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  logout,
  changePassword,
  loginUser,
  registerUser
};
