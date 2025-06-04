# Frontend Integration Guide: New Attempt Flow

## Overview

This guide covers the frontend integration for the updated `new-attempt` endpoint that now properly handles existing exam sessions without automatically timing them out.

## Key Changes

1. **Smart Session Detection**: The backend now checks for existing valid sessions before creating new attempts
2. **User Choice Interface**: When an existing session is found, users get options to continue or start fresh
3. **Force New Attempt**: Added `/force-new-attempt` endpoint for when users explicitly want to abandon current progress

## API Endpoints

### 1. Regular Exam Access
```
GET /api/exam-attendance/{examId}/attend
```
- Continues existing session if available
- Creates new session if none exists

### 2. New Attempt (Smart)
```
GET /api/exam-attendance/{examId}/new-attempt
```
- Checks for existing valid sessions
- Returns conflict (409) if session exists with options
- Creates new attempt only if no valid session exists

### 3. Force New Attempt
```
GET /api/exam-attendance/{examId}/force-new-attempt
```
- Always creates new attempt
- Times out any existing sessions
- Use when user explicitly chooses to start fresh

## Frontend Implementation

### 1. Exam Start Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ExamStartPage = ({ examId }) => {
  const [loading, setLoading] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(null);
  const [error, setError] = useState(null);

  const startExam = async (endpoint = 'attend') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/exam-attendance/${examId}/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`
        }
      });
      
      // Success - redirect to exam page
      window.location.href = `/exam/${examId}`;
      
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.existingAttempt) {
        // Session conflict - show options to user
        setSessionConflict(error.response.data);
      } else {
        setError(error.response?.data?.message || 'Failed to start exam');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueExisting = () => {
    startExam('attend');
  };

  const handleStartNew = () => {
    startExam('force-new-attempt');
  };

  const handleNewAttempt = () => {
    startExam('new-attempt');
  };

  if (sessionConflict) {
    return (
      <div className="session-conflict-modal">
        <div className="modal-content">
          <h3>Existing Exam Session Found</h3>
          <div className="conflict-details">
            <p>You have an ongoing exam session:</p>
            <ul>
              <li>Attempt #{sessionConflict.existingAttempt.attemptNumber}</li>
              <li>Started: {new Date(sessionConflict.existingAttempt.startTime).toLocaleString()}</li>
              <li>Time elapsed: {sessionConflict.existingAttempt.timeElapsed} minutes</li>
              <li>Questions attempted: {sessionConflict.existingAttempt.attemptedQuestions}</li>
            </ul>
          </div>
          
          <div className="conflict-options">
            <button 
              onClick={handleContinueExisting}
              className="btn-continue"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Continue Existing Session'}
            </button>
            
            <button 
              onClick={handleStartNew}
              className="btn-start-new"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Start New Attempt'}
            </button>
          </div>
          
          <div className="conflict-warning">
            <p><strong>Warning:</strong> Starting a new attempt will permanently lose your current progress.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-start-page">
      <h2>Start Exam</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="exam-actions">
        <button 
          onClick={() => startExam('attend')}
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Start/Continue Exam'}
        </button>
        
        <button 
          onClick={handleNewAttempt}
          className="btn-secondary"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'New Attempt'}
        </button>
      </div>
    </div>
  );
};

export default ExamStartPage;
```

### 2. Exam List Component Updates

```jsx
const ExamListItem = ({ exam }) => {
  const [showNewAttemptConfirm, setShowNewAttemptConfirm] = useState(false);
  
  const handleNewAttemptClick = () => {
    if (exam.userStatus?.inProgress) {
      setShowNewAttemptConfirm(true);
    } else {
      window.location.href = `/exam/${exam._id}/new-attempt`;
    }
  };

  return (
    <div className="exam-item">
      <h3>{exam.title}</h3>
      
      {/* Show different buttons based on exam status */}
      {exam.userStatus?.inProgress ? (
        <div className="exam-actions">
          <Link to={`/exam/${exam._id}`} className="btn-continue">
            Continue Exam (Attempt #{exam.userStatus.currentAttempt})
          </Link>
          
          {exam.userStatus.remainingAttempts > 0 && (
            <button 
              onClick={handleNewAttemptClick}
              className="btn-new-attempt"
            >
              New Attempt
            </button>
          )}
        </div>
      ) : exam.userStatus?.canAttempt ? (
        <Link to={`/exam/${exam._id}`} className="btn-start">
          Start Exam
        </Link>
      ) : (
        <div className="attempt-status">
          {exam.userStatus?.hasPassed ? 'Passed ✓' : 'Max attempts reached'}
        </div>
      )}

      {/* Confirmation modal for new attempt */}
      {showNewAttemptConfirm && (
        <div className="confirm-modal">
          <div className="modal-content">
            <h4>Start New Attempt?</h4>
            <p>You have an exam in progress. Starting a new attempt will lose your current progress.</p>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowNewAttemptConfirm(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              
              <a 
                href={`/exam/${exam._id}/force-new-attempt`}
                className="btn-confirm"
              >
                Start New Attempt
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3. Error Handling Service

```jsx
// services/examService.js
export const examService = {
  async startExam(examId, options = {}) {
    const { forceNew = false, continueExisting = false } = options;
    
    let endpoint = 'attend';
    if (forceNew) {
      endpoint = 'force-new-attempt';
    } else if (!continueExisting) {
      endpoint = 'new-attempt';
    }
    
    try {
      const response = await axios.get(`/api/exam-attendance/${examId}/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`
        }
      });
      
      return { success: true, data: response.data };
      
    } catch (error) {
      if (error.response?.status === 409) {
        return { 
          success: false, 
          conflict: true, 
          data: error.response.data 
        };
      }
      
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to start exam' 
      };
    }
  },

  async checkExamStatus(examId) {
    try {
      const response = await axios.get(`/api/exam-attendance/${examId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to check exam status:', error);
      return null;
    }
  }
};
```

### 4. React Hook for Exam Management

```jsx
// hooks/useExamSession.js
import { useState, useEffect } from 'react';
import { examService } from '../services/examService';

export const useExamSession = (examId) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    checkStatus();
  }, [examId]);

  const checkStatus = async () => {
    setLoading(true);
    const statusData = await examService.checkExamStatus(examId);
    setStatus(statusData);
    setLoading(false);
  };

  const startExam = async (options = {}) => {
    setLoading(true);
    setConflict(null);
    
    const result = await examService.startExam(examId, options);
    
    if (result.success) {
      // Redirect to exam page
      window.location.href = `/exam/${examId}`;
    } else if (result.conflict) {
      setConflict(result.data);
    } else {
      // Handle error
      console.error('Failed to start exam:', result.error);
    }
    
    setLoading(false);
    return result;
  };

  const continueExisting = () => {
    return startExam({ continueExisting: true });
  };

  const forceNewAttempt = () => {
    return startExam({ forceNew: true });
  };

  const requestNewAttempt = () => {
    return startExam({ forceNew: false });
  };

  return {
    status,
    loading,
    conflict,
    startExam,
    continueExisting,
    forceNewAttempt,
    requestNewAttempt,
    checkStatus
  };
};
```

### 5. CSS Styles

```css
/* styles/exam-session.css */
.session-conflict-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.conflict-details {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
}

.conflict-details ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.conflict-options {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
}

.btn-continue {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
}

.btn-start-new {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
}

.conflict-warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 0.75rem;
  border-radius: 4px;
  color: #856404;
}

.btn-new-attempt {
  background: #fd7e14;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  border: 1px solid #f5c6cb;
}
```

## Integration Steps

1. **Update API calls** to handle the new conflict responses
2. **Add session conflict modals** to handle user choices
3. **Update exam list components** to show appropriate buttons
4. **Add confirmation dialogs** for destructive actions
5. **Implement error handling** for various edge cases

## Testing

Test these scenarios:

1. **Normal flow**: Starting exam with no existing session
2. **Continue existing**: User has valid in-progress session
3. **Force new**: User chooses to abandon current progress
4. **Stale session**: Existing session is too old (should auto-timeout)
5. **Max attempts**: User has reached maximum attempts
6. **Error handling**: Network errors, invalid sessions, etc.

## Browser Support

This implementation uses modern JavaScript features:
- ES6+ syntax
- Async/await
- URLSearchParams
- localStorage

Ensure your build process transpiles for older browsers if needed.
