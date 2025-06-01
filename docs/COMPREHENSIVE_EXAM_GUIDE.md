# Comprehensive Exam Portal Guide

This document provides a detailed overview of the exam portal system, including authentication, exam attendance, monitoring, cheating detection, and security features.

## Table of Contents

1. [Authentication System](#1-authentication-system)
2. [Exam Attendance Flow](#2-exam-attendance-flow)
3. [Monitoring and Security](#3-monitoring-and-security)
4. [Cheating Detection System](#4-cheating-detection-system)
5. [API Reference](#5-api-reference)
6. [Frontend Integration](#6-frontend-integration)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Authentication System

The exam portal uses session-based authentication with Bearer tokens.

### Authentication Flow

1. **Login**: User provides credentials to receive a session token
2. **Session Management**: Token is used for all subsequent requests
3. **Authorization**: Different permission levels for students, instructors, and admins

### Authentication Endpoints

#### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "userId": "6839f5c5c1224dddba8b10ce",
  "sessionId": "683c4c22feceae7d315b18cf",
  "user": {
    "email": "user@example.com",
    "username": "testuser",
    "role": "student"
  }
}
```

**Important:** Include the `sessionId` in the Authorization header for all subsequent requests:

```
Authorization: Bearer 683c4c22feceae7d315b18cf
```

#### Logout

```
POST /api/auth/logout
Authorization: Bearer {sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Authentication Best Practices

1. Always store tokens securely (HTTP-only cookies preferred)
2. Implement token refresh mechanisms for longer sessions
3. Set appropriate token expiration times
4. Include proper error handling for authentication failures

---

## 2. Exam Attendance Flow

The exam attendance flow includes starting an exam, submitting answers, and completing the exam.

### 2.1 Starting an Exam

#### Request:
```
GET /api/exam-attendance/{examId}/attend
Authorization: Bearer {sessionId}
```

#### Response:
```json
{
  "success": true,
  "message": "Exam started successfully",
  "examData": {
    "examId": "68274422db1570c33bfef3a9",
    "title": "Mathematics Test",
    "duration": 60,
    "totalQuestions": 10,
    "instructions": "Answer all questions",
    "sections": {
      "mcqs": [
        {
          "questionId": "123456789",
          "text": "What is 2+2?",
          "options": [
            { "id": "A", "text": "3" },
            { "id": "B", "text": "4" },
            { "id": "C", "text": "5" },
            { "id": "D", "text": "6" }
          ]
        }
      ]
    }
  },
  "attendanceId": "683c4bea05d85bdff14fb14e",
  "startTime": "2025-06-01T12:39:04.294Z",
  "endTime": "2025-06-01T13:39:04.294Z",
  "attemptNumber": 1,
  "timeRemaining": 3600
}
```

### 2.2 Starting a New Attempt

If allowed multiple attempts, you can use the specific endpoint:

#### Request:
```
GET /api/exam-attendance/{examId}/new-attempt
Authorization: Bearer {sessionId}
```

#### Response:
Same as the attend endpoint above, but with incremented `attemptNumber`.

### 2.3 Submitting an Answer

#### Request:
```
POST /api/exam-attendance/{examId}/submit-answer
Authorization: Bearer {sessionId}
Content-Type: application/json

{
  "questionId": "123456789",
  "selectedAnswer": "B"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Answer submitted successfully",
  "correctAnswer": null, 
  "isCorrect": null,
  "questionsAttempted": 1,
  "totalQuestions": 10
}
```

Note: The `correctAnswer` and `isCorrect` fields are null during the exam to prevent cheating.

### 2.4 Completing an Exam

#### Request:
```
POST /api/exam-attendance/{examId}/complete
Authorization: Bearer {sessionId}
```

#### Response:
```json
{
  "success": true,
  "message": "Exam completed successfully",
  "score": 8,
  "totalQuestions": 10,
  "percentage": 80,
  "status": "COMPLETED",
  "timeTaken": "00:45:30",
  "resultUrl": "/api/exam-attendance/{examId}/result"
}
```

### 2.5 Checking Exam Status

#### Request:
```
GET /api/exam-attendance/{examId}/status
Authorization: Bearer {sessionId}
```

#### Response:
```json
{
  "success": true,
  "exam": {
    "title": "Mathematics Test",
    "duration": 60
  },
  "attendance": {
    "status": "IN_PROGRESS",
    "startTime": "2025-06-01T12:39:04.294Z",
    "endTime": "2025-06-01T13:39:04.294Z",
    "timeRemaining": 1800,
    "attemptedQuestions": 5,
    "totalQuestions": 10,
    "attemptNumber": 1
  }
}
```

### 2.6 Viewing Exam Results

#### Request:
```
GET /api/exam-attendance/{examId}/result
Authorization: Bearer {sessionId}
```

#### Response:
```json
{
  "success": true,
  "exam": {
    "title": "Mathematics Test",
    "duration": 60
  },
  "result": {
    "score": 8,
    "totalQuestions": 10,
    "percentage": 80,
    "status": "COMPLETED",
    "startTime": "2025-06-01T12:39:04.294Z",
    "endTime": "2025-06-01T13:24:34.294Z",
    "timeTaken": "00:45:30",
    "certificateUrl": "/api/exam-attendance/{examId}/certificate"
  }
}
```

### 2.7 Reviewing Exam Questions

#### Request:
```
GET /api/exam-attendance/{examId}/review
Authorization: Bearer {sessionId}
```

#### Response:
```json
{
  "success": true,
  "exam": {
    "title": "Mathematics Test"
  },
  "questions": [
    {
      "questionId": "123456789",
      "text": "What is 2+2?",
      "options": [
        { "id": "A", "text": "3" },
        { "id": "B", "text": "4", "isCorrect": true },
        { "id": "C", "text": "5" },
        { "id": "D", "text": "6" }
      ],
      "selectedAnswer": "B",
      "isCorrect": true,
      "explanation": "Basic addition"
    }
  ]
}
```

### 2.8 Cancelling an In-Progress Attempt

#### Request:
```
POST /api/exam-attendance/{examId}/cancel-in-progress
Authorization: Bearer {sessionId}
```

#### Response:
```json
{
  "success": true,
  "message": "Exam attempt cancelled successfully"
}
```

---

## 3. Monitoring and Security

The exam portal includes comprehensive monitoring and security features to prevent cheating.

### 3.1 Starting Monitoring

#### Request:
```
POST /api/exam-attendance/{examId}/start-monitoring
Authorization: Bearer {sessionId}
Content-Type: application/json

{
  "sessionFingerprint": {
    "screenResolution": "1920x1080",
    "timezone": "UTC+5:30",
    "language": "en-US",
    "platform": "Win32",
    "cookiesEnabled": true,
    "doNotTrack": "unspecified",
    "hardwareConcurrency": 8,
    "canvasFingerprint": "a1b2c3d4e5f6g7h8i9j0"
  }
}
```

#### Response:
```json
{
  "success": true,
  "message": "Monitoring started successfully",
  "monitoringId": "683c4d2205d85bdff14fb15f",
  "examId": "68274422db1570c33bfef3a9",
  "startTime": "2025-06-01T12:39:04.294Z"
}
```

### 3.2 Alternative Monitoring Endpoint

The system also supports an alternative URL format:

```
POST /api/exam-attendance/start-monitoring/{examId}
```

With the same request body and response format as above.

### 3.3 Security Features

The exam portal includes several security features:

1. **Session Fingerprinting**: Tracking browser and system characteristics
2. **Anti-Abuse Detection**: Detecting automation and proxy tools
3. **JavaScript Challenges**: Verifying browser authenticity
4. **Timing Analysis**: Detecting suspicious patterns in requests
5. **Header Analysis**: Identifying anomalies in HTTP headers

---

## 4. Cheating Detection System

The system includes comprehensive cheating detection mechanisms.

### 4.1 Reporting Cheating Incidents

#### Request:
```
POST /api/exam-attendance/{examId}/report-cheating
Authorization: Bearer {sessionId}
Content-Type: application/json

{
  "evidenceType": "TAB_SWITCH",
  "details": {
    "count": 3,
    "timestamps": ["2025-06-01T12:45:04.294Z", "2025-06-01T12:46:14.294Z"]
  },
  "severity": "MEDIUM"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Cheating incident reported successfully",
  "flagged": true
}
```

### 4.2 Types of Cheating Evidence

The system supports detection of various cheating methods:

- `TAB_SWITCH`: User switching between tabs or applications
- `COPY_PASTE`: Copy-paste actions detected
- `MULTIPLE_WINDOWS`: Multiple windows or browsers detected
- `PROHIBITED_KEYS`: Use of keyboard shortcuts for developer tools
- `FACE_DETECTION`: Anomalies in webcam monitoring
- `SERVER_DETECTED`: Server-side behavioral anomalies
- `PROXY_TOOL_DETECTED`: Use of proxy or VPN tools
- `AUTOMATED_BEHAVIOR`: Bot-like behavior patterns
- `TIMING_ANOMALY`: Suspicious timing patterns in answers
- `HEADER_FINGERPRINT`: Inconsistent HTTP headers
- `JS_BEACON_FAILURE`: Failed JavaScript integrity checks
- `REQUEST_PATTERN_ANOMALY`: Unusual API request patterns
- `OTHER`: Other suspicious activities

### 4.3 Severity Levels

Each cheating incident can be categorized by severity:

- `LOW`: Minor suspicious activity
- `MEDIUM`: Moderate concern
- `HIGH`: Significant concern
- `CRITICAL`: Definitive cheating evidence

---

## 5. API Reference

### 5.1 Exam Attendance Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/exam-attendance/my-exams` | GET | Get user's exam history |
| `/api/exam-attendance/my-exam-history` | GET | Get enhanced exam history |
| `/api/exam-attendance/cancel-all-attempts` | POST | Cancel all in-progress attempts |
| `/api/exam-attendance/{examId}/attend` | GET | Start attending an exam |
| `/api/exam-attendance/{examId}/new-attempt` | GET | Start a new attempt explicitly |
| `/api/exam-attendance/{examId}/cancel-in-progress` | POST | Cancel an in-progress attempt |
| `/api/exam-attendance/{examId}/submit-answer` | POST | Submit an answer |
| `/api/exam-attendance/{examId}/complete` | POST | Complete the exam |
| `/api/exam-attendance/{examId}/status` | GET | Check exam status |
| `/api/exam-attendance/{examId}/result` | GET | View exam results |
| `/api/exam-attendance/{examId}/review` | GET | Review exam questions and answers |
| `/api/exam-attendance/{examId}/certificate` | GET | Download certificate |
| `/api/exam-attendance/{examId}/start-monitoring` | POST | Start monitoring |
| `/api/exam-attendance/start-monitoring/{examId}` | POST | Alternative start monitoring |
| `/api/exam-attendance/{examId}/report-cheating` | POST | Report cheating incident |
| `/api/exam-attendance/admin/{examId}/cheating-reports` | GET | Admin: Get all cheating reports |

### 5.2 Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/register` | POST | User registration |
| `/api/auth/verify-email` | GET | Email verification |
| `/api/auth/forgot-password` | POST | Request password reset |
| `/api/auth/reset-password` | POST | Reset password |

---

## 6. Frontend Integration

### 6.1 Key Implementation Steps

1. **Authentication Flow**:
   - Implement login functionality
   - Store session token securely
   - Include token in all API requests

2. **Exam Start**:
   - Fetch and display exam details
   - Start exam timer
   - Initialize monitoring system

3. **Question Navigation**:
   - Display questions and answer options
   - Track attempted questions
   - Submit answers to the server

4. **Monitoring Integration**:
   - Collect browser fingerprinting data
   - Monitor tab switches and visibility changes
   - Detect and report suspicious activities

5. **Exam Completion**:
   - Submit final answers
   - Complete exam
   - Display results and certificate if applicable

### 6.2 Security Implementation

#### Tab Visibility Monitoring

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    reportCheating('TAB_SWITCH', {
      timestamp: new Date().toISOString(),
      details: 'Tab switch detected'
    });
  }
});
```

#### Copy-Paste Prevention

```javascript
document.addEventListener('copy', (e) => {
  e.preventDefault();
  reportCheating('COPY_PASTE', {
    timestamp: new Date().toISOString(),
    action: 'copy'
  });
});

document.addEventListener('paste', (e) => {
  e.preventDefault();
  reportCheating('COPY_PASTE', {
    timestamp: new Date().toISOString(),
    action: 'paste'
  });
});
```

#### Periodic Monitoring Requests

```javascript
setInterval(() => {
  fetch('/api/exam-attendance/{examId}/start-monitoring', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionFingerprint: collectBrowserFingerprint()
    })
  });
}, 30000); // Every 30 seconds
```

#### Browser Fingerprint Collection

```javascript
function collectBrowserFingerprint() {
  return {
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    // Additional fingerprinting as needed
  };
}
```

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

#### Authentication Issues

| Issue | Possible Causes | Solution |
|-------|----------------|----------|
| 401 Unauthorized | Expired session, Invalid token | Re-authenticate the user |
| 403 Forbidden | Insufficient permissions | Check user role and permissions |
| Token not accepted | Bearer prefix missing | Ensure token format: `Bearer {token}` |

#### Exam Access Issues

| Issue | Possible Causes | Solution |
|-------|----------------|----------|
| Cannot start exam | Exam not published, Previous attempt in progress | Check exam status, Cancel previous attempt |
| Answer not saving | Network issues, Session expired | Implement auto-retry, Check connection |
| "No active exam found" | Session mismatch, Exam ended | Verify exam status, Check time remaining |

#### Monitoring Issues

| Issue | Possible Causes | Solution |
|-------|----------------|----------|
| Monitoring not starting | Missing fingerprint data, Authentication issue | Check request payload, Verify token |
| False positive cheating | Overly sensitive detection | Adjust detection thresholds |
| Browser compatibility | Older browsers, Privacy features | Provide browser requirements to users |

### 7.2 Error Codes

| Code | Description | Recommendation |
|------|-------------|----------------|
| `AUTH_001` | Invalid credentials | Verify email and password |
| `AUTH_002` | Session expired | Re-authenticate |
| `EXAM_001` | Exam not found | Check exam ID |
| `EXAM_002` | Exam not started | Start exam before submitting answers |
| `EXAM_003` | Exam already completed | Cannot modify completed exam |
| `CHEAT_001` | Monitoring failed to start | Check browser compatibility |
| `CHEAT_002` | Multiple cheating incidents | Review flagged activities |

---

## Additional Resources

- [Security Implementation Guide](./EXAM_ATTENDANCE_SECURITY_GUIDE.md)
- [Monitoring Endpoint Documentation](./MONITORING_ENDPOINT.md)
- [Cheating Detection System](./REPORT_CHEATING_UPDATE.md)
- [Frontend Integration Guide](./FRONTEND_INTEGRATION_UPDATES.md)
