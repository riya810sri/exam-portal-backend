const express = require("express");
const cors = require("cors"); // Make sure this is installed
const db = require('./config/db'); // Ensure this is the correct path to your db.js file
const config = require("./config/config");
const net = require('net'); // Added for port checking
const attendanceUtils = require('./utils/attendanceUtils'); // Import attendance utilities
const { initCronJobs } = require('./utils/cronJobs'); // Import cron jobs

// Import email utilities with error handling
let emailUtils;
try {
  emailUtils = require("./utils/emailUtils");
  console.log('Email utilities loaded successfully');
} catch (error) {
  console.warn('Failed to load email utilities:', error.message);
  console.warn('Email functionality will be disabled');
  emailUtils = { 
    transporter: null, 
    mailSender: async () => ({ 
      messageId: 'email-disabled', 
      response: 'Email functionality disabled' 
    }) 
  };
}

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");
const examRoutes = require("./routes/exams.routes");
const questionRoutes = require("./routes/questions.routes");
const roleRoutes = require("./routes/role.routes");
const certificateRoutes = require("./routes/certificate.routes");
const examAttendanceRoutes = require("./routes/examAttendance.routes");
const adminAntiAbuseRoutes = require("./routes/admin.antiAbuse.routes");
const adminSecurityDashboardRoutes = require("./routes/admin.securityDashboard.routes");
const adminStudentRestrictionsRoutes = require("./routes/admin.studentRestrictions.routes");

const app = express();

// Note: WebSocket server on same port as Express is removed
// Only using the dynamic Socket.IO implementation from dynamicSocketManager.js

const PORT = config.port;

// CORS configuration using settings from config.js
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: true, // Allow cookies to be sent in cross-origin requests
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Additional CORS headers for WebSocket support
app.use((req, res, next) => {
  // Get origin from request headers
  const origin = req.headers.origin;
  
  // Check if the origin is allowed
  if (origin && typeof config.cors.origin === 'function') {
    config.cors.origin(origin, (err, allowed) => {
      if (allowed) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    });
  } else if (origin && Array.isArray(config.cors.origin) && config.cors.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (origin && config.cors.origin === '*') {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (config.nodeEnv === 'development') {
    // In development, allow all origins
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  // Set other CORS headers
  res.header('Access-Control-Allow-Methods', Array.isArray(config.cors.methods) ? config.cors.methods.join(',') : 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  
  // Explicitly list all allowed headers instead of using wildcard
  const allowedHeaders = Array.isArray(config.cors.allowedHeaders) 
    ? config.cors.allowedHeaders.join(', ') 
    : 'Origin, X-Requested-With, Content-Type, Accept, Authorization, headers';
  
  res.header('Access-Control-Allow-Headers', allowedHeaders);
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(204); // No Content is more appropriate for OPTIONS
  } else {
    next();
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/roles", roleRoutes);
app.use('/api/certificate', certificateRoutes);
app.use('/api/exam-attendance', examAttendanceRoutes);
app.use('/api/admin/security', adminAntiAbuseRoutes);
app.use('/api/admin/security-dashboard', adminSecurityDashboardRoutes);
app.use('/api/admin/student-restrictions', adminStudentRestrictionsRoutes);

// No WebSocket connections on the main Express server
// Only using dynamic Socket.IO instances from dynamicSocketManager.js

// Connect to Database
app.get("/live", (req, res) => {
  res.status(200).json({ message: "Server is live" });
});

// Initialize cron jobs
initCronJobs();

// Periodically clean up stale exam attendances (every 30 minutes)
// This is now handled by the cron job in utils/cronJobs.js
// Keeping this for backward compatibility
setInterval(async () => {
  try {
    console.log("Running scheduled cleanup of stale exam attendances...");
    const updatedCount = await attendanceUtils.cleanupStaleAttendances();
    if (updatedCount > 0) {
      console.log(`Cleaned up ${updatedCount} stale exam attendances`);
    }
  } catch (error) {
    console.error("Error during scheduled attendance cleanup:", error);
  }
}, 30 * 60 * 1000); // 30 minutes

// Function to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        // Port is in use
        resolve(true);
      })
      .once('listening', () => {
        // Port is free
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

// Start server with port fallback
async function startServer() {
  let currentPort = PORT;
  const maxPortAttempts = 10; // Try up to 10 ports before giving up
  
  for (let attempt = 0; attempt < maxPortAttempts; attempt++) {
    const portInUse = await isPortInUse(currentPort);
    
    if (!portInUse) {
      // Port is free, start the server
      app.listen(currentPort, () => {
        console.log(`🚀 Server running on http://localhost:${currentPort}`);
        console.log(`💻 Host: localhost, Port: ${currentPort}`);
        
        // Log CORS configuration
        console.log('🔒 CORS Configuration:');
        console.log(`   Origin: ${typeof config.cors.origin === 'object' ? JSON.stringify(config.cors.origin) : config.cors.origin}`);
        console.log(`   Methods: ${config.cors.methods.join(', ')}`);
        console.log(`   Headers: ${config.cors.allowedHeaders}`);
        
        // Log cron job status
        console.log('⏰ Cron jobs initialized for scheduled tasks');
        console.log('   - Daily abandoned exam cleanup at midnight IST');
        console.log('   - Hourly stale attendance cleanup');
      });
      return; // Exit the function after successfully starting the server
    }
    
    // Port is in use, try the next port
    console.log(`⚠️ Port ${currentPort} is already in use, trying ${currentPort + 1}...`);
    currentPort++;
  }
  
  // If we've tried all ports and none are available
  console.error(`❌ Could not find an available port after ${maxPortAttempts} attempts.`);
  process.exit(1);
}

// Start the server
startServer();