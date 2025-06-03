# Abandoned Exam Cleanup

## Overview

The abandoned exam cleanup feature is designed to automatically handle exam sessions that were left in an "IN_PROGRESS" state but were not properly completed or timed out. This can happen if:

- A student loses internet connection during an exam
- The browser crashes or is forcibly closed
- The student navigates away without properly completing the exam
- There's a server-side issue that prevents proper exam completion

## Implementation

The system uses a scheduled cron job that runs daily at midnight IST (Indian Standard Time) to identify and clean up abandoned exam sessions.

### How It Works

1. The cron job runs at 00:00 IST (6:30 PM UTC) every day
2. It identifies all exam attendance records with status "IN_PROGRESS" that haven't been updated in the last 3 hours
3. These records are updated to status "TIMED_OUT" and an end time is set
4. Detailed logs are generated for monitoring and troubleshooting

### Configuration

The abandoned exam cleanup is configured in two main files:

- `utils/attendanceUtils.js` - Contains the `handleAbandonedExams()` function that performs the cleanup
- `utils/cronJobs.js` - Sets up the cron job to run at midnight IST

## Testing

You can manually test the abandoned exam cleanup by running:

```bash
npm run test:abandoned-exams
```

This will execute the cleanup function immediately and report the results.

## Monitoring

The system logs detailed information about the cleanup process:

- Number of abandoned exams found
- Number of exams successfully updated
- Any errors encountered during the process

These logs can be found in your standard application logs.

## Related Features

The abandoned exam cleanup works alongside other exam attendance management features:

- Stale attendance cleanup (runs hourly)
- Real-time exam status monitoring
- Attempt number management

## Technical Details

### Cron Job Schedule

The cron job is scheduled using the following pattern:

```
0 30 18 * * *
```

This translates to:
- Second: 0
- Minute: 30
- Hour: 18 (UTC, which is midnight IST)
- Day of month: * (every day)
- Month: * (every month)
- Day of week: * (every day of the week)

### Cleanup Criteria

An exam is considered abandoned if:

1. Its status is "IN_PROGRESS"
2. Its `lastUpdated` timestamp is more than 3 hours old

### Status Transition

Abandoned exams are transitioned from "IN_PROGRESS" to "TIMED_OUT" status, which:

- Prevents further answers from being submitted
- Allows the exam to be scored based on answers submitted so far
- Frees up the attempt slot for the student to try again if allowed 