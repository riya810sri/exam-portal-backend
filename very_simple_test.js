// Very simple monitoring test
console.log('Starting simple monitoring test...');

const fetch = require('node-fetch');

async function simpleTest() {
  try {
    console.log('Testing endpoint...');
    
    const response = await fetch('http://localhost:3000/api/exam-attendance/68274422db1570c33bfef3a9/start-monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token'
      },
      body: JSON.stringify({})
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

simpleTest().then(() => {
  console.log('Test completed');
  process.exit(0);
});
