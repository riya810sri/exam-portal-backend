/**
 * Test script for the report-cheating endpoint
 * Tests different scenarios to ensure our fix is robust
 */

const mongoose = require('mongoose');
const config = require('./config/config');
const ExamAttendance = require('./models/examAttendance.model');
const Session = require('./models/session.model');
const User = require('./models/user.model');
const fetch = require('node-fetch');

// Connect to database
mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Test data
const examId = '683430d16db3c277cd1b0ded';  // The exam ID from the error message
let sessionId = null;

// Create a test session for authentication
async function createTestSession() {
  try {
    console.log('🔧 Creating test session for authentication...');
    
    // Find a user
    const user = await User.findOne();
    
    if (!user) {
      console.error('❌ No user found in database');
      return null;
    }
    
    console.log(`✅ Found user: ${user.email}`);
    
    // Create a new session
    const session = new Session({
      userId: user._id,
      createdAt: new Date()
    });
    
    await session.save();
    
    console.log('✅ Test session created successfully!');
    console.log(`   Session ID: ${session._id}`);
    
    return {
      sessionId: session._id.toString(),
      userId: user._id.toString()
    };
  } catch (error) {
    console.error('❌ Error creating test session:', error.message);
    return null;
  }
}

// Test reporting a cheating incident when no exam exists
async function testReportCheatingNoExam(sessionInfo) {
  try {
    console.log('\n🔍 TEST 1: Reporting cheating with no active exam...');
    
    // Delete any existing exam attendance records for this exam/user
    await ExamAttendance.deleteMany({
      examId: mongoose.Types.ObjectId(examId),
      userId: mongoose.Types.ObjectId(sessionInfo.userId)
    });
    
    const response = await fetch(`http://localhost:3000/api/exam-attendance/${examId}/report-cheating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionInfo.sessionId,
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({
        evidenceType: 'TAB_SWITCH',
        details: {
          switchCount: 1,
          hiddenTime: 15,
          visibilityState: 'hidden'
        }
      })
    });
    
    const result = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log('Response body:', result);
    
    // Verify that a new record was created
    const newAttendance = await ExamAttendance.findOne({
      examId: mongoose.Types.ObjectId(examId),
      userId: mongoose.Types.ObjectId(sessionInfo.userId),
      status: 'SUSPICIOUS_ACTIVITY'
    });
    
    if (newAttendance) {
      console.log('✅ Successfully created new SUSPICIOUS_ACTIVITY record');
      return true;
    } else {
      console.error('❌ Failed to create SUSPICIOUS_ACTIVITY record');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing report-cheating with no exam:', error.message);
    return false;
  }
}

// Test reporting a cheating incident with a completed exam
async function testReportCheatingCompletedExam(sessionInfo) {
  try {
    console.log('\n🔍 TEST 2: Reporting cheating with a COMPLETED exam...');
    
    // Create a completed exam attendance record
    const completedAttendance = new ExamAttendance({
      examId: mongoose.Types.ObjectId(examId),
      userId: mongoose.Types.ObjectId(sessionInfo.userId),
      status: 'COMPLETED',
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(),
      totalQuestions: 10,
      attemptedQuestions: 10,
      score: 8
    });
    
    await completedAttendance.save();
    console.log(`Created COMPLETED exam attendance: ${completedAttendance._id}`);
    
    const response = await fetch(`http://localhost:3000/api/exam-attendance/${examId}/report-cheating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionInfo.sessionId,
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({
        evidenceType: 'COPY_PASTE',
        details: {
          content: 'Copied text',
          location: 'question-1'
        }
      })
    });
    
    const result = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log('Response body:', result);
    
    // Verify that the evidence was added to the existing record
    const updatedAttendance = await ExamAttendance.findById(completedAttendance._id);
    
    if (updatedAttendance && updatedAttendance.cheatEvidence && updatedAttendance.cheatEvidence.length > 0) {
      console.log('✅ Successfully added evidence to COMPLETED record');
      console.log(`   Evidence count: ${updatedAttendance.cheatEvidence.length}`);
      return true;
    } else {
      console.error('❌ Failed to add evidence to COMPLETED record');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing report-cheating with completed exam:', error.message);
    return false;
  }
}

// Test reporting a cheating incident with an in-progress exam
async function testReportCheatingInProgressExam(sessionInfo) {
  try {
    console.log('\n🔍 TEST 3: Reporting cheating with an IN_PROGRESS exam...');
    
    // Create an in-progress exam attendance record
    const inProgressAttendance = new ExamAttendance({
      examId: mongoose.Types.ObjectId(examId),
      userId: mongoose.Types.ObjectId(sessionInfo.userId),
      status: 'IN_PROGRESS',
      startTime: new Date(),
      totalQuestions: 10,
      attemptedQuestions: 3
    });
    
    await inProgressAttendance.save();
    console.log(`Created IN_PROGRESS exam attendance: ${inProgressAttendance._id}`);
    
    const response = await fetch(`http://localhost:3000/api/exam-attendance/${examId}/report-cheating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionInfo.sessionId,
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({
        evidenceType: 'PROHIBITED_KEYS',
        details: {
          key: 'F12',
          action: 'DevTools'
        }
      })
    });
    
    const result = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log('Response body:', result);
    
    // Verify that the evidence was added to the existing record
    const updatedAttendance = await ExamAttendance.findById(inProgressAttendance._id);
    
    if (updatedAttendance && updatedAttendance.cheatEvidence && updatedAttendance.cheatEvidence.length > 0) {
      console.log('✅ Successfully added evidence to IN_PROGRESS record');
      console.log(`   Evidence count: ${updatedAttendance.cheatEvidence.length}`);
      return true;
    } else {
      console.error('❌ Failed to add evidence to IN_PROGRESS record');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing report-cheating with in-progress exam:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  try {
    const sessionInfo = await createTestSession();
    if (!sessionInfo) {
      console.error('❌ Failed to create test session, aborting tests');
      process.exit(1);
    }
    
    // Run tests in sequence
    const test1Result = await testReportCheatingNoExam(sessionInfo);
    const test2Result = await testReportCheatingCompletedExam(sessionInfo);
    const test3Result = await testReportCheatingInProgressExam(sessionInfo);
    
    // Print summary
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log(`Test 1 (No Exam): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 2 (Completed Exam): ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 3 (In-Progress Exam): ${test3Result ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = test1Result && test2Result && test3Result;
    console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
  } catch (error) {
    console.error('❌ Error running tests:', error.message);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Tests completed and database disconnected');
  }
}

// Run the tests
runTests();
