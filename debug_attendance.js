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
const Exam = require('./models/exam.model');
const User = require('./models/user.model');

async function debugAttendanceIssue() {
  try {
    console.log('🔍 Checking ExamAttendance data...');
    
    // Get all exam attendances to see the current state
    const attendances = await ExamAttendance.find()
      .populate('examId', 'title')
      .populate('userId', 'email firstName')
      .sort({ startTime: -1 })
      .limit(15);
    
    console.log(`Found ${attendances.length} exam attendances:`);
    attendances.forEach((att, index) => {
      console.log(`${index + 1}. User: ${att.userId?.email || 'Unknown'}`);
      console.log(`   Exam: ${att.examId?.title || 'Unknown'}`);
      console.log(`   Status: ${att.status}`);
      console.log(`   Attempt: ${att.attemptNumber || 'Not set'}`);
      console.log(`   Score: ${att.score}/${att.totalQuestions}`);
      console.log(`   Start: ${att.startTime}`);
      console.log(`   End: ${att.endTime || 'Not ended'}`);
      console.log(`   ID: ${att._id}`);
      console.log('   ---');
    });
    
    // Check for any IN_PROGRESS attendances
    const inProgress = await ExamAttendance.find({ status: 'IN_PROGRESS' })
      .populate('examId', 'title')
      .populate('userId', 'email');
    
    console.log(`\n📊 IN_PROGRESS attendances: ${inProgress.length}`);
    inProgress.forEach((att, index) => {
      console.log(`${index + 1}. ${att.userId?.email} - ${att.examId?.title} (Started: ${att.startTime})`);
    });
    
    // Check for status distribution
    const statusCounts = await ExamAttendance.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📈 Status Distribution:');
    statusCounts.forEach(status => {
      console.log(`   ${status._id}: ${status.count}`);
    });
    
    // Check for users with multiple attempts
    const userAttempts = await ExamAttendance.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'exams',
          localField: 'examId',
          foreignField: '_id',
          as: 'exam'
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            examId: '$examId'
          },
          attempts: { $sum: 1 },
          statuses: { $addToSet: '$status' },
          userEmail: { $first: { $arrayElemAt: ['$user.email', 0] } },
          examTitle: { $first: { $arrayElemAt: ['$exam.title', 0] } }
        }
      },
      {
        $match: {
          attempts: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`\n🔄 Users with multiple attempts: ${userAttempts.length}`);
    userAttempts.forEach((attempt, index) => {
      console.log(`${index + 1}. ${attempt.userEmail} - ${attempt.examTitle}`);
      console.log(`   Attempts: ${attempt.attempts}, Statuses: ${attempt.statuses.join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
  }
}

// Wait a bit for connection then run debug
setTimeout(debugAttendanceIssue, 3000);
