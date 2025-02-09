const User = require("../models/user.model");
const bcrypt = require('bcrypt');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    if (!users || users.length === 0) {
      return res.status(200).send({ message: "No users found", users: [] });
    }
    res.status(200).send(users);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error", details: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    res.status(200).send(user);
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error", details: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.status(200).send({ message: "User deleted successfully", user });
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error", details: error.message });
  }
};

const updateUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Find the user by ID
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the user's information
    user.username = username || user.username;
    user.email = email || user.email;

    if (password) {
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
}

module.exports = { getAllUsers, getUserById, deleteUser, updateUser };
