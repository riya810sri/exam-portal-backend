/**
 * This script verifies the correct functioning of exam attendance status
 * It creates a test attendance record and verifies its status
 */

const mongoose = require('mongoose');
const config = require('./config/config');
const attendanceUtils = require('./utils/attendanceUtils');

// Connect to database with longer timeout
mongoose.connect(config.db.url, {
  ...config.db.options,
  serverSelectionTimeoutMS: 30000 // Increase timeout to 30 seconds
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import models after connection
const ExamAttendance = require('./models/examAttendance.model');
const Exam = require('./models/exam.model');
const User = require('./models/user.model');

async function testAttendanceStatus() {
  try {
    console.log('🔍 Testing attendance status functionality...');
    
    // Find a valid user and exam for testing
    console.log('Finding user and exam...');
    const user = await User.findOne();
    const exam = await Exam.findOne();
    
    console.log('User:', user ? user._id : 'Not found');
    console.log('Exam:', exam ? exam._id : 'Not found');
    
    if (!user || !exam) {
      console.error('❌ Test failed: No user or exam found in database');
      return;
    }
    
    console.log(`Using user: ${user.email}, exam: ${exam.title}`);
    
    // Clean up any existing test records
    await ExamAttendance.deleteMany({
      userId: user._id,
      examId: exam._id,
      status: 'IN_PROGRESS'
    });
    
    // Get next attempt number
    const nextAttemptNumber = await attendanceUtils.getNextAttemptNumber(user._id, exam._id);
    console.log(`Next attempt number: ${nextAttemptNumber}`);
    
    // Create a test attendance record
    const attendance = new ExamAttendance({
      examId: exam._id,
      userId: user._id,
      totalQuestions: exam.sections?.mcqs?.length || 5,
      startTime: new Date(),
      status: 'IN_PROGRESS',
      attemptNumber: nextAttemptNumber
    });
    
    await attendance.save();
    console.log(`Created test attendance record with ID: ${attendance._id}`);
    
    // Verify the record was created with correct status
    const savedAttendance = await ExamAttendance.findById(attendance._id);
    
    if (!savedAttendance) {
      console.error('❌ Test failed: Could not find saved attendance record');
      return;
    }
    
    console.log(`Attendance record status: ${savedAttendance.status}`);
    console.log(`Attendance record attempt number: ${savedAttendance.attemptNumber}`);
    
    // Get detailed status using utility function
    const statusInfo = attendanceUtils.getDetailedStatus(savedAttendance);
    console.log('\nDetailed Status Information:');
    console.log(JSON.stringify(statusInfo, null, 2));
    
    // Verify inProgress flag
    if (statusInfo.inProgress !== true) {
      console.error('❌ Test failed: inProgress flag should be true');
    } else {
      console.log('✅ inProgress flag is correctly set to true');
    }
    
    // Verify status is IN_PROGRESS
    if (statusInfo.status !== 'IN_PROGRESS') {
      console.error('❌ Test failed: status should be IN_PROGRESS');
    } else {
      console.log('✅ status is correctly set to IN_PROGRESS');
    }
    
    // Clean up the test record
    await ExamAttendance.findByIdAndDelete(attendance._id);
    console.log('✅ Test completed and test record cleaned up');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
  }
}

// Wait a bit for connection then run test
setTimeout(testAttendanceStatus, 3000);
