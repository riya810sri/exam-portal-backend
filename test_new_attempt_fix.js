/**
 * Test script to verify the new-attempt endpoint fix
 * This tests that existing sessions are preserved when appropriate
 */

const mongoose = require('mongoose');
const config = require('./config/config');
const ExamAttendance = require('./models/examAttendance.model');
const User = require('./models/users.model');
const Exam = require('./models/exams.model');
const fetch = require('node-fetch'); // You may need to install: npm install node-fetch

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  sessionId: 'Bearer 683be61a14acff0e8c26e5e2', // Test session ID
  examId: '68274422db1570c33bfef3a9', // Test exam ID
  userId: '6839f5c5c1224dddba8b10ce' // Test user ID (derived from JWT)
};

async function connectDB() {
  try {
    await mongoose.connect(config.db.url, config.db.options);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

// Create a test in-progress attendance
async function createTestSession() {
  try {
    // Clean up any existing records first
    await ExamAttendance.deleteMany({
      userId: TEST_CONFIG.userId,
      examId: TEST_CONFIG.examId,
      status: 'IN_PROGRESS'
    });

    // Create a fresh in-progress attempt
    const testAttendance = new ExamAttendance({
      examId: TEST_CONFIG.examId,
      userId: TEST_CONFIG.userId,
      status: 'IN_PROGRESS',
      startTime: new Date(),
      totalQuestions: 10,
      attemptedQuestions: 3,
      attemptNumber: 1
    });

    await testAttendance.save();
    console.log(`✅ Created test IN_PROGRESS session: ${testAttendance._id}`);
    console.log(`   - Started: ${testAttendance.startTime}`);
    console.log(`   - Attempted questions: ${testAttendance.attemptedQuestions}`);
    
    return testAttendance;
  } catch (error) {
    console.error('❌ Failed to create test session:', error.message);
    throw error;
  }
}

// Test 1: new-attempt with existing session should prompt user
async function testNewAttemptWithExistingSession() {
  console.log('\n🧪 TEST 1: new-attempt with existing session');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/exam-attendance/${TEST_CONFIG.examId}/new-attempt`, {
      method: 'GET',
      headers: {
        'Authorization': TEST_CONFIG.sessionId,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      }
    });

    const result = await response.json();
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 409) {
      console.log('✅ PASS: Got 409 conflict as expected');
      console.log('✅ PASS: System detected existing session');
      console.log(`   Message: ${result.message}`);
      console.log(`   Continue URL: ${result.continueUrl}`);
      console.log(`   Force new URL: ${result.newAttemptUrl}`);
      console.log(`   Existing attempt: #${result.existingAttempt.attemptNumber}`);
      console.log(`   Time elapsed: ${result.existingAttempt.timeElapsed} minutes`);
      return true;
    } else {
      console.log('❌ FAIL: Expected 409 status but got:', response.status);
      console.log('Response:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error testing new-attempt:', error.message);
    return false;
  }
}

// Test 2: force-new-attempt should cancel existing session
async function testForceNewAttempt() {
  console.log('\n🧪 TEST 2: force-new-attempt should cancel existing session');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/exam-attendance/${TEST_CONFIG.examId}/force-new-attempt`, {
      method: 'GET',
      headers: {
        'Authorization': TEST_CONFIG.sessionId,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      }
    });

    const result = await response.json();
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ PASS: Got 200 success for force-new-attempt');
      console.log(`   New attempt number: ${result.attemptNumber}`);
      
      // Verify old session was timed out
      const oldSession = await ExamAttendance.findOne({
        userId: TEST_CONFIG.userId,
        examId: TEST_CONFIG.examId,
        attemptNumber: 1
      });
      
      if (oldSession && oldSession.status === 'TIMED_OUT') {
        console.log('✅ PASS: Old session was properly timed out');
        return true;
      } else {
        console.log('❌ FAIL: Old session was not timed out');
        console.log('Old session status:', oldSession?.status);
        return false;
      }
    } else {
      console.log('❌ FAIL: Expected 200 status but got:', response.status);
      console.log('Response:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error testing force-new-attempt:', error.message);
    return false;
  }
}

// Test 3: continue existing session should work
async function testContinueExistingSession() {
  console.log('\n🧪 TEST 3: continue existing session should work');
  
  // First create a new test session
  const testSession = await createTestSession();
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/exam-attendance/${TEST_CONFIG.examId}/attend`, {
      method: 'GET',
      headers: {
        'Authorization': TEST_CONFIG.sessionId,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      }
    });

    const result = await response.json();
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ PASS: Got 200 success for continue session');
      console.log(`   Continued attempt number: ${result.attemptNumber}`);
      
      // Verify session is still IN_PROGRESS
      const currentSession = await ExamAttendance.findById(testSession._id);
      
      if (currentSession && currentSession.status === 'IN_PROGRESS') {
        console.log('✅ PASS: Session remained IN_PROGRESS');
        return true;
      } else {
        console.log('❌ FAIL: Session status changed unexpectedly');
        console.log('Current session status:', currentSession?.status);
        return false;
      }
    } else {
      console.log('❌ FAIL: Expected 200 status but got:', response.status);
      console.log('Response:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error testing continue session:', error.message);
    return false;
  }
}

// Test 4: stale session should be automatically timed out
async function testStaleSessionHandling() {
  console.log('\n🧪 TEST 4: stale session handling');
  
  try {
    // Create a stale session (7 hours old)
    const staleTime = new Date(Date.now() - 7 * 60 * 60 * 1000);
    
    await ExamAttendance.deleteMany({
      userId: TEST_CONFIG.userId,
      examId: TEST_CONFIG.examId,
      status: 'IN_PROGRESS'
    });

    const staleSession = new ExamAttendance({
      examId: TEST_CONFIG.examId,
      userId: TEST_CONFIG.userId,
      status: 'IN_PROGRESS',
      startTime: staleTime,
      totalQuestions: 10,
      attemptedQuestions: 2,
      attemptNumber: 1
    });

    await staleSession.save();
    console.log(`✅ Created stale session (7 hours old): ${staleSession._id}`);

    // Try new-attempt, should automatically timeout stale session
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/exam-attendance/${TEST_CONFIG.examId}/new-attempt`, {
      method: 'GET',
      headers: {
        'Authorization': TEST_CONFIG.sessionId,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      }
    });

    const result = await response.json();
    
    if (response.status === 200) {
      console.log('✅ PASS: Stale session allowed new attempt');
      
      // Verify stale session was timed out
      const updatedStaleSession = await ExamAttendance.findById(staleSession._id);
      
      if (updatedStaleSession && updatedStaleSession.status === 'TIMED_OUT') {
        console.log('✅ PASS: Stale session was automatically timed out');
        return true;
      } else {
        console.log('❌ FAIL: Stale session was not timed out');
        console.log('Stale session status:', updatedStaleSession?.status);
        return false;
      }
    } else {
      console.log('❌ FAIL: Expected 200 status but got:', response.status);
      console.log('Response:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error testing stale session:', error.message);
    return false;
  }
}

// Clean up test data
async function cleanup() {
  try {
    await ExamAttendance.deleteMany({
      userId: TEST_CONFIG.userId,
      examId: TEST_CONFIG.examId
    });
    console.log('\n🧹 Cleaned up test data');
  } catch (error) {
    console.error('⚠️ Cleanup failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting new-attempt endpoint fix tests');
  console.log('========================================');
  
  await connectDB();
  
  let totalTests = 0;
  let passedTests = 0;
  
  try {
    // Create initial test session
    await createTestSession();
    
    // Run tests
    const tests = [
      { name: 'Test 1: new-attempt with existing session', fn: testNewAttemptWithExistingSession },
      { name: 'Test 2: force-new-attempt cancels existing', fn: testForceNewAttempt },
      { name: 'Test 3: continue existing session', fn: testContinueExistingSession },
      { name: 'Test 4: stale session handling', fn: testStaleSessionHandling }
    ];
    
    for (const test of tests) {
      totalTests++;
      const result = await test.fn();
      if (result) {
        passedTests++;
      }
    }
    
    // Results
    console.log('\n📊 TEST RESULTS');
    console.log('================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! The new-attempt endpoint fix is working correctly.');
    } else {
      console.log('\n❌ Some tests failed. Please review the output above.');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    await cleanup();
    mongoose.disconnect();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
