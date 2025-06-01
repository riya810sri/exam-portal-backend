# Monitoring Endpoint Documentation

The monitoring endpoint is used to start monitoring for cheating detection during an exam.

## Endpoint Details

### URL
Both formats are supported:
- `POST /api/exam-attendance/:examId/start-monitoring`
- `POST /api/exam-attendance/start-monitoring/:examId`

### Headers
- `Content-Type: application/json`
- `Authorization: {sessionId}` - The session ID, not a JWT token

### Request Body
```json
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

### Response (Success)
Status: 200 OK
```json
{
  "message": "Monitoring started successfully",
  "success": true,
  "monitoringId": "683c4bea05d85bdff14fb14e",
  "riskLevel": "LOW",
  "status": "MONITORING_ACTIVE"
}
```

### Response (Error - No Active Exam)
Status: 404 Not Found
```json
{
  "message": "No active exam found to monitor",
  "success": false
}
```

## Testing Procedure

1. Create a test IN_PROGRESS exam session:
   ```
   node create_test_monitor.js
   ```

2. Create a valid session for authentication:
   ```
   node create_test_auth.js
   ```

3. Test the endpoint with curl:
   ```
   curl -X POST http://localhost:3000/api/exam-attendance/68274422db1570c33bfef3a9/start-monitoring \
     -H "Content-Type: application/json" \
     -H "Authorization: {sessionId}" \
     -H "Origin: http://localhost:3001" \
     --data-raw '{"userAgent":"Mozilla/5.0","screenResolution":"1920x1080","timezone":"Asia/Kolkata","browserFingerprint":{}}'
   ```

## Common Issues

1. **Authentication Error**: Make sure you're using a valid session ID in the Authorization header, not a JWT token.
2. **No Active Exam**: Ensure there is an IN_PROGRESS exam attendance record for the user.
3. **CORS Issues**: The Origin header must be one of the allowed origins configured in the CORS settings.
