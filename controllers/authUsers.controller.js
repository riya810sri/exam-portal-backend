const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const Session = require("../models/session.model");
const { generateOTP, sendOTPEmail, validateOTPFormat, calculateOTPExpiry } = require("../utils/otpUtils");

const registerUser = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    // Split the full name into first and last name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Generate username from email (part before @)
    const username = email.split('@')[0];
    
    // Check if user already exists with this email or username
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }
    
    // Generate OTP for email verification
    const otp = generateOTP();
    const otpExpiry = calculateOTPExpiry();
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      isAdmin: false,
      role: "user",
      isVerified: false,
      verificationOTP: otp,
      otpExpiry: otpExpiry,
      verificationAttempts: 0
    });
    await newUser.save();

    // Send verification OTP email
    try {
      await sendOTPEmail(email, otp, firstName);
      console.log(`OTP sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // We continue anyway, user can request a new OTP
    }

    // Remove sensitive information from response
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.verificationOTP;
    delete userResponse.otpExpiry;

    res
      .status(201)
      .json({ 
        message: "User registered successfully. Please verify your email with the OTP sent to your email address.", 
        user: userResponse,
        requiresVerification: true
      });
  } catch (error) {
    res.status(500).json({ 
      message: "Registration failed", 
      error: error.message 
    });
  }
};

// Verify OTP sent during registration
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }
  
  // Validate OTP format
  if (!validateOTPFormat(otp)) {
    return res.status(400).json({ message: "Invalid OTP format. OTP must be a 6-digit number." });
  }
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // If user is already verified
    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }
    
    // Check if max verification attempts exceeded
    if (user.verificationAttempts >= 5) {
      return res.status(400).json({ 
        message: "Maximum verification attempts exceeded. Please request a new OTP.", 
        maxAttemptsExceeded: true 
      });
    }
    
    // Increment verification attempts
    user.verificationAttempts += 1;
    
    // Check if OTP has expired
    if (user.otpExpiry && new Date() > new Date(user.otpExpiry)) {
      await user.save(); // Save the attempt increment
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new OTP.", 
        expired: true 
      });
    }
    
    // Check if OTP matches
    if (user.verificationOTP !== otp) {
      await user.save(); // Save the attempt increment
      return res.status(400).json({ 
        message: "Invalid OTP. Please try again.", 
        remainingAttempts: 5 - user.verificationAttempts 
      });
    }
    
    // OTP is valid, mark user as verified
    user.isVerified = true;
    user.verificationOTP = undefined; // Clear OTP
    user.otpExpiry = undefined; // Clear expiry
    user.verificationAttempts = 0; // Reset attempts
    
    await user.save();
    
    res.status(200).json({ 
      message: "Email verified successfully. You can now login to your account.", 
      verified: true
    });
    
  } catch (error) {
    res.status(500).json({ 
      message: "Verification failed", 
      error: error.message 
    });
  }
};

// Resend OTP if expired or not received
const resendOTP = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // If user is already verified
    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = calculateOTPExpiry();
    
    // Update user with new OTP
    user.verificationOTP = otp;
    user.otpExpiry = otpExpiry;
    user.verificationAttempts = 0; // Reset attempts
    
    await user.save();
    
    // Send verification OTP email
    try {
      await sendOTPEmail(email, otp, user.firstName);
      console.log(`New OTP sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
    
    res.status(200).json({ 
      message: "New OTP has been sent to your email address", 
      otpSent: true 
    });
    
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to resend OTP", 
      error: error.message 
    });
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
    
    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: "Email not verified. Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email
      });
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
  registerUser,
  verifyOTP,
  resendOTP
};
