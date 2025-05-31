/**
 * Comprehensive testing suite for the anti-abuse detection system
 * Tests all components: detection, monitoring, admin controls, and patterns
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
const TEST_CONFIG = {
  // These should be set via environment variables or test setup
  studentToken: process.env.TEST_STUDENT_TOKEN || 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  adminToken: process.env.TEST_ADMIN_TOKEN || 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  testExamId: process.env.TEST_EXAM_ID || '507f1f77bcf86cd799439011',
  testUserId: process.env.TEST_USER_ID || '507f1f77bcf86cd799439012'
};

// Test utilities
class TestUtils {
  static createAuthClient(token) {
    return axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }

  static createSuspiciousClient(token) {
    return axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PostmanRuntime/7.28.4', // Suspicious user agent
        'X-Postman-Token': crypto.randomUUID(),
        'Cache-Control': 'no-cache'
      }
    });
  }

  static generateSuspiciousHeaders() {
    return {
      'Postman-Token': crypto.randomUUID(),
      'X-Requested-With': 'PostmanRuntime',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    };
  }

  static simulateAutomatedBehavior() {
    return {
      mouseMovements: [], // No mouse movements
      keystrokes: [
        { key: 'A', timestamp: Date.now() },
        { key: 'B', timestamp: Date.now() + 100 },
        { key: 'C', timestamp: Date.now() + 200 }
      ], // Perfect timing
      clickPattern: 'SEQUENTIAL',
      responseTime: 500 // Suspiciously fast
    };
  }

  static simulateNormalBehavior() {
    return {
      mouseMovements: [
        { x: 100, y: 200, timestamp: Date.now() },
        { x: 150, y: 220, timestamp: Date.now() + 500 },
        { x: 200, y: 240, timestamp: Date.now() + 1200 }
      ],
      keystrokes: [
        { key: 'B', timestamp: Date.now() + 2000 },
        { key: 'A', timestamp: Date.now() + 8000 },
        { key: 'C', timestamp: Date.now() + 15000 }
      ],
      clickPattern: 'IRREGULAR',
      responseTime: 8500
    };
  }

  static log(testName, result, details = '') {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
    if (details) console.log(`   ${details}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }
}

// Test Suite Classes
class AntiAbuseDetectionTests {
  constructor() {
    this.studentClient = TestUtils.createAuthClient(TEST_CONFIG.studentToken);
    this.suspiciousClient = TestUtils.createSuspiciousClient(TEST_CONFIG.studentToken);
    this.results = [];
  }

  async testNormalExamAttendance() {
    try {
      const response = await this.studentClient.post(`/exam-attendance/${TEST_CONFIG.testExamId}/attend`, {
        browserFingerprint: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          screen: { width: 1920, height: 1080 },
          timezone: 'America/New_York',
          language: 'en-US'
        },
        behaviorData: TestUtils.simulateNormalBehavior()
      });

      const result = { success: response.status === 200 };
      this.results.push(result);
      TestUtils.log('Normal Exam Attendance', result, 
        `Risk Score: ${response.data.riskAssessment?.overallRiskScore || 'N/A'}`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Normal Exam Attendance', result);
      return result;
    }
  }

  async testSuspiciousExamAttendance() {
    try {
      const suspiciousHeaders = TestUtils.generateSuspiciousHeaders();
      const response = await this.suspiciousClient.post(`/exam-attendance/${TEST_CONFIG.testExamId}/attend`, {
        browserFingerprint: {
          userAgent: 'PostmanRuntime/7.28.4',
          screen: { width: 1024, height: 768 },
          timezone: 'UTC',
          language: 'en'
        },
        behaviorData: TestUtils.simulateAutomatedBehavior()
      }, { headers: suspiciousHeaders });

      const riskScore = response.data.riskAssessment?.overallRiskScore || 0;
      const result = { success: riskScore > 70 }; // Should be flagged as high risk
      this.results.push(result);
      TestUtils.log('Suspicious Exam Attendance', result, 
        `Risk Score: ${riskScore} (Expected > 70)`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Suspicious Exam Attendance', result);
      return result;
    }
  }

  async testAnswerSubmissionWithAnomaly() {
    try {
      // Submit answers with suspicious timing patterns
      const answers = [
        { questionId: 'q1', selectedOption: 'A', timeSpent: 500 },
        { questionId: 'q2', selectedOption: 'B', timeSpent: 500 },
        { questionId: 'q3', selectedOption: 'C', timeSpent: 500 }
      ];

      const response = await this.suspiciousClient.post(`/exam-attendance/${TEST_CONFIG.testExamId}/submit-answer`, {
        answers,
        behaviorData: TestUtils.simulateAutomatedBehavior(),
        jsChallenge: 'invalid_challenge_response'
      });

      const riskScore = response.data.riskAssessment?.overallRiskScore || 0;
      const result = { success: riskScore > 60 };
      this.results.push(result);
      TestUtils.log('Answer Submission with Anomaly', result, 
        `Risk Score: ${riskScore} (Expected > 60)`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Answer Submission with Anomaly', result);
      return result;
    }
  }

  async runAllTests() {
    console.log('🧪 Running Anti-Abuse Detection Tests...\n');
    
    await this.testNormalExamAttendance();
    await this.testSuspiciousExamAttendance();
    await this.testAnswerSubmissionWithAnomaly();

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log(`📊 Detection Tests Summary: ${passed}/${total} passed\n`);
    return { passed, total, results: this.results };
  }
}

class AdminControlTests {
  constructor() {
    this.adminClient = TestUtils.createAuthClient(TEST_CONFIG.adminToken);
    this.results = [];
  }

  async testSecurityDashboard() {
    try {
      const response = await this.adminClient.get('/admin/security/dashboard');
      
      const result = { 
        success: response.status === 200 && 
                 response.data.success &&
                 response.data.dashboard
      };
      this.results.push(result);
      TestUtils.log('Security Dashboard Access', result,
        `Active Sessions: ${response.data.dashboard?.activeSessions || 'N/A'}`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Security Dashboard Access', result);
      return result;
    }
  }

  async testSessionAnalysis() {
    try {
      // Use a test session ID - in real tests this would be from previous test
      const testSessionId = 'TEST_SESSION_ID';
      const response = await this.adminClient.get(`/admin/security/sessions/${testSessionId}/analysis`);
      
      const result = { success: response.status === 200 };
      this.results.push(result);
      TestUtils.log('Session Analysis', result);
      return result;
    } catch (error) {
      // Expected to fail with test data, but should return proper error structure
      const result = { success: error.response?.status === 404 };
      this.results.push(result);
      TestUtils.log('Session Analysis', result, 'Expected 404 for test session');
      return result;
    }
  }

  async testRiskThresholdConfiguration() {
    try {
      // Get current thresholds
      const getResponse = await this.adminClient.get('/admin/security/config/risk-thresholds');
      
      // Update thresholds
      const newThresholds = {
        suspicious: 40,
        highRisk: 70,
        critical: 90,
        autoSuspend: 95
      };
      
      const updateResponse = await this.adminClient.put('/admin/security/config/risk-thresholds', {
        thresholds: newThresholds
      });
      
      const result = { 
        success: getResponse.status === 200 && 
                 updateResponse.status === 200 
      };
      this.results.push(result);
      TestUtils.log('Risk Threshold Configuration', result);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Risk Threshold Configuration', result);
      return result;
    }
  }

  async testSecurityAlerts() {
    try {
      const response = await this.adminClient.get('/admin/security/alerts?limit=10');
      
      const result = { 
        success: response.status === 200 && 
                 Array.isArray(response.data.alerts)
      };
      this.results.push(result);
      TestUtils.log('Security Alerts Retrieval', result,
        `Alert Count: ${response.data.alerts?.length || 'N/A'}`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Security Alerts Retrieval', result);
      return result;
    }
  }

  async runAllTests() {
    console.log('🛡️  Running Admin Control Tests...\n');
    
    await this.testSecurityDashboard();
    await this.testSessionAnalysis();
    await this.testRiskThresholdConfiguration();
    await this.testSecurityAlerts();

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log(`📊 Admin Tests Summary: ${passed}/${total} passed\n`);
    return { passed, total, results: this.results };
  }
}

class PatternDetectionTests {
  constructor() {
    this.results = [];
  }

  async testMouseMovementAnalysis() {
    try {
      // Import pattern detection utilities
      const { patternDetector } = require('../utils/serverPatternDetection');
      
      // Test normal mouse movements
      const normalMovements = [
        { x: 100, y: 200, timestamp: Date.now() },
        { x: 150, y: 220, timestamp: Date.now() + 500 },
        { x: 200, y: 240, timestamp: Date.now() + 1200 }
      ];
      
      const normalAnalysis = patternDetector.analyzeMouseMovements(normalMovements);
      
      // Test suspicious (no) mouse movements
      const suspiciousMovements = [];
      const suspiciousAnalysis = patternDetector.analyzeMouseMovements(suspiciousMovements);
      
      const result = { 
        success: normalAnalysis.riskScore < 50 && 
                 suspiciousAnalysis.riskScore > 70
      };
      this.results.push(result);
      TestUtils.log('Mouse Movement Analysis', result,
        `Normal: ${normalAnalysis.riskScore}, Suspicious: ${suspiciousAnalysis.riskScore}`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Mouse Movement Analysis', result);
      return result;
    }
  }

  async testKeystrokePatternAnalysis() {
    try {
      const { patternDetector } = require('../utils/serverPatternDetection');
      
      // Test normal keystroke patterns
      const normalKeystrokes = [
        { key: 'B', timestamp: Date.now() + 2000 },
        { key: 'A', timestamp: Date.now() + 8000 },
        { key: 'C', timestamp: Date.now() + 15000 }
      ];
      
      const normalAnalysis = patternDetector.analyzeKeystrokePatterns(normalKeystrokes);
      
      // Test automated keystroke patterns
      const automatedKeystrokes = [
        { key: 'A', timestamp: Date.now() },
        { key: 'B', timestamp: Date.now() + 100 },
        { key: 'C', timestamp: Date.now() + 200 }
      ];
      
      const automatedAnalysis = patternDetector.analyzeKeystrokePatterns(automatedKeystrokes);
      
      const result = { 
        success: normalAnalysis.riskScore < 50 && 
                 automatedAnalysis.riskScore > 70
      };
      this.results.push(result);
      TestUtils.log('Keystroke Pattern Analysis', result,
        `Normal: ${normalAnalysis.riskScore}, Automated: ${automatedAnalysis.riskScore}`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Keystroke Pattern Analysis', result);
      return result;
    }
  }

  async testSequentialAnswerDetection() {
    try {
      const { patternDetector } = require('../utils/serverPatternDetection');
      
      // Test normal answer pattern
      const normalAnswers = ['B', 'A', 'D', 'C', 'B', 'A'];
      const normalAnalysis = patternDetector.detectSequentialAnswering(normalAnswers);
      
      // Test suspicious sequential pattern
      const sequentialAnswers = ['A', 'B', 'C', 'D', 'A', 'B'];
      const sequentialAnalysis = patternDetector.detectSequentialAnswering(sequentialAnswers);
      
      const result = { 
        success: !normalAnalysis.isSequential && 
                 sequentialAnalysis.isSequential
      };
      this.results.push(result);
      TestUtils.log('Sequential Answer Detection', result,
        `Normal: ${normalAnalysis.isSequential}, Sequential: ${sequentialAnalysis.isSequential}`);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this.results.push(result);
      TestUtils.log('Sequential Answer Detection', result);
      return result;
    }
  }

  async runAllTests() {
    console.log('🔍 Running Pattern Detection Tests...\n');
    
    await this.testMouseMovementAnalysis();
    await this.testKeystrokePatternAnalysis();
    await this.testSequentialAnswerDetection();

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log(`📊 Pattern Tests Summary: ${passed}/${total} passed\n`);
    return { passed, total, results: this.results };
  }
}

// Main test runner
class AntiAbuseTestSuite {
  async runAll() {
    console.log('🚀 Starting Comprehensive Anti-Abuse Test Suite\n');
    console.log('='.repeat(50));
    
    const detectionTests = new AntiAbuseDetectionTests();
    const adminTests = new AdminControlTests();
    const patternTests = new PatternDetectionTests();
    
    const detectionResults = await detectionTests.runAllTests();
    const adminResults = await adminTests.runAllTests();
    const patternResults = await patternTests.runAllTests();
    
    const totalPassed = detectionResults.passed + adminResults.passed + patternResults.passed;
    const totalTests = detectionResults.total + adminResults.total + patternResults.total;
    
    console.log('='.repeat(50));
    console.log(`🏁 FINAL RESULTS: ${totalPassed}/${totalTests} tests passed`);
    console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 All tests passed! Anti-abuse system is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Review the results above for details.');
    }
    
    return {
      detection: detectionResults,
      admin: adminResults,
      patterns: patternResults,
      overall: { passed: totalPassed, total: totalTests }
    };
  }
}

// Export for use in other test files or direct execution
module.exports = {
  AntiAbuseTestSuite,
  AntiAbuseDetectionTests,
  AdminControlTests,
  PatternDetectionTests,
  TestUtils
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new AntiAbuseTestSuite();
  testSuite.runAll().catch(console.error);
}
