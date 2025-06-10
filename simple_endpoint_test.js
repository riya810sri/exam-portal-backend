// Simple test for monitoring endpoint
const fetch = require('node-fetch');

async function testMonitoringEndpoint() {
  try {
    console.log('🔍 Testing monitoring endpoint...');
    
    // Simple health check first
    console.log('1. Testing server health...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    console.log(`Health check status: ${healthResponse.status}`);
    
    if (!healthResponse.ok) {
      console.log('❌ Server health check failed');
      return;
    }
    
    // Test monitoring endpoint without authentication
    console.log('2. Testing monitoring endpoint (should fail with 401)...');
    const monitorResponse = await fetch('http://localhost:3000/api/exam-attendance/68274422db1570c33bfef3a9/start-monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Monitoring endpoint status: ${monitorResponse.status}`);
    const result = await monitorResponse.json();
    console.log('Response:', result);
    
    if (monitorResponse.status === 401) {
      console.log('✅ Endpoint is accessible but requires authentication (expected)');
    } else {
      console.log('❌ Unexpected response from monitoring endpoint');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMonitoringEndpoint();
