const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const roleController = require("../controllers/role.controller");

// Define fallback function
const fallback = (methodName) => (req, res) => 
  res.status(501).json({ message: `${methodName} not implemented yet` });

// According to roleConfig.js, only admins have access to all role endpoints
// GET /api/role - List all roles
router.get("/", 
  authenticateUser, 
  checkRole("admin"),
  roleController.getRoles || fallback("getRoles")
);

// GET /api/role/:id - Get a single role
router.get("/:id", 
  authenticateUser, 
  checkRole("admin"),
  roleController.getRole || fallback("getRole")
);

// POST /api/role - Create a new role
router.post("/", 
  authenticateUser, 
  checkRole("admin"),
  roleController.createRole || fallback("createRole")
);

// PUT /api/role/:id - Update a role
router.put("/:id", 
  authenticateUser, 
  checkRole("admin"),
  roleController.updateRole || fallback("updateRole")
);

// DELETE /api/role/:id - Delete a role
router.delete("/:id", 
  authenticateUser, 
  checkRole("admin"),
  roleController.deleteRole || fallback("deleteRole")
);

// POST /api/role/assign - Assign role to user
router.post("/assign", 
  authenticateUser, 
  checkRole("admin"),
  roleController.assignRole || fallback("assignRole")
);

// GET /api/role/:roleId/permissions - List permissions by role
router.get("/:roleId/permissions", 
  authenticateUser,
  checkRole("admin"),
  roleController.getRolePermissions || fallback("getRolePermissions")
);

// PUT /api/role/:roleId/permissions - Update role permissions
router.put("/:roleId/permissions", 
  authenticateUser,
  checkRole("admin"),
  roleController.updateRolePermissions || fallback("updateRolePermissions")
);

module.exports = router;
