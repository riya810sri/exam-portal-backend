// Test script for monitoring endpoint
const mongoose = require('mongoose');
const config = require('./config/config');
const ExamAttendance = require('./models/examAttendance.model');
const fetch = require('node-fetch');

// Connect to the database
mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Test data provided by the user
const examId = '68274422db1570c33bfef3a9';
const userId = '6839f5c5c1224dddba8b10ce'; // From the token
const authToken = '683be61a14acff0e8c26e5e2'; // Simple token format

async function createTestSession() {
  try {
    console.log('🔧 Creating test IN_PROGRESS exam session...');
    
    // Clean up any existing IN_PROGRESS records for this user/exam
    await ExamAttendance.deleteMany({
      userId: mongoose.Types.ObjectId(userId),
      examId: mongoose.Types.ObjectId(examId),
      status: 'IN_PROGRESS'
    });
    
    // Create a new IN_PROGRESS exam session
    const testAttendance = new ExamAttendance({
      examId: mongoose.Types.ObjectId(examId),
      userId: mongoose.Types.ObjectId(userId),
      totalQuestions: 5, // Example value
      startTime: new Date(),
      status: 'IN_PROGRESS',
      attemptNumber: 1,
      score: 0,
      attemptedQuestions: 0
    });
    
    await testAttendance.save();
    
    console.log('✅ Test IN_PROGRESS session created successfully!');
    console.log(`   Session ID: ${testAttendance._id}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Exam ID: ${examId}`);
    console.log(`   Status: ${testAttendance.status}`);
    console.log(`   Started: ${testAttendance.startTime}`);
    
    return testAttendance;
  } catch (error) {
    console.error('❌ Error creating test session:', error.message);
    console.error(error.stack);
    return null;
  }
}

async function testMonitoringEndpoint(attendance) {
  try {
    console.log('\n🔍 Testing the monitoring endpoint...');
    
    // Test both formats of the endpoint to see which one works
    const endpoints = [
      `http://localhost:3000/api/exam-attendance/${examId}/start-monitoring`,
      `http://localhost:3000/api/exam-attendance/start-monitoring/${examId}`
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\nTesting endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
          'Origin': 'http://localhost:3001'
        },
        body: JSON.stringify({
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
          screenResolution: '1920x1080',
          timezone: 'Asia/Kolkata',
          browserFingerprint: {
            canvas: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAZJElEQVR4Xu1c...',
            webGL: 'Mozilla - Radeon R9 200 Series, or similar - WebGL 1.0',
            fonts: ['Arial', 'Times New Roman'],
            plugins: ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF']
          }
        })
      });
      
      const result = await response.json();
      console.log('Response status:', response.status);
      console.log('Response body:', result);
    }
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Test completed and database disconnected');
  }
}

// Run the test
(async () => {
  const attendance = await createTestSession();
  if (attendance) {
    await testMonitoringEndpoint(attendance);
  }
})();
