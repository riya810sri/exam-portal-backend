/**
 * React Frontend Integration for Anti-Abuse Detection System
 * This file provides complete examples for integrating the anti-abuse system
 * into a React-based exam taking interface
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

// =============================================================================
// 1. CLIENT-SIDE BEHAVIORAL TRACKING HOOK
// =============================================================================

export const useBehaviorTracking = () => {
  const [behaviorData, setBehaviorData] = useState({
    mouseMovements: [],
    keystrokes: [],
    tabSwitches: 0,
    windowBlurEvents: 0,
    rightClicks: 0,
    copyPasteAttempts: 0,
    devToolsDetected: false
  });

  const mouseMovements = useRef([]);
  const keystrokes = useRef([]);
  const lastMouseTime = useRef(Date.now());
  const lastKeyTime = useRef(Date.now());

  // Mouse movement tracking
  const trackMouseMovement = useCallback((e) => {
    const now = Date.now();
    // Throttle to avoid too much data
    if (now - lastMouseTime.current > 100) {
      const movement = {
        x: e.clientX,
        y: e.clientY,
        timestamp: now
      };
      
      mouseMovements.current.push(movement);
      
      // Keep only last 50 movements
      if (mouseMovements.current.length > 50) {
        mouseMovements.current.shift();
      }
      
      lastMouseTime.current = now;
    }
  }, []);

  // Keystroke tracking
  const trackKeystroke = useCallback((e) => {
    const now = Date.now();
    const keystroke = {
      key: e.key,
      timestamp: now,
      timeDiff: now - lastKeyTime.current
    };
    
    keystrokes.current.push(keystroke);
    
    // Keep only last 20 keystrokes
    if (keystrokes.current.length > 20) {
      keystrokes.current.shift();
    }
    
    lastKeyTime.current = now;
  }, []);

  // Tab switch detection
  const trackVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setBehaviorData(prev => ({
        ...prev,
        tabSwitches: prev.tabSwitches + 1
      }));
    }
  }, []);

  // Window blur detection
  const trackWindowBlur = useCallback(() => {
    setBehaviorData(prev => ({
      ...prev,
      windowBlurEvents: prev.windowBlurEvents + 1
    }));
  }, []);

  // Right-click detection
  const trackRightClick = useCallback((e) => {
    e.preventDefault();
    setBehaviorData(prev => ({
      ...prev,
      rightClicks: prev.rightClicks + 1
    }));
  }, []);

  // Copy/paste detection
  const trackCopyPaste = useCallback((e) => {
    if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
      setBehaviorData(prev => ({
        ...prev,
        copyPasteAttempts: prev.copyPasteAttempts + 1
      }));
    }
  }, []);

  // DevTools detection
  const detectDevTools = useCallback(() => {
    const threshold = 160;
    if (window.outerHeight - window.innerHeight > threshold || 
        window.outerWidth - window.innerWidth > threshold) {
      setBehaviorData(prev => ({
        ...prev,
        devToolsDetected: true
      }));
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    document.addEventListener('mousemove', trackMouseMovement);
    document.addEventListener('keydown', trackKeystroke);
    document.addEventListener('keydown', trackCopyPaste);
    document.addEventListener('visibilitychange', trackVisibilityChange);
    document.addEventListener('contextmenu', trackRightClick);
    window.addEventListener('blur', trackWindowBlur);
    window.addEventListener('resize', detectDevTools);

    return () => {
      document.removeEventListener('mousemove', trackMouseMovement);
      document.removeEventListener('keydown', trackKeystroke);
      document.removeEventListener('keydown', trackCopyPaste);
      document.removeEventListener('visibilitychange', trackVisibilityChange);
      document.removeEventListener('contextmenu', trackRightClick);
      window.removeEventListener('blur', trackWindowBlur);
      window.removeEventListener('resize', detectDevTools);
    };
  }, [trackMouseMovement, trackKeystroke, trackCopyPaste, trackVisibilityChange, 
      trackRightClick, trackWindowBlur, detectDevTools]);

  // Get current behavior data
  const getCurrentBehaviorData = useCallback(() => {
    return {
      ...behaviorData,
      mouseMovements: [...mouseMovements.current],
      keystrokes: [...keystrokes.current],
      sessionDuration: Date.now() - (keystrokes.current[0]?.timestamp || Date.now())
    };
  }, [behaviorData]);

  return {
    behaviorData: getCurrentBehaviorData(),
    resetBehaviorData: () => {
      mouseMovements.current = [];
      keystrokes.current = [];
      setBehaviorData({
        mouseMovements: [],
        keystrokes: [],
        tabSwitches: 0,
        windowBlurEvents: 0,
        rightClicks: 0,
        copyPasteAttempts: 0,
        devToolsDetected: false
      });
    }
  };
};

// =============================================================================
// 2. BROWSER FINGERPRINTING UTILITY
// =============================================================================

export const generateBrowserFingerprint = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Browser fingerprint text', 2, 2);
  
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    plugins: Array.from(navigator.plugins).map(p => ({
      name: p.name,
      description: p.description
    })),
    canvasFingerprint: canvas.toDataURL(),
    hardwareConcurrency: navigator.hardwareConcurrency,
    memory: navigator.deviceMemory,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    webdriver: navigator.webdriver
  };
};

// =============================================================================
// 3. ANTI-ABUSE API CLIENT
// =============================================================================

export class AntiAbuseClient {
  constructor(apiBaseUrl, authToken) {
    this.apiClient = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.jsChallenge = null;
    this.challengeSolution = null;
  }

  // Solve JavaScript challenge from server
  async solveJSChallenge(challenge) {
    try {
      // The challenge is a JavaScript expression to evaluate
      const solution = eval(challenge.expression);
      this.challengeSolution = solution;
      return solution;
    } catch (error) {
      console.error('Failed to solve JS challenge:', error);
      return null;
    }
  }

  // Attend exam with anti-abuse data
  async attendExam(examId, behaviorData) {
    try {
      const fingerprint = generateBrowserFingerprint();
      
      const response = await this.apiClient.post(`/exam-attendance/${examId}/attend`, {
        browserFingerprint: fingerprint,
        behaviorData: behaviorData,
        clientTimestamp: Date.now()
      });

      // Store JS challenge if provided
      if (response.data.jsChallenge) {
        this.jsChallenge = response.data.jsChallenge;
        await this.solveJSChallenge(this.jsChallenge);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to attend exam:', error);
      throw error;
    }
  }

  // Submit answer with anti-abuse validation
  async submitAnswer(examId, answerData, behaviorData) {
    try {
      const response = await this.apiClient.post(`/exam-attendance/${examId}/submit-answer`, {
        ...answerData,
        behaviorData: behaviorData,
        jsChallenge: this.challengeSolution,
        clientTimestamp: Date.now()
      });

      // Update JS challenge if new one is provided
      if (response.data.jsChallenge) {
        this.jsChallenge = response.data.jsChallenge;
        await this.solveJSChallenge(this.jsChallenge);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to submit answer:', error);
      throw error;
    }
  }
}

// =============================================================================
// 4. COMPLETE EXAM COMPONENT EXAMPLE
// =============================================================================

export const SecureExamComponent = ({ examId, questions, onExamComplete }) => {
  const { behaviorData, resetBehaviorData } = useBehaviorTracking();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [examSession, setExamSession] = useState(null);
  const [riskWarnings, setRiskWarnings] = useState([]);
  const antiAbuseClient = useRef(null);

  // Initialize exam session
  useEffect(() => {
    const initializeExam = async () => {
      try {
        antiAbuseClient.current = new AntiAbuseClient(
          process.env.REACT_APP_API_URL,
          localStorage.getItem('authToken')
        );

        const sessionData = await antiAbuseClient.current.attendExam(
          examId, 
          behaviorData
        );
        
        setExamSession(sessionData);
        
        // Show risk warnings if any
        if (sessionData.riskAssessment && sessionData.riskAssessment.overallRiskScore > 30) {
          setRiskWarnings(['Your session is being monitored for security purposes.']);
        }
      } catch (error) {
        console.error('Failed to initialize exam:', error);
      }
    };

    initializeExam();
  }, [examId]);

  // Handle answer submission
  const handleAnswerSubmit = async (questionId, selectedOption) => {
    try {
      const answerData = {
        questionId,
        selectedOption,
        timeSpent: Date.now() - (answers[questionId]?.startTime || Date.now())
      };

      const response = await antiAbuseClient.current.submitAnswer(
        examId,
        answerData,
        behaviorData
      );

      setAnswers(prev => ({
        ...prev,
        [questionId]: { ...answerData, submitted: true }
      }));

      // Check for risk warnings
      if (response.riskAssessment && response.riskAssessment.overallRiskScore > 50) {
        setRiskWarnings(prev => [...prev, 
          'Suspicious activity detected. Please ensure you are following exam guidelines.'
        ]);
      }

      // Move to next question
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
      } else {
        onExamComplete(answers);
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      setRiskWarnings(prev => [...prev, 'Failed to submit answer. Please try again.']);
    }
  };

  // Security monitoring component
  const SecurityMonitor = () => (
    <div className="security-monitor">
      {riskWarnings.length > 0 && (
        <div className="risk-warnings">
          {riskWarnings.map((warning, index) => (
            <div key={index} className="warning-message">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}
      
      <div className="behavior-stats">
        <small>
          Session Monitor: {behaviorData.tabSwitches} tab switches, {' '}
          {behaviorData.windowBlurEvents} focus losses
        </small>
      </div>
    </div>
  );

  if (!examSession) {
    return <div>Initializing secure exam session...</div>;
  }

  const question = questions[currentQuestion];

  return (
    <div className="secure-exam-container">
      <SecurityMonitor />
      
      <div className="exam-content">
        <div className="question-header">
          <h3>Question {currentQuestion + 1} of {questions.length}</h3>
        </div>
        
        <div className="question-content">
          <p>{question.text}</p>
          
          <div className="answer-options">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSubmit(question.id, option.id)}
                className="option-button"
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="exam-footer">
        <p>This exam session is monitored for security and academic integrity.</p>
      </div>
    </div>
  );
};

// =============================================================================
// 5. CSS STYLES FOR SECURITY COMPONENTS
// =============================================================================

export const securityStyles = `
.secure-exam-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.security-monitor {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 20px;
}

.risk-warnings {
  margin-bottom: 10px;
}

.warning-message {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 5px;
  font-size: 14px;
}

.behavior-stats {
  color: #6c757d;
  font-size: 12px;
}

.exam-content {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.question-header {
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.answer-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.option-button {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  padding: 12px 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.option-button:hover {
  background: #e9ecef;
  border-color: #0066cc;
}

.exam-footer {
  text-align: center;
  color: #6c757d;
  font-size: 12px;
  font-style: italic;
}
`;

// =============================================================================
// 6. USAGE EXAMPLE
// =============================================================================

/*
// In your main App component:

import React from 'react';
import { SecureExamComponent, securityStyles } from './SecureExamComponent';

function App() {
  const examData = {
    examId: 'exam-123',
    questions: [
      {
        id: 'q1',
        text: 'What is the capital of France?',
        options: [
          { id: 'a', text: 'London' },
          { id: 'b', text: 'Berlin' },
          { id: 'c', text: 'Paris' },
          { id: 'd', text: 'Madrid' }
        ]
      }
      // ... more questions
    ]
  };

  const handleExamComplete = (answers) => {
    console.log('Exam completed with answers:', answers);
    // Handle exam completion
  };

  return (
    <div className="App">
      <style>{securityStyles}</style>
      <SecureExamComponent 
        examId={examData.examId}
        questions={examData.questions}
        onExamComplete={handleExamComplete}
      />
    </div>
  );
}

export default App;
*/
