// Simple debug script to check attendance data
require('dotenv').config();
const mongoose = require('mongoose');

// Get DB URL from environment
const DB_URL = process.env.DB_URL;

if (!DB_URL) {
  console.error('❌ DB_URL not found in environment variables');
  process.exit(1);
}

console.log('🔄 Connecting to database...');

mongoose.connect(DB_URL, { 
  serverSelectionTimeoutMS: 20000 
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  
  // Create simple schema
  const attendanceSchema = new mongoose.Schema({}, { collection: 'examattendances', strict: false });
  const ExamAttendance = mongoose.model('ExamAttendance', attendanceSchema);
  
  // Query data
  return ExamAttendance.find().limit(10);
})
.then(attendances => {
  console.log(`📊 Found ${attendances.length} exam attendance records:`);
  
  attendances.forEach((att, index) => {
    console.log(`${index + 1}. Status: ${att.status || 'No status'}`);
    console.log(`   UserId: ${att.userId || 'No userId'}`);
    console.log(`   ExamId: ${att.examId || 'No examId'}`);
    console.log(`   Attempt: ${att.attemptNumber || 'No attemptNumber'}`);
    console.log(`   Score: ${att.score || 0}/${att.totalQuestions || 0}`);
    console.log(`   Start: ${att.startTime || 'No startTime'}`);
    console.log(`   End: ${att.endTime || 'No endTime'}`);
    console.log('   ---');
  });
  
  // Check status distribution
  return ExamAttendance.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
})
.then(statusCounts => {
  console.log('\n📈 Status Distribution:');
  statusCounts.forEach(status => {
    console.log(`   ${status._id || 'No status'}: ${status.count}`);
  });
})
.catch(error => {
  console.error('❌ Error:', error.message);
})
.finally(() => {
  mongoose.disconnect();
  console.log('🔚 Disconnected from database');
});
