const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.error('Error verifying email transporter:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email templates
const emailTemplates = {
  welcomeEmail: (user) => ({
    from: `"Durbhasi Gurukulam Career" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Welcome to Online Exam Portal',
    text: `Hi ${user.username},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Exam Portal Team`,
    html: `
      <div>
        <p>Hi ${user.username},</p>
        <p>Welcome to our platform! We're excited to have you on board.</p>
        <p>Best regards,<br/>The Exam Portal Team</p>
      </div>
    `
  })
};

module.exports = { transporter, emailTemplates };
