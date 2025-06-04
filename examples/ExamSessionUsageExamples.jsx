import React from 'react';
import ExamSessionManager from './ExamSessionManager';

// Example 1: Usage in an Exam List Page
const ExamListPage = () => {
  const exams = [
    {
      _id: '68274422db1570c33bfef3a9',
      title: 'JavaScript Fundamentals',
      description: 'Test your knowledge of JavaScript basics',
      duration: 60,
      maxAttempts: 3,
      userStatus: {
        inProgress: false,
        remainingAttempts: 2,
        completedAttempts: 1,
        maxAttempts: 3,
        bestScore: 75
      }
    },
    {
      _id: '68274422db1570c33bfef3b0',
      title: 'React Development',
      description: 'Advanced React concepts and patterns',
      duration: 90,
      maxAttempts: 2,
      userStatus: {
        inProgress: true,
        remainingAttempts: 1,
        completedAttempts: 0,
        maxAttempts: 2,
        currentAttempt: 1
      }
    }
  ];

  const handleExamStart = (examData) => {
    // Custom logic when exam starts successfully
    console.log('Exam started:', examData);
    // You can navigate programmatically here if needed
    // navigate(`/exam/${examData.examId}`);
  };

  const handleExamError = (error) => {
    // Custom error handling
    console.error('Exam start error:', error);
    // Show toast notification, etc.
  };

  return (
    <div className="exam-list">
      <h1>Available Exams</h1>
      
      {exams.map(exam => (
        <div key={exam._id} className="exam-card">
          <div className="exam-info">
            <h3>{exam.title}</h3>
            <p>{exam.description}</p>
            <div className="exam-meta">
              <span>Duration: {exam.duration} minutes</span>
              <span>Max Attempts: {exam.maxAttempts}</span>
              {exam.userStatus.bestScore && (
                <span>Best Score: {exam.userStatus.bestScore}%</span>
              )}
            </div>
          </div>
          
          <div className="exam-actions">
            <ExamSessionManager
              examId={exam._id}
              examTitle={exam.title}
              onExamStart={handleExamStart}
              onError={handleExamError}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Example 2: Usage in a Single Exam Detail Page
const ExamDetailPage = ({ examId }) => {
  const [exam, setExam] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchExamDetails();
  }, [examId]);

  const fetchExamDetails = async () => {
    try {
      const response = await fetch(`/api/exams/${examId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`
        }
      });
      
      if (response.ok) {
        const examData = await response.json();
        setExam(examData);
      }
    } catch (error) {
      console.error('Failed to fetch exam details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExamStart = (examData) => {
    // Redirect to exam taking interface
    window.location.href = `/exam/${examId}/take`;
  };

  if (loading) {
    return <div>Loading exam details...</div>;
  }

  if (!exam) {
    return <div>Exam not found</div>;
  }

  return (
    <div className="exam-detail">
      <div className="exam-header">
        <h1>{exam.title}</h1>
        <p className="exam-description">{exam.description}</p>
      </div>

      <div className="exam-info-grid">
        <div className="info-item">
          <strong>Duration:</strong> {exam.duration} minutes
        </div>
        <div className="info-item">
          <strong>Total Questions:</strong> {exam.totalQuestions}
        </div>
        <div className="info-item">
          <strong>Max Attempts:</strong> {exam.maxAttempts}
        </div>
        <div className="info-item">
          <strong>Passing Score:</strong> {exam.passingScore}%
        </div>
      </div>

      <div className="exam-start-section">
        <h2>Start Exam</h2>
        <ExamSessionManager
          examId={exam._id}
          examTitle={exam.title}
          onExamStart={handleExamStart}
        />
      </div>

      {exam.instructions && (
        <div className="exam-instructions">
          <h2>Instructions</h2>
          <div dangerouslySetInnerHTML={{ __html: exam.instructions }} />
        </div>
      )}
    </div>
  );
};

// Example 3: Custom Hook for Exam Session Management
const useExamSession = (examId) => {
  const [sessionState, setSessionState] = React.useState({
    status: null,
    loading: true,
    error: null,
    conflict: null
  });

  const updateSessionState = (updates) => {
    setSessionState(prev => ({ ...prev, ...updates }));
  };

  const checkStatus = async () => {
    updateSessionState({ loading: true, error: null });
    
    try {
      const response = await fetch(`/api/exam-attendance/${examId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`
        }
      });

      if (response.ok) {
        const status = await response.json();
        updateSessionState({ status, loading: false });
        return status;
      } else {
        throw new Error('Failed to fetch status');
      }
    } catch (error) {
      updateSessionState({ 
        error: error.message, 
        loading: false 
      });
      return null;
    }
  };

  const startSession = async (endpoint = 'attend') => {
    updateSessionState({ loading: true, error: null, conflict: null });

    try {
      const response = await fetch(`/api/exam-attendance/${examId}/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionId')}`
        }
      });

      if (response.status === 409) {
        const conflictData = await response.json();
        updateSessionState({ 
          conflict: conflictData, 
          loading: false 
        });
        return { success: false, conflict: conflictData };
      }

      if (response.ok) {
        const examData = await response.json();
        updateSessionState({ loading: false });
        return { success: true, data: examData };
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start exam');
      }
    } catch (error) {
      updateSessionState({ 
        error: error.message, 
        loading: false 
      });
      return { success: false, error: error.message };
    }
  };

  React.useEffect(() => {
    if (examId) {
      checkStatus();
    }
  }, [examId]);

  return {
    ...sessionState,
    checkStatus,
    startSession,
    clearConflict: () => updateSessionState({ conflict: null }),
    clearError: () => updateSessionState({ error: null })
  };
};

// Example 4: Advanced Component with Custom Logic
const AdvancedExamManager = ({ examId, examTitle }) => {
  const {
    status,
    loading,
    error,
    conflict,
    startSession,
    clearConflict,
    clearError
  } = useExamSession(examId);

  const [showInstructions, setShowInstructions] = React.useState(false);

  const handleStartAttempt = async () => {
    const result = await startSession('new-attempt');
    
    if (result.success) {
      // Navigate to exam
      window.location.href = `/exam/${examId}/take`;
    }
  };

  const handleContinueSession = async () => {
    const result = await startSession('attend');
    
    if (result.success) {
      // Navigate to exam
      window.location.href = `/exam/${examId}/take`;
    }
  };

  const handleForceNew = async () => {
    const result = await startSession('force-new-attempt');
    
    if (result.success) {
      clearConflict();
      window.location.href = `/exam/${examId}/take`;
    }
  };

  return (
    <div className="advanced-exam-manager">
      {error && (
        <div className="error-alert">
          {error}
          <button onClick={clearError}>×</button>
        </div>
      )}

      {!conflict ? (
        <div className="normal-controls">
          <button 
            onClick={() => setShowInstructions(!showInstructions)}
            className="btn btn-info"
          >
            {showInstructions ? 'Hide' : 'Show'} Instructions
          </button>

          {status?.inProgress ? (
            <button 
              onClick={handleContinueSession}
              disabled={loading}
              className="btn btn-success"
            >
              Continue Current Attempt
            </button>
          ) : (
            <button 
              onClick={handleStartAttempt}
              disabled={loading}
              className="btn btn-primary"
            >
              Start New Attempt
            </button>
          )}
        </div>
      ) : (
        <div className="conflict-resolution">
          <div className="conflict-message">
            <h4>Active Session Detected</h4>
            <p>You have an active session for {examTitle}. What would you like to do?</p>
          </div>
          
          <div className="conflict-actions">
            <button 
              onClick={handleContinueSession}
              className="btn btn-success"
            >
              Continue Session
            </button>
            
            <button 
              onClick={handleForceNew}
              className="btn btn-warning"
            >
              Start Fresh
            </button>
            
            <button 
              onClick={clearConflict}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="instructions-panel">
          <h4>Exam Instructions</h4>
          <ul>
            <li>Read each question carefully</li>
            <li>You can navigate between questions</li>
            <li>Your progress is automatically saved</li>
            <li>Submit the exam when you're done</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExamListPage;
export { ExamDetailPage, useExamSession, AdvancedExamManager };
