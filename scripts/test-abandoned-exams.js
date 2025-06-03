/**
 * Test script for abandoned exam cleanup
 * This script manually runs the abandoned exam cleanup function
 */

// Load environment variables
require('dotenv').config();

// Connect to database
const mongoose = require('mongoose');
const db = require('../config/db');
const attendanceUtils = require('../utils/attendanceUtils');

async function runTest() {
  try {
    console.log('Starting abandoned exam cleanup test...');
    
    // Run the abandoned exam cleanup function
    const result = await attendanceUtils.handleAbandonedExams();
    
    console.log('Test completed successfully');
    console.log(`Updated ${result.updated} abandoned exams`);
    console.log(`Encountered ${result.errors} errors`);
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
  }
}

// Run the test
runTest(); 