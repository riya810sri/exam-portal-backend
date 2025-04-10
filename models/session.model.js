const mongoose = require('mongoose');

// Define the schema for the session
const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Reference the User model
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // automatically delete after 24 hours (in seconds)
    }
});

// Create the model from the schema
const Session = mongoose.model('Session', sessionSchema);

// Export the model to use in other parts of your application
module.exports = Session;