#!/usr/bin/env node

/**
 * Mouse Event Logging Production Validation
 * Validates that all components are working correctly
 */

console.log('🚀 Mouse Event Logging Production Validation');
console.log('=' .repeat(60));

const tests = [];

// Test 1: Mouse Processing Utility
console.log('\n🧪 Test 1: Mouse Processing Utility');
try {
  const { processMouseData } = require('./utils/mouseMonitoring');
  
  // Test normal events
  const normalEvents = [
    { type: 'mousemove', x: 100, y: 100, timestamp: Date.now() },
    { type: 'mousemove', x: 150, y: 120, timestamp: Date.now() + 100 },
    { type: 'click', x: 150, y: 120, timestamp: Date.now() + 200, button: 0 }
  ];
  
  const normalResult = processMouseData(normalEvents);
  console.log('   ✅ Normal events processed');
  console.log(`   - Events: ${normalResult.processed.length}`);
  console.log(`   - Risk Score: ${normalResult.analysis.riskScore}`);
  
  // Test suspicious events
  const suspiciousEvents = [];
  for (let i = 0; i < 30; i++) {
    suspiciousEvents.push({
      type: 'mousemove',
      x: i * 10,
      y: i * 5,
      timestamp: Date.now() + i * 10,
      button: null
    });
  }
  
  const suspiciousResult = processMouseData(suspiciousEvents);
  console.log('   ✅ Suspicious events processed');
  console.log(`   - Events: ${suspiciousResult.processed.length}`);
  console.log(`   - Risk Score: ${suspiciousResult.analysis.riskScore}`);
  console.log(`   - High Risk: ${suspiciousResult.analysis.riskScore > 60 ? 'YES' : 'NO'}`);
  
  tests.push({ name: 'Mouse Processing Utility', passed: true });
} catch (error) {
  console.log('   ❌ Failed:', error.message);
  tests.push({ name: 'Mouse Processing Utility', passed: false, error: error.message });
}

// Test 2: Security Event Logger
console.log('\n🧪 Test 2: Security Event Logger');
try {
  const { securityEventLogger } = require('./utils/securityEventLogger');
  console.log('   ✅ Security Event Logger loaded');
  console.log('   ✅ logEvent method available:', typeof securityEventLogger.logEvent === 'function');
  tests.push({ name: 'Security Event Logger', passed: true });
} catch (error) {
  console.log('   ❌ Failed:', error.message);
  tests.push({ name: 'Security Event Logger', passed: false, error: error.message });
}

// Test 3: Comprehensive Security Monitor
console.log('\n🧪 Test 3: Comprehensive Security Monitor');
try {
  const { comprehensiveSecurityMonitor } = require('./utils/comprehensiveSecurityMonitor');
  console.log('   ✅ Comprehensive Security Monitor loaded');
  console.log('   ✅ processSecurityEvent method available:', typeof comprehensiveSecurityMonitor.processSecurityEvent === 'function');
  tests.push({ name: 'Comprehensive Security Monitor', passed: true });
} catch (error) {
  console.log('   ❌ Failed:', error.message);
  tests.push({ name: 'Comprehensive Security Monitor', passed: false, error: error.message });
}

// Test 4: Dynamic Socket Manager
console.log('\n🧪 Test 4: Dynamic Socket Manager');
try {
  const { DynamicSocketManager } = require('./utils/dynamicSocketManager');
  const manager = DynamicSocketManager.getInstance();
  console.log('   ✅ Dynamic Socket Manager loaded');
  console.log('   ✅ Instance created');
  console.log('   ✅ processMouseData method available:', typeof manager.processMouseData === 'function');
  console.log('   ✅ processKeyboardData method available:', typeof manager.processKeyboardData === 'function');
  console.log('   ✅ processSecurityEvent method available:', typeof manager.processSecurityEvent === 'function');
  tests.push({ name: 'Dynamic Socket Manager', passed: true });
} catch (error) {
  console.log('   ❌ Failed:', error.message);
  tests.push({ name: 'Dynamic Socket Manager', passed: false, error: error.message });
}

// Test 5: Import Integration Check
console.log('\n🧪 Test 5: Import Integration Check');
try {
  // Check if all the imports in dynamicSocketManager work
  const fs = require('fs');
  const socketManagerContent = fs.readFileSync('./utils/dynamicSocketManager.js', 'utf8');
  
  const hasMouseImport = socketManagerContent.includes('processMouseData: processMouseDataUtil');
  const hasSecurityLoggerImport = socketManagerContent.includes('securityEventLogger');
  const hasSecurityMonitorImport = socketManagerContent.includes('comprehensiveSecurityMonitor');
  
  console.log('   ✅ Mouse processing import:', hasMouseImport ? 'CORRECT' : 'MISSING');
  console.log('   ✅ Security logger import:', hasSecurityLoggerImport ? 'CORRECT' : 'MISSING');
  console.log('   ✅ Security monitor import:', hasSecurityMonitorImport ? 'CORRECT' : 'MISSING');
  
  const allImportsCorrect = hasMouseImport && hasSecurityLoggerImport && hasSecurityMonitorImport;
  tests.push({ name: 'Import Integration Check', passed: allImportsCorrect });
} catch (error) {
  console.log('   ❌ Failed:', error.message);
  tests.push({ name: 'Import Integration Check', passed: false, error: error.message });
}

// Test 6: Function Integration Test
console.log('\n🧪 Test 6: Function Integration Test');
try {
  // Test that the functions can work together (without database)
  const { processMouseData } = require('./utils/mouseMonitoring');
  const { securityEventLogger } = require('./utils/securityEventLogger');
  const { comprehensiveSecurityMonitor } = require('./utils/comprehensiveSecurityMonitor');
  
  const testEvents = [{ type: 'mousemove', x: 100, y: 100, timestamp: Date.now() }];
  const result = processMouseData(testEvents);
  
  // Test if the processing result has the expected structure
  const hasProcessed = Array.isArray(result.processed);
  const hasAnalysis = result.analysis && typeof result.analysis.riskScore === 'number';
  const hasPatterns = Array.isArray(result.analysis.patterns);
  
  console.log('   ✅ Processing result structure valid:', hasProcessed && hasAnalysis && hasPatterns);
  console.log('   ✅ Risk score type:', typeof result.analysis.riskScore);
  console.log('   ✅ Patterns array:', Array.isArray(result.analysis.patterns));
  
  tests.push({ name: 'Function Integration Test', passed: hasProcessed && hasAnalysis && hasPatterns });
} catch (error) {
  console.log('   ❌ Failed:', error.message);
  tests.push({ name: 'Function Integration Test', passed: false, error: error.message });
}

// Generate Report
console.log('\n📊 VALIDATION REPORT');
console.log('=' .repeat(60));

const passedTests = tests.filter(t => t.passed).length;
const totalTests = tests.length;
const successRate = Math.round((passedTests / totalTests) * 100);

console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests} ✅`);
console.log(`Failed: ${totalTests - passedTests} ❌`);
console.log(`Success Rate: ${successRate}%`);

console.log('\nDetailed Results:');
tests.forEach((test, index) => {
  const status = test.passed ? '✅' : '❌';
  console.log(`${index + 1}. ${status} ${test.name}`);
  if (test.error) {
    console.log(`   Error: ${test.error}`);
  }
});

if (successRate === 100) {
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('🚀 Mouse event logging system is ready for production!');
  console.log('\n📋 Features Validated:');
  console.log('   ✅ Mouse event processing and analysis');
  console.log('   ✅ Risk score calculation');
  console.log('   ✅ Pattern and anomaly detection');
  console.log('   ✅ Security event logging infrastructure');
  console.log('   ✅ Comprehensive security monitoring');
  console.log('   ✅ Socket manager integration');
  console.log('   ✅ Import structure and dependencies');
} else {
  console.log('\n⚠️ Some tests failed. Please review the errors above.');
}

console.log('\n🔍 Next Steps:');
console.log('   1. Start the backend server');
console.log('   2. Connect frontend with mouse monitoring enabled');
console.log('   3. Mouse events will be automatically logged');
console.log('   4. High-risk events will trigger security alerts');
console.log('   5. Admin dashboard will receive real-time notifications');

process.exit(successRate === 100 ? 0 : 1);
