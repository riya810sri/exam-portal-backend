# Anti-Abuse Detection System Documentation

## Overview

The Anti-Abuse Detection System is a comprehensive security solution designed to detect and prevent cheating during online exams. It uses multiple detection techniques without relying on easily spoofable user-agent strings.

## Architecture

### Core Components

1. **Detection Engine** (`utils/antiAbuseDetector.js`)
   - Header analysis for proxy tool detection
   - Request timing pattern analysis
   - JavaScript challenge generation and validation
   - Behavioral pattern analysis

2. **Pattern Detection** (`utils/serverPatternDetection.js`)
   - Mouse movement analysis
   - Keystroke timing patterns
   - Sequential answering detection
   - Automated behavior recognition

3. **Security Monitor** (`utils/securityMonitor.js`)
   - Real-time threat monitoring
   - Automated alert system
   - Risk escalation management
   - Email notifications to administrators

4. **Admin Management** (`controllers/admin.antiAbuse.controller.js`)
   - Security dashboard
   - Session analysis and review
   - Risk threshold configuration
   - Bulk session management

## Detection Methods

### 1. Proxy Tool Detection
- **Header Anomalies**: Detects Postman, Burp Suite, curl, and other API tools
- **Request Patterns**: Identifies non-browser request signatures
- **Timing Analysis**: Detects automated request timing patterns

### 2. Behavioral Analysis
- **Mouse Movements**: Tracks mouse velocity and movement patterns
- **Keystroke Timing**: Analyzes keystroke intervals for consistency
- **Response Patterns**: Detects suspiciously fast or consistent responses
- **Sequential Answering**: Identifies A-B-C-D pattern answering

### 3. Browser Fingerprinting
- **Screen Resolution**: Validates browser environment
- **Timezone Consistency**: Checks for timezone manipulation
- **Feature Detection**: Validates browser capabilities

### 4. JavaScript Challenges
- **Dynamic Challenges**: Server-generated computation challenges
- **Client Validation**: Ensures JavaScript execution environment
- **Response Verification**: Validates challenge solutions

## Risk Assessment

### Risk Scoring (0-100)
- **0-30**: Low Risk - Normal behavior
- **31-50**: Moderate Risk - Some suspicious patterns
- **51-70**: High Risk - Multiple red flags
- **71-85**: Critical Risk - Strong cheating indicators
- **86-100**: Extreme Risk - Automated tools detected

### Risk Factors
- Proxy tool detection: +40 points
- No mouse movements: +30 points
- Perfect timing patterns: +25 points
- Sequential answering: +20 points
- Header anomalies: +35 points
- Failed JS challenges: +30 points

## Database Schema

### Enhanced ExamAttendance Model

```javascript
{
  // Existing fields...
  
  // Anti-abuse specific fields
  cheatEvidence: [{
    evidenceType: String, // PROXY_TOOL_DETECTED, AUTOMATED_BEHAVIOR, etc.
    timestamp: Date,
    source: String,      // CLIENT_SIDE, SERVER_SIDE, MIDDLEWARE
    details: Object,     // Specific detection data
    confidence: Number   // 0-1 confidence score
  }],
  
  sessionFingerprint: {
    userAgent: String,
    screen: Object,
    timezone: String,
    language: String,
    fingerprint: String
  },
  
  requestMetrics: {
    totalRequests: Number,
    averageResponseTime: Number,
    timeVariance: Number,
    requestPattern: String
  },
  
  behaviorProfile: {
    mouseMovements: [Object],
    keystrokes: [Object],
    clickPatterns: [String],
    averageResponseTime: Number,
    suspiciousPatternCount: Number
  },
  
  riskAssessment: {
    overallRiskScore: Number,
    riskFactors: [String],
    violationCount: Number,
    confidence: Number,
    lastUpdated: Date
  }
}
```

## API Endpoints

### Admin Security Dashboard
```
GET /api/admin/security/dashboard
GET /api/admin/security/metrics
GET /api/admin/security/threats
```

### Session Management
```
GET /api/admin/security/sessions/:sessionId/analysis
GET /api/admin/security/sessions/:sessionId/history
POST /api/admin/security/sessions/:sessionId/suspend
POST /api/admin/security/sessions/:sessionId/review
POST /api/admin/security/sessions/bulk-action
```

### Configuration
```
GET /api/admin/security/config/risk-thresholds
PUT /api/admin/security/config/risk-thresholds
```

### Alerts and Reporting
```
GET /api/admin/security/alerts
PUT /api/admin/security/alerts/:alertId/reviewed
GET /api/admin/security/reports/export
```

## Client-Side Integration

### JavaScript Detection Code
```javascript
// Include in your exam frontend
import { AntiAbuseClient } from './path/to/client-side-detection.js';

const antiAbuse = new AntiAbuseClient({
  examId: 'exam123',
  userId: 'user456',
  apiBaseUrl: 'https://your-api.com/api'
});

// Start monitoring
antiAbuse.startMonitoring();

// Submit behavior data with answers
await antiAbuse.submitAnswer(questionId, answer, behaviorData);
```

### Required Client Events
- Mouse movements and clicks
- Keystroke timing
- Tab focus/blur events
- Window resize events
- JavaScript challenge responses

## Testing

### Running Tests
```bash
# Set up test environment
cp .env.test.example .env.test
# Edit .env.test with your test credentials

# Run comprehensive test suite
npm test tests/comprehensive-antiabuse.test.js

# Run specific test categories
node tests/comprehensive-antiabuse.test.js
```

### Test Categories
1. **Detection Tests**: Verify proxy tool and automation detection
2. **Admin Tests**: Test dashboard and management functions
3. **Pattern Tests**: Validate behavioral pattern recognition

## Configuration

### Risk Thresholds
```javascript
{
  highRiskThreshold: 70,      // Flag for review
  criticalRiskThreshold: 85,  // Generate alerts
  autoSuspendThreshold: 90,   // Automatic suspension
  maxViolationsPerSession: 5, // Maximum violations before action
  alertCooldown: 300000       // 5 minutes between similar alerts
}
```

### Detection Sensitivity
```javascript
{
  rapidResponse: 2000,        // Flag responses under 2 seconds
  identicalTiming: 500,       // Flag timing within 500ms
  mouseVelocity: 5000,        // Flag unrealistic mouse speed
  keystrokePattern: 0.9       // Flag 90%+ timing consistency
}
```

## Monitoring and Alerts

### Real-time Monitoring
- Active session tracking
- Live risk score updates
- Immediate threat detection
- Automated response triggers

### Alert System
- Email notifications to administrators
- Escalating alert levels (suspicious → high → critical)
- Cooldown periods to prevent spam
- Detailed violation reports

### Automated Responses
- Session flagging for review
- Temporary session suspension
- Administrator notifications
- Detailed audit logs

## Security Considerations

### Data Privacy
- All behavior data is encrypted
- Personal data is minimized
- Retention policies are enforced
- GDPR compliance considerations

### False Positives
- Multiple detection methods reduce false positives
- Confidence scoring for evidence quality
- Manual review processes for borderline cases
- Configurable thresholds

### Performance Impact
- Minimal client-side overhead
- Efficient server-side processing
- Database indexing for fast queries
- Background processing for analysis

## Deployment

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- Redis (for session management)
- SMTP server (for alerts)

### Environment Variables
```bash
# Security Configuration
ANTI_ABUSE_ENABLED=true
SECURITY_MONITOR_ENABLED=true
ADMIN_EMAIL=admin@yoursite.com

# Detection Thresholds
HIGH_RISK_THRESHOLD=70
CRITICAL_RISK_THRESHOLD=85
AUTO_SUSPEND_THRESHOLD=90
```

### Database Indexes
```javascript
// Run the indexing script
node scripts/database-indexes.js
```

## Maintenance

### Regular Tasks
- Review flagged sessions weekly
- Update risk thresholds based on data
- Monitor false positive rates
- Clean up old behavior data

### Performance Monitoring
- Track detection accuracy
- Monitor system performance
- Review alert effectiveness
- Analyze cheating trends

## Support

### Troubleshooting
- Check server logs for detection issues
- Verify client-side integration
- Test API endpoints manually
- Review database queries

### Common Issues
1. **High False Positives**: Adjust risk thresholds
2. **Missed Detections**: Review detection patterns
3. **Performance Issues**: Check database indexes
4. **Integration Problems**: Verify client-side code

### Contact
For technical support or questions about the anti-abuse system, contact the development team or review the code documentation.

---

**Last Updated**: December 2024
**Version**: 1.0.0
