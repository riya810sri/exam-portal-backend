const nodemailer = require("nodemailer");
const config = require("../config/config");

// Set a timeout for SMTP connection attempts
const connectionTimeout = 5000; // 5 seconds

// Create a mock transporter for development mode
const createMockTransporter = () => {
  console.log('⚠️ Using mock email transporter for development');
  
  return {
    verify: (callback) => callback(null, true),
    sendMail: (mailOptions) => {
      console.log('📧 [MOCK EMAIL]', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html ? '(HTML content)' : mailOptions.text
      });
      return Promise.resolve({
        messageId: `mock-email-${Date.now()}@localhost`,
        response: 'Mock email delivery successful'
      });
    }
  };
};

// Create the email transporter with proper configuration
let transporter;

try {
  // Only create real transporter if we have valid email config
  if (config.email.host && config.email.user && config.email.pass) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
      connectionTimeout,
      logger: true,
      debug: config.nodeEnv === 'development'
    });
  } else {
    throw new Error('Missing email configuration');
  }
} catch (error) {
  console.warn('Email transporter creation failed:', error.message);
  if (config.nodeEnv === 'development') {
    transporter = createMockTransporter();
  }
}

// Verify the transporter is configured correctly, but don't block startup
if (config.nodeEnv !== 'development') {
  transporter.verify((error) => {
    if (error) {
      console.error('Email server verification failed:', error);
      console.warn('Continuing without email capabilities. Some features may not work correctly.');
    } else {
      console.log('✓ Email server connection verified and ready to send messages');
    }
  });
}

// Helper function to send emails with fallback for failures
const mailSender = async (email, subject, text) => {
  try {
    let mailOptions = {
      from: `"Exam Portal" <${config.email.user}>`,
      to: email,
      subject: subject,
      html: `<p>${text}</p>`,
    };
    
    let info = await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    
    // In development mode, just log and continue
    if (config.nodeEnv === 'development') {
      console.log(`📧 [DEV MODE] Would have sent email to ${email} with subject "${subject}"`);
      return {
        messageId: `dev-mode-${Date.now()}@localhost`,
        accepted: [email],
        rejected: [],
        pending: [],
        response: 'Dev mode - no email sent'
      };
    }
    
    throw error;
  }
};

module.exports = { transporter, mailSender };
