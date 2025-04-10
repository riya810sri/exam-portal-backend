const express = require('express');
const router = express.Router();
const { authenticateUser } = require("../middlewares/auth.middleware");
const { checkRoleAccess } = require("../middlewares/role.middleware");
const { checkRole } = require("../middlewares/permissions.middleware");
const { generateCertificate, downloadCertificate } = require('../controllers/certificate.controller');

// Fallback for missing implementations
const fallback = (methodName) => (req, res) => 
  res.status(501).json({ message: `${methodName} not implemented yet` });

/**
 * Certificate routes
 */
// Only admin can generate certificates
router.post('/generate-certificate', authenticateUser, checkRole("admin"), 
  generateCertificate ? generateCertificate : fallback("generateCertificate")
);

// Any authenticated user can download certificates
router.get('/:certificateId', authenticateUser, 
  downloadCertificate ? downloadCertificate : fallback("downloadCertificate")
);

module.exports = router;