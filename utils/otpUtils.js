// Utility functions for OTP generation and verification
const crypto = require('crypto');
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

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
    // Create a transporter using nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: process.env.MAIL_PORT == 465,
      auth: {
        user: process.env.USER1,
        pass: process.env.PASS,
      },
      logger: true,
      debug: process.env.NODE_ENV === 'development',
    });

    // Define email options
    let mailOptions = {
      from: `"TechOnquer Verification" <${process.env.USER1}>`,
      to: email,
      subject: subject,
      html: html,
    };

    // Send the email
    let info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}: ${info.messageId}`);
    
    // Return the info object from nodemailer
    return info;
  } catch (error) {
    console.error(`Failed to send OTP email to ${email}: ${error.message}`);
    
    // In development mode, still proceed but log the OTP for testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV MODE] Would have sent OTP: ${otp} to ${email}`);
      return { messageId: 'dev-mode-no-email-sent', otp };
    }
    
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

/**
 * Validates that the OTP is in the correct format (6-digit number)
 * @param {string} otp - OTP to validate
 * @returns {boolean} - Whether the OTP format is valid
 */
const validateOTPFormat = (otp) => {
  return /^\d{6}$/.test(otp);
};

/**
 * Calculates the expiry time for an OTP (10 minutes from now)
 * @returns {Date} - Expiry date and time
 */
const calculateOTPExpiry = () => {
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 10); // 10 minutes expiry
  return expiryTime;
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  validateOTPFormat,
  calculateOTPExpiry
};