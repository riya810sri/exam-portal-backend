const express = require("express");
const router = express.Router();
const { loginUser } = require("../controllers/authUsers.controller");
const { registerUser } = require("../controllers/authUsers.controller");

router.post("/login", loginUser);
router.post("/register", registerUser);

module.exports = router;
