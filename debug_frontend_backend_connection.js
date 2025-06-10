// Debug script to test frontend-backend mouse monitoring connection
const mongoose = require('mongoose');
const config = require('./config/config');
const ExamAttendance = require('./models/examAttendance.model');
const Session = require('./models/session.model');
const User = require('./models/user.model');
const Exam = require('./models/exam.model');
const fetch = require('node-fetch');

// Connect to the database
mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Known data from previous conversations
const examId = '68274422db1570c33bfef3a9';
const userId = '6839f5c5c1224dddba8b10ce';

async function debugFrontendBackendConnection() {
  try {
    console.log('🔍 Debugging Frontend-Backend Connection for Mouse Monitoring');
    console.log('======================================================');

    // 1. Check if exam exists
    console.log('\n1. Checking if exam exists...');
    const exam = await Exam.findById(examId);
    if (!exam) {
      console.error('❌ Exam not found!');
      return;
    }
    console.log(`✅ Exam found: ${exam.title}`);

    // 2. Check if user exists
    console.log('\n2. Checking if user exists...');
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found!');
      return;
    }
    console.log(`✅ User found: ${user.email}`);

    // 3. Check current attendance status
    console.log('\n3. Checking current attendance status...');
    const attendances = await ExamAttendance.find({
      examId,
      userId
    }).sort({ startTime: -1 });

    console.log(`Found ${attendances.length} attendance records for this user-exam combination:`);
    attendances.forEach((att, index) => {
      console.log(`   ${index + 1}. Status: ${att.status}, Start: ${att.startTime}, ID: ${att._id}`);
    });

    let inProgressAttendance = attendances.find(att => att.status === 'IN_PROGRESS');

    // 4. Create an IN_PROGRESS attendance if none exists
    if (!inProgressAttendance) {
      console.log('\n4. Creating IN_PROGRESS attendance for testing...');
      inProgressAttendance = new ExamAttendance({
        examId,
        userId,
        totalQuestions: exam.sections?.mcqs?.length || 10,
        startTime: new Date(),
        status: 'IN_PROGRESS',
        attemptNumber: 1,
        score: 0,
        attemptedQuestions: 0
      });
      await inProgressAttendance.save();
      console.log(`✅ Created IN_PROGRESS attendance: ${inProgressAttendance._id}`);
    } else {
      console.log(`✅ Found existing IN_PROGRESS attendance: ${inProgressAttendance._id}`);
    }

    // 5. Create a session for authentication
    console.log('\n5. Creating session for authentication...');
    
    // Remove any existing sessions for this user
    await Session.deleteMany({ userId });
    
    const session = new Session({
      userId,
      sessionId: `test_session_${Date.now()}`,
      isValid: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    await session.save();
    console.log(`✅ Created session: ${session.sessionId}`);

    // 6. Test the start-monitoring endpoint
    console.log('\n6. Testing start-monitoring endpoint...');
    
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

    console.log(`Response status: ${response.status}`);
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (result.success && result.socket) {
      console.log('\n✅ Start-monitoring endpoint working correctly!');
      console.log('Socket configuration received:');
      console.log(`   Port: ${result.socket.port}`);
      console.log(`   URL: ${result.socket.url}`);
      console.log(`   Monitoring ID: ${result.socket.monit_id}`);
      
      // 7. Test socket connection (basic check)
      console.log('\n7. Testing socket connection...');
      
      const io = require('socket.io-client');
      const socketUrl = result.socket.url || `http://localhost:${result.socket.port}`;
      
      console.log(`Attempting to connect to: ${socketUrl}`);
      
      const socketClient = io(socketUrl, {
        transports: result.socket.protocols || ['websocket', 'polling'],
        query: {
          monit_id: result.socket.monit_id,
          client_type: 'exam_client'
        }
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('❌ Socket connection timeout (10 seconds)');
          socketClient.disconnect();
          resolve();
        }, 10000);

        socketClient.on('connect', () => {
          console.log('✅ Socket connected successfully!');
          
          // Test sending mouse data
          console.log('\n8. Testing mouse data transmission...');
          
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
              examStartTime: inProgressAttendance.startTime
            }
          };

          socketClient.emit('mouse_data', testMouseData);
          console.log('📤 Test mouse data sent');

          // Listen for any responses
          socketClient.on('mouse_data_received', (data) => {
            console.log('✅ Mouse data acknowledgment received:', data);
          });

          socketClient.on('security_warning', (warning) => {
            console.log('⚠️ Security warning received:', warning);
          });

          // Clean up after 3 seconds
          setTimeout(() => {
            console.log('🧹 Disconnecting test socket');
            clearTimeout(timeout);
            socketClient.disconnect();
            resolve();
          }, 3000);
        });

        socketClient.on('connect_error', (error) => {
          console.log('❌ Socket connection error:', error.message);
          clearTimeout(timeout);
          resolve();
        });

        socketClient.on('disconnect', (reason) => {
          console.log('🔴 Socket disconnected:', reason);
        });
      });

    } else {
      console.log('❌ Start-monitoring endpoint failed or returned invalid response');
      console.log('This is likely the root cause of the mouse logging issue');
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    console.log('\n======================================================');
    console.log('🔍 Debug Summary:');
    console.log('1. Use the session token printed above for authentication');
    console.log('2. If start-monitoring fails, check middleware and route configuration');
    console.log('3. If socket connection fails, check DynamicSocketManager');
    console.log('4. If mouse data transmission fails, check processMouseData in DynamicSocketManager');
    
    mongoose.disconnect();
    console.log('\n✅ Debug completed and database disconnected');
  }
}

// Run the debug
debugFrontendBackendConnection();
