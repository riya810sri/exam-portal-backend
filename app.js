const express = require("express");
const cors = require("cors"); // Make sure this is installed
const db = require('./config/db'); // Ensure this is the correct path to your db.js file
const config = require("./config/config");
require("dotenv").config();
const { transporter } = require("./utils/emailUtils");
const net = require('net'); // Added for port checking

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");
const examRoutes = require("./routes/exams.routes");
const questionRoutes = require("./routes/questions.routes");
const roleRoutes = require("./routes/role.routes");
const certificateRoutes = require("./routes/certificate.routes");
const examAttendanceRoutes = require("./routes/examAttendance.routes");

const app = express();
const PORT = process.env.PORT || 3456;

// CORS configuration using settings from config.js
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: true, // Allow cookies to be sent in cross-origin requests
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Middleware
app.use(cors());
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

// Connect to Database
app.get("/live", (req, res) => {
  res.status(200).json({ message: "Server is live" });
});

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