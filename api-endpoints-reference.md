# Exam Portal API Endpoints Reference

This document provides curl examples for API endpoints related to fullscreen mode and dynamic attempt count features in the exam portal.

## Table of Contents
1. [Exam Creation](#1-exam-creation)
2. [Get Available Exams](#2-get-available-exams)
3. [Start Exam Attendance](#3-start-exam-attendance)
4. [Submit Answer](#4-submit-answer)
5. [Complete Exam](#5-complete-exam)
6. [Report Fullscreen Exit](#6-report-fullscreen-exit)
7. [Exam Status](#7-exam-status)

## Authentication

All requests require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## 1. Exam Creation

Create a new exam with configurable maxAttempts and passingScore.

### Request

```bash
curl -X POST \
  http://localhost:3000/api/exams \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "title": "JavaScript Fundamentals",
    "description": "Test your knowledge of JavaScript basics",
    "duration": 60,
    "maxAttempts": 3,
    "passingScore": 70,
    "sections": {
      "mcqs": []
    }
  }'
```

### Response

```json
{
  "message": "Exam created successfully and is pending approval",
  "exam": {
    "_id": "60d21b4667d0d8992e610c85",
    "title": "JavaScript Fundamentals",
    "description": "Test your knowledge of JavaScript basics",
    "duration": 60,
    "maxAttempts": 3,
    "passingScore": 70,
    "sections": {
      "mcqs": [],
      "shortAnswers": []
    },
    "createdBy": "60d21b4667d0d8992e610c80",
    "status": "PENDING",
    "createdAt": "2023-08-15T12:00:00.000Z",
    "updatedAt": "2023-08-15T12:00:00.000Z"
  }
}
```

---

## 2. Get Available Exams

Retrieve a list of available exams with attempt count information.

### Request

```bash
curl -X GET \
  http://localhost:3000/api/exams \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "message": "Exams retrieved successfully",
  "page": 1,
  "limit": 10,
  "total": 2,
  "totalPages": 1,
  "exams": [
    {
      "_id": "60d21b4667d0d8992e610c85",
      "title": "JavaScript Fundamentals",
      "description": "Test your knowledge of JavaScript basics",
      "duration": 60,
      "status": "PUBLISHED",
      "totalQuestions": 10,
      "questionCount": 10,
      "attempts": 1,
      "publishedAt": "2023-08-15T14:00:00.000Z",
      "maxAttempts": 3,
      "passingScore": 70,
      "userStatus": {
        "inProgress": false,
        "bestScore": 6,
        "bestPercentage": "60.0",
        "attemptCount": 1,
        "canAttempt": true,
        "remainingAttempts": 2
      }
    },
    {
      "_id": "60d21b4667d0d8992e610c86",
      "title": "Advanced JavaScript",
      "description": "Test your knowledge of advanced JavaScript concepts",
      "duration": 90,
      "status": "PUBLISHED",
      "totalQuestions": 15,
      "questionCount": 15,
      "attempts": 3,
      "publishedAt": "2023-08-10T10:00:00.000Z",
      "maxAttempts": 3,
      "passingScore": 60,
      "userStatus": {
        "inProgress": false,
        "bestScore": 12,
        "bestPercentage": "80.0",
        "attemptCount": 3,
        "canAttempt": false,
        "remainingAttempts": 0
      }
    }
  ]
}
```

---

## 3. Start Exam Attendance

Start attending an exam. Fullscreen mode will be enforced on the client side.

### Request

```bash
curl -X GET \
  'http://localhost:3000/api/exams/attend/60d21b4667d0d8992e610c85?newAttempt=true' \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "examTitle": "JavaScript Fundamentals",
  "currentPage": 1,
  "totalPages": 10,
  "totalQuestions": 10,
  "question": {
    "_id": "60d21b4667d0d8992e610c90",
    "questionText": "Which of the following is not a JavaScript data type?",
    "options": [
      "String",
      "Boolean",
      "Float",
      "Object"
    ]
  },
  "timeRemaining": 60,
  "attendanceId": "60d21b4667d0d8992e610d01",
  "attemptNumber": 2
}
```

---

## 4. Submit Answer

Submit an answer during the exam.

### Request

```bash
curl -X POST \
  http://localhost:3000/api/exams/submit-answer/60d21b4667d0d8992e610c85 \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "questionId": "60d21b4667d0d8992e610c90",
    "selectedAnswer": "Float",
    "timeTaken": 25,
    "mouseData": {
      "clickCount": 3,
      "movementDistance": 120
    },
    "keyboardData": {
      "keyPressCount": 5,
      "backspaceCount": 1
    }
  }'
```

### Response

```json
{
  "message": "Answer submitted successfully",
  "nextQuestion": null
}
```

---

## 5. Complete Exam

Complete the exam and get results.

### Request

```bash
curl -X POST \
  http://localhost:3000/api/exams/complete/60d21b4667d0d8992e610c85 \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "message": "Exam completed successfully",
  "score": 8,
  "totalQuestions": 10,
  "attemptedQuestions": 10,
  "percentage": "80.00",
  "result": "pass",
  "certificateGenerated": "yes",
  "certificateId": "cert_60d21b4667d0d8992e610e01",
  "emailSent": true,
  "shouldExitFullscreen": true,
  "examCompleted": true
}
```

---

## 6. Report Fullscreen Exit

Report when a user exits fullscreen mode during an exam.

### Request

```bash
curl -X POST \
  http://localhost:3000/api/exams/report-cheating/60d21b4667d0d8992e610c85 \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "evidenceType": "FULLSCREEN_EXIT",
    "details": {
      "timestamp": "2023-08-15T15:30:45.123Z",
      "warningCount": 1
    },
    "source": "CLIENT"
  }'
```

### Response

```json
{
  "message": "Cheating incident reported successfully",
  "evidenceId": "60d21b4667d0d8992e610f01"
}
```

---

## 7. Exam Status

Get the status of an exam, including attempt information.

### Request

```bash
curl -X GET \
  http://localhost:3000/api/exams/status/60d21b4667d0d8992e610c85 \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "status": "IN_PROGRESS",
  "examId": "60d21b4667d0d8992e610c85",
  "attendanceId": "60d21b4667d0d8992e610d01",
  "attemptNumber": 2,
  "startTime": "2023-08-15T15:20:00.000Z",
  "timeElapsed": 15,
  "timeRemaining": 45,
  "progress": {
    "totalQuestions": 10,
    "attemptedQuestions": 3,
    "percentComplete": 30
  },
  "totalAttempts": 2,
  "completedAttempts": 1,
  "remainingAttempts": 1
}
```

---

## 8. Start Monitoring

Start monitoring for fullscreen and anti-cheating functionality.

### Request

```bash
curl -X POST \
  http://localhost:3000/api/exams/start-monitoring/60d21b4667d0d8992e610c85 \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "message": "Monitoring started successfully",
  "success": true,
  "monitoringId": "60d21b4667d0d8992e610d01",
  "riskLevel": "LOW",
  "status": "MONITORING_ACTIVE",
  "socket": {
    "port": 3001,
    "url": "ws://localhost:3001",
    "monit_id": "user123_60d21b4667d0d8992e610c85_1692115200000",
    "protocols": ["websocket", "polling"]
  },
  "validation": {
    "requireBrowserValidation": true,
    "maxConnectionTime": 300000,
    "requiredEvents": [
      "browser_validation",
      "exam_ready",
      "security_heartbeat",
      "keyboard_data",
      "mouse_data",
      "fullscreen_status"
    ]
  },
  "scripts": {
    "keyboardMonitoring": "/* keyboard monitoring script */",
    "mouseMonitoring": "/* mouse monitoring script */",
    "fullscreenManager": "/* fullscreen manager script */"
  }
}
```

---

## 9. Cancel Attempt

Cancel an in-progress exam attempt.

### Request

```bash
curl -X POST \
  http://localhost:3000/api/exams/cancel-attempt/60d21b4667d0d8992e610c85 \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "message": "Exam attempt canceled successfully",
  "success": true,
  "attemptNumber": 2
}
```

---

## 10. Get User Exam History

Get a user's exam history with attempt information.

### Request

```bash
curl -X GET \
  http://localhost:3000/api/exams/history \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "message": "Exam history retrieved successfully",
  "user": {
    "username": "johndoe",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "summary": {
    "totalExams": 2,
    "totalAttempts": 4,
    "completedExams": 2,
    "passedExams": 1,
    "passRate": "50.0%",
    "averageScore": "70.0%"
  },
  "exams": [
    {
      "examId": "60d21b4667d0d8992e610c85",
      "title": "JavaScript Fundamentals",
      "description": "Test your knowledge of JavaScript basics",
      "duration": 60,
      "bestScore": 8,
      "bestPercentage": 80,
      "attempts": [
        {
          "attendanceId": "60d21b4667d0d8992e610d01",
          "attemptNumber": 2,
          "startDate": "15/08/2023",
          "startTime": "15:20",
          "endDate": "15/08/2023",
          "endTime": "16:10",
          "duration": "50 min",
          "status": "COMPLETED",
          "statusText": "Completed",
          "score": 8,
          "totalQuestions": 10,
          "attemptedQuestions": 10,
          "percentage": "80.00",
          "isPassed": true,
          "result": "PASSED",
          "canContinue": false,
          "canViewResults": true
        },
        {
          "attendanceId": "60d21b4667d0d8992e610d00",
          "attemptNumber": 1,
          "startDate": "10/08/2023",
          "startTime": "10:00",
          "endDate": "10/08/2023",
          "endTime": "10:45",
          "duration": "45 min",
          "status": "COMPLETED",
          "statusText": "Completed",
          "score": 6,
          "totalQuestions": 10,
          "attemptedQuestions": 10,
          "percentage": "60.00",
          "isPassed": false,
          "result": "NOT PASSED",
          "canContinue": false,
          "canViewResults": true
        }
      ],
      "latestAttemptDate": "2023-08-15T15:20:00.000Z",
      "hasPassed": true,
      "formattedBestScore": "8/10 (80.00%)"
    },
    {
      "examId": "60d21b4667d0d8992e610c86",
      "title": "Advanced JavaScript",
      "description": "Test your knowledge of advanced JavaScript concepts",
      "duration": 90,
      "bestScore": 9,
      "bestPercentage": 60,
      "attempts": [
        {
          "attendanceId": "60d21b4667d0d8992e610d03",
          "attemptNumber": 2,
          "startDate": "12/08/2023",
          "startTime": "14:00",
          "endDate": "12/08/2023",
          "endTime": "15:20",
          "duration": "80 min",
          "status": "COMPLETED",
          "statusText": "Completed",
          "score": 9,
          "totalQuestions": 15,
          "attemptedQuestions": 15,
          "percentage": "60.00",
          "isPassed": true,
          "result": "PASSED",
          "canContinue": false,
          "canViewResults": true
        },
        {
          "attendanceId": "60d21b4667d0d8992e610d02",
          "attemptNumber": 1,
          "startDate": "05/08/2023",
          "startTime": "09:30",
          "endDate": "05/08/2023",
          "endTime": "10:50",
          "duration": "80 min",
          "status": "COMPLETED",
          "statusText": "Completed",
          "score": 7,
          "totalQuestions": 15,
          "attemptedQuestions": 14,
          "percentage": "46.67",
          "isPassed": false,
          "result": "NOT PASSED",
          "canContinue": false,
          "canViewResults": true
        }
      ],
      "latestAttemptDate": "2023-08-12T14:00:00.000Z",
      "hasPassed": true,
      "formattedBestScore": "9/15 (60.00%)"
    }
  ],
  "filters": {
    "available": {
      "status": ["all", "IN_PROGRESS", "COMPLETED", "TIMED_OUT", "passed", "failed"],
      "sort": ["recent", "score", "title"]
    },
    "applied": {
      "status": "all",
      "sort": "recent",
      "search": ""
    }
  }
}
```

---

## 11. Get Cheating Reports (Admin Only)

Get all cheating reports for an exam (admin only).

### Request

```bash
curl -X GET \
  http://localhost:3000/api/admin/exams/cheating-reports/60d21b4667d0d8992e610c85 \
  -H 'Authorization: Bearer <your-admin-token>'
```

### Response

```json
{
  "message": "Cheating reports retrieved successfully",
  "count": 1,
  "reports": [
    {
      "attendanceId": "60d21b4667d0d8992e610d01",
      "user": {
        "userId": "60d21b4667d0d8992e610c80",
        "username": "johndoe",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "attemptNumber": 2,
      "startTime": "2023-08-15T15:20:00.000Z",
      "endTime": "2023-08-15T16:10:00.000Z",
      "status": "COMPLETED",
      "flaggedForReview": true,
      "evidenceCount": 1,
      "evidence": [
        {
          "id": "60d21b4667d0d8992e610f01",
          "timestamp": "2023-08-15T15:30:45.123Z",
          "evidenceType": "FULLSCREEN_EXIT",
          "details": {
            "timestamp": "2023-08-15T15:30:45.123Z",
            "warningCount": 1
          },
          "source": "CLIENT"
        }
      ]
    }
  ]
}
```

## 12. Review Exam Questions with Answers

Review questions and answers after completing an exam.

### Request

```bash
curl -X GET \
  'http://localhost:3000/api/exams/review/60d21b4667d0d8992e610c85?attemptNumber=2' \
  -H 'Authorization: Bearer <your-jwt-token>'
```

### Response

```json
{
  "examTitle": "JavaScript Fundamentals",
  "attemptNumber": 2,
  "totalQuestions": 10,
  "correctAnswers": 8,
  "score": 8,
  "percentage": "80.00",
  "passed": true,
  "reviewData": [
    {
      "questionId": "60d21b4667d0d8992e610c90",
      "questionText": "Which of the following is not a JavaScript data type?",
      "options": [
        "String",
        "Boolean",
        "Float",
        "Object"
      ],
      "userAnswer": "Float",
      "correctAnswer": "Float",
      "isCorrect": true,
      "explanation": "Float is not a separate data type in JavaScript. JavaScript has Number type which can represent both integers and floating-point values."
    },
    {
      "questionId": "60d21b4667d0d8992e610c91",
      "questionText": "Which method is used to add an element to the end of an array?",
      "options": [
        "push()",
        "pop()",
        "shift()",
        "unshift()"
      ],
      "userAnswer": "push()",
      "correctAnswer": "push()",
      "isCorrect": true,
      "explanation": "The push() method adds one or more elements to the end of an array and returns the new length of the array."
    }
    // Additional questions...
  ]
}
``` 