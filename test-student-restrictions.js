/**
 * Test script for student restriction system
 * Tests all restriction types and checks integration with anti-abuse system
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { DynamicSocketManager } = require('./utils/dynamicSocketManager');
const StudentRestriction = require('./models/studentRestriction.model');
const { StudentRestrictionManager } = require('./utils/studentRestrictionManager');
const BannedClient = require('./models/bannedClient.model');
const User = require('./models/user.model');
const Exam = require('./models/exam.model');

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam_portal')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
  
  try {
    await runTests();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
});

async function runTests() {
  console.log('🧪 Starting student restriction system tests...');
  
  // Create test user and exam if needed
  const testUser = await getOrCreateTestUser();
  const testExam = await getOrCreateTestExam();
  
  console.log(`👤 Test user: ${testUser.username} (${testUser._id})`);
  console.log(`📝 Test exam: ${testExam.title} (${testExam._id})`);
  
  // Create restriction manager instance
  const restrictionManager = new StudentRestrictionManager();
  
  // Clean up any existing restrictions for test user
  await cleanUpTestRestrictions(testUser._id);
  
  // ====== TEST 1: Exam Ban ======
  console.log('\n\n🧪 TEST 1: Exam Ban');
  await testExamBan(restrictionManager, testUser._id, testExam._id);
  
  // ====== TEST 2: Account Suspension ======
  console.log('\n\n🧪 TEST 2: Account Suspension');
  await testAccountSuspension(restrictionManager, testUser._id);
  
  // ====== TEST 3: IP Ban ======
  console.log('\n\n🧪 TEST 3: IP Ban');
  await testIpBan(restrictionManager, testUser._id);
  
  // ====== TEST 4: Global Ban ======
  console.log('\n\n🧪 TEST 4: Global Ban');
  await testGlobalBan(restrictionManager, testUser._id);
  
  // ====== TEST 5: Removal/Unbanning ======
  console.log('\n\n🧪 TEST 5: Removal/Unbanning');
  await testRemoveRestriction(restrictionManager, testUser._id, testExam._id);
  
  console.log('\n\n✅ All tests completed successfully!');
}

async function getOrCreateTestUser() {
  let testUser = await User.findOne({ username: 'test_student' });
  
  if (!testUser) {
    testUser = new User({
      username: 'test_student',
      email: 'test_student@example.com',
      firstName: 'Test',
      lastName: 'Student',
      role: 'student',
      isVerified: true
    });
    await testUser.save();
  }
  
  return testUser;
}

async function getOrCreateTestExam() {
  let testExam = await Exam.findOne({ title: 'Test Exam' });
  
  if (!testExam) {
    testExam = new Exam({
      title: 'Test Exam',
      description: 'Exam for testing restriction system',
      duration: 60,
      passingMarks: 70,
      totalMarks: 100,
      status: 'published'
    });
    await testExam.save();
  }
  
  return testExam;
}

async function cleanUpTestRestrictions(studentId) {
  await StudentRestriction.deleteMany({ student_id: studentId });
  console.log('🧹 Cleaned up existing test restrictions');
}

async function testExamBan(restrictionManager, studentId, examId) {
  // Impose exam ban
  console.log('Creating exam ban...');
  const examBan = await restrictionManager.imposeRestriction({
    studentId,
    restrictionType: 'exam_ban',
    reason: 'Testing exam ban',
    examId,
    duration: 60 * 60 * 1000, // 1 hour
    violationDetails: {
      source: 'test_script',
      timestamp: new Date()
    }
  });
  
  console.log(`✅ Exam ban created: ${examBan._id}`);
  
  // Test if ban is effective
  const accessCheck1 = await restrictionManager.canTakeExam(studentId, examId, '127.0.0.1');
  console.log(`Ban effective? ${!accessCheck1.allowed ? 'Yes' : 'No'}`);
  console.log(`Message: ${accessCheck1.message}`);
  
  // Check different exam (should be allowed)
  const accessCheck2 = await restrictionManager.canTakeExam(studentId, new mongoose.Types.ObjectId(), '127.0.0.1');
  console.log(`Different exam allowed? ${accessCheck2.allowed ? 'Yes' : 'No'}`);
  
  if (!accessCheck1.allowed && accessCheck2.allowed) {
    console.log('✅ Exam Ban test passed');
  } else {
    throw new Error('❌ Exam Ban test failed');
  }
}

async function testAccountSuspension(restrictionManager, studentId) {
  // Impose account suspension
  console.log('Creating account suspension...');
  const suspension = await restrictionManager.imposeRestriction({
    studentId,
    restrictionType: 'account_suspension',
    reason: 'Testing account suspension',
    duration: 60 * 60 * 1000, // 1 hour
    violationDetails: {
      source: 'test_script',
      timestamp: new Date()
    }
  });
  
  console.log(`✅ Account suspension created: ${suspension._id}`);
  
  // Test if suspension is effective for any exam
  const examId1 = new mongoose.Types.ObjectId();
  const examId2 = new mongoose.Types.ObjectId();
  
  const accessCheck1 = await restrictionManager.canTakeExam(studentId, examId1, '127.0.0.1');
  const accessCheck2 = await restrictionManager.canTakeExam(studentId, examId2, '127.0.0.1');
  
  console.log(`Exam 1 blocked? ${!accessCheck1.allowed ? 'Yes' : 'No'}`);
  console.log(`Exam 2 blocked? ${!accessCheck2.allowed ? 'Yes' : 'No'}`);
  console.log(`Message: ${accessCheck1.message}`);
  
  if (!accessCheck1.allowed && !accessCheck2.allowed) {
    console.log('✅ Account Suspension test passed');
  } else {
    throw new Error('❌ Account Suspension test failed');
  }
}

async function testIpBan(restrictionManager, studentId) {
  const testIp = '192.168.1.100';
  
  // Impose IP ban
  console.log('Creating IP ban...');
  const ipBan = await restrictionManager.imposeRestriction({
    studentId,
    restrictionType: 'ip_ban',
    reason: 'Testing IP ban',
    ipAddress: testIp,
    duration: 60 * 60 * 1000, // 1 hour
    violationDetails: {
      source: 'test_script',
      timestamp: new Date()
    }
  });
  
  console.log(`✅ IP ban created: ${ipBan._id}`);
  
  // Test if ban is effective for any student from that IP
  const examId = new mongoose.Types.ObjectId();
  const otherStudentId = new mongoose.Types.ObjectId();
  
  const accessCheck1 = await restrictionManager.canTakeExam(studentId, examId, testIp);
  const accessCheck2 = await restrictionManager.canTakeExam(otherStudentId, examId, testIp);
  const accessCheck3 = await restrictionManager.canTakeExam(studentId, examId, '10.0.0.1'); // Different IP
  
  console.log(`Same student, banned IP blocked? ${!accessCheck1.allowed ? 'Yes' : 'No'}`);
  console.log(`Different student, banned IP blocked? ${!accessCheck2.allowed ? 'Yes' : 'No'}`);
  console.log(`Same student, different IP allowed? ${accessCheck3.allowed ? 'Yes' : 'No'}`);
  
  if (!accessCheck1.allowed && !accessCheck2.allowed && accessCheck3.allowed) {
    console.log('✅ IP Ban test passed');
  } else {
    throw new Error('❌ IP Ban test failed');
  }
}

async function testGlobalBan(restrictionManager, studentId) {
  // Impose global ban
  console.log('Creating global ban...');
  const globalBan = await restrictionManager.imposeRestriction({
    studentId,
    restrictionType: 'global_ban',
    reason: 'Testing global ban',
    isPermanent: true,
    violationDetails: {
      source: 'test_script',
      timestamp: new Date()
    }
  });
  
  console.log(`✅ Global ban created: ${globalBan._id}`);
  
  // Test if ban is effective for any exam and IP
  const examId1 = new mongoose.Types.ObjectId();
  const examId2 = new mongoose.Types.ObjectId();
  
  const accessCheck1 = await restrictionManager.canTakeExam(studentId, examId1, '127.0.0.1');
  const accessCheck2 = await restrictionManager.canTakeExam(studentId, examId2, '192.168.1.1');
  
  console.log(`Exam 1 blocked? ${!accessCheck1.allowed ? 'Yes' : 'No'}`);
  console.log(`Exam 2 with different IP blocked? ${!accessCheck2.allowed ? 'Yes' : 'No'}`);
  console.log(`Message: ${accessCheck1.message}`);
  
  if (!accessCheck1.allowed && !accessCheck2.allowed) {
    console.log('✅ Global Ban test passed');
  } else {
    throw new Error('❌ Global Ban test failed');
  }
}

async function testRemoveRestriction(restrictionManager, studentId, examId) {
  // Get all active restrictions
  const activeRestrictions = await restrictionManager.getActiveRestrictions(studentId);
  console.log(`Found ${activeRestrictions.length} active restrictions`);
  
  // Remove each restriction
  for (const restriction of activeRestrictions) {
    console.log(`Removing restriction: ${restriction._id} (${restriction.restriction_type})`);
    await restrictionManager.removeRestriction(
      restriction._id,
      new mongoose.Types.ObjectId(), // Admin ID
      'Testing restriction removal'
    );
  }
  
  // Verify all restrictions are removed
  const remainingRestrictions = await restrictionManager.getActiveRestrictions(studentId);
  console.log(`Remaining restrictions: ${remainingRestrictions.length}`);
  
  // Test if student can now take exams
  const accessCheck = await restrictionManager.canTakeExam(studentId, examId, '127.0.0.1');
  console.log(`Can take exam now? ${accessCheck.allowed ? 'Yes' : 'No'}`);
  
  if (remainingRestrictions.length === 0 && accessCheck.allowed) {
    console.log('✅ Restriction Removal test passed');
  } else {
    throw new Error('❌ Restriction Removal test failed');
  }
}
