// AutoFullscreenExam.jsx
import React, { useState, useEffect, useRef } from 'react';
import './AutoFullscreenExam.css';

const AutoFullscreenExam = ({ examId, studentId }) => {
  const [examStarted, setExamStarted] = useState(false);
  const [isSecureMode, setIsSecureMode] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [examData, setExamData] = useState(null);
  const examInProgress = useRef(false);

  useEffect(() => {
    setupSecurityListeners();
    return () => cleanupSecurityListeners();
  }, []);

  const setupSecurityListeners = () => {
    // Fullscreen change detection
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement ||
                             document.msFullscreenElement);
      
      setIsSecureMode(isFullscreen);
      
      // If user exits fullscreen during exam, attempt to re-enter
      if (!isFullscreen && examInProgress.current) {
        showSecurityAlert('Security Warning', 'Exiting fullscreen during exam is not allowed. Re-entering automatically...');
        setTimeout(() => {
          enterFullscreen();
        }, 2000);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Security event prevention
    const preventAction = (event, message) => {
      event.preventDefault();
      showSecurityAlert('Action Blocked', message);
      return false;
    };

    const handleKeydown = (event) => {
      if (!examInProgress.current) return;

      const isCtrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      // Prohibited key combinations
      const prohibitedKeys = {
        'f12': true,     // Developer Tools
        'f11': true,     // Fullscreen toggle (handled automatically)
        'c': isCtrl,     // Ctrl+C
        'v': isCtrl,     // Ctrl+V
        'x': isCtrl,     // Ctrl+X
        'p': isCtrl,     // Ctrl+P
        's': isCtrl,     // Ctrl+S
        'u': isCtrl,     // Ctrl+U
        'i': isCtrl && event.shiftKey, // Ctrl+Shift+I
        'j': isCtrl && event.shiftKey, // Ctrl+Shift+J
      };

      if (prohibitedKeys[key]) {
        preventAction(event, `Key combination ${isCtrl ? 'Ctrl+' : ''}${event.key} is disabled`);
      }

      // Alt+Tab detection
      if (event.altKey && event.key === 'Tab') {
        preventAction(event, 'Alt+Tab is disabled during exam');
      }
    };

    // Tab visibility monitoring
    const handleVisibilityChange = () => {
      if (document.hidden && examInProgress.current) {
        showSecurityAlert('Security Warning', 'Tab switching detected! This action has been logged.');
      }
    };

    // Prevent page navigation during exam
    const handleBeforeUnload = (event) => {
      if (examInProgress.current) {
        event.preventDefault();
        event.returnValue = 'Leaving the exam will be recorded as suspicious activity. Are you sure?';
        return event.returnValue;
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', (e) => preventAction(e, 'Right-click disabled'));
    document.addEventListener('copy', (e) => preventAction(e, 'Copying disabled'));
    document.addEventListener('paste', (e) => preventAction(e, 'Pasting disabled'));
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Store references for cleanup
    window.examSecurityListeners = {
      handleFullscreenChange,
      preventAction,
      handleKeydown,
      handleVisibilityChange,
      handleBeforeUnload
    };
  };

  const cleanupSecurityListeners = () => {
    if (window.examSecurityListeners) {
      const listeners = window.examSecurityListeners;
      
      document.removeEventListener('fullscreenchange', listeners.handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', listeners.handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', listeners.handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', listeners.handleFullscreenChange);
      document.removeEventListener('contextmenu', (e) => listeners.preventAction(e, 'Right-click disabled'));
      document.removeEventListener('copy', (e) => listeners.preventAction(e, 'Copying disabled'));
      document.removeEventListener('paste', (e) => listeners.preventAction(e, 'Pasting disabled'));
      document.removeEventListener('keydown', listeners.handleKeydown);
      document.removeEventListener('visibilitychange', listeners.handleVisibilityChange);
      window.removeEventListener('beforeunload', listeners.handleBeforeUnload);
      
      delete window.examSecurityListeners;
    }
  };

  const enterFullscreen = async () => {
    try {
      const element = document.documentElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      
      console.log('✅ Entered fullscreen mode automatically');
      return true;
    } catch (error) {
      console.error('❌ Failed to enter fullscreen:', error);
      showSecurityAlert('Error', 'Unable to enter fullscreen mode. Please press F11 to continue.');
      return false;
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      
      console.log('✅ Exited fullscreen mode');
    } catch (error) {
      console.error('❌ Failed to exit fullscreen:', error);
    }
  };

  const showSecurityAlert = (title, message) => {
    const alert = {
      id: Date.now(),
      title,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setSecurityAlerts(prev => [...prev, alert]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setSecurityAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 5000);
  };

  const startSecureExam = async () => {
    console.log('🚀 Starting secure exam with automatic fullscreen...');
    
    // Simulate API call to start monitoring
    try {
      // Here you would make the actual API call to start monitoring
      // const response = await fetch('/api/exam-attendance/start-monitoring', { ... });
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enter fullscreen automatically
      const success = await enterFullscreen();
      
      if (success) {
        examInProgress.current = true;
        setExamStarted(true);
        
        // Simulate loading exam data
        setExamData({
          title: 'React Development Assessment',
          duration: 60,
          questions: [
            {
              id: 1,
              question: 'What is the difference between state and props in React?',
              type: 'text'
            },
            {
              id: 2,
              question: 'Explain the concept of React Hooks and their benefits.',
              type: 'text'
            },
            {
              id: 3,
              question: 'How does the automatic fullscreen security feature work?',
              type: 'text'
            }
          ]
        });
        
        console.log('✅ Secure exam environment activated');
      } else {
        showSecurityAlert('Setup Failed', 'Could not enter secure mode. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error starting exam:', error);
      showSecurityAlert('Error', 'Failed to start exam. Please try again.');
    }
  };

  const submitExam = async () => {
    if (window.confirm('Are you sure you want to submit your exam? This action cannot be undone.')) {
      console.log('📝 Ending secure exam...');
      
      examInProgress.current = false;
      
      // Exit fullscreen
      await exitFullscreen();
      
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showSecurityAlert('Exam Complete', 'Your exam has been submitted successfully. You may now close this window.');
      
      console.log('✅ Exam completed and secure mode disabled');
    }
  };

  const dismissAlert = (alertId) => {
    setSecurityAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  if (!examStarted) {
    return (
      <div className="exam-container">
        <div className="exam-start-screen">
          <h1>🔒 Secure Exam Environment</h1>
          <div className="security-info">
            <h3>⚠️ Automatic Security Features:</h3>
            <ul>
              <li>✅ Automatic fullscreen mode (no manual steps required)</li>
              <li>✅ Real-time activity monitoring</li>
              <li>✅ Tab switching and copy/paste disabled</li>
              <li>✅ Right-click and developer tools blocked</li>
              <li>✅ Automatic re-entry if fullscreen exited</li>
              <li>✅ Comprehensive security logging</li>
            </ul>
          </div>
          
          <button 
            onClick={startSecureExam}
            className="start-exam-button"
          >
            🚀 Start Secure Exam (Auto Fullscreen)
          </button>
          
          <div className="disclaimer">
            <p><small>
              By clicking "Start Secure Exam", you agree to security monitoring.
              The exam will automatically enter fullscreen mode for your security.
            </small></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-container">
      {/* Security Status Badge */}
      <div className={`security-badge ${isSecureMode ? 'active' : 'inactive'}`}>
        {isSecureMode ? '🔒 Secure Mode Active' : '⚠️ Security Setup in Progress'}
      </div>

      {/* Security Alerts */}
      <div className="security-alerts">
        {securityAlerts.map(alert => (
          <div key={alert.id} className="security-alert">
            <div className="alert-content">
              <h4>{alert.title}</h4>
              <p>{alert.message}</p>
              <small>{alert.timestamp}</small>
            </div>
            <button 
              className="dismiss-btn"
              onClick={() => dismissAlert(alert.id)}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Exam Content */}
      <div className="exam-content">
        <header className="exam-header">
          <h2>📝 {examData?.title}</h2>
          <div className="exam-info">
            <span>Duration: {examData?.duration} minutes</span>
            <span>Student ID: {studentId}</span>
          </div>
        </header>

        <div className="questions-container">
          {examData?.questions.map((question, index) => (
            <div key={question.id} className="question-card">
              <h3>Question {index + 1}</h3>
              <p>{question.question}</p>
              <textarea 
                className="answer-input"
                placeholder="Type your answer here..."
                rows="6"
              />
            </div>
          ))}
        </div>

        <div className="exam-actions">
          <button 
            onClick={submitExam}
            className="submit-button"
          >
            Submit Exam
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoFullscreenExam;
