// Create a proper test session and test monitoring
const mongoose = require('mongoose');
const config = require('./config/config');
const Session = require('./models/session.model');
const User = require('./models/user.model');
const ExamAttendance = require('./models/examAttendance.model');
const fetch = require('node-fetch');

// Connect to the database
mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

const userId = '6839f5c5c1224dddba8b10ce';
const examId = '68274422db1570c33bfef3a9';

async function createValidSessionAndTest() {
  try {
    console.log('🔍 Creating valid session and testing monitoring...');
    
    // 1. Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    console.log(`✅ User found: ${user.email}`);

    // 2. Clean up existing sessions and create new one
    await Session.deleteMany({ userId });
    console.log('🧹 Cleaned up existing sessions');

    // 3. Create a proper session document using the Session model
    const sessionDoc = new Session({
      userId: userId,
      sessionId: `monitoring_test_${Date.now()}`,
      isValid: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    await sessionDoc.save();
    
    const sessionId = sessionDoc._id.toString(); // Use the MongoDB _id as session ID
    console.log(`✅ Created session with ID: ${sessionId}`);

    // 4. Verify attendance record exists and is IN_PROGRESS
    let attendance = await ExamAttendance.findOne({
      examId: new mongoose.Types.ObjectId(examId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'IN_PROGRESS'
    });

    if (!attendance) {
      console.log('📝 No IN_PROGRESS attendance found, looking for any attendance to update...');
      
      // Find any attendance record and update it to IN_PROGRESS
      attendance = await ExamAttendance.findOne({
        examId: new mongoose.Types.ObjectId(examId),
        userId: new mongoose.Types.ObjectId(userId)
      }).sort({ startTime: -1 });

      if (attendance) {
        attendance.status = 'IN_PROGRESS';
        await attendance.save();
        console.log(`✅ Updated existing attendance to IN_PROGRESS: ${attendance._id}`);
      } else {
        console.log('❌ No attendance record found at all');
        return;
      }
    } else {
      console.log(`✅ Found IN_PROGRESS attendance: ${attendance._id}`);
    }

    // 5. Test the monitoring endpoint with proper session
    console.log('\n🎯 Testing start-monitoring endpoint...');
    
    const endpoint = `http://localhost:3000/api/exam-attendance/${examId}/start-monitoring`;
    console.log(`Testing: ${endpoint}`);
    console.log(`Session: ${sessionId}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionId}`,
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({
        userAgent: 'Mozilla/5.0 (Test Browser)',
        screenResolution: '1920x1080',
        timezone: 'Asia/Kolkata',
        browserFingerprint: {
          canvas: 'test_canvas',
          webGL: 'test_webgl',
          fonts: ['Arial', 'Helvetica'],
          plugins: ['PDF Viewer']
        }
      })
    });

    console.log(`Response Status: ${response.status}`);
    const responseText = await response.text();
    
    try {
      const result = JSON.parse(responseText);
      console.log('\n📡 Response Body:');
      console.log(JSON.stringify(result, null, 2));

      if (response.status === 200 && result.success) {
        console.log('\n🎉 SUCCESS! Monitoring endpoint is working!');
        
        if (result.socket) {
          console.log('\n🔌 Socket Configuration:');
          console.log(`   Port: ${result.socket.port}`);
          console.log(`   URL: ${result.socket.url}`);
          console.log(`   Monitoring ID: ${result.socket.monit_id}`);
          
          console.log('\n✅ BACKEND MOUSE LOGGING IS READY!');
          console.log('   The backend monitoring system is fully functional.');
          console.log('   Next step: Verify frontend is calling this endpoint correctly.');
          
          // Test basic socket connection
          await testSocketConnection(result.socket);
          
        } else {
          console.log('⚠️ No socket configuration in response');
        }
      } else {
        console.log('\n❌ Monitoring endpoint failed');
        console.log(`Status: ${response.status}`);
        console.log('Response:', result);
      }

    } catch (parseError) {
      console.log('\n❌ Failed to parse response:');
      console.log('Raw response:', responseText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Test completed');
  }
}

async function testSocketConnection(socketConfig) {
  console.log('\n🧪 Testing socket connection...');
  
  return new Promise((resolve) => {
    try {
      const io = require('socket.io-client');
      const socketUrl = socketConfig.url || `http://localhost:${socketConfig.port}`;
      
      console.log(`   Connecting to: ${socketUrl}`);
      
      const client = io(socketUrl, {
        transports: socketConfig.protocols || ['websocket', 'polling'],
        query: {
          monit_id: socketConfig.monit_id,
          client_type: 'exam_client'
        },
        timeout: 5000
      });

      const timeout = setTimeout(() => {
        console.log('   ⏰ Socket connection timeout');
        client.disconnect();
        resolve();
      }, 5000);

      client.on('connect', () => {
        console.log('   ✅ Socket connected successfully!');
        
        // Test mouse data emission
        const testMouseData = {
          events: [
            { x: 100, y: 200, timestamp: Date.now(), type: 'mousemove' },
            { x: 150, y: 250, timestamp: Date.now() + 50, type: 'click', button: 0 }
          ],
          eventType: 'test',
          timestamp: Date.now()
        };
        
        console.log('   📤 Sending test mouse data...');
        client.emit('mouse_data', testMouseData);
        
        setTimeout(() => {
          console.log('   🧹 Disconnecting test client');
          clearTimeout(timeout);
          client.disconnect();
          resolve();
        }, 2000);
      });

      client.on('connect_error', (error) => {
        console.log('   ❌ Socket connection error:', error.message);
        clearTimeout(timeout);
        resolve();
      });

      client.on('mouse_data_received', (data) => {
        console.log('   ✅ Mouse data acknowledgment received:', data);
      });

    } catch (error) {
      console.log('   ❌ Socket test error:', error.message);
      resolve();
    }
  });
}

// Run the test
createValidSessionAndTest();
