/**
 * Create a test session for authentication testing
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
const Session = require('./models/session.model');
const User = require('./models/user.model');
const ExamAttendance = require('./models/examAttendance.model');

async function createTestAuth() {
  try {
    console.log('🔧 Creating test session for authentication...');
    
    // Find the user with the specified email
    const user = await User.findOne({ email: 'ap975498@gmail.com' });
    
    if (!user) {
      console.error('❌ User ap975498@gmail.com not found in database');
      return;
    }
    
    console.log(`✅ Found user: ${user.email} (ID: ${user._id})`);
    
    // Create a new session
    const session = new Session({
      userId: user._id,
      isActive: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });
    
    await session.save();
    
    console.log('✅ Test session created successfully!');
    console.log(`   Session ID: ${session._id}`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   User Email: ${user.email}`);
    console.log(`   Expires: ${session.expiresAt}`);
    
    // Check for IN_PROGRESS exam attendance
    const attendance = await ExamAttendance.findOne({
      userId: user._id,
      status: 'IN_PROGRESS'
    });
    
    if (attendance) {
      console.log('✅ Found IN_PROGRESS exam attendance:');
      console.log(`   Attendance ID: ${attendance._id}`);
      console.log(`   Exam ID: ${attendance.examId}`);
      console.log(`   Status: ${attendance.status}`);
      
      console.log('\n🔍 Test the monitoring endpoint with:');
      console.log(`curl -X POST http://localhost:3000/api/exam-attendance/${attendance.examId}/start-monitoring \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -H "Authorization: ${session._id}"`);
    } else {
      console.log('⚠️ No IN_PROGRESS exam attendance found for this user');
      console.log('   Run create_test_session.js first to create test exam data');
    }
    
  } catch (error) {
    console.error('❌ Error creating test auth:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
  }
}

// Wait a bit for connection then create test session
setTimeout(createTestAuth, 1000);
