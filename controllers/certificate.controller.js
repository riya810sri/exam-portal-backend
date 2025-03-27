const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');  // Add this import
const mailSender = require('../utils/mailSender'); // Import mailSender module
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
            console.log(`Font family name: ${fontName}`);
            
            // Now register with the correct name
            this.doc.registerFont('CustomFont', fontPath);
            this.fontRegistered = true;
            console.log('Custom font registered successfully');
        } catch (error) {
            console.error(`Error loading font with fontkit: ${error.message}`);
            this.fontRegistered = false;
        }
    }

    async generateCertificate(data) {
        try {
            const { name, certificateId, directorName, dateOfIssue, email } = data;
            
            // Validate input data
            if (!name || !certificateId || !directorName || !dateOfIssue) {
                throw new Error('Missing required certificate data');
            }

            // Ensure Certificate directory exists
            const certDir = this.ensureCertificateDir();

            // Load template image
            const imagePath = path.join(__dirname, '../tmp/techonquer-cert.jpeg');
            if (!fs.existsSync(imagePath)) {
                throw new Error('Certificate template not found');
            }

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
            const outputPath = path.join(__dirname, `../tmp/certificate-${certificateId}.pdf`);
            // Save the PDF path.join(__dirname, '../tmp/techonquer-cert.jpeg');
            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(outputPath);
                this.doc.pipe(writeStream);
                this.doc.end();
                
                writeStream.on('finish', async () => {
                    console.log(`Certificate generated: ${outputPath}`);
                    resolve(outputPath);
                });
                
                writeStream.on('error', reject);
            });

        } catch (error) {
            console.error('Error generating certificate:', error);
            throw error;
        }
    }

    // Helper method to ensure Certificate directory exists
    ensureCertificateDir() {
        const certDir = path.join(__dirname, 'Certificate');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir);
            console.log('Certificate directory created');
        }
        return certDir;
    }
}

// Create an instance of the generator
const generator = new CertificateGenerator();

// Controller functions
// Generate certificate controller
const generateCertificate = (req, res) => {
    try {
        const { name, certificateId, directorName, dateOfIssue, email } = req.body;
        
        // Validate required fields
        if (!name || !certificateId || !directorName || !dateOfIssue) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        // Generate certificate
        generator.generateCertificate({
            name,
            certificateId,
            directorName,
            dateOfIssue,
            email
        })
        .then(async certificatePath => {
            let emailSent = false;
            
            // Send email if email is provided
            if (email) {
                try {
                    const attachments = [{
                        filename: `certificate-${certificateId}.pdf`,
                        path: certificatePath
                    }];
                    
                    const emailSubject = 'Your TechOnquer Certificate';
                    const emailText = `
                        <p>Dear ${name},</p>
                        <p>Congratulations on your achievement! Please find your certificate attached.</p>
                        <p>Certificate ID: ${certificateId}</p>
                        <p>Date of Issue: ${dateOfIssue}</p>
                        <p>Best regards,<br>${directorName}</p>
                    `;
                    
                    await mailSender(email, emailSubject, emailText, attachments);
                    console.log(`Certificate sent to ${email}`);
                    emailSent = false;
                } catch (emailError) {
                    console.error('Error sending email:', emailError);
                }
            }
            
            // Save certificate to database
            try {
                await Certificate.create({
                    name,
                    certificateId,
                    directorName,
                    dateOfIssue,
                    email,
                    certificatePath,
                    emailSent
                });
                console.log('Certificate saved to database');
            } catch (dbError) {
                console.error('Error saving to database:', dbError);
            }
            
            res.status(200).json({
                success: true,
                message: 'Certificate generated successfully',
                certificateId,
                path: certificatePath,
                emailSent
            });
        })
        .catch(error => {
            console.error('Error generating certificate:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate certificate'
            });
        });
        
    } catch (error) {
        console.error('Error in certificate generation controller:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate certificate'
        });
    }
};

// Download certificate controller
const downloadCertificate = (req, res) => {
    try {
        const { certificateId } = req.params;
        const certPath = path.join(process.cwd(), 'Certificate', `certificate-${certificateId}.pdf`);
        
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
