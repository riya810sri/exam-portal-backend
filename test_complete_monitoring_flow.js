const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/user.model');
const Session = require('./models/session.model');
const Exam = require('./models/exam.model');
const ExamAttendance = require('./models/examAttendance.model');

const BASE_URL = 'http://localhost:3000';

async function createTestSession() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/exam_portal');
    console.log('Connected to MongoDB');

    // Clean up any existing test data
    await User.deleteMany({ email: 'test@example.com' });
    await Session.deleteMany({});
    
    // Create a test user
    const testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword123',
      role: 'student',
      isAdmin: false
    });
    await testUser.save();
    console.log('Test user created:', testUser._id);

    // Create a test session
    const testSession = new Session({
      userId: testUser._id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });
    await testSession.save();
    console.log('Test session created:', testSession._id);

    // Create a test exam
    const testExam = new Exam({
      title: 'Test Exam',
      description: 'Test exam for monitoring',
      duration: 60,
      questions: [],
      startTime: new Date(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      isActive: true
    });
    await testExam.save();
    console.log('Test exam created:', testExam._id);

    // Create attendance record
    const attendanceRecord = new ExamAttendance({
      exam_id: testExam._id,
      student_id: testUser._id,
      startTime: new Date(),
      isActive: true,
      status: 'in_progress'
    });
    await attendanceRecord.save();
    console.log('Attendance record created:', attendanceRecord._id);

    return {
      sessionId: testSession._id.toString(),
      userId: testUser._id.toString(),
      examId: testExam._id.toString(),
      attendanceId: attendanceRecord._id.toString()
    };

  } catch (error) {
    console.error('Error creating test session:', error);
    throw error;
  }
}

async function testMonitoringEndpoint(sessionId, examId) {
  try {
    console.log('\n=== Testing Start Monitoring Endpoint ===');
    
    const response = await axios.post(`${BASE_URL}/api/exam-attendance/start-monitoring`, {
      exam_id: examId
    }, {
      headers: {
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Start monitoring response:', response.data);
    return response.data.monit_id;

  } catch (error) {
    console.error('Error testing monitoring endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

async function testMouseEventSubmission(sessionId, examId, monitId) {
  try {
    console.log('\n=== Testing Mouse Event Submission ===');
    
    const mouseEvents = [
      {
        type: 'mousemove',
        x: 100,
        y: 200,
        timestamp: Date.now(),
        element: 'question-1',
        windowWidth: 1920,
        windowHeight: 1080
      },
      {
        type: 'click',
        x: 150,
        y: 250,
        timestamp: Date.now() + 1000,
        element: 'option-a',
        windowWidth: 1920,
        windowHeight: 1080
      }
    ];

    const response = await axios.post(`${BASE_URL}/api/exam-attendance/submit-mouse-events`, {
      exam_id: examId,
      monit_id: monitId,
      events: mouseEvents
    }, {
      headers: {
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Mouse events submission response:', response.data);
    return true;

  } catch (error) {
    console.error('Error testing mouse events:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

async function testSecurityEventSubmission(sessionId, examId, monitId) {
  try {
    console.log('\n=== Testing Security Event Submission ===');
    
    const securityEvents = [
      {
        type: 'tab_switch',
        timestamp: Date.now(),
        data: {
          from: 'exam_page',
          to: 'external_tab',
          duration: 2000
        }
      },
      {
        type: 'window_focus_lost',
        timestamp: Date.now() + 2000,
        data: {
          duration: 3000,
          reason: 'alt_tab'
        }
      }
    ];

    const response = await axios.post(`${BASE_URL}/api/exam-attendance/submit-security-events`, {
      exam_id: examId,
      monit_id: monitId,
      events: securityEvents
    }, {
      headers: {
        'Authorization': `Bearer ${sessionId}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Security events submission response:', response.data);
    return true;

  } catch (error) {
    console.error('Error testing security events:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

async function runCompleteTest() {
  try {
    console.log('=== Starting Complete Monitoring Flow Test ===\n');

    // Create test session and data
    const testData = await createTestSession();
    console.log('\nTest data created successfully');

    // Wait a moment for the server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test monitoring endpoint
    const monitId = await testMonitoringEndpoint(testData.sessionId, testData.examId);
    console.log('Monitoring ID:', monitId);

    // Test mouse event submission
    const mouseSuccess = await testMouseEventSubmission(testData.sessionId, testData.examId, monitId);
    
    // Test security event submission
    const securitySuccess = await testSecurityEventSubmission(testData.sessionId, testData.examId, monitId);

    console.log('\n=== Test Results ===');
    console.log('Mouse events test:', mouseSuccess ? 'PASSED' : 'FAILED');
    console.log('Security events test:', securitySuccess ? 'PASSED' : 'FAILED');

    if (mouseSuccess && securitySuccess) {
      console.log('\n✅ All tests PASSED! Mouse event logging is working correctly.');
    } else {
      console.log('\n❌ Some tests FAILED. Check the logs above for details.');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Clean up
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the test
runCompleteTest().catch(console.error);
