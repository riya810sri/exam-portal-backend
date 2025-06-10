#!/usr/bin/env node

/**
 * Simple Mouse Event Logging Test
 * Quick test to verify mouse event processing is working
 */

console.log('🐭 Testing Mouse Event Processing...');

try {
  // Test mouse monitoring utility
  const { processMouseData } = require('./utils/mouseMonitoring');
  console.log('✅ mouseMonitoring module loaded');
  
  // Test security event logger
  const { securityEventLogger } = require('./utils/securityEventLogger');
  console.log('✅ securityEventLogger module loaded');
  
  // Test comprehensive security monitor
  const { comprehensiveSecurityMonitor } = require('./utils/comprehensiveSecurityMonitor');
  console.log('✅ comprehensiveSecurityMonitor module loaded');
  
  // Test dynamic socket manager
  const { DynamicSocketManager } = require('./utils/dynamicSocketManager');
  console.log('✅ DynamicSocketManager module loaded');
  
  // Generate test mouse events
  const testEvents = [
    { type: 'mousemove', x: 100, y: 100, timestamp: Date.now() },
    { type: 'mousemove', x: 110, y: 105, timestamp: Date.now() + 50 },
    { type: 'click', x: 120, y: 110, timestamp: Date.now() + 100, button: 0 }
  ];
  
  console.log('📊 Generated test events:', testEvents.length);
  
  // Test mouse data processing
  const result = processMouseData(testEvents);
  console.log('✅ Mouse data processed successfully');
  console.log('   - Processed events:', result.processed.length);
  console.log('   - Risk score:', result.analysis.riskScore);
  console.log('   - Patterns detected:', result.analysis.patterns?.length || 0);
  
  // Test the imports in dynamic socket manager
  const manager = DynamicSocketManager.getInstance();
  console.log('✅ DynamicSocketManager instance created');
  
  console.log('\n🎉 All module tests passed! Mouse logging pipeline components are working.');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
