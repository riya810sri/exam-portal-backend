#!/usr/bin/env node
/**
 * Simple verification script for anti-abuse system components
 * Run this to ensure all components are properly installed and configured
 */

const chalk = require('chalk');

console.log(chalk.blue.bold('\n🔒 Anti-Abuse System Verification\n'));

async function verifyComponents() {
  const results = [];
  
  try {
    // Test 1: Check core utilities
    console.log(chalk.yellow.bold('📦 Testing core utilities...'));
    
    const antiAbuseDetector = require('./utils/antiAbuseDetector');
    const patternDetection = require('./utils/serverPatternDetection');
    const securityMonitor = require('./utils/securityMonitor');
    const cheatDetection = require('./utils/cheatDetection');
    
    results.push({ name: 'Core Utilities', status: 'PASS', details: 'All utilities imported successfully' });
    console.log(chalk.green.bold('✅ Core utilities loaded'));
    
    // Test 2: Check models
    console.log(chalk.yellow.bold('\n📋 Testing database models...'));
    
    const ExamAttendance = require('./models/examAttendance.model');
    const User = require('./models/user.model');
    
    results.push({ name: 'Database Models', status: 'PASS', details: 'Models imported successfully' });
    console.log(chalk.green.bold('✅ Database models loaded'));
    
    // Test 3: Check controllers
    console.log(chalk.yellow.bold('\n🎮 Testing controllers...'));
    
    const adminController = require('./controllers/admin.antiAbuse.controller');
    const examController = require('./controllers/examAttendance.controller');
    
    const expectedFunctions = [
      'getSecurityDashboard',
      'getSessionAnalysis', 
      'updateRiskThresholds',
      'getSystemMetrics'
    ];
    
    const missingFunctions = expectedFunctions.filter(fn => typeof adminController[fn] !== 'function');
    
    if (missingFunctions.length === 0) {
      results.push({ name: 'Controller Functions', status: 'PASS', details: 'All required functions available' });
      console.log(chalk.green.bold('✅ Controllers loaded with all functions'));
    } else {
      results.push({ name: 'Controller Functions', status: 'FAIL', details: `Missing: ${missingFunctions.join(', ')}` });
      console.log(chalk.red.bold(`❌ Missing functions: ${missingFunctions.join(', ')}`));
    }
    
    // Test 4: Check middleware
    console.log(chalk.yellow.bold('\n🛡️  Testing middleware...'));
    
    const antiAbuseMiddleware = require('./middlewares/antiAbuse.middleware');
    const authMiddleware = require('./middlewares/auth.middleware');
    
    results.push({ name: 'Middleware', status: 'PASS', details: 'Middleware imported successfully' });
    console.log(chalk.green.bold('✅ Middleware loaded'));
    
    // Test 5: Check routes
    console.log(chalk.yellow.bold('\n🛤️  Testing routes...'));
    
    const adminRoutes = require('./routes/admin.antiAbuse.routes');
    const examRoutes = require('./routes/examAttendance.routes');
    
    results.push({ name: 'Route Configuration', status: 'PASS', details: 'Routes imported successfully' });
    console.log(chalk.green.bold('✅ Routes configured'));
    
    // Test 6: Pattern Detection Functions
    console.log(chalk.yellow.bold('\n🔍 Testing pattern detection...'));
    
    const { patternDetector } = patternDetection;
    
    // Test mouse movement analysis
    const testMouseData = {
      movements: [
        { x: 100, y: 200, timestamp: Date.now() },
        { x: 150, y: 220, timestamp: Date.now() + 500 }
      ],
      clicks: []
    };
    
    const mouseAnalysis = patternDetector.analyzeMouseMovement(testMouseData);
    
    if (mouseAnalysis && typeof mouseAnalysis.isSuspicious === 'boolean') {
      results.push({ name: 'Pattern Detection', status: 'PASS', details: `Mouse analysis working, suspicious: ${mouseAnalysis.isSuspicious}` });
      console.log(chalk.green.bold('✅ Pattern detection functioning'));
    } else {
      results.push({ name: 'Pattern Detection', status: 'FAIL', details: 'Mouse analysis not working properly' });
      console.log(chalk.red.bold('❌ Pattern detection issues'));
    }
    
    // Test 7: Security Monitor
    console.log(chalk.yellow.bold('\n📊 Testing security monitor...'));
    
    const { securityMonitor: monitor } = securityMonitor;
    const stats = monitor.getStats();
    
    if (stats && typeof stats === 'object') {
      results.push({ name: 'Security Monitor', status: 'PASS', details: 'Monitor active and returning stats' });
      console.log(chalk.green.bold('✅ Security monitor active'));
    } else {
      results.push({ name: 'Security Monitor', status: 'FAIL', details: 'Monitor not returning proper stats' });
      console.log(chalk.red.bold('❌ Security monitor issues'));
    }
    
  } catch (error) {
    results.push({ name: 'System Error', status: 'FAIL', details: error.message });
    console.log(chalk.red.bold(`❌ System error: ${error.message}`));
  }
  
  // Summary
  console.log(chalk.blue.bold('\n📋 Verification Summary:'));
  console.log('═'.repeat(60));
  
  let passCount = 0;
  let failCount = 0;
  
  results.forEach(result => {
    const status = result.status === 'PASS' 
      ? chalk.green.bold('PASS') 
      : chalk.red.bold('FAIL');
    
    console.log(`${status} ${result.name.padEnd(25)} ${result.details}`);
    
    if (result.status === 'PASS') passCount++;
    else failCount++;
  });
  
  console.log('═'.repeat(60));
  console.log(`Total: ${results.length}, Passed: ${chalk.green.bold(passCount)}, Failed: ${chalk.red.bold(failCount)}`);
  
  if (failCount === 0) {
    console.log(chalk.green.bold('\n🎉 All systems operational! Anti-abuse system is ready.'));
  } else {
    console.log(chalk.yellow.bold('\n⚠️  Some issues detected. Please review failed components.'));
  }
  
  console.log(chalk.blue.bold('\n📖 For detailed documentation, see: docs/ANTI_ABUSE_SYSTEM.md'));
  console.log(chalk.blue.bold('🧪 To run comprehensive tests: npm test tests/comprehensive-antiabuse.test.js\n'));
}

// Install chalk if not available
try {
  require('chalk');
} catch (error) {
  console.log('Installing chalk for colored output...');
  require('child_process').execSync('npm install chalk --save-dev', { stdio: 'inherit' });
}

verifyComponents().catch(console.error);
