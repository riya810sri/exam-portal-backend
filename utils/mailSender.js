const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config();

/**
 * Sends an email with optional attachments
 * @param {string} email - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content for the email body
 * @param {Array} attachments - Array of attachment objects
 * @returns {Promise} - Nodemailer info response
 */
const mailSender = async (email, subject, html, attachments) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: process.env.MAIL_PORT == 465,
      auth: {
        user: process.env.USER1,
        pass: process.env.PASS,
      },
      logger: true,
      debug: true,
    });

    let mailOptions = {
      from: `"TechOnquer Certifications" <${process.env.USER1}>`,
      to: email,
      subject: subject,
      html: html, // Use the HTML content directly without wrapping in <p> tags
      attachments: attachments || [], // Ensure attachments is always an array
    };

    let info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Email sending failed to ${email}: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = mailSender;
