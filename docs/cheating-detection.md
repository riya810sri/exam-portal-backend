# Cheating Detection Functionality Documentation

## Overview
This document provides information about the cheating detection feature implemented in the exam portal backend. The system enables detection and reporting of suspicious activities during exams, with support for both client-side and server-side detection mechanisms.

## Data Model
The cheating detection feature extends the `ExamAttendance` model with the following fields:

- `cheatDetected` (Boolean): Indicates if cheating was detected in the exam attempt
- `cheatEvidence` (Array): Collection of evidence records with the following structure:
  - `timestamp` (Date): When the cheating incident was detected
  - `evidenceType` (String): Type of cheating detected (enum values)
  - `details` (Mixed): Flexible schema for different types of evidence data
  - `source` (String): Whether detected by client or server
- `flaggedForReview` (Boolean): Flag for administrators to review suspicious activities

### Evidence Types
The following cheating evidence types are supported:

| Type | Description |
|------|-------------|
| TAB_SWITCH | User switched to another browser tab |
| COPY_PASTE | User attempted to copy or paste content |
| MULTIPLE_WINDOWS | Multiple browser windows detected |
| PROHIBITED_KEYS | Restricted keyboard shortcuts used |
| FACE_DETECTION | Anomalies in webcam monitoring |
| SERVER_DETECTED | Suspicious patterns detected by server-side analysis |
| OTHER | Other types of cheating evidence |

## API Endpoints

### 1. Report Cheating Incident
- **URL**: `/api/exam-attendance/:examId/report-cheating`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "evidenceType": "TAB_SWITCH",
    "details": {
      "fromUrl": "https://exam.portal/test",
      "toUrl": "https://search-engine.com",
      "duration": 15000
    },
    "source": "CLIENT"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Cheating incident reported successfully",
    "evidenceId": "5f8a72b3c1e3a42d4c9b8e7d"
  }
  ```

### 2. Get Cheating Reports (Admin Only)
- **URL**: `/api/exam-attendance/admin/:examId/cheating-reports`
- **Method**: `GET`
- **Authentication**: Required (Admin only)
- **Response**:
  ```json
  {
    "message": "Cheating reports retrieved successfully",
    "count": 2,
    "reports": [
      {
        "attendanceId": "5f8a72b3c1e3a42d4c9b8e7a",
        "user": {
          "userId": "5f8a72b3c1e3a42d4c9b8e7b",
          "username": "student1",
          "name": "John Doe",
          "email": "john.doe@example.com"
        },
        "attemptNumber": 1,
        "startTime": "2023-01-01T10:00:00.000Z",
        "endTime": "2023-01-01T11:30:00.000Z",
        "status": "COMPLETED",
        "flaggedForReview": true,
        "evidenceCount": 3,
        "evidence": [
          {
            "id": "5f8a72b3c1e3a42d4c9b8e7c",
            "timestamp": "2023-01-01T10:15:23.000Z",
            "evidenceType": "TAB_SWITCH",
            "details": {
              "fromUrl": "https://exam.portal/test",
              "toUrl": "https://search-engine.com",
              "duration": 15000
            },
            "source": "CLIENT"
          }
        ]
      }
    ]
  }
  ```

## Integration Guide

### Client-Side Integration
To integrate client-side cheating detection:

1. Implement event listeners for suspicious activities (tab switch, key combinations, etc.)
2. When suspicious activity is detected, send a report to the API:

```javascript
async function reportCheatingIncident(examId, evidenceType, details) {
  try {
    const response = await axios.post(
      `/api/exam-attendance/${examId}/report-cheating`,
      {
        evidenceType,
        details,
        source: "CLIENT"
      },
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Cheating incident reported:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to report cheating:', error);
    return null;
  }
}
```

### Admin Dashboard Integration
For administrators to review cheating reports:

1. Fetch the cheating reports for an exam:

```javascript
async function getCheatingReports(examId) {
  try {
    const response = await axios.get(
      `/api/exam-attendance/admin/${examId}/cheating-reports`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.reports;
  } catch (error) {
    console.error('Failed to get cheating reports:', error);
    return [];
  }
}
```

2. Display the reports in the admin dashboard with appropriate filtering and sorting options.

## Future Enhancements
- Server-side pattern detection for identifying suspicious answer patterns
- AI-based analysis of student behavior during exams
- Integration with proctoring services
- Real-time notifications for administrators when cheating is detected
- Enhanced evidence collection (screenshots, webcam snapshots)
