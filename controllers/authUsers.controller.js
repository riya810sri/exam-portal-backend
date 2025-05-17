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

// Request password reset - generates token and sends email
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  // Validate input
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  
  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    // Don't reveal if user exists or not for security
    if (!user) {
      return res.status(200).json({ 
        message: "If a user with that email exists, a password reset link has been sent." 
      });
    }
    
    // Generate reset token using OTP utility for consistency
    const resetToken = generateOTP();
    
    // Set token expiry to 1 hour (instead of default 10 minutes)
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);
    
    // Store token in user record
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    
    await user.save();
    
    // Send password reset email
    try {
      // Create email with reset instructions
      const emailSubject = "Password Reset Request";
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a86e8; text-align: center;">TechOnquer Password Reset</h2>
          <p>Hello ${user.firstName},</p>
          <p>You have requested to reset your password. Please use the following code to reset your password:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${resetToken}
          </div>
          
          <p>This code is valid for 1 hour and can only be used once.</p>
          
          <p>If you did not request this reset, please ignore this email and your password will remain unchanged.</p>
          
          <p>Best regards,<br>TechOnquer Team</p>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777; text-align: center;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `;
      
      // Use the same email sender as for OTP
      await sendOTPEmail(email, resetToken, user.firstName);
      console.log(`Password reset token sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return res.status(500).json({ message: "Failed to send password reset email" });
    }
    
    res.status(200).json({ 
      message: "If a user with that email exists, a password reset link has been sent." 
    });
    
  } catch (error) {
    console.error("Password reset request failed:", error);
    res.status(500).json({ 
      message: "Password reset request failed", 
      error: error.message 
    });
  }
};

// Reset password using token
const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  // Validate input
  if (!email || !token || !newPassword) {
    return res.status(400).json({ 
      message: "Email, token, and new password are required" 
    });
  }
  
  // Validate password strength
  if (newPassword.length < 8) {
    return res.status(400).json({ 
      message: "Password must be at least 8 characters long" 
    });
  }
  
  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if reset token exists and hasn't expired
    if (!user.resetPasswordToken || !user.resetPasswordExpiry) {
      return res.status(400).json({ 
        message: "Password reset token is missing or has been used already" 
      });
    }
    
    // Check if OTP has been verified
    if (!user.resetOTPVerified) {
      return res.status(403).json({ 
        message: "Please verify your OTP before resetting the password",
        verified: false
      });
    }
    
    // Check if token has expired
    if (new Date() > new Date(user.resetPasswordExpiry)) {
      return res.status(400).json({ 
        message: "Password reset token has expired. Please request a new token." 
      });
    }
    
    // Verify the token once more
    if (user.resetPasswordToken !== token) {
      return res.status(400).json({ message: "Invalid password reset token" });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user's password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    user.resetOTPVerified = false;
    
    await user.save();
    
    // Invalidate any existing sessions for security
    await Session.deleteMany({ userId: user._id });
    
    res.status(200).json({ 
      message: "Password has been reset successfully. You can now log in with your new password." 
    });
    
  } catch (error) {
    console.error("Password reset failed:", error);
    res.status(500).json({ 
      message: "Password reset failed", 
      error: error.message 
    });
  }
};

// Verify OTP sent during password reset flow
const verifyResetOTP = async (req, res) => {
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
    
    // Check if reset token exists
    if (!user.resetPasswordToken) {
      return res.status(400).json({ 
        message: "No password reset was requested or it has already been used" 
      });
    }
    
    // Check if token has expired
    if (new Date() > new Date(user.resetPasswordExpiry)) {
      return res.status(400).json({ 
        message: "Password reset OTP has expired. Please request a new one.", 
        expired: true 
      });
    }
    
    // Verify the token
    if (user.resetPasswordToken !== otp) {
      return res.status(400).json({ message: "Invalid password reset OTP" });
    }
    
    // Mark the OTP as verified but keep it for the actual password reset step
    user.resetOTPVerified = true;
    await user.save();
    
    res.status(200).json({ 
      message: "OTP verified successfully. You can now reset your password.", 
      verified: true,
      email: user.email,
      // Include a temporary verification token valid for the reset
      resetVerificationToken: user.resetPasswordToken
    });
    
  } catch (error) {
    console.error("Reset OTP verification failed:", error);
    res.status(500).json({ 
      message: "Verification failed", 
      error: error.message 
    });
  }
};

// Resend OTP for password reset
const resendResetOTP = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  
  try {
    const user = await User.findOne({ email });
    
    // Don't reveal if user exists or not for security
    if (!user) {
      return res.status(200).json({ 
        message: "If a user with that email exists, a new password reset OTP has been sent." 
      });
    }
    
    // Generate new reset token
    const resetToken = generateOTP();
    
    // Set token expiry to 1 hour
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);
    
    // Store token in user record and reset verification flag
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    user.resetOTPVerified = false;
    
    await user.save();
    
    // Send password reset email
    try {
      // Create email with reset instructions
      const emailSubject = "Password Reset OTP";
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a86e8; text-align: center;">TechOnquer Password Reset</h2>
          <p>Hello ${user.firstName},</p>
          <p>You have requested to reset your password. Please use the following code to verify your request:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${resetToken}
          </div>
          
          <p>This code is valid for 1 hour and can only be used once.</p>
          
          <p>If you did not request this reset, please ignore this email and your password will remain unchanged.</p>
          
          <p>Best regards,<br>TechOnquer Team</p>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777; text-align: center;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `;
      
      // Use the same email sender as for OTP
      await sendOTPEmail(email, resetToken, user.firstName);
      console.log(`New password reset token sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return res.status(500).json({ message: "Failed to send password reset email" });
    }
    
    res.status(200).json({ 
      message: "If a user with that email exists, a new password reset OTP has been sent." 
    });
    
  } catch (error) {
    console.error("Resend reset OTP failed:", error);
    res.status(500).json({ 
      message: "Failed to resend password reset OTP", 
      error: error.message 
    });
  }
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

// Alias loginUser function to login for backward compatibility
const login = loginUser;

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
  resendOTP,
  verifyResetOTP,
  resendResetOTP
};
