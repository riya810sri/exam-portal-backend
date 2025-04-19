const express = require("express");
const cors = require("cors"); // Make sure this is installed
const db = require('./config/db'); // Ensure this is the correct path to your db.js file
const config = require("./config/config");
require("dotenv").config();
const { transporter } = require("./utils/emailUtils");

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


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💻 Host: localhost, Port: ${PORT}`);
});

// Log CORS configuration
console.log('🔒 CORS Configuration:');
console.log(`   Origin: ${typeof config.cors.origin === 'object' ? JSON.stringify(config.cors.origin) : config.cors.origin}`);
console.log(`   Methods: ${config.cors.methods.join(', ')}`);
console.log(`   Headers: ${config.cors.allowedHeaders}`);