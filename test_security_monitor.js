// First check if global.io is available (from running server)
if (!global.io) {
  console.log('⚠️ No global.io found. This test should be run while the server is running.');
  console.log('🔧 Setting up mock WebSocket for testing...');
  
  // Mock Socket.IO for testing
  global.io = {
    to: (room) => ({
      emit: (event, data) => {
        console.log(`📡 [MOCK] Would broadcast to room "${room}": ${event}`, data);
      }
    })
  };
}

const { ExamSecurityMonitor, securityMonitor } = require('./utils/securityMonitor');

// Use existing monitor instance or create new one
const monitor = securityMonitor || new ExamSecurityMonitor();

console.log('🧪 Testing WebSocket Security Monitor');
console.log('=====================================');

// Test data
const testEventData = {
  userId: 'test-user-123',
  examId: 'test-exam-456',
  sessionId: 'test-session-789',
  examTitle: 'Advanced JavaScript Exam',
  userEmail: 'test@example.com',
  userName: 'Test Student',
  violation: {
    evidenceType: 'tab_switch',
    details: {
      timestamp: new Date().toISOString(),
      userAgent: 'Test Browser',
      ip: '127.0.0.1',
      detectedAt: 'question 5 of 20'
    }
  },
  riskLevel: {
    score: 75,
    level: 'medium'
  }
};

// Test 1: Suspicious Activity
console.log('\n1️⃣ Testing Suspicious Activity Event...');
setTimeout(() => {
  monitor.emit('suspiciousActivity', {
    ...testEventData,
    violation: {
      evidenceType: 'tab_switch',
      details: { message: 'Student switched tabs during exam' }
    }
  });
}, 1000);

// Test 2: High Risk Session
console.log('\n2️⃣ Testing High Risk Session Event...');
setTimeout(() => {
  monitor.emit('highRiskSession', {
    ...testEventData,
    riskLevel: { score: 85, level: 'high' },
    violation: {
      evidenceType: 'multiple_violations',
      details: { message: 'Multiple security violations detected' }
    }
  });
}, 3000);

// Test 3: Critical Threat
console.log('\n3️⃣ Testing Critical Threat Event...');
setTimeout(() => {
  monitor.emit('criticalThreat', {
    ...testEventData,
    riskLevel: { score: 95, level: 'critical' },
    violation: {
      evidenceType: 'cheating_detected',
      details: { message: 'Potential cheating behavior detected - immediate action required' }
    }
  });
}, 5000);

// Test 4: Auto Suspend
console.log('\n4️⃣ Testing Auto Suspend Event...');
setTimeout(() => {
  monitor.emit('autoSuspend', {
    ...testEventData,
    riskLevel: { score: 98, level: 'critical' },
    violation: {
      evidenceType: 'auto_suspend',
      details: { 
        message: 'Session automatically suspended due to critical violations',
        reason: 'Exceeded maximum violation threshold'
      }
    }
  });
}, 7000);

// Test WebSocket broadcasting methods directly
console.log('\n5️⃣ Testing Direct WebSocket Methods...');
setTimeout(() => {
  console.log('Testing broadcastToAdmins...');
  monitor.broadcastToAdmins('test-admin-alert', {
    message: 'Test admin notification',
    severity: 'medium',
    userId: testEventData.userId
  });
}, 9000);

setTimeout(() => {
  console.log('Testing sendToUser...');
  monitor.sendToUser(testEventData.userId, 'test-user-notification', {
    message: 'Test user notification',
    type: 'warning'
  });
}, 11000);

setTimeout(() => {
  console.log('Testing sendToExamSession...');
  monitor.sendToExamSession(testEventData.examId, 'test-exam-broadcast', {
    message: 'Test exam-wide notification',
    type: 'info'
  });
}, 13000);

// Display stats after tests
setTimeout(() => {
  console.log('\n📊 Security Monitor Stats:');
  console.log('==========================');
  console.log(JSON.stringify(monitor.stats, null, 2));
  
  console.log('\n✅ WebSocket Security Monitor Test Complete!');
  console.log('Check your browser test page for real-time WebSocket events.');
  console.log('You should see the events being broadcasted to connected clients.');
  
  // Exit after tests
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}, 15000);
