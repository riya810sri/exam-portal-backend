// Utility functions for OTP generation and verification
const crypto = require('crypto');
const config = require("../config/config");

// Import email utilities with fallback for transporter
let emailUtils;
try {
  emailUtils = require('./emailUtils');
} catch (error) {
  console.warn('Failed to load email utilities in otpUtils:', error.message);
  emailUtils = { 
    transporter: {
      sendMail: async () => ({ 
        messageId: 'email-disabled', 
        response: 'Email functionality disabled' 
      })
    }
  };
}
const { transporter } = emailUtils;

/**
 * Generates a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Sends an email with OTP verification code using nodemailer directly
 * @param {string} email - Recipient email address
 * @param {string} otp - One-Time Password to be sent
 * @param {string} name - Recipient's name for personalization
 * @returns {Promise} - Result of email sending operation
 */
const sendOTPEmail = async (email, otp, name) => {
  const subject = 'TechOnquer Account Verification OTP';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4a86e8; text-align: center;">TechOnquer Account Verification</h2>
      <p>Hello ${name},</p>
      <p>Thank you for registering with TechOnquer Exam Portal. To complete your account registration, please use the following One-Time Password (OTP):</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      
      <p>This OTP is valid for 10 minutes and can only be used once.</p>
      
      <p>If you did not request this registration, please ignore this email.</p>
      
      <p>Best regards,<br>TechOnquer Team</p>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777; text-align: center;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  try {
    // Define email options
    let mailOptions = {
      from: `"TechOnquer Verification" <${config.email.user}>`,
      to: email,
      subject: subject,
      html: html,
    };

    // Send the email using the shared transporter
    let info = await transporter.sendMail(mailOptions);
    console.log(`✓ OTP ${otp} email sent to ${email}: ${info.messageId}`);
    
    // Return the info object from nodemailer
    return info;
  } catch (error) {
    console.error(`Failed to send OTP email to ${email}: ${error.message}`);
    
    // In development mode, still proceed but log the OTP for testing
    if (config.nodeEnv === 'development') {
      console.log(`📧 [DEV MODE] OTP for ${email}: ${otp}`);
      return {
        messageId: `dev-mode-otp-${Date.now()}@localhost`,
        accepted: [email],
        rejected: [],
        pending: [],
        response: 'Dev mode - OTP email logged instead of sent'
      };
    }
    
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

/**
 * Validates that the OTP is in the correct format (6-digit number)
 * @param {string} otp - OTP to validate
 * @returns {boolean} True if valid, false otherwise
 */
const validateOTPFormat = (otp) => {
  return /^\d{6}$/.test(otp);
};

/**
 * Calculates the OTP expiry time (10 minutes from now)
 * @returns {Date} OTP expiry date
 */
const calculateOTPExpiry = () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10); // 10 minutes from now
  return expiry;
};

/**
 * Hashes an OTP for secure storage
 * @param {string} otp - The OTP to hash
 * @param {string} salt - Salt to use in hashing
 * @returns {string} Hashed OTP
 */
const hashOTP = (otp, salt) => {
  return crypto
    .createHmac('sha256', salt)
    .update(otp)
    .digest('hex');
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  validateOTPFormat,
  calculateOTPExpiry,
  hashOTP
};
