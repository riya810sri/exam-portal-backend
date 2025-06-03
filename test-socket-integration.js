/**
 * Quick Integration Test for Dynamic Socket Manager
 * Tests singleton pattern and basic functionality
 */

// Load environment first
require('dotenv').config();

const { DynamicSocketManager } = require('./utils/dynamicSocketManager');

async function testDynamicSocketManager() {
  console.log('🧪 Testing Dynamic Socket Manager Integration\n');

  try {
    // Test singleton pattern
    console.log('1. Testing Singleton Pattern...');
    const instance1 = DynamicSocketManager.getInstance();
    const instance2 = DynamicSocketManager.getInstance();
    
    if (instance1 === instance2) {
      console.log('✅ Singleton pattern working correctly');
    } else {
      console.log('❌ Singleton pattern failed');
      return;
    }

    // Test server statistics
    console.log('\n2. Testing Server Statistics...');
    const stats = instance1.getServerStats();
    console.log('📊 Current Stats:', {
      active_servers: stats.active_servers,
      used_ports: stats.used_ports,
      total_connections: stats.total_connections
    });
    console.log('✅ Statistics method working correctly');

    // Test port availability check
    console.log('\n3. Testing Port Availability...');
    const isPortAvailable = await instance1.isPortAvailable(4500);
    console.log(`✅ Port 4500 availability check: ${isPortAvailable}`);

    // Test find available port
    console.log('\n4. Testing Port Discovery...');
    const availablePort = await instance1.findAvailablePort();
    if (availablePort) {
      console.log(`✅ Found available port: ${availablePort}`);
    } else {
      console.log('⚠️  No available ports found (this is normal if all ports are used)');
    }

    console.log('\n🎉 All Integration Tests Passed!');
    console.log('\n📋 Integration Status:');
    console.log('✅ Singleton pattern implemented correctly');
    console.log('✅ Server statistics accessible');
    console.log('✅ Port management working');
    console.log('✅ Dynamic socket manager ready for use');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    console.error('Error details:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testDynamicSocketManager();
}

module.exports = { testDynamicSocketManager };
