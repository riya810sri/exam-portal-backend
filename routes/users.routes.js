const express = require("express");
const router = express.Router();

const { getUserById, updateUser } = require("../controllers/users.controller");
const { deleteUser } = require("../controllers/users.controller");
const { getAllUsers } = require("../controllers/users.controller");

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.delete("/:id", deleteUser);
router.put('/:id', updateUser);

module.exports = router;
