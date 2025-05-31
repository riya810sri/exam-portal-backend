// Debug script to test imports
console.log('Testing imports...');

try {
  console.log('1. Testing ExamAttendance model...');
  const ExamAttendance = require('./models/examAttendance.model');
  console.log('✅ ExamAttendance imported successfully');

  console.log('2. Testing User model...');
  const User = require('./models/user.model');
  console.log('✅ User imported successfully');

  console.log('3. Testing securityMonitor...');
  const { securityMonitor } = require('./utils/securityMonitor');
  console.log('✅ securityMonitor imported successfully');
  console.log('   securityMonitor type:', typeof securityMonitor);
  console.log('   securityMonitor.getStats type:', typeof securityMonitor.getStats);

  console.log('4. Testing patternDetector...');
  const { patternDetector } = require('./utils/serverPatternDetection');
  console.log('✅ patternDetector imported successfully');
  console.log('   patternDetector type:', typeof patternDetector);
  console.log('   patternDetector.getSessionStats type:', typeof patternDetector.getSessionStats);

  console.log('5. Testing controller functions...');
  const controllerExports = require('./controllers/admin.antiAbuse.controller');
  console.log('✅ Controller exports:', Object.keys(controllerExports));
  
  // Test each exported function
  Object.keys(controllerExports).forEach(key => {
    console.log(`   ${key}: ${typeof controllerExports[key]}`);
  });

} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error('Stack trace:', error.stack);
}
