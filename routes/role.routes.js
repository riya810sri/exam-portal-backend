const express = require("express");
const router = express.Router();
const { createRole } = require("../middlewares/role.middleware");
const { assignRoleToUser, userHasRole } = require("../middlewares/permissions.middleware");
const { authenticateUser, verifyAdmin} = require("../middlewares/auth.middleware");

router.post("/createRole", authenticateUser, verifyAdmin, async (req, res) => {
  const { id, name, description } = req.body;
  try {
    await createRole(id, name, description);
    res.status(201).send("Role created successfully");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/assignRole", authenticateUser, verifyAdmin, async (req, res) => {
  const { userId, roleId } = req.body;
  try {
    await assignRoleToUser(userId, roleId);
    res.status(201).send("Role assigned to user successfully");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/hasRole" , authenticateUser, verifyAdmin,  async (req, res) => {
  const { userId, roleId } = req.body;
  try {
    const hasRole = await userHasRole(userId, roleId);
    res.status(200).json({ hasRole });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
