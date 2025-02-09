const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const Session = require("../models/session.model");

const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({
      email: email,
      username: username,
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email or username" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });
    await newUser.save();
    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      res.status(404).json({ message: "User not found" });
    }
    const authenticate = await bcrypt.compare(password, user.password);
    if (authenticate) {
      const session = new Session({ userId: user.id });
      await session.save();
      res.status(200).json({
        message: "Login successful",
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        sessionId: session._id,
      });
    } else {
      res.status(401).json({ message: "password not match" });
    }
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

module.exports = { loginUser, registerUser };
