/**
 * Test file for cheating detection functionality
 */
const axios = require('axios');

// Replace with your actual API base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Test authentication tokens (you'll need to get these after logging in)
const STUDENT_TOKEN = 'YOUR_STUDENT_TOKEN_HERE';
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE';

// Test exam ID (replace with an actual exam ID from your database)
const TEST_EXAM_ID = 'EXAM_ID_HERE';

// Helper function for making authenticated requests
const authRequest = (token) => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

// Test 1: Report a cheating incident
async function testReportCheating() {
  try {
    const studentClient = authRequest(STUDENT_TOKEN);
    
    const response = await studentClient.post(`/exam-attendance/${TEST_EXAM_ID}/report-cheating`, {
      evidenceType: 'TAB_SWITCH',
      details: {
        fromUrl: 'https://exam.portal/test',
        toUrl: 'https://google.com/search?q=exam+answers',
        duration: 15000 // milliseconds
      },
      source: 'CLIENT'
    });
    
    console.log('Test 1 - Report Cheating Response:', response.data);
    return response.data.evidenceId; // Return the evidence ID for verification
  } catch (error) {
    console.error('Test 1 - Report Cheating Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 2: Get cheating reports (admin only)
async function testGetCheatingReports() {
  try {
    const adminClient = authRequest(ADMIN_TOKEN);
    
    const response = await adminClient.get(`/exam-attendance/admin/${TEST_EXAM_ID}/cheating-reports`);
    
    console.log('Test 2 - Get Cheating Reports Response:', response.data);
  } catch (error) {
    console.error('Test 2 - Get Cheating Reports Error:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  console.log('Starting cheating detection tests...');
  
  // Test 1: Report cheating
  const evidenceId = await testReportCheating();
  
  if (evidenceId) {
    console.log(`Successfully reported cheating incident with evidence ID: ${evidenceId}`);
  } else {
    console.log('Failed to report cheating incident');
  }
  
  // Wait a moment before getting reports
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Get cheating reports (admin only)
  await testGetCheatingReports();
  
  console.log('Testing completed');
}

// Only run if directly executed (not required by another module)
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testReportCheating, testGetCheatingReports };
