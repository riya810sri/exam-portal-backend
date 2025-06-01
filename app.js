const express = require("express");
const cors = require("cors"); // Make sure this is installed
const http = require('http');
const socketIo = require('socket.io');
const db = require('./config/db'); // Ensure this is the correct path to your db.js file
const config = require("./config/config");
require("dotenv").config();
const { transporter } = require("./utils/emailUtils");
const net = require('net'); // Added for port checking
const attendanceUtils = require('./utils/attendanceUtils'); // Import attendance utilities

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");
const examRoutes = require("./routes/exams.routes");
const questionRoutes = require("./routes/questions.routes");
const roleRoutes = require("./routes/role.routes");
const certificateRoutes = require("./routes/certificate.routes");
const examAttendanceRoutes = require("./routes/examAttendance.routes");
const adminAntiAbuseRoutes = require("./routes/admin.antiAbuse.routes");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.WS_CORS_ORIGIN || ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make Socket.IO instance available globally
global.io = io;

const PORT = process.env.PORT || 3456;

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
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New WebSocket connection: ${socket.id}`);
  
  // Handle authentication
  socket.on('authenticate', (data) => {
    try {
      const { token, userId, examId, isAdmin } = data;
      
      // Store user info in socket (you might want to verify the token here)
      socket.userId = userId;
      socket.examId = examId;
      socket.isAdmin = isAdmin;
      
      // Join appropriate rooms
      if (isAdmin) {
        socket.join('admin-dashboard');
        console.log(`👨‍💼 Admin ${userId} joined admin dashboard`);
      } else {
        socket.join(`exam-${examId}`);
        socket.join(`user-${userId}`);
        console.log(`👨‍🎓 User ${userId} joined exam ${examId}`);
      }
      
      socket.emit('authenticated', { 
        success: true, 
        message: 'Successfully authenticated',
        socketId: socket.id 
      });
      
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      socket.emit('auth-error', { message: 'Authentication failed' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 WebSocket disconnected: ${socket.id}`);
  });
  
  // Handle ping for connection testing
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Connect to Database
app.get("/live", (req, res) => {
  res.status(200).json({ message: "Server is live" });
});

// Periodically clean up stale exam attendances (every 30 minutes)
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
      server.listen(currentPort, () => {
        console.log(`🚀 Server running on http://localhost:${currentPort}`);
        console.log(`🔌 WebSocket server running on ws://localhost:${currentPort}`);
        console.log(`💻 Host: localhost, Port: ${currentPort}`);
        
        // Log CORS configuration
        console.log('🔒 CORS Configuration:');
        console.log(`   Origin: ${typeof config.cors.origin === 'object' ? JSON.stringify(config.cors.origin) : config.cors.origin}`);
        console.log(`   Methods: ${config.cors.methods.join(', ')}`);
        console.log(`   Headers: ${config.cors.allowedHeaders}`);
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