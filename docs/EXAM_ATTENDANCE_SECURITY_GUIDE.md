# Exam Attendance & Security Implementation Guide

This document provides a comprehensive guide for frontend developers implementing the exam attendance flow, security monitoring, and related functionality in the Exam Portal system.

## Table of Contents
1. [Authentication](#1-authentication)
2. [Exam Flow](#2-exam-flow)
3. [Security Monitoring](#3-security-monitoring)
4. [Error Handling](#4-error-handling)
5. [Frontend Implementation Examples](#5-frontend-implementation-examples)

## 1. Authentication

Before accessing any exam endpoints, users must be authenticated. The system uses session-based authentication.

### Login Flow

**Request:**
```http
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
  "sessionId": "683c8c038716dbe7068b8d56",
  "user": {
    "email": "user@example.com",
    "username": "testuser",
    "role": "student"
  }
}
```

**Important:** Store the `sessionId` and include it in all subsequent requests in the Authorization header:
```
Authorization: 683c8c038716dbe7068b8d56
```

## 2. Exam Flow

### 2.1 Fetch Available Exams

**Request:**
```http
GET /api/exams/available
Authorization: 683c8c038716dbe7068b8d56
```

**Response:**
```json
{
  "success": true,
  "exams": [
    {
      "examId": "68274422db1570c33bfef3a9",
      "title": "Mathematics Final Exam",
      "duration": 60,
      "totalQuestions": 10,
      "status": "PUBLISHED",
      "startDate": "2025-06-01T10:00:00.000Z",
      "endDate": "2025-06-02T18:00:00.000Z",
      "attemptsAllowed": 1,
      "attemptsUsed": 0,
      "passScore": 70
    },
    // ... more exams
  ]
}
```

### 2.2 Start an Exam

**Request:**
```http
GET /api/exam-attendance/{examId}/attend
Authorization: 683c8c038716dbe7068b8d56
```

**Response:**
```json
{
  "success": true,
  "message": "Exam started successfully",
  "examData": {
    "examId": "68274422db1570c33bfef3a9",
    "title": "Mathematics Final Exam",
    "duration": 60,
    "totalQuestions": 10,
    "instructions": "Answer all questions. Calculator allowed.",
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
        },
        // ... more questions
      ]
    }
  },
  "attendanceId": "683c4bea05d85bdff14fb14e",
  "startTime": "2025-06-01T12:39:04.294Z",
  "endTime": "2025-06-01T13:39:04.294Z",
  "attemptNumber": 1,
  "timeRemaining": 3600 // in seconds
}
```

### 2.3 Check Exam Status

**Request:**
```http
GET /api/exam-attendance/{examId}/status
Authorization: 683c8c038716dbe7068b8d56
```

**Response:**
```json
{
  "success": true,
  "status": "IN_PROGRESS",
  "examId": "68274422db1570c33bfef3a9",
  "timeRemaining": 3555, // seconds
  "progress": {
    "attempted": 1,
    "total": 10
  },
  "startTime": "2025-06-01T12:39:04.294Z",
  "endTime": "2025-06-01T13:39:04.294Z"
}
```

### 2.4 Submit an Answer

**Request:**
```http
POST /api/exam-attendance/{examId}/submit-answer
Authorization: 683c8c038716dbe7068b8d56
Content-Type: application/json

{
  "questionId": "123456789",
  "answer": "B",
  "timeSpent": 45 // in seconds
}
```

**Response:**
```json
{
  "success": true,
  "message": "Answer submitted successfully",
  "questionId": "123456789",
  "answerId": "abcdef123456",
  "status": "RECORDED",
  "progress": {
    "attempted": 1,
    "total": 10,
    "timeRemaining": 3555 // in seconds
  }
}
```

### 2.5 Complete the Exam

**Request:**
```http
POST /api/exam-attendance/{examId}/complete
Authorization: 683c8c038716dbe7068b8d56
```

**Response:**
```json
{
  "success": true,
  "message": "Exam completed successfully",
  "examId": "68274422db1570c33bfef3a9",
  "attendanceId": "683c4bea05d85bdff14fb14e",
  "status": "COMPLETED",
  "score": 8,
  "totalQuestions": 10,
  "attemptedQuestions": 10,
  "timeTaken": 45, // minutes
  "resultUrl": "/api/exam-attendance/68274422db1570c33bfef3a9/result"
}
```

### 2.6 View Exam Result

**Request:**
```http
GET /api/exam-attendance/{examId}/result
Authorization: 683c8c038716dbe7068b8d56
```

**Response:**
```json
{
  "success": true,
  "examId": "68274422db1570c33bfef3a9",
  "title": "Mathematics Final Exam",
  "status": "COMPLETED",
  "score": 8,
  "totalMarks": 10,
  "percentage": 80,
  "timeTaken": 45, // minutes
  "answers": [
    {
      "questionId": "123456789",
      "yourAnswer": "B",
      "correctAnswer": "B",
      "isCorrect": true,
      "marks": 1
    },
    // ... more answers
  ],
  "certificateUrl": "/api/exam-attendance/68274422db1570c33bfef3a9/certificate"
}
```

## 3. Security Monitoring

The system includes comprehensive security monitoring to maintain exam integrity.

### 3.1 Start Monitoring

Must be called immediately after starting an exam to enable security monitoring:

**Request:**
```http
POST /api/exam-attendance/{examId}/start-monitoring
Authorization: 683c8c038716dbe7068b8d56
Content-Type: application/json

{
  "userAgent": "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0",
  "screenResolution": "1920x1080",
  "timezone": "Asia/Kolkata",
  "browserFingerprint": {
    "canvas": "data:image/png;base64,...",
    "webGL": "Mozilla - Radeon R9 200 Series, or similar - WebGL 1.0",
    "fonts": ["Arial", "Times New Roman"],
    "plugins": ["PDF Viewer", "Chrome PDF Viewer", "Chromium PDF Viewer", "Microsoft Edge PDF Viewer", "WebKit built-in PDF"]
  }
}
```

**Response:**
```json
{
  "message": "Monitoring started successfully",
  "success": true,
  "monitoringId": "683c4bea05d85bdff14fb14e",
  "riskLevel": "LOW",
  "status": "MONITORING_ACTIVE"
}
```

**Note:** Both URL formats are supported:
- `/api/exam-attendance/{examId}/start-monitoring`
- `/api/exam-attendance/start-monitoring/{examId}`

### 3.2 Report Cheating Incidents

Use this endpoint to report security events like tab switching, copy-paste attempts, etc.:

**Request:**
```http
POST /api/exam-attendance/{examId}/report-cheating
Authorization: 683c8c038716dbe7068b8d56
Content-Type: application/json

{
  "evidenceType": "TAB_SWITCH", 
  "details": {
    "switchCount": 1,
    "hiddenTime": 15, // seconds
    "visibilityState": "hidden"
  }
}
```

**Response:**
```json
{
  "message": "Cheating incident reported successfully",
  "evidenceId": "683c8c16e4983595498f4e09"
}
```

**Important:** This endpoint works in all scenarios:
- When the user has an active exam
- When the exam has been completed
- When the user has no active exam (creates a placeholder record)

### 3.3 Event Types to Monitor

The system can detect and report various types of suspicious activities:

| Event Type | Description | Example Details |
|------------|-------------|----------------|
| `TAB_SWITCH` | User switched to another tab or window | `{ switchCount: 1, hiddenTime: 15, visibilityState: "hidden" }` |
| `COPY_PASTE` | Copy or paste attempt detected | `{ content: "copied text", location: "question-1" }` |
| `PROHIBITED_KEYS` | Restricted key combinations used | `{ key: "F12", action: "DevTools" }` |
| `MULTIPLE_SESSIONS` | Multiple sessions detected | `{ count: 2, ips: ["192.168.1.1", "192.168.1.2"] }` |
| `AUTOMATION_DETECTED` | Bot or script behavior detected | `{ pattern: "rapid-responses", confidence: 0.85 }` |

## 4. Error Handling

### 4.1 Common Error Types

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid parameters or missing required fields |
| 401 | Unauthorized | Invalid or expired session |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Exam not found or no active exam |
| 409 | Conflict | Attempting to start an already completed exam |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### 4.2 Error Response Format

```json
{
  "success": false,
  "message": "Detailed error message",
  "error": "ERROR_CODE" // optional
}
```

## 5. Frontend Implementation Examples

### 5.1 Starting an Exam and Enabling Security

```javascript
// Function to start an exam
async function startExam(examId) {
  try {
    // Start the exam
    const examResponse = await fetch(`/api/exam-attendance/${examId}/attend`, {
      method: 'GET',
      headers: {
        'Authorization': sessionId
      }
    });
    
    const examData = await examResponse.json();
    if (!examData.success) {
      throw new Error(examData.message);
    }
    
    // Store exam data in state
    setExamData(examData.examData);
    setTimeRemaining(examData.timeRemaining);
    setAttendanceId(examData.attendanceId);
    
    // Enable security monitoring
    await startSecurityMonitoring(examId);
    
    // Start timer
    startExamTimer(examData.timeRemaining);
    
    return examData;
  } catch (error) {
    console.error('Error starting exam:', error);
    showErrorNotification(`Failed to start exam: ${error.message}`);
    return null;
  }
}

// Function to enable security monitoring
async function startSecurityMonitoring(examId) {
  try {
    // Collect browser information
    const browserInfo = {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browserFingerprint: await collectBrowserFingerprint()
    };
    
    // Start monitoring
    const response = await fetch(`/api/exam-attendance/${examId}/start-monitoring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionId
      },
      body: JSON.stringify(browserInfo)
    });
    
    const result = await response.json();
    if (!result.success) {
      console.warn('Security monitoring failed to start:', result.message);
    }
    
    // Add event listeners for security
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('paste', preventCopyPaste);
    document.addEventListener('keydown', detectProhibitedKeys);
    
    return result;
  } catch (error) {
    console.error('Error starting security monitoring:', error);
    // Continue exam even if monitoring fails
    return null;
  }
}

// Function to collect browser fingerprint
async function collectBrowserFingerprint() {
  // Simple implementation - in production, use a proper fingerprinting library
  return {
    canvas: await generateCanvasFingerprint(),
    webGL: getWebGLInfo(),
    fonts: detectFonts(),
    plugins: Array.from(navigator.plugins).map(p => p.name)
  };
}

// Function to handle tab switching
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    tabSwitchStartTime = Date.now();
    tabSwitchCount++;
  } else if (document.visibilityState === 'visible' && tabSwitchStartTime > 0) {
    const hiddenTime = (Date.now() - tabSwitchStartTime) / 1000; // seconds
    tabSwitchStartTime = 0;
    
    // Report tab switch if hidden for more than 2 seconds
    if (hiddenTime > 2) {
      reportCheatingIncident(examId, 'TAB_SWITCH', {
        switchCount: tabSwitchCount,
        hiddenTime,
        visibilityState: 'hidden'
      });
    }
  }
}

// Function to report cheating incidents
async function reportCheatingIncident(examId, evidenceType, details) {
  try {
    const response = await fetch(`/api/exam-attendance/${examId}/report-cheating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionId
      },
      body: JSON.stringify({
        evidenceType,
        details,
        source: 'CLIENT'
      })
    });
    
    const result = await response.json();
    console.log(`Reported ${evidenceType} incident:`, result);
    return result;
  } catch (error) {
    console.error(`Failed to report ${evidenceType} incident:`, error);
    return null;
  }
}
```

### 5.2 Submitting Answers

```javascript
// Function to submit an answer
async function submitAnswer(examId, questionId, answer, timeSpent) {
  try {
    const response = await fetch(`/api/exam-attendance/${examId}/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionId
      },
      body: JSON.stringify({
        questionId,
        answer,
        timeSpent
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    
    // Update progress
    setProgress(result.progress);
    
    // Store locally as backup
    saveAnswerToLocalStorage(questionId, answer);
    
    return result;
  } catch (error) {
    console.error('Error submitting answer:', error);
    
    // Store locally to retry later
    saveAnswerForRetry(examId, questionId, answer, timeSpent);
    
    showErrorNotification(`Failed to submit answer: ${error.message}`);
    return null;
  }
}

// Function to save answer for retry
function saveAnswerForRetry(examId, questionId, answer, timeSpent) {
  const retryQueue = JSON.parse(localStorage.getItem('answerRetryQueue') || '[]');
  retryQueue.push({
    examId, 
    questionId, 
    answer, 
    timeSpent,
    timestamp: Date.now()
  });
  localStorage.setItem('answerRetryQueue', JSON.stringify(retryQueue));
}

// Function to retry failed submissions
async function retryFailedSubmissions() {
  const retryQueue = JSON.parse(localStorage.getItem('answerRetryQueue') || '[]');
  if (retryQueue.length === 0) return;
  
  const newRetryQueue = [];
  
  for (const item of retryQueue) {
    try {
      const result = await submitAnswer(
        item.examId, 
        item.questionId, 
        item.answer, 
        item.timeSpent
      );
      
      if (!result) {
        // If still failing, keep in queue but only if not too old
        if (Date.now() - item.timestamp < 30 * 60 * 1000) { // 30 minutes
          newRetryQueue.push(item);
        }
      }
    } catch (error) {
      // Keep in retry queue
      newRetryQueue.push(item);
    }
  }
  
  localStorage.setItem('answerRetryQueue', JSON.stringify(newRetryQueue));
}
```

### 5.3 Completing an Exam

```javascript
// Function to complete an exam
async function completeExam(examId) {
  try {
    // First retry any failed submissions
    await retryFailedSubmissions();
    
    const response = await fetch(`/api/exam-attendance/${examId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': sessionId
      }
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    
    // Clear exam data from local storage
    clearExamLocalStorage();
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('copy', preventCopyPaste);
    document.removeEventListener('paste', preventCopyPaste);
    document.removeEventListener('keydown', detectProhibitedKeys);
    
    // Show result
    setExamCompleted(true);
    setExamResult(result);
    
    return result;
  } catch (error) {
    console.error('Error completing exam:', error);
    showErrorNotification(`Failed to complete exam: ${error.message}`);
    return null;
  }
}
```

## Best Practices for Implementation

1. **Authentication Management**
   - Store the session ID securely (HttpOnly cookies or secure local storage)
   - Handle session expiration gracefully

2. **Exam Progress Tracking**
   - Implement autosave for answers (every 30 seconds)
   - Store answers locally as backup
   - Implement retry mechanism for failed submissions

3. **Time Management**
   - Sync time with server periodically
   - Show clear countdown timer
   - Warn user before exam expires

4. **Security Implementation**
   - Start monitoring immediately after exam starts
   - Implement all recommended security checks
   - Provide clear warnings when suspicious activity is detected

5. **Error Handling**
   - Implement comprehensive error handling
   - Show user-friendly error messages
   - Log errors for debugging

6. **Offline Support**
   - Cache exam questions locally
   - Store answers for submission when online
   - Show sync status indicator

7. **Accessibility**
   - Ensure keyboard navigation works
   - Support screen readers
   - Provide high contrast mode
