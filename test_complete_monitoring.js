// Comprehensive test for monitoring with proper authentication
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

const examId = '68274422db1570c33bfef3a9';
const userId = '6839f5c5c1224dddba8b10ce';

async function testCompleteMonitoringFlow() {
  try {
    console.log('🔍 Starting Complete Monitoring Flow Test');
    console.log('=======================================');

    // Step 1: Find user and exam
    const user = await User.findById(userId);
    const exam = await Exam.findById(examId);
    
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    
    if (!exam) {
      console.error('❌ Exam not found');
      return;
    }
    
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ Exam: ${exam.title}`);

    // Step 2: Create a proper session
    console.log('\n📝 Creating authentication session...');
    
    // Clean up existing sessions
    await Session.deleteMany({ userId });
    
    const sessionId = `monitor_test_${Date.now()}`;
    const session = new Session({
      userId,
      sessionId,
      isValid: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    await session.save();
    console.log(`✅ Session created: ${sessionId}`);

    // Step 3: Check existing attendance records
    console.log('\n📋 Checking attendance records...');
    
    const existingAttendances = await ExamAttendance.find({
      examId: new mongoose.Types.ObjectId(examId),
      userId: new mongoose.Types.ObjectId(userId)
    }).sort({ startTime: -1 });

    console.log(`Found ${existingAttendances.length} existing attendance records:`);
    existingAttendances.forEach((att, index) => {
      console.log(`   ${index + 1}. Status: ${att.status}, Start: ${att.startTime}, ID: ${att._id}`);
    });

    // Step 4: Ensure we have an IN_PROGRESS attendance
    let activeAttendance = existingAttendances.find(att => att.status === 'IN_PROGRESS');
    
    if (!activeAttendance) {
      console.log('\n🔧 No IN_PROGRESS attendance found, creating one...');
      
      try {
        activeAttendance = new ExamAttendance({
          examId: new mongoose.Types.ObjectId(examId),
          userId: new mongoose.Types.ObjectId(userId),
          totalQuestions: exam.sections?.mcqs?.length || 5,
          startTime: new Date(),
          status: 'IN_PROGRESS',
          attemptNumber: 1,
          score: 0,
          attemptedQuestions: 0
        });
        await activeAttendance.save();
        console.log(`✅ Created new IN_PROGRESS attendance: ${activeAttendance._id}`);
      } catch (createError) {
        if (createError.code === 11000) {
          // Duplicate key error, update existing one
          console.log('⚠️ Duplicate attendance, updating existing one to IN_PROGRESS...');
          
          const existingAtt = await ExamAttendance.findOne({
            examId: new mongoose.Types.ObjectId(examId),
            userId: new mongoose.Types.ObjectId(userId),
            attemptNumber: 1
          });
          
          if (existingAtt) {
            existingAtt.status = 'IN_PROGRESS';
            await existingAtt.save();
            activeAttendance = existingAtt;
            console.log(`✅ Updated attendance to IN_PROGRESS: ${activeAttendance._id}`);
          }
        } else {
          throw createError;
        }
      }
    } else {
      console.log(`✅ Found existing IN_PROGRESS attendance: ${activeAttendance._id}`);
    }

    // Step 5: Test the start-monitoring endpoint
    console.log('\n🎯 Testing start-monitoring endpoint...');
    
    const endpoint = `http://localhost:3000/api/exam-attendance/${examId}/start-monitoring`;
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Session: ${sessionId}`);
    
    const requestBody = {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
      screenResolution: '1920x1080',
      timezone: 'Asia/Kolkata',
      browserFingerprint: {
        canvas: 'test_canvas_fingerprint',
        webGL: 'Mozilla - Test WebGL Context',
        fonts: ['Arial', 'Times New Roman', 'Helvetica'],
        plugins: ['PDF Viewer', 'Chrome PDF Viewer']
      }
    };

    console.log('Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionId}`,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0',
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`\n📡 Response Status: ${response.status}`);
    const responseText = await response.text();
    
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Response Body:', JSON.stringify(result, null, 2));
    } catch (parseError) {
      console.log('Raw Response:', responseText);
      console.error('❌ Failed to parse response as JSON:', parseError.message);
      return;
    }

    // Step 6: Analyze the response
    if (response.status === 200 && result.success) {
      console.log('\n🎉 SUCCESS! Start-monitoring endpoint is working correctly!');
      
      if (result.socket) {
        console.log('\n🔌 Socket Configuration Received:');
        console.log(`   Port: ${result.socket.port}`);
        console.log(`   URL: ${result.socket.url}`);
        console.log(`   Monitoring ID: ${result.socket.monit_id}`);
        console.log(`   Protocols: ${result.socket.protocols?.join(', ')}`);
        
        console.log('\n✅ DIAGNOSIS: Backend mouse monitoring setup is WORKING!');
        console.log('   The issue might be in the frontend-backend communication.');
        console.log('   Frontend should successfully connect to this socket configuration.');
        
        // Step 7: Test basic socket connection (optional)
        console.log('\n🧪 Testing basic socket connection...');
        await testBasicSocketConnection(result.socket);
        
      } else {
        console.log('⚠️ Socket configuration not provided in response');
      }
      
    } else {
      console.log('\n❌ FAILED! Start-monitoring endpoint not working correctly');
      console.log('Response status:', response.status);
      console.log('Response body:', result);
      
      if (response.status === 401) {
        console.log('🔐 Authentication issue detected');
      } else if (response.status === 404) {
        console.log('📝 Attendance record issue detected');
      } else {
        console.log('🛠️ Other server-side issue detected');
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Test completed and database disconnected');
    
    console.log('\n🔍 SUMMARY:');
    console.log('- If start-monitoring succeeded: The backend is working correctly');
    console.log('- If authentication failed: Check session management');
    console.log('- If attendance not found: Check exam session setup');
    console.log('- If socket connection failed: Check DynamicSocketManager');
    console.log('- Next step: Test frontend integration with this working backend');
  }
}

async function testBasicSocketConnection(socketConfig) {
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
        console.log('   ⏰ Socket connection timeout (5 seconds)');
        client.disconnect();
        resolve();
      }, 5000);

      client.on('connect', () => {
        console.log('   ✅ Socket connected successfully!');
        clearTimeout(timeout);
        client.disconnect();
        resolve();
      });

      client.on('connect_error', (error) => {
        console.log('   ❌ Socket connection error:', error.message);
        clearTimeout(timeout);
        resolve();
      });

    } catch (error) {
      console.log('   ❌ Socket test error:', error.message);
      resolve();
    }
  });
}

// Run the comprehensive test
testCompleteMonitoringFlow();
