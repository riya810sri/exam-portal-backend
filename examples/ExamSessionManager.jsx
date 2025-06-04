import React, { useState, useEffect } from 'react';
import './ExamSessionManager.css';

const ExamSessionManager = ({ examId, examTitle, onExamStart, onError }) => {
  const [loading, setLoading] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(null);
  const [examStatus, setExamStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkExamStatus();
  }, [examId]);

  const checkExamStatus = async () => {
    try {
      const response = await fetch(`/api/exam-attendance/${examId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const status = await response.json();
        setExamStatus(status);
      }
    } catch (error) {
      console.error('Failed to check exam status:', error);
    }
  };

  const makeExamRequest = async (endpoint) => {
    setLoading(true);
    setError(null);
    setSessionConflict(null);

    try {
      const response = await fetch(`/api/exam-attendance/${examId}/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 409) {
        // Session conflict - user has existing session
        const conflictData = await response.json();
        setSessionConflict(conflictData);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start exam');
      }

      const examData = await response.json();
      
      // Success - notify parent component
      if (onExamStart) {
        onExamStart(examData);
      } else {
        // Default behavior - redirect to exam page
        window.location.href = `/exam/${examId}`;
      }

    } catch (error) {
      const errorMessage = error.message || 'Failed to start exam';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    makeExamRequest('attend');
  };

  const handleNewAttempt = () => {
    makeExamRequest('new-attempt');
  };

  const handleContinueExisting = () => {
    setSessionConflict(null);
    makeExamRequest('attend');
  };

  const handleForceNewAttempt = () => {
    setSessionConflict(null);
    makeExamRequest('force-new-attempt');
  };

  const handleCancelConflict = () => {
    setSessionConflict(null);
  };

  const formatTimeElapsed = (minutes) => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getActionButtons = () => {
    if (!examStatus) {
      return (
        <button 
          onClick={handleStartExam}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Loading...' : 'Start Exam'}
        </button>
      );
    }

    const { status, inProgress, remainingAttempts, completedAttempts, maxAttempts } = examStatus;

    if (inProgress) {
      return (
        <div className="exam-actions">
          <button 
            onClick={handleStartExam}
            disabled={loading}
            className="btn btn-success"
          >
            {loading ? 'Loading...' : `Continue Exam (Attempt #${examStatus.attemptNumber || 1})`}
          </button>
          
          {remainingAttempts > 0 && (
            <button 
              onClick={handleNewAttempt}
              disabled={loading}
              className="btn btn-warning"
            >
              {loading ? 'Loading...' : 'New Attempt'}
            </button>
          )}
        </div>
      );
    }

    if (remainingAttempts > 0) {
      return (
        <div className="exam-actions">
          <button 
            onClick={handleStartExam}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Loading...' : 'Start Exam'}
          </button>
          
          {completedAttempts > 0 && (
            <span className="attempts-info">
              Attempts: {completedAttempts}/{maxAttempts}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="max-attempts-reached">
        <span>Maximum attempts reached ({maxAttempts})</span>
      </div>
    );
  };

  return (
    <div className="exam-session-manager">
      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {getActionButtons()}

      {/* Session Conflict Modal */}
      {sessionConflict && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Existing Exam Session Found</h3>
            </div>

            <div className="modal-body">
              <div className="conflict-info">
                <p>You have an ongoing exam session for <strong>{examTitle}</strong>:</p>
                
                <ul className="session-details">
                  <li>
                    <strong>Attempt:</strong> #{sessionConflict.existingAttempt?.attemptNumber || 1}
                  </li>
                  <li>
                    <strong>Started:</strong> {
                      sessionConflict.existingAttempt?.startTime 
                        ? new Date(sessionConflict.existingAttempt.startTime).toLocaleString()
                        : 'Unknown'
                    }
                  </li>
                  <li>
                    <strong>Time Elapsed:</strong> {
                      sessionConflict.existingAttempt?.timeElapsed 
                        ? formatTimeElapsed(sessionConflict.existingAttempt.timeElapsed)
                        : 'Unknown'
                    }
                  </li>
                  <li>
                    <strong>Questions Attempted:</strong> {
                      sessionConflict.existingAttempt?.attemptedQuestions || 0
                    }
                  </li>
                </ul>

                <div className="options-description">
                  <h4>What would you like to do?</h4>
                  <div className="option-item">
                    <strong>Continue:</strong> Resume your current exam session with all progress preserved.
                  </div>
                  <div className="option-item">
                    <strong>Start New:</strong> Begin a fresh attempt. Your current progress will be permanently lost.
                  </div>
                </div>

                <div className="warning-box">
                  <strong>⚠️ Warning:</strong> Starting a new attempt will permanently lose all progress from your current session.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={handleCancelConflict}
                disabled={loading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              
              <button 
                onClick={handleContinueExisting}
                disabled={loading}
                className="btn btn-success"
              >
                {loading ? 'Loading...' : 'Continue Existing Session'}
              </button>
              
              <button 
                onClick={handleForceNewAttempt}
                disabled={loading}
                className="btn btn-danger"
              >
                {loading ? 'Loading...' : 'Start New Attempt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSessionManager;
