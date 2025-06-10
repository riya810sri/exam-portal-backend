// Simple test to use existing attendance record and test monitoring
const mongoose = require('mongoose');
const config = require('./config/config');
const ExamAttendance = require('./models/examAttendance.model');
const Session = require('./models/session.model');
const User = require('./models/user.model');
const fetch = require('node-fetch');
const io = require('socket.io-client');

// Connect to the database
mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Known test data
const examId = '68274422db1570c33bfef3a9';
const userId = '6839f5c5c1224dddba8b10ce';

async function testExistingAttendance() {
  try {
    console.log('🔍 Testing with existing attendance record...');
    
    // 1. Find user
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found!');
      return;
    }
    console.log(`✅ Found user: ${user.email}`);

    // 2. Create fresh session
    await Session.deleteMany({ userId });
    const session = new Session({
      userId,
      sessionId: `test_session_${Date.now()}`,
      isValid: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    await session.save();
    console.log(`✅ Created session: ${session.sessionId}`);

    // 3. Find existing attendance record
    console.log('\n🔍 Looking for existing attendance records...');
    const attendances = await ExamAttendance.find({
      examId: new mongoose.Types.ObjectId(examId),
      userId: new mongoose.Types.ObjectId(userId)
    }).sort({ startTime: -1 });

    console.log(`Found ${attendances.length} attendance records:`);
    attendances.forEach((att, index) => {
      console.log(`   ${index + 1}. Status: ${att.status}, Start: ${att.startTime}, ID: ${att._id}`);
    });

    let targetAttendance = attendances.find(att => att.status === 'IN_PROGRESS');
    
    if (!targetAttendance && attendances.length > 0) {
      // Update the most recent one to IN_PROGRESS for testing
      targetAttendance = attendances[0];
      targetAttendance.status = 'IN_PROGRESS';
      await targetAttendance.save();
      console.log(`✅ Updated attendance ${targetAttendance._id} to IN_PROGRESS for testing`);
    }

    if (!targetAttendance) {
      console.log('❌ No attendance record found to test with');
      return;
    }

    // 4. Test the start-monitoring endpoint
    console.log('\n🔍 Testing start-monitoring endpoint...');
    
    const endpoint = `http://localhost:3000/api/exam-attendance/${examId}/start-monitoring`;
    console.log(`Testing endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.sessionId}`,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
        screenResolution: '1920x1080',
        timezone: 'Asia/Kolkata',
        browserFingerprint: {
          canvas: 'test_canvas_fingerprint',
          webGL: 'Mozilla - Test WebGL',
          fonts: ['Arial', 'Times New Roman'],
          plugins: ['PDF Viewer']
        }
      })
    });

    console.log(`\n📡 Response status: ${response.status}`);
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (result.success && result.socket) {
      console.log('\n✅ START-MONITORING ENDPOINT WORKING!');
      console.log('Socket configuration received:');
      console.log(`   Port: ${result.socket.port}`);
      console.log(`   URL: ${result.socket.url}`);
      console.log(`   Monitoring ID: ${result.socket.monit_id}`);
      
      // 5. Test socket connection
      console.log('\n🔌 Testing socket connection...');
      
      await testSocketConnection(result.socket, targetAttendance);
      
    } else {
      console.log('❌ Start-monitoring endpoint failed');
      console.log('Response details:', result);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Test completed');
  }
}

async function testSocketConnection(socketConfig, attendance) {
  return new Promise((resolve) => {
    const socketUrl = socketConfig.url || `http://localhost:${socketConfig.port}`;
    console.log(`Connecting to: ${socketUrl}`);
    
    const socketClient = io(socketUrl, {
      transports: socketConfig.protocols || ['websocket', 'polling'],
      query: {
        monit_id: socketConfig.monit_id,
        client_type: 'exam_client'
      }
    });

    const timeout = setTimeout(() => {
      console.log('❌ Socket connection timeout (10 seconds)');
      socketClient.disconnect();
      resolve();
    }, 10000);

    socketClient.on('connect', () => {
      console.log('✅ Socket connected successfully!');
      
      // Test mouse data transmission
      console.log('\n📤 Testing mouse data transmission...');
      
      const testMouseData = {
        events: [
          { x: 100, y: 200, timestamp: Date.now(), type: 'mousemove' },
          { x: 150, y: 250, timestamp: Date.now() + 100, type: 'mousemove' },
          { x: 200, y: 300, timestamp: Date.now() + 200, type: 'click', button: 0 }
        ],
        eventType: 'test',
        totalClicks: 1,
        rapidClicks: 0,
        timestamp: Date.now(),
        examId,
        sessionInfo: {
          currentPage: 'test',
          timeRemaining: 3600,
          examStartTime: attendance.startTime
        }
      };

      console.log('Sending mouse data:', JSON.stringify(testMouseData, null, 2));
      socketClient.emit('mouse_data', testMouseData);

      // Listen for responses
      socketClient.on('mouse_data_received', (data) => {
        console.log('✅ Mouse data acknowledgment received:', data);
      });

      socketClient.on('security_warning', (warning) => {
        console.log('⚠️ Security warning received:', warning);
      });

      // Test keyboard data too
      setTimeout(() => {
        console.log('\n📤 Testing keyboard data transmission...');
        
        const testKeyboardData = {
          events: [
            { type: 'keydown', key: 'a', timestamp: Date.now() },
            { type: 'keyup', key: 'a', timestamp: Date.now() + 100 }
          ],
          activeKeys: [],
          timestamp: Date.now()
        };
        
        console.log('Sending keyboard data:', JSON.stringify(testKeyboardData, null, 2));
        socketClient.emit('keyboard_data', testKeyboardData);
      }, 2000);

      // Clean up
      setTimeout(() => {
        console.log('\n🧹 Disconnecting test socket');
        clearTimeout(timeout);
        socketClient.disconnect();
        resolve();
      }, 5000);
    });

    socketClient.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error.message);
      clearTimeout(timeout);
      resolve();
    });

    socketClient.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      clearTimeout(timeout);
      resolve();
    });

    socketClient.on('error', (error) => {
      console.log('❌ Socket error:', error);
    });
  });
}

// Run the test
testExistingAttendance();
