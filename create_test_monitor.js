// Create test IN_PROGRESS exam session for monitoring
const mongoose = require('mongoose');
const config = require('./config/config');

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

// Create an IN_PROGRESS attendance record for testing
async function createTestSession() {
  try {
    // Hard-code values for testing
    const examId = '68274422db1570c33bfef3a9'; // The exam ID provided by user
    const userId = '6839f5c5c1224dddba8b10ce'; // The user ID derived from JWT token (ap975498@gmail.com)
    
    console.log('Creating test IN_PROGRESS session for:');
    console.log(`Exam ID: ${examId}`);
    console.log(`User ID: ${userId}`);
    
    // Clean up any existing IN_PROGRESS records for this user/exam
    const deleteResult = await ExamAttendance.deleteMany({
      userId,
      examId,
      status: 'IN_PROGRESS'
    });
    
    console.log(`Deleted ${deleteResult.deletedCount} existing IN_PROGRESS records`);
    
    // Create a new IN_PROGRESS exam session
    const testAttendance = new ExamAttendance({
      examId,
      userId,
      totalQuestions: 5, // Arbitrary value for testing
      startTime: new Date(),
      status: 'IN_PROGRESS',
      attemptNumber: 1,
      score: 0,
      attemptedQuestions: 0
    });
    
    await testAttendance.save();
    
    console.log('✅ Test IN_PROGRESS session created successfully!');
    console.log(`   Session ID: ${testAttendance._id}`);
    console.log(`   Status: ${testAttendance.status}`);
    
    // Verify the record was created by reading it back
    const savedRecord = await ExamAttendance.findById(testAttendance._id);
    console.log(`   Verified status: ${savedRecord.status}`);
    
    console.log('\n🔍 Now test the monitoring endpoint with:');
    console.log(`   curl -X POST http://localhost:3000/api/exam-attendance/${examId}/start-monitoring \\`);
    console.log(`   -H "Content-Type: application/json" \\`);
    console.log(`   -H "Authorization: Bearer 683be61a14acff0e8c26e5e2" \\`);
    console.log(`   -H "Origin: http://localhost:3001" \\`);
    console.log(`   --data-raw '{"userAgent":"Mozilla/5.0","screenResolution":"1920x1080","timezone":"Asia/Kolkata","browserFingerprint":{}}'`);
    
  } catch (error) {
    console.error('❌ Error creating test session:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
  }
}

// Wait a bit for connection then create test session
setTimeout(createTestSession, 3000);
