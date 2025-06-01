# Exam Attendance API Flow Documentation

This document outlines the complete flow for exam attendance, from starting an exam to submitting answers and handling cheating detection. This is intended for frontend developers integrating with the exam portal backend.

## 1. Authentication

Before accessing any exam endpoints, the user must be authenticated.

### Login Flow

**Request:**
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

**Important:** Store the `sessionId` and include it in all subsequent requests as:
```
Authorization: 683c4c22feceae7d315b18cf
```
or
```
Authorization: Bearer 683c4c22feceae7d315b18cf
```

## 2. Exam Attendance Flow

### 2.1 Start an Exam

**Request:**
```
GET /api/exam-attendance/{examId}/attend
Authorization: Bearer {sessionId}
```

**Response:**
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

### 2.2 Start a New Attempt (if allowed multiple attempts)

**Request:**
```
GET /api/exam-attendance/{examId}/new-attempt
Authorization: Bearer {sessionId}
```

**Response:** Same as the attend endpoint above, but with incremented `attemptNumber`.

### 2.3 Submit an Answer

**Request:**
```
POST /api/exam-attendance/{examId}/submit-answer
Authorization: Bearer {sessionId}
Content-Type: application/json

{
  "questionId": "123456789",
  "answer": "B",
  "timeSpent": 45, // in seconds
  "jsChallengeResponse": "..." // Anti-abuse token from frontend
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

### 2.4 Complete the Exam

**Request:**
```
POST /api/exam-attendance/{examId}/complete
Authorization: Bearer {sessionId}
Content-Type: application/json

{
  "feedback": "The exam was well structured", // Optional
  "difficultyRating": 3 // Optional, 1-5 scale
}
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

### 2.5 Get Exam Status (during exam)

**Request:**
```
GET /api/exam-attendance/{examId}/status
Authorization: Bearer {sessionId}
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

### 2.6 View Exam Result (after completion)

**Request:**
```
GET /api/exam-attendance/{examId}/result
Authorization: Bearer {sessionId}
```

**Response:**
```json
{
  "success": true,
  "examId": "68274422db1570c33bfef3a9",
  "title": "Mathematics Test",
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

### 2.7 Review Exam Questions (after completion)

**Request:**
```
GET /api/exam-attendance/{examId}/review
Authorization: Bearer {sessionId}
```

**Response:**
```json
{
  "success": true,
  "examId": "68274422db1570c33bfef3a9",
  "title": "Mathematics Test",
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
      "yourAnswer": "B",
      "isCorrect": true,
      "explanation": "2+2 equals 4"
    },
    // ... more questions with answers
  ]
}
```

### 2.8 Download Certificate (if exam passed)

**Request:**
```
GET /api/exam-attendance/{examId}/certificate
Authorization: Bearer {sessionId}
```

**Response:** PDF file download

## 3. Security & Cheating Detection

### 3.1 Start Monitoring (Client-side detection)

**Request:**
```
POST /api/exam-attendance/{examId}/start-monitoring
Authorization: Bearer {sessionId}
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

### 3.2 Report Cheating Incident (Client-side detection)

**Request:**
```
POST /api/exam-attendance/{examId}/report-cheating
Authorization: Bearer {sessionId}
Content-Type: application/json

{
  "incidentType": "TAB_SWITCH",
  "timestamp": 1748779604726,
  "details": {
    "switchCount": 1,
    "hiddenTime": 15, // seconds
    "visibilityState": "hidden"
  },
  "evidence": {
    "screenshot": "data:image/png;base64,..." // Optional
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cheating incident reported",
  "incidentId": "683c4d05feceae7d315b18d0",
  "warningLevel": "MILD",
  "consequences": "This incident has been recorded"
}
```

## 4. Cancel Attempts

### 4.1 Cancel In-Progress Attempt

**Request:**
```
POST /api/exam-attendance/{examId}/cancel-in-progress
Authorization: Bearer {sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "Exam attempt canceled",
  "examId": "68274422db1570c33bfef3a9",
  "status": "CANCELED"
}
```

### 4.2 Cancel All Attempts for an Exam

**Request:**
```
POST /api/exam-attendance/{examId}/cancel-all-attempts
Authorization: Bearer {sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "All exam attempts canceled",
  "examId": "68274422db1570c33bfef3a9",
  "canceledCount": 2
}
```

## 5. View Exam History

### 5.1 Get All Exam History

**Request:**
```
GET /api/exam-attendance/my-exams
Authorization: Bearer {sessionId}
```

**Response:**
```json
{
  "success": true,
  "exams": [
    {
      "examId": "68274422db1570c33bfef3a9",
      "title": "Mathematics Test",
      "status": "COMPLETED",
      "score": 8,
      "totalMarks": 10,
      "percentage": 80,
      "completedOn": "2025-06-01T13:24:15.294Z",
      "attemptNumber": 1,
      "resultUrl": "/api/exam-attendance/68274422db1570c33bfef3a9/result"
    },
    // ... more exams
  ]
}
```

### 5.2 Get Enhanced Exam History

**Request:**
```
GET /api/exam-attendance/my-exam-history
Authorization: Bearer {sessionId}
```

**Response:** More detailed version of the above, with statistics and trends.

### 5.3 Filter Exam History by Status

**Request:**
```
GET /api/exam-attendance/my-exams/COMPLETED
Authorization: Bearer {sessionId}
```

**Response:** Same as my-exams but filtered by the specified status.

## 6. Error Handling

All API endpoints return appropriate status codes:

- 200: Success
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (invalid or expired session)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (exam not found or no active exam)
- 409: Conflict (e.g., attempting to start an already completed exam)
- 500: Internal Server Error

Error responses follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE" // optional
}
```

## 7. Frontend Implementation Notes

1. **Session Management**:
   - Store the sessionId in localStorage or a secure cookie
   - Include it in all API requests in the Authorization header
   - Handle session expiration gracefully by redirecting to login

2. **Exam Monitoring**:
   - Start monitoring immediately after the exam begins
   - Implement visibility change detection to catch tab switching
   - Report suspicious activities using the report-cheating endpoint

3. **Error Handling**:
   - Add global error handling for API requests
   - Show appropriate messages for different error types
   - Implement retry logic for network issues

4. **Real-time Updates**:
   - Poll the exam status endpoint periodically to show remaining time
   - Implement auto-save for answers before submission

5. **Offline Support**:
   - Cache submitted answers locally
   - Implement retry mechanism for failed submissions when back online

## 8. Common Implementation Examples

### Starting an Exam and Monitoring

```javascript
// Function to start the exam
async function startExam(examId) {
  try {
    const response = await fetch(`/api/exam-attendance/${examId}/attend`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionId}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      // Store exam data
      setExamData(data.examData);
      setAttendanceId(data.attendanceId);
      setTimeRemaining(data.timeRemaining);
      
      // Start monitoring
      startExamMonitoring(examId);
    }
  } catch (error) {
    console.error('Error starting exam:', error);
  }
}

// Function to start monitoring
async function startExamMonitoring(examId) {
  try {
    const browserData = {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browserFingerprint: await collectBrowserFingerprint()
    };
    
    const response = await fetch(`/api/exam-attendance/${examId}/start-monitoring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionId}`
      },
      body: JSON.stringify(browserData)
    });
    
    const data = await response.json();
    console.log('Monitoring started:', data);
    
    // Add event listeners for cheating detection
    document.addEventListener('visibilitychange', handleVisibilityChange);
  } catch (error) {
    console.error('Failed to start monitoring:', error);
  }
}
```

### Submitting an Answer

```javascript
async function submitAnswer(examId, questionId, answer, timeSpent) {
  try {
    const jsChallengeResponse = await generateJSChallengeResponse();
    
    const response = await fetch(`/api/exam-attendance/${examId}/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionId}`
      },
      body: JSON.stringify({
        questionId,
        answer,
        timeSpent,
        jsChallengeResponse
      })
    });
    
    const data = await response.json();
    if (data.success) {
      // Update progress
      setProgress(data.progress);
      
      // Store locally as backup
      localStorage.setItem(`answer_${questionId}`, answer);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error submitting answer:', error);
    
    // Store locally to retry later
    storeAnswerForRetry(examId, questionId, answer, timeSpent);
    return false;
  }
}
```

### Handling Tab Switching (Cheating Detection)

```javascript
let tabSwitchCount = 0;
let hiddenStartTime = 0;

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    hiddenStartTime = Date.now();
    tabSwitchCount++;
  } else if (document.visibilityState === 'visible' && hiddenStartTime > 0) {
    const hiddenTime = (Date.now() - hiddenStartTime) / 1000; // seconds
    hiddenStartTime = 0;
    
    // Report tab switch if hidden for more than 2 seconds
    if (hiddenTime > 2) {
      reportTabSwitch(tabSwitchCount, hiddenTime);
    }
  }
}

async function reportTabSwitch(switchCount, hiddenTime) {
  try {
    const response = await fetch(`/api/exam-attendance/${examId}/report-cheating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionId}`
      },
      body: JSON.stringify({
        incidentType: 'TAB_SWITCH',
        timestamp: Date.now(),
        details: {
          switchCount,
          hiddenTime,
          visibilityState: 'hidden'
        }
      })
    });
    
    const data = await response.json();
    console.log('Reported tab switch:', data);
    
    if (data.warningLevel === 'SEVERE') {
      showWarningToUser(data.consequences);
    }
  } catch (error) {
    console.error('Failed to report cheating incident:', error);
  }
}
```
