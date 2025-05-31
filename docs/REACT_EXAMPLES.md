# React Implementation Examples

## 🎯 Complete Integration Examples

### 1. **Main Exam Security Hook**

```javascript
// hooks/useCheatingDetection.js
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export function useCheatingDetection(examId, token) {
  const [securityState, setSecurityState] = useState({
    isMonitoring: false,
    violations: [],
    riskLevel: 'LOW',
    warningCount: 0,
    status: 'ACTIVE',
    lastViolation: null,
    sessionId: null
  });

  const [showWarning, setShowWarning] = useState(false);
  const tabSwitchCount = useRef(0);
  const behaviourData = useRef({
    mouseMovements: [],
    keystrokes: [],
    answerTimings: []
  });

  // API client with authentication
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Exam-Session': examId
    }
  });

  // Start monitoring when component mounts
  useEffect(() => {
    if (examId && token) {
      startMonitoring();
      setupEventListeners();
    }

    return () => {
      cleanup();
    };
  }, [examId, token]);

  // Initialize monitoring
  const startMonitoring = async () => {
    try {
      const response = await apiClient.post(`/exam-attendance/${examId}/start-monitoring`, {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browserFingerprint: generateFingerprint()
      });

      if (response.data.success) {
        setSecurityState(prev => ({
          ...prev,
          isMonitoring: true,
          sessionId: response.data.sessionId
        }));
      }
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  // Generate browser fingerprint
  const generateFingerprint = () => {
    return {
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      navigator: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      }
    };
  };

  // Setup event listeners for detection
  const setupEventListeners = () => {
    // Tab switch detection
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Mouse movement tracking
    document.addEventListener('mousemove', handleMouseMove);
    
    // Keyboard tracking
    document.addEventListener('keydown', handleKeyDown);
    
    // Right-click blocking
    document.addEventListener('contextmenu', handleContextMenu);
    
    // Keyboard shortcuts blocking
    document.addEventListener('keydown', handleKeyboardShortcuts);
  };

  // Handle tab switching
  const handleVisibilityChange = () => {
    if (document.hidden) {
      tabSwitchCount.current++;
      reportViolation('TAB_SWITCH', {
        tabSwitchCount: tabSwitchCount.current,
        timestamp: Date.now()
      });
    }
  };

  // Track mouse movements
  const handleMouseMove = (event) => {
    behaviourData.current.mouseMovements.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now()
    });

    // Limit data size
    if (behaviourData.current.mouseMovements.length > 100) {
      behaviourData.current.mouseMovements.shift();
    }
  };

  // Track keystrokes
  const handleKeyDown = (event) => {
    behaviourData.current.keystrokes.push({
      key: event.key,
      timestamp: Date.now(),
      duration: 0 // Can be calculated on keyup
    });

    // Detect copy-paste
    if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'v')) {
      reportViolation('COPY_PASTE', {
        action: event.key === 'c' ? 'copy' : 'paste',
        timestamp: Date.now()
      });
    }
  };

  // Block right-click
  const handleContextMenu = (event) => {
    event.preventDefault();
    reportViolation('RIGHT_CLICK_ATTEMPT', {
      timestamp: Date.now()
    });
  };

  // Block dangerous keyboard shortcuts
  const handleKeyboardShortcuts = (event) => {
    const blockedShortcuts = [
      { ctrl: true, key: 'u' },      // View source
      { ctrl: true, shift: true, key: 'I' }, // Dev tools
      { key: 'F12' },                // Dev tools
      { ctrl: true, shift: true, key: 'J' }, // Console
      { ctrl: true, key: 'P' },      // Print
      { ctrl: true, key: 'S' }       // Save
    ];

    const isBlocked = blockedShortcuts.some(shortcut => {
      return (!shortcut.ctrl || event.ctrlKey) &&
             (!shortcut.shift || event.shiftKey) &&
             event.key === shortcut.key;
    });

    if (isBlocked) {
      event.preventDefault();
      reportViolation('BLOCKED_SHORTCUT', {
        key: event.key,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        timestamp: Date.now()
      });
    }
  };

  // Report violation to backend
  const reportViolation = async (evidenceType, details) => {
    try {
      const response = await apiClient.post(`/exam-attendance/${examId}/report-cheating`, {
        evidenceType,
        details: {
          ...details,
          description: getViolationDescription(evidenceType),
          metadata: details
        },
        source: 'CLIENT'
      });

      if (response.data.success) {
        const { violationCount, riskLevel, action, message } = response.data;
        
        setSecurityState(prev => ({
          ...prev,
          violations: [...prev.violations, { evidenceType, details, timestamp: Date.now() }],
          riskLevel,
          warningCount: violationCount,
          lastViolation: { evidenceType, details }
        }));

        if (action === 'WARNING') {
          setShowWarning(true);
        } else if (action === 'SUSPEND') {
          setSecurityState(prev => ({ ...prev, status: 'SUSPENDED' }));
          // Handle suspension UI
        }
      }
    } catch (error) {
      console.error('Failed to report violation:', error);
    }
  };

  // Get human-readable violation description
  const getViolationDescription = (evidenceType) => {
    const descriptions = {
      TAB_SWITCH: 'User switched browser tabs',
      COPY_PASTE: 'Copy-paste operation detected',
      RIGHT_CLICK_ATTEMPT: 'Right-click context menu blocked',
      BLOCKED_SHORTCUT: 'Blocked potentially dangerous keyboard shortcut',
      SUSPICIOUS_TIMING: 'Suspicious answer timing detected'
    };
    return descriptions[evidenceType] || 'Unknown violation';
  };

  // Submit behavior data periodically
  const submitBehaviorData = useCallback(async () => {
    if (behaviourData.current.mouseMovements.length > 0 || 
        behaviourData.current.keystrokes.length > 0) {
      
      try {
        await apiClient.post(`/exam-attendance/${examId}/submit-behavior-data`, {
          mouseMovements: behaviourData.current.mouseMovements,
          keystrokes: behaviourData.current.keystrokes,
          answerTimings: behaviourData.current.answerTimings,
          timestamp: Date.now()
        });

        // Clear submitted data
        behaviourData.current = {
          mouseMovements: [],
          keystrokes: [],
          answerTimings: []
        };
      } catch (error) {
        console.error('Failed to submit behavior data:', error);
      }
    }
  }, [examId]);

  // Submit behavior data every 30 seconds
  useEffect(() => {
    const interval = setInterval(submitBehaviorData, 30000);
    return () => clearInterval(interval);
  }, [submitBehaviorData]);

  // Track answer timing
  const trackAnswerTiming = (questionId, responseTime) => {
    behaviourData.current.answerTimings.push({
      questionId,
      responseTime,
      timestamp: Date.now()
    });

    // Check for suspicious timing
    if (responseTime < 2000) { // Less than 2 seconds
      reportViolation('SUSPICIOUS_TIMING', {
        questionId,
        responseTime,
        reason: 'Too fast response'
      });
    }
  };

  // Acknowledge warning
  const acknowledgeWarning = () => {
    setShowWarning(false);
  };

  // Cleanup
  const cleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
  };

  return {
    securityState,
    showWarning,
    trackAnswerTiming,
    acknowledgeWarning,
    reportViolation
  };
}
```

### 2. **Security Status Component**

```jsx
// components/SecurityStatusIndicator.jsx
import React from 'react';

const SecurityStatusIndicator = ({ securityState }) => {
  const getRiskColor = (riskLevel) => {
    const colors = {
      LOW: 'bg-green-500',
      MEDIUM: 'bg-yellow-500', 
      HIGH: 'bg-orange-500',
      CRITICAL: 'bg-red-500'
    };
    return colors[riskLevel] || 'bg-gray-500';
  };

  const getRiskIcon = (riskLevel) => {
    const icons = {
      LOW: '🛡️',
      MEDIUM: '⚠️',
      HIGH: '🚨', 
      CRITICAL: '🔴'
    };
    return icons[riskLevel] || '❓';
  };

  if (!securityState.isMonitoring) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <span>🔄</span>
        <span>Initializing security...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4 p-3 bg-white border rounded-lg shadow-sm">
      <div className={`w-3 h-3 rounded-full ${getRiskColor(securityState.riskLevel)}`}></div>
      
      <div className="flex items-center space-x-2">
        <span className="text-lg">{getRiskIcon(securityState.riskLevel)}</span>
        <span className="font-medium">
          Security: {securityState.riskLevel}
        </span>
      </div>

      {securityState.warningCount > 0 && (
        <div className="flex items-center space-x-2 text-orange-600">
          <span>⚠️</span>
          <span className="text-sm">
            {securityState.warningCount} warning{securityState.warningCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {securityState.status === 'SUSPENDED' && (
        <div className="flex items-center space-x-2 text-red-600 font-bold">
          <span>🛑</span>
          <span>SUSPENDED</span>
        </div>
      )}
    </div>
  );
};

export default SecurityStatusIndicator;
```

### 3. **Violation Warning Modal**

```jsx
// components/ViolationWarningModal.jsx
import React, { useState, useEffect } from 'react';

const ViolationWarningModal = ({ violation, warningCount, onAcknowledge, isVisible }) => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (isVisible) {
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onAcknowledge();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isVisible, onAcknowledge]);

  if (!isVisible) return null;

  const getWarningLevel = () => {
    if (warningCount === 1) return { color: 'yellow', title: 'Security Warning' };
    if (warningCount === 2) return { color: 'orange', title: 'Final Warning' };
    return { color: 'red', title: 'Critical Violation' };
  };

  const warningLevel = getWarningLevel();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg p-6 max-w-md w-full mx-4 border-l-4 border-${warningLevel.color}-500`}>
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-2xl">
            {warningLevel.color === 'red' ? '🚨' : '⚠️'}
          </span>
          <h2 className={`text-xl font-bold text-${warningLevel.color}-600`}>
            {warningLevel.title}
          </h2>
        </div>

        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>Violation:</strong> {violation?.details?.description}
          </p>
          <p className="text-sm text-gray-600">
            This is warning #{warningCount}. Please adhere to exam security policies.
          </p>
        </div>

        {warningCount >= 3 ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>FINAL WARNING:</strong> Any additional violations will result in 
            immediate exam suspension.
          </div>
        ) : (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            <strong>Security Reminder:</strong>
            <ul className="list-disc list-inside mt-2 text-sm">
              <li>Do not switch browser tabs</li>
              <li>Do not copy or paste content</li>
              <li>Keep your browser in full screen</li>
              <li>Do not open developer tools</li>
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Auto-close in {countdown} seconds
          </div>
          <button
            onClick={onAcknowledge}
            className={`px-4 py-2 bg-${warningLevel.color}-500 text-white rounded hover:bg-${warningLevel.color}-600 transition-colors`}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationWarningModal;
```

### 4. **Main Exam Wrapper Component**

```jsx
// components/ExamSecurityWrapper.jsx
import React from 'react';
import { useCheatingDetection } from '../hooks/useCheatingDetection';
import SecurityStatusIndicator from './SecurityStatusIndicator';
import ViolationWarningModal from './ViolationWarningModal';

const ExamSecurityWrapper = ({ children, examId, userToken }) => {
  const securityHook = useCheatingDetection(examId, userToken);

  // Disable text selection and drag
  const securityStyles = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserDrag: 'none',
    KhtmlUserDrag: 'none',
    MozUserDrag: 'none',
    OUserDrag: 'none'
  };

  if (securityHook.securityState.status === 'SUSPENDED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg border-l-4 border-red-500">
          <div className="text-6xl mb-4">🛑</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Exam Session Suspended
          </h1>
          <p className="text-gray-700 mb-4">
            Your exam session has been suspended due to security violations.
          </p>
          <p className="text-sm text-gray-600">
            Please contact your instructor or system administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={securityStyles} className="min-h-screen bg-gray-50">
      {/* Security status bar */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <SecurityStatusIndicator securityState={securityHook.securityState} />
        </div>
      </div>

      {/* Main exam content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>

      {/* Violation warning modal */}
      <ViolationWarningModal
        violation={securityHook.securityState.lastViolation}
        warningCount={securityHook.securityState.warningCount}
        onAcknowledge={securityHook.acknowledgeWarning}
        isVisible={securityHook.showWarning}
      />
    </div>
  );
};

export default ExamSecurityWrapper;
```

### 5. **Usage Example - Exam Page**

```jsx
// pages/exam/[examId].js (Next.js example)
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import ExamSecurityWrapper from '../components/ExamSecurityWrapper';
import QuestionComponent from '../components/QuestionComponent';

const ExamPage = () => {
  const router = useRouter();
  const { examId } = router.query;
  const { user, token } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);

  if (!examId || !token) {
    return <div>Loading...</div>;
  }

  return (
    <ExamSecurityWrapper examId={examId} userToken={token}>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Secure Online Exam</h1>
          <p className="text-gray-600">
            This exam is monitored for security violations. Please follow all guidelines.
          </p>
        </div>

        <QuestionComponent
          questionNumber={currentQuestion + 1}
          onAnswerSelected={(answer) => {
            // Track answer timing here
            console.log('Answer selected:', answer);
          }}
        />

        <div className="flex justify-between">
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentQuestion(prev => prev + 1)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Next
          </button>
        </div>
      </div>
    </ExamSecurityWrapper>
  );
};

export default ExamPage;
```

## 🎯 Quick Implementation Checklist

1. **✅ Install dependencies:**
   ```bash
   npm install axios
   ```

2. **✅ Copy the hook:** `useCheatingDetection.js`

3. **✅ Create components:**
   - `SecurityStatusIndicator.jsx`
   - `ViolationWarningModal.jsx` 
   - `ExamSecurityWrapper.jsx`

4. **✅ Wrap your exam page:**
   ```jsx
   <ExamSecurityWrapper examId={examId} userToken={token}>
     {/* Your exam content */}
   </ExamSecurityWrapper>
   ```

5. **✅ Test the integration:**
   - Try switching tabs
   - Try right-clicking
   - Try copying/pasting
   - Check the security status indicator

**That's it! Your frontend is now integrated with the anti-abuse system. All violations will be tracked and reported to the backend in real-time.**
