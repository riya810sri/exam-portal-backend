# Frontend API Quick Reference

## 🔗 Base Configuration

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000/security-monitor';

// Auth headers for all requests
const authHeaders = {
  'Authorization': `Bearer ${userToken}`,
  'Content-Type': 'application/json',
  'X-Exam-Session': examId
};
```

## 📡 Core API Endpoints

### 1. **Start Exam Monitoring**
```javascript
POST /exam-attendance/{examId}/start-monitoring

Request Body:
{
  userAgent: string,
  screenResolution: string, // "1920x1080"
  timezone: string,
  browserFingerprint: object
}

Response:
{
  success: boolean,
  sessionId: string,
  monitoringActive: boolean,
  riskThresholds: object
}
```

### 2. **Report Cheating Incident**
```javascript
POST /exam-attendance/{examId}/report-cheating

Request Body:
{
  evidenceType: "TAB_SWITCH" | "COPY_PASTE" | "SUSPICIOUS_TIMING" | "AUTOMATION_DETECTED" | "MULTIPLE_SESSIONS",
  details: {
    timestamp: number,
    description: string,
    metadata: object
  },
  source: "CLIENT"
}

Response:
{
  success: boolean,
  violationCount: number,
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  action: "WARNING" | "SUSPEND" | "NONE",
  message: string
}
```

### 3. **Submit Behavior Data**
```javascript
POST /exam-attendance/{examId}/submit-behavior-data

Request Body:
{
  mouseMovements: Array<{x: number, y: number, timestamp: number}>,
  keystrokes: Array<{key: string, timestamp: number, duration: number}>,
  answerTimings: Array<{questionId: string, responseTime: number}>,
  timestamp: number
}

Response:
{
  success: boolean,
  analysisResult: object,
  riskLevel: string
}
```

### 4. **Get Security Status**
```javascript
GET /exam-attendance/{examId}/security-status

Response:
{
  success: boolean,
  status: "ACTIVE" | "WARNED" | "SUSPENDED",
  violations: Array<object>,
  riskLevel: string,
  warningCount: number,
  lastViolation: object | null
}
```

### 5. **Validate Environment**
```javascript
POST /exam-attendance/{examId}/validate-environment

Request Body:
{
  windowSize: {width: number, height: number},
  screenSize: {width: number, height: number},
  availableScreens: number,
  browserFeatures: object,
  plugins: Array<string>
}

Response:
{
  success: boolean,
  isValid: boolean,
  issues: Array<string>,
  recommendations: Array<string>
}
```

## 👨‍💼 Admin Dashboard APIs

### 1. **Security Dashboard**
```javascript
GET /admin/security/dashboard

Response:
{
  success: boolean,
  data: {
    totalActiveSessions: number,
    violationsToday: number,
    suspendedSessions: number,
    riskDistribution: object,
    recentAlerts: Array<object>,
    systemHealth: object
  }
}
```

### 2. **Session Analysis**
```javascript
GET /admin/security/sessions/{sessionId}/analysis

Response:
{
  success: boolean,
  session: {
    userId: string,
    examId: string,
    status: string,
    violations: Array<object>,
    riskScore: number,
    behaviorAnalysis: object,
    timeline: Array<object>
  }
}
```

### 3. **Suspend Session**
```javascript
POST /admin/security/sessions/{sessionId}/suspend

Request Body:
{
  reason: string,
  duration: number, // minutes, 0 = permanent
  notifyUser: boolean
}

Response:
{
  success: boolean,
  message: string,
  suspensionId: string
}
```

### 4. **Risk Configuration**
```javascript
GET /admin/security/config/risk-thresholds
POST /admin/security/config/risk-thresholds

GET Response:
{
  success: boolean,
  thresholds: {
    tabSwitchLimit: number,
    copyPasteLimit: number,
    suspiciousTimingThreshold: number,
    autoSuspendRiskLevel: number
  }
}

POST Request Body:
{
  thresholds: object // same structure as GET response
}
```

## 🔄 WebSocket Events

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/security-monitor');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'AUTH',
    token: userToken,
    examId: examId
  }));
};
```

### Events to Listen For
```javascript
// Incoming events
{
  type: 'VIOLATION_DETECTED',
  data: {
    sessionId: string,
    violationType: string,
    severity: string,
    timestamp: number
  }
}

{
  type: 'RISK_LEVEL_CHANGED',
  data: {
    sessionId: string,
    oldLevel: string,
    newLevel: string,
    riskScore: number
  }
}

{
  type: 'SESSION_SUSPENDED',
  data: {
    sessionId: string,
    reason: string,
    suspendedBy: string
  }
}

{
  type: 'SECURITY_UPDATE',
  data: {
    message: string,
    severity: string,
    actionRequired: boolean
  }
}
```

## 🎯 Evidence Types Reference

```javascript
const EVIDENCE_TYPES = {
  TAB_SWITCH: 'User switched browser tabs',
  COPY_PASTE: 'Copy-paste operation detected',
  SUSPICIOUS_TIMING: 'Suspiciously fast or slow responses',
  AUTOMATION_DETECTED: 'Automated behavior patterns',
  MULTIPLE_SESSIONS: 'Multiple active sessions detected',
  DEV_TOOLS: 'Developer tools opened',
  BROWSER_RESIZE: 'Suspicious browser resizing',
  IDLE_TIMEOUT: 'Extended idle period detected',
  RAPID_SUBMISSIONS: 'Rapid answer submissions',
  PATTERN_MATCHING: 'Sequential answer patterns detected'
};
```

## 🚨 Risk Levels

```javascript
const RISK_LEVELS = {
  LOW: {
    color: '#10B981',    // Green
    action: 'MONITOR',
    description: 'Normal behavior'
  },
  MEDIUM: {
    color: '#F59E0B',    // Yellow
    action: 'WARNING',
    description: 'Minor violations detected'
  },
  HIGH: {
    color: '#EF4444',    // Red
    action: 'STRICT_MONITOR',
    description: 'Multiple violations, high risk'
  },
  CRITICAL: {
    color: '#DC2626',    // Dark Red
    action: 'SUSPEND',
    description: 'Immediate suspension required'
  }
};
```

## 📝 Example Error Responses

```javascript
// Authentication Error
{
  success: false,
  error: 'UNAUTHORIZED',
  message: 'Invalid or expired token',
  code: 401
}

// Validation Error
{
  success: false,
  error: 'VALIDATION_ERROR',
  message: 'Required fields missing',
  details: ['examId is required', 'evidenceType is invalid'],
  code: 400
}

// Session Not Found
{
  success: false,
  error: 'SESSION_NOT_FOUND',
  message: 'Exam session not found or expired',
  code: 404
}

// Rate Limit Error
{
  success: false,
  error: 'RATE_LIMIT_EXCEEDED',
  message: 'Too many requests, please slow down',
  retryAfter: 60, // seconds
  code: 429
}
```

## 🔧 Implementation Tips

1. **Always check `success` field** in responses before processing data
2. **Implement exponential backoff** for failed requests
3. **Cache risk thresholds** locally to reduce API calls
4. **Use WebSocket for real-time updates** instead of polling
5. **Batch behavior data submissions** for performance
6. **Handle network errors gracefully** with offline detection
7. **Implement proper loading states** for all async operations

---

**All endpoints are live and tested. Start with the core monitoring workflow: start-monitoring → report-cheating → submit-behavior-data → get-security-status**
