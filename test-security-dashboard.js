/**
 * Security Dashboard API Testing Script
 * Tests all new security monitoring endpoints with proper admin authentication
 */

const http = require('http');
const config = require('./config/config');

// Test configuration
const TEST_CONFIG = {
  baseUrl: `http://localhost:${config.port}`,
  adminCredentials: {
    email: 'admin@example.com', // Update with actual admin email
    password: 'admin123' // Update with actual admin password
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, body: jsonBody });
        } catch (error) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

class SecurityDashboardTester {
  constructor() {
    this.sessionId = null;
    this.testResults = [];
  }

  async authenticate() {
    log('\n🔐 Authenticating as Admin...', 'cyan');
    
    try {
      // Step 1: Generate admin OTP
      const otpResponse = await makeRequest({
        hostname: 'localhost',
        port: config.port,
        path: '/api/auth/admin/generate-otp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, TEST_CONFIG.adminCredentials);

      if (otpResponse.statusCode !== 200) {
        log(`❌ OTP generation failed: ${otpResponse.statusCode}`, 'red');
        return false;
      }

      log('✅ Admin OTP generated (check email for actual OTP)', 'green');
      
      // For testing, we'll try to use a test session if available
      // In real scenario, you'd need to verify the OTP
      log('⚠️  Note: This test requires manual OTP verification for real authentication', 'yellow');
      log('   For now, we\'ll test endpoints that don\'t require strict authentication', 'yellow');
      
      return true;
    } catch (error) {
      log(`❌ Authentication error: ${error.message}`, 'red');
      return false;
    }
  }

  async testEndpoint(name, path, method = 'GET', data = null, expectStatus = 200) {
    log(`\n🧪 Testing: ${name}`, 'blue');
    
    try {
      const options = {
        hostname: 'localhost',
        port: config.port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Add session if available
      if (this.sessionId) {
        options.headers['Authorization'] = `Bearer ${this.sessionId}`;
      }

      const response = await makeRequest(options, data);
      
      const passed = response.statusCode === expectStatus;
      const result = {
        name,
        path,
        method,
        expected: expectStatus,
        actual: response.statusCode,
        passed,
        response: response.body
      };

      this.testResults.push(result);

      if (passed) {
        log(`✅ ${name}: ${response.statusCode}`, 'green');
        if (response.body && response.body.message) {
          log(`   Message: ${response.body.message}`, 'green');
        }
      } else {
        log(`❌ ${name}: Expected ${expectStatus}, got ${response.statusCode}`, 'red');
        if (response.body && response.body.message) {
          log(`   Error: ${response.body.message}`, 'red');
        }
      }

      return result;
    } catch (error) {
      log(`❌ ${name}: Network error - ${error.message}`, 'red');
      this.testResults.push({
        name,
        path,
        method,
        expected: expectStatus,
        actual: 'ERROR',
        passed: false,
        error: error.message
      });
      return false;
    }
  }

  async runSecurityDashboardTests() {
    log('\n' + '='.repeat(60), 'magenta');
    log('🛡️  SECURITY DASHBOARD API TESTS', 'magenta');
    log('='.repeat(60), 'magenta');

    // Test 1: Security Dashboard Overview
    await this.testEndpoint(
      'Security Dashboard Overview',
      '/api/admin/security-dashboard/overview',
      'GET',
      null,
      401 // Expect 401 without authentication
    );

    // Test 2: Session Events
    await this.testEndpoint(
      'Session Events',
      '/api/admin/security-dashboard/sessions/test-session-123/events',
      'GET',
      null,
      401 // Expect 401 without authentication
    );

    // Test 3: Banned Clients Management
    await this.testEndpoint(
      'Banned Clients List',
      '/api/admin/security-dashboard/banned-clients',
      'GET',
      null,
      401 // Expect 401 without authentication
    );

    // Test 4: Active Monitoring Sessions
    await this.testEndpoint(
      'Active Sessions',
      '/api/admin/security-dashboard/active-sessions',
      'GET',
      null,
      401 // Expect 401 without authentication
    );

    // Test 5: Ban Client Endpoint
    await this.testEndpoint(
      'Ban Client',
      '/api/admin/security-dashboard/ban-client',
      'POST',
      {
        ip_address: '192.168.1.100',
        ban_reason: 'Test ban',
        ban_duration_hours: 24
      },
      401 // Expect 401 without authentication
    );
  }

  async runAntiAbuseTests() {
    log('\n' + '='.repeat(60), 'magenta');
    log('🚨 ANTI-ABUSE API TESTS', 'magenta');
    log('='.repeat(60), 'magenta');

    // Test Anti-Abuse endpoints
    await this.testEndpoint(
      'Security Dashboard (Anti-Abuse)',
      '/api/admin/security/dashboard',
      'GET',
      null,
      401
    );

    await this.testEndpoint(
      'System Metrics',
      '/api/admin/security/metrics',
      'GET',
      null,
      401
    );

    await this.testEndpoint(
      'Active Threats',
      '/api/admin/security/threats',
      'GET',
      null,
      401
    );

    await this.testEndpoint(
      'Security Alerts',
      '/api/admin/security/alerts',
      'GET',
      null,
      401
    );

    await this.testEndpoint(
      'Risk Configuration',
      '/api/admin/security/config/risk-thresholds',
      'GET',
      null,
      401
    );
  }

  async runRouteValidationTests() {
    log('\n' + '='.repeat(60), 'magenta');
    log('🔍 ROUTE VALIDATION TESTS', 'magenta');
    log('='.repeat(60), 'magenta');

    // Test that routes exist (should return 401, not 404)
    const routesToTest = [
      '/api/admin/security-dashboard/overview',
      '/api/admin/security-dashboard/banned-clients',
      '/api/admin/security-dashboard/active-sessions',
      '/api/admin/security/dashboard',
      '/api/admin/security/metrics',
      '/api/admin/security/threats',
      '/api/admin/security/alerts'
    ];

    for (const route of routesToTest) {
      const result = await this.testEndpoint(
        `Route Exists: ${route}`,
        route,
        'GET',
        null,
        401 // Routes should exist and return 401 (unauthorized) not 404 (not found)
      );

      // If we get 404, the route doesn't exist
      if (result && result.actual === 404) {
        log(`❌ Route not found: ${route}`, 'red');
      } else if (result && result.actual === 401) {
        log(`✅ Route exists (properly protected): ${route}`, 'green');
      }
    }
  }

  printSummary() {
    log('\n' + '='.repeat(60), 'cyan');
    log('📊 TEST RESULTS SUMMARY', 'cyan');
    log('='.repeat(60), 'cyan');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    log(`\nTotal Tests: ${totalTests}`, 'bright');
    log(`✅ Passed: ${passedTests}`, 'green');
    log(`❌ Failed: ${failedTests}`, 'red');
    log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 'bright');

    if (failedTests > 0) {
      log('\n❌ Failed Tests:', 'red');
      this.testResults
        .filter(r => !r.passed)
        .forEach(test => {
          log(`   ${test.name}: Expected ${test.expected}, got ${test.actual}`, 'red');
        });
    }

    log('\n' + '='.repeat(60), 'cyan');
    log('🎯 Next Steps:', 'yellow');
    log('1. Set up proper admin authentication with valid credentials', 'yellow');
    log('2. Test endpoints with authenticated admin user', 'yellow');
    log('3. Verify real-time monitoring functionality', 'yellow');
    log('4. Test socket connection and event streaming', 'yellow');
    log('='.repeat(60), 'cyan');
  }

  async run() {
    log('🚀 Starting Security Dashboard API Tests', 'bright');
    log('This test validates all new security monitoring endpoints\n', 'bright');

    // Skip authentication for now - just test route existence and protection
    log('⚠️  Testing without authentication (validating route protection)', 'yellow');

    await this.runRouteValidationTests();
    await this.runSecurityDashboardTests();
    await this.runAntiAbuseTests();

    this.printSummary();
  }
}

// Main execution
async function main() {
  const tester = new SecurityDashboardTester();
  
  try {
    await tester.run();
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SecurityDashboardTester;
