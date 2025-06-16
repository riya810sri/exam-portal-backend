# Questions Export API Documentation

## Overview
The Questions Export API allows authenticated users to export exam questions in multiple formats for backup, sharing, or external use.

## Endpoint
```
GET /api/questions/export/:examId?format={json|csv|txt}
```

## Authentication
- **Required**: Yes
- **Middleware**: `authenticateUser`
- **Permissions**: Any authenticated user can export questions

## Parameters

### Path Parameters
- `examId` (required): MongoDB ObjectId of the exam

### Query Parameters
- `format` (optional): Export format
  - `json` (default): Structured JSON format
  - `csv`: Comma-separated values for spreadsheets
  - `txt`: Human-readable text format

## Response Formats

### JSON Format
```json
{
  "exam": {
    "id": "exam_id",
    "title": "Exam Title",
    "description": "Exam Description",
    "exportedAt": "2025-06-15T10:30:00.000Z"
  },
  "questions": [
    {
      "id": "question_id",
      "type": "MCQ",
      "questionText": "What is 2+2?",
      "options": ["2", "3", "4", "5"],
      "correctAnswer": "4"
    }
  ],
  "totalQuestions": 1
}
```

### CSV Format
```csv
Question ID,Type,Question Text,Option 1,Option 2,Option 3,Option 4,Correct Answer
question_id,MCQ,"What is 2+2?","2","3","4","5","4"
```

### TXT Format
```
EXAM: Exam Title
DESCRIPTION: Exam Description
EXPORTED: 6/15/2025, 10:30:00 AM
TOTAL QUESTIONS: 1
==================================================

QUESTION 1: [MCQ]
What is 2+2?
OPTIONS:
  A. 2
  B. 3
  C. 4
  D. 5
CORRECT ANSWER: 4
------------------------------
```

## Response Headers
- **JSON**: `Content-Type: application/json`
- **CSV**: `Content-Type: text/csv`
- **TXT**: `Content-Type: text/plain`
- **All formats**: `Content-Disposition: attachment; filename="questions_ExamTitle_timestamp.ext"`

## Error Responses

### 400 Bad Request
```json
{
  "message": "Exam ID is required"
}
```

### 401 Unauthorized
```json
{
  "message": "Access denied. No token provided."
}
```

### 404 Not Found
```json
{
  "message": "Exam not found"
}
```

### 404 No Questions
```json
{
  "message": "No questions found for this exam"
}
```

### 400 Unsupported Format
```json
{
  "message": "Unsupported format. Supported formats: json, csv, txt"
}
```

## Usage Examples

### JavaScript/Axios
```javascript
// Export as JSON
const response = await axios.get('/api/questions/export/675e1dd1b94635e89f8dd1f0', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

// Export as CSV
const csvResponse = await axios.get('/api/questions/export/675e1dd1b94635e89f8dd1f0?format=csv', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});
```

### cURL
```bash
# Export as JSON
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/questions/export/675e1dd1b94635e89f8dd1f0"

# Export as CSV
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/questions/export/675e1dd1b94635e89f8dd1f0?format=csv"
```

## Implementation Details

### Security Features
- Authentication required for all exports
- Exam existence validation
- Input sanitization for CSV output
- Proper error handling

### Performance Considerations
- Efficient MongoDB queries with populate
- Streaming for large datasets (can be implemented)
- Proper memory management for large exports

### File Naming Convention
- Pattern: `questions_{ExamTitle}_{timestamp}.{ext}`
- Spaces in exam titles are replaced with underscores
- Timestamp ensures unique filenames