#!/usr/bin/env node

const axios = require('axios');

// Real session ID from logs
const REAL_SESSION_ID = '68451e441c8ebd35bab15126';
const REAL_EXAM_ID = '6843df9b4005b2532adf856c';
const BASE_URL = 'http://localhost:3000';

async function testMouseMonitoringFlow() {
  console.log('🧪 Testing mouse monitoring endpoints with real session...');
  
  try {
    // Test 1: Start monitoring
    console.log('\n1️⃣ Testing start monitoring endpoint...');
    const startResponse = await axios.post(
      `${BASE_URL}/api/exam-attendance/start-monitoring/${REAL_EXAM_ID}`,
      { exam_id: REAL_EXAM_ID },
      {
        headers: {
          'Authorization': REAL_SESSION_ID,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Start monitoring response:', startResponse.data);
    
    // Test 2: Submit mouse events
    console.log('\n2️⃣ Testing submit mouse events endpoint...');
    const mouseEvents = [
      {
        x: 100,
        y: 200,
        timestamp: Date.now(),
        type: 'click',
        button: 0,
        windowWidth: 1920,
        windowHeight: 1080
      },
      {
        x: 150,
        y: 250,
        timestamp: Date.now() + 1000,
        type: 'mousemove',
        button: null,
        windowWidth: 1920,
        windowHeight: 1080
      }
    ];
    
    const mouseResponse = await axios.post(
      `${BASE_URL}/api/exam-attendance/${REAL_EXAM_ID}/submit-mouse-events`,
      {
        exam_id: REAL_EXAM_ID,
        events: mouseEvents
      },
      {
        headers: {
          'Authorization': REAL_SESSION_ID,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Submit mouse events response:', mouseResponse.data);
    
    // Test 3: Submit security events
    console.log('\n3️⃣ Testing submit security events endpoint...');
    const securityEvents = [
      {
        type: 'FULLSCREEN_EXIT',
        timestamp: Date.now(),
        details: { reason: 'User pressed ESC' }
      }
    ];
    
    const securityResponse = await axios.post(
      `${BASE_URL}/api/exam-attendance/${REAL_EXAM_ID}/submit-security-events`,
      {
        exam_id: REAL_EXAM_ID,
        events: securityEvents
      },
      {
        headers: {
          'Authorization': REAL_SESSION_ID,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Submit security events response:', securityResponse.data);
    
    console.log('\n🎉 All endpoints working successfully!');
    
  } catch (error) {
    console.error('❌ Error testing endpoints:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

testMouseMonitoringFlow();
