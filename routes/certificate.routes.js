const express = require('express');
const router = express.Router();
const { 
    generateCertificate, 
    downloadCertificate 
} = require('../controllers/certificate.controller');

/**
 * Certificate routes
 */
router.post('/generate-certificate', generateCertificate);
router.get('/download-certificate/:certificateId', downloadCertificate);

module.exports = router;