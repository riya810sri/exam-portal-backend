const mongoose = require("mongoose");
const config = require("./config");

const connectDB = async () => {
    try {
        // Get the MongoDB URI from the right location in the config object
        const mongoUri = config.db.url;
        
        if (!mongoUri) {
            throw new Error("MongoDB connection URI is not defined. Check your .env file for DB_URL or MONGO_URI");
        }
        
        // Connect to MongoDB with appropriate options
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: config.db.options.serverSelectionTimeoutMS || 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log("✅ Database Connected Successfully");
    } catch (error) {
        console.error("❌ Database Connection Failed:", error.message);
        console.error("Check that your MongoDB server is running and accessible");
        
        // Safely log the connection URL (hide password if present)
        if (config.db && config.db.url) {
            console.error("Connection URL:", config.db.url.replace(/:([^:@]+)@/, ':****@'));
        } else {
            console.error("Connection URL is not defined");
        }
        
        process.exit(1);
    }
};

module.exports = connectDB;
