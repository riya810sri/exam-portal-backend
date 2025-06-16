const axios = require('axios');

// Test configuration
const baseURL = 'http://localhost:5000';
const testExamId = '675e1dd1b94635e89f8dd1f0'; // Replace with actual exam ID

// Test different export formats
async function testExportQuestions() {
  console.log('🧪 Testing Question Export Functionality...\n');

  try {
    // Test JSON export
    console.log('📋 Testing JSON Export...');
    const jsonResponse = await axios.get(`${baseURL}/api/questions/export/${testExamId}?format=json`, {
      headers: {
        'Authorization': 'Bearer YOUR_AUTH_TOKEN' // Replace with actual token
      }
    });
    console.log('✅ JSON Export Status:', jsonResponse.status);
    console.log('📊 JSON Export Data Keys:', Object.keys(jsonResponse.data));
    console.log('📝 Total Questions:', jsonResponse.data.totalQuestions);
    console.log();

    // Test CSV export
    console.log('📋 Testing CSV Export...');
    const csvResponse = await axios.get(`${baseURL}/api/questions/export/${testExamId}?format=csv`, {
      headers: {
        'Authorization': 'Bearer YOUR_AUTH_TOKEN' // Replace with actual token
      }
    });
    console.log('✅ CSV Export Status:', csvResponse.status);
    console.log('📄 CSV Export Content Type:', csvResponse.headers['content-type']);
    console.log('📝 CSV Content Preview:', csvResponse.data.substring(0, 200) + '...');
    console.log();

    // Test TXT export
    console.log('📋 Testing TXT Export...');
    const txtResponse = await axios.get(`${baseURL}/api/questions/export/${testExamId}?format=txt`, {
      headers: {
        'Authorization': 'Bearer YOUR_AUTH_TOKEN' // Replace with actual token
      }
    });
    console.log('✅ TXT Export Status:', txtResponse.status);
    console.log('📄 TXT Export Content Type:', txtResponse.headers['content-type']);
    console.log('📝 TXT Content Preview:', txtResponse.data.substring(0, 300) + '...');
    console.log();

    // Test invalid format
    console.log('📋 Testing Invalid Format...');
    try {
      await axios.get(`${baseURL}/api/questions/export/${testExamId}?format=pdf`);
    } catch (error) {
      console.log('✅ Invalid Format Error Status:', error.response.status);
      console.log('📝 Error Message:', error.response.data.message);
    }
    console.log();

    console.log('🎉 All export tests completed successfully!');

  } catch (error) {
    console.error('❌ Export test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Test without authentication
async function testUnauthenticatedExport() {
  console.log('🔒 Testing Unauthenticated Export...');
  
  try {
    await axios.get(`${baseURL}/api/questions/export/${testExamId}`);
  } catch (error) {
    console.log('✅ Unauthenticated Access Blocked:', error.response.status);
    console.log('📝 Error Message:', error.response.data.message);
  }
  console.log();
}

// Run tests
async function runTests() {
  await testUnauthenticatedExport();
  await testExportQuestions();
}

// Instructions for running the test
console.log(`
🚀 Question Export Test Setup Instructions:

1. Make sure your server is running on ${baseURL}
2. Replace 'testExamId' with a valid exam ID from your database
3. Replace 'YOUR_AUTH_TOKEN' with a valid JWT token
4. Run: node test_export_questions.js

📝 Available Export Formats:
- JSON: Structured data format
- CSV: Comma-separated values for spreadsheets
- TXT: Human-readable text format

🔗 Export Endpoint: GET /api/questions/export/:examId?format=json|csv|txt
`);

if (require.main === module) {
  runTests();
}

module.exports = { testExportQuestions, testUnauthenticatedExport };
