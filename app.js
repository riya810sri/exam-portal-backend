const express = require("express");
const connectDB = require("./config/dbConnect");
require("dotenv").config();
const { transporter } = require("./utils/emailUtils");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");
const examRoutes = require("./routes/exams.routes");
const questionRoutes = require("./routes/questions.routes");
const roleRoutes = require("./routes/role.routes");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/roles", roleRoutes);
// Connect to MongoDB
connectDB();

// Sample Route
app.get("/", (req, res) => {
  res.send("Online Exam Portal Backend is Running 🚀")});
