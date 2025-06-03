/**
 * Debug script for studentRestrictionManager
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { StudentRestrictionManager } = require('./utils/studentRestrictionManager');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam_portal')
  .then(() => {
    console.log('Connected to MongoDB');
    runDebug()
      .then(() => {
        console.log('Debug completed');
        mongoose.connection.close();
      })
      .catch(error => {
        console.error('Debug error:', error);
        mongoose.connection.close();
      });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

async function runDebug() {
  console.log('Starting StudentRestrictionManager debug...');
  
  // Check if the class export is working
  console.log('StudentRestrictionManager class structure:', StudentRestrictionManager);
  
  // Create instance
  console.log('Creating instance...');
  const manager = new StudentRestrictionManager();
  console.log('Instance created:', manager);
  
  // Test methods
  console.log('Testing canTakeExam method...');
  console.log('Method structure:', manager.canTakeExam);
  
  // Check if StudentRestriction model has static methods
  const StudentRestriction = require('./models/studentRestriction.model');
  console.log('StudentRestriction model:', StudentRestriction);
  console.log('checkExamRestriction method:', StudentRestriction.checkExamRestriction);
  console.log('checkIPRestriction method:', StudentRestriction.checkIPRestriction);
}
