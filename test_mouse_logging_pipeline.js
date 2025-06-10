#!/usr/bin/env node

/**
 * Comprehensive Mouse Event Logging Pipeline Test
 * Tests the complete flow from mouse event generation to database logging
 */

const mongoose = require('mongoose');
const { DynamicSocketManager } = require('./utils/dynamicSocketManager');
const { securityEventLogger } = require('./utils/securityEventLogger');
const { comprehensiveSecurityMonitor } = require('./utils/comprehensiveSecurityMonitor');
const { processMouseData } = require('./utils/mouseMonitoring');
const SecurityEvent = require('./models/securityEvent.model');
const ExamAttendance = require('./models/examAttendance.model');
require('dotenv').config();

class MouseLoggingPipelineTest {
  constructor() {
    this.testResults = [];
    this.manager = null;
    this.testMonitId = `test_${Date.now()}`;
    this.testExamId = 'exam_test_123';
    this.testStudentId = 'student_test_456';
  }

  async setup() {
    try {
      console.log('🔧 Setting up test environment...');
      
      // Connect to database
      await this.connectDatabase();
      
      // Clean up any existing test data
      await this.cleanupTestData();
      
      // Create test exam attendance record
      await this.createTestAttendanceRecord();
      
      console.log('✅ Test environment setup complete');
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  }

  async connectDatabase() {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('📊 Connected to MongoDB');
    }
  }

  async cleanupTestData() {
    // Remove any existing test security events
    await SecurityEvent.deleteMany({
      monit_id: this.testMonitId
    });
    
    // Remove any existing test attendance records
    await ExamAttendance.deleteMany({
      examId: this.testExamId,
      userId: this.testStudentId
    });
    
    console.log('🧹 Test data cleaned up');
  }

  async createTestAttendanceRecord() {
    const attendance = new ExamAttendance({
      examId: this.testExamId,
      userId: this.testStudentId,
      status: 'IN_PROGRESS',
      startTime: new Date(),
      behaviorProfile: {},
      riskAssessment: {
        overallRiskScore: 0,
        riskFactors: [],
        violationCount: 0,
        lastUpdated: new Date()
      }
    });
    
    await attendance.save();
    console.log('📝 Test attendance record created');
  }

  generateTestMouseEvents() {
    const events = [];
    const baseTime = Date.now();
    
    // Generate normal mouse movements
    for (let i = 0; i < 10; i++) {
      events.push({
        type: 'mousemove',
        x: 100 + i * 10,
        y: 100 + i * 5,
        timestamp: baseTime + i * 100,
        button: null
      });
    }
    
    // Generate some clicks
    events.push({
      type: 'click',
      x: 200,
      y: 150,
      timestamp: baseTime + 1100,
      button: 0
    });
    
    // Generate suspicious rapid movements (should trigger high risk score)
    for (let i = 0; i < 20; i++) {
      events.push({
        type: 'mousemove',
        x: Math.random() * 1000,
        y: Math.random() * 800,
        timestamp: baseTime + 1200 + i * 5, // Very rapid - 5ms intervals
        button: null
      });
    }
    
    return events;
  }

  generateSuspiciousMouseEvents() {
    const events = [];
    const baseTime = Date.now();
    
    // Generate perfectly linear movements (bot-like)
    for (let i = 0; i < 50; i++) {
      events.push({
        type: 'mousemove',
        x: i * 10,
        y: i * 10,
        timestamp: baseTime + i * 10, // Perfect timing
        button: null
      });
    }
    
    return events;
  }

  async testMouseDataProcessing() {
    console.log('\n🐭 Testing mouse data processing utility...');
    
    try {
      const testEvents = this.generateTestMouseEvents();
      const result = processMouseData(testEvents);
      
      this.testResults.push({
        test: 'Mouse Data Processing',
        success: true,
        details: {
          inputEvents: testEvents.length,
          processedEvents: result.processed.length,
          riskScore: result.analysis.riskScore,
          patterns: result.analysis.patterns?.length || 0,
          anomalies: result.analysis.anomalies?.length || 0
        }
      });
      
      console.log('✅ Mouse data processing test passed:', {
        processedEvents: result.processed.length,
        riskScore: result.analysis.riskScore
      });
      
      return result;
    } catch (error) {
      console.error('❌ Mouse data processing test failed:', error);
      this.testResults.push({
        test: 'Mouse Data Processing',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async testSecurityEventLogger() {
    console.log('\n🔒 Testing security event logger...');
    
    try {
      await securityEventLogger.logEvent({
        monit_id: this.testMonitId,
        exam_id: this.testExamId,
        student_id: this.testStudentId,
        event_type: 'MOUSE_TEST',
        details: {
          testData: true,
          riskScore: 75
        },
        risk_score: 75,
        is_suspicious: true
      });
      
      // Verify the event was logged
      const loggedEvents = await SecurityEvent.find({
        monit_id: this.testMonitId,
        event_type: 'MOUSE_TEST'
      });
      
      this.testResults.push({
        test: 'Security Event Logger',
        success: loggedEvents.length > 0,
        details: {
          eventsLogged: loggedEvents.length
        }
      });
      
      console.log('✅ Security event logger test passed:', {
        eventsLogged: loggedEvents.length
      });
      
    } catch (error) {
      console.error('❌ Security event logger test failed:', error);
      this.testResults.push({
        test: 'Security Event Logger',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async testComprehensiveSecurityMonitor() {
    console.log('\n🔍 Testing comprehensive security monitor...');
    
    try {
      const result = await comprehensiveSecurityMonitor.processSecurityEvent({
        monit_id: this.testMonitId,
        exam_id: this.testExamId,
        student_id: this.testStudentId,
        event_type: 'MOUSE_ACTIVITY',
        event_data: {
          riskScore: 85,
          patterns: ['RAPID_MOVEMENT', 'ERRATIC_PATTERN'],
          anomalies: ['INHUMAN_PRECISION'],
          eventCount: 50
        }
      });
      
      this.testResults.push({
        test: 'Comprehensive Security Monitor',
        success: true,
        details: {
          riskLevel: result.riskLevel,
          sessionAction: result.sessionAction,
          alertGenerated: result.alertGenerated
        }
      });
      
      console.log('✅ Comprehensive security monitor test passed:', {
        riskLevel: result.riskLevel,
        sessionAction: result.sessionAction
      });
      
      return result;
    } catch (error) {
      console.error('❌ Comprehensive security monitor test failed:', error);
      this.testResults.push({
        test: 'Comprehensive Security Monitor',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async testEndToEndPipeline() {
    console.log('\n🔗 Testing end-to-end mouse logging pipeline...');
    
    try {
      // Generate test mouse events
      const testEvents = this.generateSuspiciousMouseEvents();
      
      // Create mock socket object
      const mockSocket = {
        handshake: {
          headers: { 'user-agent': 'Test Browser' },
          address: '127.0.0.1'
        },
        emit: (event, data) => {
          console.log(`📡 Socket emit: ${event}`, data);
        }
      };
      
      // Get dynamic socket manager instance
      this.manager = DynamicSocketManager.getInstance();
      
      // Process mouse data through the pipeline
      await this.manager.processMouseData(
        { events: testEvents },
        this.testMonitId,
        this.testExamId,
        this.testStudentId,
        mockSocket
      );
      
      // Wait a moment for async operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify security events were created
      const securityEvents = await SecurityEvent.find({
        monit_id: this.testMonitId,
        student_id: this.testStudentId
      });
      
      // Verify attendance record was updated
      const attendance = await ExamAttendance.findOne({
        examId: this.testExamId,
        userId: this.testStudentId
      });
      
      const success = securityEvents.length > 0 && attendance && attendance.behaviorProfile;
      
      this.testResults.push({
        test: 'End-to-End Pipeline',
        success,
        details: {
          securityEventsCreated: securityEvents.length,
          attendanceUpdated: !!attendance?.behaviorProfile,
          mouseMovements: attendance?.behaviorProfile?.mouseMovements?.length || 0,
          automationRisk: attendance?.behaviorProfile?.automationRisk || 0
        }
      });
      
      console.log('✅ End-to-end pipeline test completed:', {
        securityEvents: securityEvents.length,
        attendanceUpdated: !!attendance?.behaviorProfile
      });
      
    } catch (error) {
      console.error('❌ End-to-end pipeline test failed:', error);
      this.testResults.push({
        test: 'End-to-End Pipeline',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async testHighVolumeProcessing() {
    console.log('\n⚡ Testing high-volume mouse event processing...');
    
    try {
      const startTime = Date.now();
      
      // Generate large number of events
      const largeEventSet = [];
      for (let batch = 0; batch < 10; batch++) {
        largeEventSet.push(...this.generateTestMouseEvents());
      }
      
      console.log(`Processing ${largeEventSet.length} mouse events...`);
      
      // Create mock socket
      const mockSocket = {
        handshake: {
          headers: { 'user-agent': 'Test Browser' },
          address: '127.0.0.1'
        },
        emit: () => {}
      };
      
      // Process through pipeline
      await this.manager.processMouseData(
        { events: largeEventSet },
        `${this.testMonitId}_volume`,
        this.testExamId,
        this.testStudentId,
        mockSocket
      );
      
      const processingTime = Date.now() - startTime;
      
      this.testResults.push({
        test: 'High Volume Processing',
        success: true,
        details: {
          eventCount: largeEventSet.length,
          processingTimeMs: processingTime,
          eventsPerSecond: Math.round(largeEventSet.length / (processingTime / 1000))
        }
      });
      
      console.log('✅ High-volume processing test passed:', {
        events: largeEventSet.length,
        time: `${processingTime}ms`,
        rate: `${Math.round(largeEventSet.length / (processingTime / 1000))} events/sec`
      });
      
    } catch (error) {
      console.error('❌ High-volume processing test failed:', error);
      this.testResults.push({
        test: 'High Volume Processing',
        success: false,
        error: error.message
      });
    }
  }

  async generateTestReport() {
    console.log('\n📊 Generating Test Report...');
    console.log('=' .repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.test}`);
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   - ${key}: ${value}`);
        });
      }
      
      if (result.error) {
        console.log(`   - Error: ${result.error}`);
      }
    });
    
    // Database statistics
    const totalSecurityEvents = await SecurityEvent.countDocuments({
      monit_id: { $regex: this.testMonitId }
    });
    
    console.log(`\n📊 DATABASE STATISTICS:`);
    console.log(`- Security Events Created: ${totalSecurityEvents}`);
    console.log(`- Test Monitoring Session: ${this.testMonitId}`);
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: Math.round((passedTests / totalTests) * 100),
      securityEventsCreated: totalSecurityEvents
    };
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    await this.cleanupTestData();
    console.log('✅ Cleanup complete');
  }

  async runAllTests() {
    try {
      console.log('🚀 Starting Mouse Logging Pipeline Test Suite');
      console.log('=' .repeat(60));
      
      await this.setup();
      
      await this.testMouseDataProcessing();
      await this.testSecurityEventLogger();
      await this.testComprehensiveSecurityMonitor();
      await this.testEndToEndPipeline();
      await this.testHighVolumeProcessing();
      
      const report = await this.generateTestReport();
      
      await this.cleanup();
      
      console.log('\n🎉 Test suite completed!');
      
      return report;
      
    } catch (error) {
      console.error('💥 Test suite failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new MouseLoggingPipelineTest();
  testSuite.runAllTests()
    .then((report) => {
      if (report.successRate === 100) {
        console.log('\n🎊 ALL TESTS PASSED! Mouse logging pipeline is working correctly.');
        process.exit(0);
      } else {
        console.log('\n⚠️ Some tests failed. Please review the results above.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = MouseLoggingPipelineTest;
