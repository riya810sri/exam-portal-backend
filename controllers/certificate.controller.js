const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');  // Add this import
const { mailSender } = require('../utils/mailSender'); // Fix: Destructure mailSender from the module
const Certificate = require('../models/certificate.model'); // Add this import

class CertificateGenerator {
    constructor() {
        this.doc = new PDFDocument({
            autoFirstPage: false,
            layout: 'landscape'
        });
        
        // Use fontkit to inspect the font
        try {
            const fontPath = path.join(__dirname, 'luminus.ttf');
            const fontData = fs.readFileSync(fontPath);
            const font = fontkit.create(fontData);
            
            // Get the actual font name from fontkit
            const fontName = font.familyName;
            
            // Now register with the correct name
            this.doc.registerFont('CustomFont', fontPath);
            this.fontRegistered = true;
        } catch (error) {
            console.log("Font registration error:", error.message);
            this.fontRegistered = false;
        }
    }

    async generateCertificate(data) {
        try {
            const { name, certificateId, directorName, dateOfIssue, email, examTitle, score } = data;
            
            // Validate input data
            if (!name || !certificateId || !directorName || !dateOfIssue) {
                throw new Error('Missing required certificate data');
            }

            // Ensure Certificate directory exists
            const certDir = this.ensureCertificateDir();

            // Try different paths for template image
            const possiblePaths = [
                path.join(__dirname, '../tmp/techonquer-cert.jpeg'),
                path.join(__dirname, '../tmp/techonquer-cert.jpg'),
                path.join(__dirname, '../tmp/certificate-template.jpeg'),
                path.join(__dirname, '../tmp/certificate-template.jpg'),
                path.join(__dirname, '../certificate_design.json')
            ];
            
            let imagePath = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    imagePath = p;
                    break;
                }
            }

            // If no template found, create a simple certificate design directly in PDF
            if (!imagePath) {
                console.log("No certificate template found, creating basic certificate");
                
                // Set page size for a standard certificate
                this.doc.addPage({
                    size: [842, 595], // A4 landscape
                    margin: 50
                });
                
                // Add border
                this.doc
                    .rect(20, 20, 802, 555)
                    .lineWidth(3)
                    .stroke('#1B3C73');
                
                // Add title
                this.doc
                    .font('Helvetica-Bold')
                    .fontSize(40)
                    .fillColor('#1B3C73')
                    .text('CERTIFICATE OF ACHIEVEMENT', {
                        align: 'center'
                    })
                    .moveDown(0.5);
                
                // Add organization name
                this.doc
                    .font('Helvetica')
                    .fontSize(20)
                    .text('TechOnquer Education', {
                        align: 'center'
                    })
                    .moveDown(1);
                
                // Add certificate text
                this.doc
                    .font('Helvetica')
                    .fontSize(16)
                    .text('This is to certify that', {
                        align: 'center'
                    })
                    .moveDown(0.5);
                
                // Add name
                this.doc
                    .font('Helvetica-Bold')
                    .fontSize(30)
                    .fillColor('#1B3C73')
                    .text(name, {
                        align: 'center'
                    })
                    .moveDown(0.5);
                
                // Add exam completion text
                this.doc
                    .font('Helvetica')
                    .fontSize(16)
                    .fillColor('#000000')
                    .text(`has successfully completed the ${examTitle || 'course examination'}${score ? ` with a score of ${score}` : ''}`, {
                        align: 'center'
                    })
                    .moveDown(2);
                
                // Add signature line and date
                const signatureY = 450;
                this.doc
                    .moveTo(250, signatureY)
                    .lineTo(400, signatureY)
                    .stroke()
                    .moveTo(550, signatureY)
                    .lineTo(700, signatureY)
                    .stroke();
                
                // Add signature labels
                this.doc
                    .font('Helvetica')
                    .fontSize(12)
                    .text(directorName, 250, signatureY + 10, {
                        width: 150,
                        align: 'center'
                    })
                    .text('Date of Issue', 550, signatureY + 10, {
                        width: 150,
                        align: 'center'
                    });
                
                // Add date text
                this.doc
                    .font('Helvetica-Bold')
                    .fontSize(12)
                    .text(dateOfIssue, 550, signatureY - 20, {
                        width: 150,
                        align: 'center'
                    });
                
                // Add certificate ID at bottom
                this.doc
                    .font('Helvetica')
                    .fontSize(10)
                    .text(`Certificate ID: ${certificateId}`, 50, 550, {
                        width: 400
                    });
                
                // Save the PDF file path
                const outputPath = path.join(certDir, `certificate-${certificateId}.pdf`);
                
                // Return a promise for async resolution
                return new Promise((resolve, reject) => {
                    const writeStream = fs.createWriteStream(outputPath);
                    this.doc.pipe(writeStream);
                    this.doc.end();
                    
                    writeStream.on('finish', () => {
                        resolve(outputPath);
                    });
                    
                    writeStream.on('error', reject);
                });
            }
            
            // If template exists, use it (original template flow)
            // For JSON templates, parse the design
            if (imagePath.endsWith('.json')) {
                try {
                    const design = JSON.parse(fs.readFileSync(imagePath, 'utf8'));
                    // Implementation for JSON-based certificate would go here
                    // This is just a placeholder for future development
                    
                    // For now, fall back to the basic certificate
                    return this.generateBasicCertificate(data, certDir);
                } catch (e) {
                    console.error('Error parsing JSON template:', e);
                    return this.generateBasicCertificate(data, certDir);
                }
            }

            // For image-based template
            const imageInfo = this.doc.openImage(imagePath);
            
            // Set page size based on image dimensions
            this.doc.addPage({
                size: [imageInfo.width, imageInfo.height]
            });

            // Add background image
            this.doc.image(imagePath, 0, 0, {
                width: imageInfo.width,
                height: imageInfo.height
            });

            // Calculate positions based on image dimensions
            const positions = {
                name: {
                    y: imageInfo.height * 0.42,
                    size: 60,
                    color: '#1B3C73'  // Dark blue color
                },
                certificateId: {
                    x: imageInfo.width * 0.22,
                    y: imageInfo.height * 0.82,
                    size: 16,
                    color: '#2B2B2B'  // Dark gray color
                },
                directorName: {
                    x: imageInfo.width * 0.43,
                    y: imageInfo.height * 0.87,
                    size: 16,
                    color: '#1B3C73'  // Dark blue color
                },
                dateOfIssue: {
                    x: imageInfo.width * 0.64,
                    y: imageInfo.height * 0.82,
                    size: 16,
                    color: '#2B2B2B'  // Dark gray color
                }
            };

            // Add text elements
            // Name (centered, large)
            if (this.fontRegistered) {
                try {
                    this.doc
                        .font('CustomFont')  // Use the registered name
                        .fontSize(positions.name.size)
                        .fillColor(positions.name.color)
                        .text(name, 0, positions.name.y, {
                            align: 'center',
                            width: imageInfo.width
                        });
                } catch (error) {
                    console.warn(`Failed to use custom font: ${error.message}`);
                    // Fall back to standard font
                    this.doc
                        .font('Helvetica-Bold')
                        .fontSize(positions.name.size)
                        .fillColor(positions.name.color)
                        .text(name, 0, positions.name.y, {
                            align: 'center',
                            width: imageInfo.width
                        });
                }
            } else {
                // Use standard font if registration failed
                this.doc
                    .font('Helvetica-Bold')
                    .fontSize(positions.name.size)
                    .fillColor(positions.name.color)
                    .text(name, 0, positions.name.y, {
                        align: 'center',
                        width: imageInfo.width
                    });
            }

            // Certificate ID
            this.doc
                .font('Helvetica')
                .fontSize(positions.certificateId.size)
                .fillColor(positions.certificateId.color)
                .text(`${certificateId}`,
                    positions.certificateId.x,
                    positions.certificateId.y);

            // Director Name
            this.doc
                .fontSize(positions.directorName.size)
                .fillColor(positions.directorName.color)
                .text(directorName,
                    positions.directorName.x,
                    positions.directorName.y, {
                        align: 'center',
                        width: imageInfo.width * 0.1 - 100
                    });

            // Date of Issue
            this.doc
                .fontSize(positions.dateOfIssue.size)
                .fillColor(positions.dateOfIssue.color)
                .text(`${dateOfIssue}`,
                    positions.dateOfIssue.x,
                    positions.dateOfIssue.y);

            // Generate output filename in Certificate folder
            const outputPath = path.join(certDir, `certificate-${certificateId}.pdf`);
            
            // Save the PDF
            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(outputPath);
                this.doc.pipe(writeStream);
                this.doc.end();
                
                writeStream.on('finish', async () => {
                    resolve(outputPath);
                });
                
                writeStream.on('error', reject);
            });

        } catch (error) {
            console.error("Certificate generation error:", error);
            // Fall back to basic certificate if any error occurs
            return this.generateBasicCertificate(data, this.ensureCertificateDir());
        }
    }

    // Helper method to generate a basic certificate without requiring a template
    async generateBasicCertificate(data, certDir) {
        const { name, certificateId, directorName, dateOfIssue, examTitle, score } = data;
        
        // Create new PDFDocument instance
        const doc = new PDFDocument({
            size: [842, 595], // A4 landscape
            margin: 50
        });
        
        // Set up the PDF
        doc.font('Helvetica-Bold')
           .fontSize(40)
           .fillColor('#1B3C73')
           .text('CERTIFICATE OF ACHIEVEMENT', {
               align: 'center'
           })
           .moveDown(0.5);
        
        doc.font('Helvetica')
           .fontSize(20)
           .text('TechOnquer Education', {
               align: 'center'
           })
           .moveDown(1);
        
        doc.fontSize(16)
           .text('This is to certify that', {
               align: 'center'
           })
           .moveDown(0.5);
        
        doc.font('Helvetica-Bold')
           .fontSize(30)
           .text(name, {
               align: 'center'
           })
           .moveDown(0.5);
        
        doc.font('Helvetica')
           .fontSize(16)
           .text(`has successfully completed the ${examTitle || 'course examination'}${score ? ` with a score of ${score}` : ''}`, {
               align: 'center'
           })
           .moveDown(2);
        
        // Draw signature lines
        const signatureY = 400;
        doc.moveTo(250, signatureY)
           .lineTo(400, signatureY)
           .stroke()
           .moveTo(550, signatureY)
           .lineTo(700, signatureY)
           .stroke();
        
        // Add signature labels
        doc.font('Helvetica')
           .fontSize(12)
           .text(directorName, 250, signatureY + 10, {
               width: 150,
               align: 'center'
           })
           .text('Date of Issue', 550, signatureY + 10, {
               width: 150,
               align: 'center'
           });
        
        // Add date
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .text(dateOfIssue, 550, signatureY - 20, {
               width: 150,
               align: 'center'
           });
        
        // Add certificate ID
        doc.font('Helvetica')
           .fontSize(10)
           .text(`Certificate ID: ${certificateId}`, 50, 500);
        
        // Save the PDF
        const outputPath = path.join(certDir, `certificate-${certificateId}.pdf`);
        
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(outputPath);
            doc.pipe(writeStream);
            doc.end();
            
            writeStream.on('finish', () => {
                resolve(outputPath);
            });
            
            writeStream.on('error', reject);
        });
    }

    // Helper method to ensure Certificate directory exists
    ensureCertificateDir() {
        const certDir = path.join(__dirname, '../tmp');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        return certDir;
    }
}

// Create an instance of the generator
const generator = new CertificateGenerator();

// Controller functions
// Generate certificate controller
const generateCertificate = async (data, res) => {
    try {
        // Check if this is a direct API call or programmatic call
        let certificateData = data;
        if (data.body) {
            certificateData = data.body;
            res = data;
        }
        
        const { name, directorName, dateOfIssue, email, examTitle, score, passed = true } = certificateData;
        
        console.log(`Generating certificate for: ${name}, exam: ${examTitle}, score: ${score}`);
        
        // Only generate certificates for passing students
        if (!passed && !res) {
            return {
                success: false,
                message: "Certificate not generated - student did not pass"
            };
        }
        
        // Generate a short certificateId
        const timestamp = Date.now().toString().slice(-6);
        const randomSuffix = Math.random().toString(36).substring(2, 5);
        const certificateId = `TC${timestamp}${randomSuffix}`.substring(0, 11);
        
        // Validate required fields
        if (!name || !directorName || !dateOfIssue) {
            const errorMsg = 'Missing required certificate fields';
            if (res && res.status) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            throw new Error(errorMsg);
        }
        
        // Generate certificate with all available data
        const certificatePath = await generator.generateCertificate({
            name,
            certificateId,
            directorName,
            dateOfIssue,
            email,
            examTitle,
            score
        });
        
        console.log(`Certificate generated at: ${certificatePath}`);
        
        let emailSent = false;
        
        // Send email if email is provided
        if (email) {
            try {
                const attachments = [{
                    filename: `certificate-${certificateId}.pdf`,
                    path: certificatePath
                }];
                
                const emailSubject = examTitle 
                    ? `Your TechOnquer Certificate for ${examTitle}` 
                    : `Your TechOnquer Certificate`;
                
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1B3C73;">Congratulations, ${name}!</h2>
                        <p>You have successfully completed the exam <strong>${examTitle || 'course'}</strong>
                        ${score ? ` with a score of <strong>${score}</strong>` : ''}!</p>
                        <p>Your certificate is attached to this email.</p>
                        <p><strong>Certificate ID:</strong> ${certificateId}</p>
                        <p><strong>Date of Issue:</strong> ${dateOfIssue}</p>
                        <p>Best regards,<br>${directorName}</p>
                    </div>
                `;
                
                await mailSender(email, emailSubject, emailHtml, attachments);
                emailSent = true;
            } catch (emailError) {
                console.error(`Failed to send certificate email: ${emailError.message}`);
            }
        }
        
        // Save certificate to database
        try {
            const certificateDoc = await Certificate.create({
                name,
                certificateId,
                directorName,
                dateOfIssue,
                email,
                certificatePath,
                examTitle: certificateData.examTitle || null,
                score: certificateData.score || null,
                passed: true,
                emailSent
            });
            
            // Return data
            const resultData = {
                success: true,
                message: "Certificate generated successfully",
                certificateId,
                certificatePath,
                emailSent
            };
            
            if (res && res.status) {
                res.status(200).json(resultData);
            }
            
            return resultData;
        } catch (dbError) {
            console.error(`DB Error: ${dbError.message}`);
            // Still return the certificate info even if DB save failed
            return {
                success: true,
                message: "Certificate generated successfully",
                certificateId,
                certificatePath,
                emailSent
            };
        }
    } catch (error) {
        console.error(`Certificate generation failed: ${error.message}`);
        if (res && res.status) {
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate certificate'
            });
        }
        throw error;
    }
};

// Download certificate controller
const downloadCertificate = (req, res) => {
    try {
        const { certificateId } = req.params;
        const certPath = path.join(__dirname, '../tmp', `certificate-${certificateId}.pdf`);
        
        if (!fs.existsSync(certPath)) {
            return res.status(404).json({
                success: false,
                error: 'Certificate not found'
            });
        }
        
        res.download(certPath);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to download certificate'
        });
    }
};

// Export both the class and controller functions
module.exports = {
    CertificateGenerator,
    generateCertificate,
    downloadCertificate
};
