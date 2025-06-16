/**
 * Test script to verify WebSocket request logging and connection details
 */

const { DynamicSocketManager } = require('./utils/dynamicSocketManager');

async function testWebSocketLogging() {
  console.log('🧪 Testing WebSocket Request Logging and Connection Details');
  console.log('======================================================\n');

  try {
    // Get the DynamicSocketManager instance
    const socketManager = DynamicSocketManager.getInstance();
    
    // Create a test monitoring server
    const monit_id = `test-monitor-${Date.now()}`;
    const exam_id = 'test-exam-123';
    const student_id = 'test-student-456';
    
    console.log(`Creating test monitoring server with ID: ${monit_id}`);
    
    // Create the server and get connection details
    const serverDetails = await socketManager.createMonitoringServer(monit_id, exam_id, student_id);
    
    console.log('\n📊 Server Details Returned:');
    console.log(JSON.stringify(serverDetails, null, 2));
    
    // Verify the connection information is in the required format
    if (serverDetails.connection && 
        serverDetails.connection.host === 'localhost' && 
        typeof serverDetails.connection.port === 'number' &&
        serverDetails.connection.uri === 'wss://test.test.com') {
      console.log('\n✅ Connection details are in the required format!');
    } else {
      console.log('\n❌ Connection details are not in the required format!');
    }
    
    // Simulate a security event to test logging
    console.log('\nSimulating a security event to test logging...');
    const testSocket = { 
      id: 'test-socket-id',
      handshake: { 
        address: '127.0.0.1',
        headers: {
          'user-agent': 'Test Browser',
          'origin': 'http://localhost:3000'
        }
      }
    };
    
    const testEvent = {
      type: 'tab_switch',
      details: {
        timestamp: new Date().toISOString(),
        url: 'https://example.com'
      }
    };
    
    const logEntry = socketManager.logSocketEvent('test_event', testSocket, {
      ...testEvent,
      monit_id,
      exam_id,
      student_id
    });
    
    console.log('\n✅ Log entry created successfully!');
    
    // Clean up the test server
    console.log('\nCleaning up test server...');
    await socketManager.terminateServer(monit_id);
    console.log('✅ Test server terminated successfully!');
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\nVerify that the console output above includes:');
    console.log('1. Detailed server creation log with host, port, and URI');
    console.log('2. Connection details in the server details object');
    console.log('3. Detailed log entry for the simulated security event');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testWebSocketLogging();
}

module.exports = { testWebSocketLogging };
