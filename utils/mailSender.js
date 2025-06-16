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

/**
 * Sends a certificate email with retry functionality
 * @param {Object} params - Parameters for the email
 * @param {string} params.email - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.name - Recipient name
 * @param {string} params.certificateId - Certificate ID
 * @param {string} params.examTitle - Exam title
 * @param {boolean} params.passed - Exam pass status
 * @param {string} params.certificatePath - Path to the certificate file
 * @param {number} retryCount - Number of retry attempts
 * @returns {Promise<boolean>} - Success status
 */
const sendCertificateEmail = async ({ email, subject, name, certificateId, examTitle, passed, certificatePath }, retryCount = 3) => {
  try {
    console.log(`Sending email with certificate attachment to ${email}`);
    
    // Create email with attachment
  //   const transporter = nodemailer.createTransport({
  //     host: process.env.MAIL_HOST,
  //     port: process.env.MAIL_PORT,
  //     secure: process.env.MAIL_PORT == 465,
  //     auth: {
  //       user: process.env.USER1,
  //       pass: process.env.PASS,
  //     },
  //     logger: true,
  //     debug: true,
  //   });

  //   const mailOptions = {
  //     from: process.env.EMAIL_FROM || 'your-email@example.com',
  //     to: email,
  //     subject: subject,
  //     html: `
  //       <h1>${passed ? 'Congratulations' : 'Exam Results'}!</h1>
  //       <p>Hello ${name},</p>
  //       <p>You have ${passed ? 'successfully completed' : 'completed'} the exam <b>${examTitle}</b>.</p>
  //       <p>${passed ? 'Your certificate is attached to this email.' : 'Your results are attached to this email.'}</p>
  //       <p>Certificate ID: ${certificateId}</p>
  //       <p>Thank you!</p>
  //     `,
  //     attachments: [
  //       {
  //         filename: `${examTitle.replace(/\s+/g, '_')}_Certificate.pdf`,
  //         path: certificatePath,
  //         contentType: 'application/pdf'
  //       }
  //     ]
  //   };
    
  //   // Send email
  //   const info = await transporter.sendMail(mailOptions);
  //   console.log(`Email sent: ${info.messageId}`);
  //   return true;
  } catch (error) {
    console.error(`Error sending certificate email (attempt ${4-retryCount}/3):`, error);
    
    // // Implement retries
    // if (retryCount > 1) {
    //   console.log(`Retrying email send to ${email}... (${retryCount-1} attempts remaining)`);
    //   return sendCertificateEmail({ email, subject, name, certificateId, examTitle, passed, certificatePath }, retryCount - 1);
    // }
    
    // return false;
  }
};

module.exports = { mailSender, sendCertificateEmail };
