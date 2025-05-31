/**
 * This script fixes issues with exam attendance status tracking
 * It addresses:
 * 1. Incorrect IN_PROGRESS status values
 * 2. Missing attempt numbers
 * 3. Conflicting attendance records
 */

const mongoose = require('mongoose');
const config = require('./config/config');

// Connect to database
mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import models after connection
const ExamAttendance = require('./models/examAttendance.model');
const Exam = require('./models/exam.model');
const User = require('./models/user.model');

async function fixAttendanceStatus() {
  try {
    console.log('🔧 Starting attendance status fix process...');
    
    // First check for any IN_PROGRESS records with endTime set (inconsistent state)
    const inconsistentRecords = await ExamAttendance.find({
      status: 'IN_PROGRESS',
      endTime: { $ne: null }
    });
    
    console.log(`Found ${inconsistentRecords.length} inconsistent records (IN_PROGRESS with endTime set)`);
    
    // Fix these records by setting them to TIMED_OUT
    if (inconsistentRecords.length > 0) {
      const updateResult = await ExamAttendance.updateMany(
        { status: 'IN_PROGRESS', endTime: { $ne: null } },
        { status: 'TIMED_OUT' }
      );
      
      console.log(`Updated ${updateResult.modifiedCount} records from IN_PROGRESS to TIMED_OUT`);
    }
    
    // Check for any stale IN_PROGRESS records (older than 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const staleRecords = await ExamAttendance.find({
      status: 'IN_PROGRESS',
      startTime: { $lt: sixHoursAgo }
    });
    
    console.log(`Found ${staleRecords.length} stale IN_PROGRESS records (older than 6 hours)`);
    
    // Fix these records by setting them to TIMED_OUT
    if (staleRecords.length > 0) {
      const updateResult = await ExamAttendance.updateMany(
        { status: 'IN_PROGRESS', startTime: { $lt: sixHoursAgo } },
        { status: 'TIMED_OUT', endTime: new Date() }
      );
      
      console.log(`Updated ${updateResult.modifiedCount} stale records from IN_PROGRESS to TIMED_OUT`);
    }
    
    // Check for records with missing attempt numbers
    const missingAttemptRecords = await ExamAttendance.find({
      $or: [
        { attemptNumber: { $exists: false } },
        { attemptNumber: null }
      ]
    });
    
    console.log(`Found ${missingAttemptRecords.length} records with missing attempt numbers`);
    
    // Fix attempt numbers for each user and exam combination
    if (missingAttemptRecords.length > 0) {
      // Get unique user and exam combinations
      const userExamCombos = [];
      missingAttemptRecords.forEach(record => {
        const combo = `${record.userId.toString()}-${record.examId.toString()}`;
        if (!userExamCombos.includes(combo)) {
          userExamCombos.push(combo);
        }
      });
      
      console.log(`Fixing attempt numbers for ${userExamCombos.length} user-exam combinations`);
      
      // Process each combination
      for (const combo of userExamCombos) {
        const [userId, examId] = combo.split('-');
        
        // Get all records for this user and exam, sorted by start time
        const records = await ExamAttendance.find({
          userId: mongoose.Types.ObjectId(userId),
          examId: mongoose.Types.ObjectId(examId)
        }).sort({ startTime: 1 });
        
        // Assign sequential attempt numbers
        for (let i = 0; i < records.length; i++) {
          records[i].attemptNumber = i + 1;
          await records[i].save();
        }
        
        console.log(`Fixed attempt numbers for user ${userId}, exam ${examId} (${records.length} records)`);
      }
    }
    
    // Finally, check for multiple IN_PROGRESS records for the same user and exam
    // This violates the business rule - a user should have at most one IN_PROGRESS record per exam
    const userExamCounts = await ExamAttendance.aggregate([
      { $match: { status: 'IN_PROGRESS' } },
      { 
        $group: {
          _id: { userId: '$userId', examId: '$examId' },
          count: { $sum: 1 },
          records: { $push: '$_id' }
        } 
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`Found ${userExamCounts.length} user-exam combinations with multiple IN_PROGRESS records`);
    
    // Fix these by keeping only the most recent one
    for (const combo of userExamCounts) {
      const { userId, examId } = combo._id;
      
      // Get all IN_PROGRESS records for this combo, sorted by start time (descending)
      const records = await ExamAttendance.find({
        userId: mongoose.Types.ObjectId(userId),
        examId: mongoose.Types.ObjectId(examId),
        status: 'IN_PROGRESS'
      }).sort({ startTime: -1 });
      
      // Keep the most recent one, mark others as TIMED_OUT
      for (let i = 1; i < records.length; i++) {
        records[i].status = 'TIMED_OUT';
        records[i].endTime = new Date();
        await records[i].save();
      }
      
      console.log(`Fixed multiple IN_PROGRESS records for user ${userId}, exam ${examId}`);
    }
    
    // Check final counts after fixes
    const statusCounts = await ExamAttendance.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📊 Final Status Distribution After Fixes:');
    statusCounts.forEach(status => {
      console.log(`   ${status._id}: ${status.count}`);
    });
    
    console.log('\n✅ Attendance status fix process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during fix process:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
  }
}

// Wait a bit for connection then run fix process
setTimeout(fixAttendanceStatus, 1000);
