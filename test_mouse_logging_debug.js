const axios = require('axios');

async function testMouseLogging() {
  console.log('🔍 Testing mouse logging with detailed debugging...');
  
  const API_BASE = 'http://localhost:3000/api';
  const sessionId = '68452458519f4db88ffcba45';
  const examId = '6832bf8a4b5adad3701cfe8b';
  const userId = '6839f5c5c1224dddba8b10ce';
  
  // Test data
  const mouseEvents = [
    {
      type: 'click',
      x: 150,
      y: 250,
      timestamp: Date.now(),
      button: 0,
      windowWidth: 1920,
      windowHeight: 1080
    },
    {
      type: 'mousemove',
      x: 200,
      y: 300,
      timestamp: Date.now() + 1000,
      button: null,
      windowWidth: 1920,
      windowHeight: 1080
    }
  ];
  
  const payload = {
    exam_id: examId,
    monit_id: `test_${Date.now()}`,
    events: mouseEvents
  };
  
  console.log('📤 Sending payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(
      `${API_BASE}/exam-attendance/${examId}/submit-mouse-events`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionId
        }
      }
    );
    
    console.log('✅ Response:', response.data);
    
    // Wait a moment for database operation to complete
    console.log('⏳ Waiting 2 seconds for database operation...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now check if events were stored
    console.log('🔍 Checking database for stored events...');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const dbCheckScript = `
      const mongoose = require('mongoose');
      const SecurityEvent = require('./models/securityEvent.model');
      
      mongoose.connect('mongodb://localhost:27017/exam_portal').then(async () => {
        const events = await SecurityEvent.find({ 
          event_type: { $in: ['click', 'mousemove'] } 
        }).sort({ timestamp: -1 }).limit(5);
        
        console.log('Found events:', events.length);
        events.forEach((event, i) => {
          console.log(\`Event \${i+1}:\`, {
            id: event._id,
            type: event.event_type,
            timestamp: new Date(event.timestamp),
            details: event.details
          });
        });
        
        await mongoose.disconnect();
      }).catch(console.error);
    `;
    
    try {
      const { stdout, stderr } = await execPromise(`node -e "${dbCheckScript}"`);
      console.log('Database check output:', stdout);
      if (stderr) console.error('Database check errors:', stderr);
    } catch (error) {
      console.error('Error checking database:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testMouseLogging();
