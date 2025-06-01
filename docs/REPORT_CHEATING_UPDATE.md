# Report-Cheating Endpoint Update

The `report-cheating` endpoint has been updated to handle cases where an active exam session is not found. This update fixes the "No active exam found to report cheating" error that was occurring when users reported cheating incidents after their exam had completed.

## Changes Made

1. **Enhanced Controller Logic**: The `reportCheating` controller now:
   - First attempts to find an active exam (IN_PROGRESS)
   - If none found, looks for the most recent exam attendance record
   - As a last resort, creates a placeholder record to store the evidence

2. **Middleware Change**: Removed the `blockPostman` middleware from the route to allow legitimate client requests to go through.

3. **Added Anti-Abuse Data Collection**: Ensures all security events are properly logged with appropriate context.

## Updated Endpoint Behavior

```javascript
POST /api/exam-attendance/{examId}/report-cheating

// Request Body
{
  "evidenceType": "TAB_SWITCH", // Types: TAB_SWITCH, COPY_PASTE, PROHIBITED_KEYS, OTHER
  "details": {
    "switchCount": 3,
    "hiddenTime": 15, // Seconds
    "visibilityState": "hidden"
  },
  "source": "CLIENT" // Optional, defaults to CLIENT
}

// Response
{
  "message": "Cheating incident reported successfully",
  "evidenceId": "683c4d05feceae7d315b18d0"
}
```

## Impact on Frontend Code

This change is backward compatible. Frontend code can continue to call the same endpoint with the same parameters. The only difference is that it will now succeed in scenarios where it previously failed with a 404 error.

## Key Benefits

1. **More Robust Cheating Detection**: Security incidents can be reported and tracked at any time, not just during active exams
2. **Better User Experience**: Reduces errors shown to users during security monitoring
3. **Improved Security Logging**: Captures suspicious activities across the entire exam portal experience
