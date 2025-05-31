/**
 * This script verifies the status handling functionality without database connection
 */

// Import the attendance utilities
console.log('Importing attendance utilities...');
const attendanceUtils = require('./utils/attendanceUtils');
console.log('Utilities imported successfully');

// Create a mock attendance record
const mockAttendance = {
  _id: 'mock-id-12345',
  examId: 'exam-id-12345',
  userId: 'user-id-12345',
  status: 'IN_PROGRESS',
  startTime: new Date(),
  endTime: null,
  totalQuestions: 10,
  attemptedQuestions: 0,
  score: 0,
  attemptNumber: 1
};

console.log('Created mock attendance record:', mockAttendance);

// Create mock user exam data
const mockUserExamData = {
  'user-id-12345': {
    'exam-id-12345': {
      userAnswers: {
        'q1': 'A',
        'q2': 'B'
      }
    }
  }
};

console.log('Created mock user exam data');

// Test the status handling
console.log('🔍 Testing status handling functionality...');

// Get detailed status using utility function
console.log('Getting detailed status...');
const statusInfo = attendanceUtils.getDetailedStatus(mockAttendance, mockUserExamData);
console.log('Detailed status retrieved successfully');

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

// Verify attempted questions count
if (statusInfo.attemptedQuestions !== 2) {
  console.error(`❌ Test failed: attemptedQuestions should be 2, got ${statusInfo.attemptedQuestions}`);
} else {
  console.log('✅ attemptedQuestions is correctly set to 2');
}

console.log('\n✅ Status handling verification complete!');
