/**
 * Create a test IN_PROGRESS exam session for testing monitoring functionality
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

async function createTestSession() {
  try {
    console.log('🔧 Creating test IN_PROGRESS exam session...');
    
    // Find a user and a published exam
    const user = await User.findOne();
    const exam = await Exam.findOne({ status: 'PUBLISHED' });
    
    if (!user) {
      console.error('❌ No user found in database');
      return;
    }
    
    if (!exam) {
      console.error('❌ No published exam found in database');
      return;
    }
    
    console.log(`Using user: ${user.email}`);
    console.log(`Using exam: ${exam.title}`);
    
    // Clean up any existing IN_PROGRESS records for this user/exam
    await ExamAttendance.deleteMany({
      userId: user._id,
      examId: exam._id,
      status: 'IN_PROGRESS'
    });
    
    // Create a new IN_PROGRESS exam session
    const testAttendance = new ExamAttendance({
      examId: exam._id,
      userId: user._id,
      totalQuestions: exam.sections?.mcqs?.length || 5,
      startTime: new Date(),
      status: 'IN_PROGRESS',
      attemptNumber: 1,
      score: 0,
      attemptedQuestions: 0
    });
    
    await testAttendance.save();
    
    console.log('✅ Test IN_PROGRESS session created successfully!');
    console.log(`   Session ID: ${testAttendance._id}`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Exam ID: ${exam._id}`);
    console.log(`   Status: ${testAttendance.status}`);
    console.log(`   Started: ${testAttendance.startTime}`);
    
    console.log('\n🔍 You can now test the monitoring endpoint with:');
    console.log(`   POST /api/exam-attendance/${exam._id}/start-monitoring`);
    console.log(`   With Authorization header containing the user's token`);
    
  } catch (error) {
    console.error('❌ Error creating test session:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
  }
}

// Wait a bit for connection then create test session
setTimeout(createTestSession, 1000);
