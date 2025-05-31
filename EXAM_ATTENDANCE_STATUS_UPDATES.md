# Frontend Update: Enhanced Exam Attendance Status Tracking

## Overview
We've made significant improvements to the backend exam attendance system to fix status reporting issues. The system now properly tracks exam attempt status and numbers, with better handling of attempt counts and status transitions.

## Key API Changes

### 1. getExamStatus API Endpoint

The exam status API now returns enhanced information:

```json
{
  "status": "COMPLETED", 
  "statusDisplay": "Completed",
  "score": 4,
  "totalQuestions": 5,
  "attemptedQuestions": 5,
  "startTime": "2025-05-16T15:03:27.046Z",
  "endTime": "2025-05-16T16:05:29.669Z",
  "attemptNumber": 1,
  "inProgress": false,
  "completed": true,
  "timedOut": false,
  "totalAttempts": 2,
  "completedAttempts": 1,
  "remainingAttempts": 4
}
```

### 2. getUserExams API Endpoint

The user exams API now includes detailed attempt information:

```json
{
  "message": "Exam history retrieved successfully",
  "summary": {
    "totalExams": 2,
    "totalAttempts": 3,
    "completedAttempts": 2,
    "passedExams": 1,
    "passRate": "50.0%",
    "hiddenExams": 0,
    "showAll": true,
    "maxAttemptsAllowed": 5
  },
  "exams": [
    {
      "examId": "682744bedb1570c33bfef5d4",
      "examTitle": "Example Exam",
      "attempts": [
        {
          "attendanceId": "682753bf8474557f5c0dbb2b",
          "attemptNumber": 1,
          "startTime": "2025-05-16T15:03:27.046Z",
          "endTime": "2025-05-16T16:05:29.669Z",
          "status": "TIMED_OUT",
          "statusDisplay": "Timed Out"
        }
      ],
      "attemptsInfo": {
        "total": 1,
        "completed": 1,
        "inProgress": 0,
        "remaining": 4,
        "canAttempt": true,
        "maxAttemptsReached": false,
        "maxAttempts": 5
      }
    }
  ]
}
```

## Required Frontend Updates

### 1. Exam Status Display
- Use the new `inProgress`, `completed`, and `timedOut` flags to accurately display exam status
- Display "Attempt #X" using the `attemptNumber` field
- Show remaining attempts (e.g., "4 attempts remaining") using `remainingAttempts`
- Display max attempts allowed (5) and attempts used so far

### 2. Dashboard Exam List
- Use the `attemptsInfo` object to show comprehensive attempt information
- Clearly indicate when a user has reached maximum attempts
- Display remaining attempts information prominently
- Use the `statusDisplay` for user-friendly status messages

### 3. Timeout Handling
- Update UI to handle status transitions gracefully, especially for "TIMED_OUT" exams
- Show appropriate messages when an exam times out
- Use the `timedOut` flag to conditionally render timeout-specific UI elements

### 4. Exam Attempt Navigation
- When starting a new exam, use the backend's calculated attempt number
- Don't try to manage attempt counting on the frontend
- Ensure UI properly reflects the current attempt number from the API

### 5. Progress Tracking
- For in-progress exams, show the number of questions attempted using `attemptedQuestions`
- For completed exams, show score, total questions, and percentage

These updates will improve the reliability of the exam attendance system and provide a better user experience, especially for users with multiple exam attempts or those who've experienced timeouts.
