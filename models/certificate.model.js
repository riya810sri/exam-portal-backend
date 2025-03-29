const mongoose = require('mongoose');

// Define certificate schema
const certificateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    certificateId: {
        type: String,
        required: [true, 'Certificate ID is required'],
        unique: true,
        trim: true
    },
    directorName: {
        type: String,
        required: [true, 'Director name is required'],
        trim: true
    },
    dateOfIssue: {
        type: String,
        required: [true, 'Date of issue is required'],
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    certificatePath: {
        type: String,
        trim: true
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    examTitle: {
        type: String,
        trim: true
    },
    score: {
        type: String,
        trim: true
    },
    passed: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create the model
const Certificate = mongoose.model('Certificate', certificateSchema);

module.exports = Certificate;