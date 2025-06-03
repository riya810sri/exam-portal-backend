/**
 * Client-side cheating detection integration example
 * 
 * This file demonstrates how to integrate the cheating detection
 * functionality in a React/Next.js frontend application.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Custom hook for cheating detection during exams
 * @param {string} examId - The ID of the current exam
 * @param {string} token - The user's authentication token
 * @returns {Object} - Methods and state for cheating detection
 */
export function useCheatingDetection(examId, token) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const originalVisibilityState = useRef(document.visibilityState);
  const tabSwitchCount = useRef(0);
  const lastTabSwitchTime = useRef(null);
  const tabHiddenStartTime = useRef(null);
  
  // Configure axios client with authentication
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  /**
   * Report a cheating incident to the backend
   * @param {string} evidenceType - Type of cheating detected
   * @param {Object} details - Details about the incident
   * @returns {Promise} - API response promise
   */
  const reportCheatingIncident = async (evidenceType, details) => {
    try {
      const response = await apiClient.post(
        `/exam-attendance/${examId}/report-cheating`,
        {
          evidenceType,
          details,
          source: "CLIENT"
        }
      );
      
      console.log('Cheating incident reported:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to report cheating:', error);
      return null;
    }
  };
  
  /**
   * Handle tab visibility change events
   */
  const handleVisibilityChange = () => {
    if (!isMonitoring) return;
    
    const currentTime = new Date();
    
    // User has switched away from the exam tab
    if (document.visibilityState === 'hidden') {
      tabHiddenStartTime.current = currentTime;
      
      // Report the initial tab switch
      reportCheatingIncident('TAB_SWITCH', {
        action: 'tab_hidden',
        timestamp: currentTime.toISOString(),
        tabSwitchCount: ++tabSwitchCount.current
      });
    } 
    // User has returned to the exam tab
    else if (document.visibilityState === 'visible' && tabHiddenStartTime.current) {
      const hiddenDuration = currentTime - tabHiddenStartTime.current;
      lastTabSwitchTime.current = currentTime;
      
      // Report the tab return with duration information
      reportCheatingIncident('TAB_SWITCH', {
        action: 'tab_visible',
        timestamp: currentTime.toISOString(),
        hiddenDuration, // in milliseconds
        tabSwitchCount: tabSwitchCount.current
      });
    }
  };
  
  /**
   * Handle copy/paste prevention and detection
   * @param {Event} e - The browser event
   */
  const handleCopyPaste = (e) => {
    if (!isMonitoring) return;
    
    // Prevent the action
    e.preventDefault();
    
    // Report the incident
    reportCheatingIncident('COPY_PASTE', {
      action: e.type, // 'copy', 'paste', 'cut'
      timestamp: new Date().toISOString(),
      targetElement: e.target.tagName,
      selection: window.getSelection().toString().substring(0, 50) // First 50 chars of selection
    });
    
    // Show warning to user
    alert(`${e.type.charAt(0).toUpperCase() + e.type.slice(1)} action is not allowed during the exam.`);
  };
  
  /**
   * Handle keyboard shortcuts that might be used for cheating
   * @param {KeyboardEvent} e - The keyboard event
   */
  const handleKeyDown = (e) => {
    if (!isMonitoring) return;
    
    // Detect common shortcut combinations
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    
    if (modifier) {
      // Check for known shortcuts
      switch (e.key.toLowerCase()) {
        case 'c': // Copy
        case 'v': // Paste
        case 'x': // Cut
        case 'p': // Print
        case 'f': // Find
        case 's': // Save
          e.preventDefault();
          
          reportCheatingIncident('PROHIBITED_KEYS', {
            action: 'keyboard_shortcut',
            timestamp: new Date().toISOString(),
            key: e.key,
            modifier: isMac ? 'meta' : 'ctrl',
            targetElement: document.activeElement.tagName
          });
          
          alert(`The keyboard shortcut ${isMac ? '⌘' : 'Ctrl'}+${e.key.toUpperCase()} is not allowed during the exam.`);
          break;
        
        default:
          // Other shortcuts with modifier keys
          if (['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            reportCheatingIncident('PROHIBITED_KEYS', {
              action: 'function_key',
              timestamp: new Date().toISOString(),
              key: e.key
            });
          }
          break;
      }
    }
    
    // Detect Alt+Tab attempt (may not work in all browsers)
    if (e.altKey && e.key === 'Tab') {
      reportCheatingIncident('PROHIBITED_KEYS', {
        action: 'alt_tab',
        timestamp: new Date().toISOString()
      });
    }
  };
  
  /**
   * Start monitoring for cheating behaviors
   */
  const startMonitoring = () => {
    setIsMonitoring(true);
    tabSwitchCount.current = 0;
    originalVisibilityState.current = document.visibilityState;
    console.log('Cheating detection monitoring started');
  };
  
  /**
   * Stop monitoring for cheating behaviors
   */
  const stopMonitoring = () => {
    setIsMonitoring(false);
    console.log('Cheating detection monitoring stopped');
  };
  
  // Set up event listeners when monitoring is active
  useEffect(() => {
    if (isMonitoring) {
      // Tab switching detection
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Copy/paste prevention
      document.addEventListener('copy', handleCopyPaste);
      document.addEventListener('paste', handleCopyPaste);
      document.addEventListener('cut', handleCopyPaste);
      
      // Keyboard shortcut prevention
      document.addEventListener('keydown', handleKeyDown);
      
      // Detect full screen exit
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && isMonitoring) {
          reportCheatingIncident('OTHER', {
            action: 'fullscreen_exit',
            timestamp: new Date().toISOString()
          });
        }
      });
      
      return () => {
        // Clean up listeners when component unmounts or monitoring stops
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('copy', handleCopyPaste);
        document.removeEventListener('paste', handleCopyPaste);
        document.removeEventListener('cut', handleCopyPaste);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('fullscreenchange', () => {});
      };
    }
  }, [isMonitoring, examId]);
  
  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    reportCheatingIncident,
    tabSwitchCount: tabSwitchCount.current
  };
}

/**
 * React hook for keyboard and keybinding monitoring in exams
 * @param {Object} options - Configuration options
 * @param {string} options.examId - The ID of the current exam
 * @param {string} options.sessionToken - Authentication token
 * @param {Function} options.onWarning - Callback when a warning is received
 * @param {Function} options.onError - Callback when an error occurs
 * @returns {Object} Monitoring state and controls
 */
export const useExamMonitoring = ({ 
  examId, 
  sessionToken, 
  onWarning = () => {}, 
  onError = () => {} 
}) => {
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [socket, setSocket] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, connecting, active, error
  const [error, setError] = useState(null);

  // Start monitoring
  const startMonitoring = useCallback(async () => {
    if (status === 'connecting' || status === 'active') return;

    try {
      setStatus('connecting');
      setError(null);

      const response = await fetch(`/api/exam-attendance/${examId}/start-monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start monitoring');
      }

      const data = await response.json();
      
      if (data.success) {
        // Initialize socket connection
        const socketInstance = initializeSocketConnection(data.socket);
        setSocket(socketInstance);
        
        // Execute monitoring scripts
        if (data.scripts) {
          executeMonitoringScripts(data.scripts);
        }
        
        setMonitoringActive(true);
        setStatus('active');
      } else {
        throw new Error(data.message || 'Monitoring initialization failed');
      }
    } catch (error) {
      console.error('Error starting exam monitoring:', error);
      setError(error.message || 'Failed to start monitoring');
      setStatus('error');
      onError(error);
    }
  }, [examId, sessionToken, status, onError, initializeSocketConnection, executeMonitoringScripts]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setMonitoringActive(false);
    setStatus('idle');
    
    // Remove global socket reference
    if (window.socket) {
      window.socket = null;
    }
  }, [socket]);

  // Initialize socket connection
  const initializeSocketConnection = useCallback((socketConfig) => {
    if (!socketConfig || !socketConfig.port || !socketConfig.monit_id) {
      console.error('Invalid socket configuration');
      return null;
    }
    
    // Create socket connection
    const socketUrl = socketConfig.url || `http://localhost:${socketConfig.port}`;
    const socketInstance = io(socketUrl, {
      transports: socketConfig.protocols || ['websocket', 'polling'],
      query: {
        monit_id: socketConfig.monit_id,
        client_type: 'exam_client'
      }
    });
    
    // Store socket globally for the monitoring script to access
    window.socket = socketInstance;
    
    // Set up event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to monitoring server');
      
      // Send browser validation data
      socketInstance.emit('browser_validation', {
        userAgent: navigator.userAgent,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: Date.now()
      });
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Disconnected from monitoring server');
      setMonitoringActive(false);
      setStatus('idle');
    });
    
    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
      setError('Connection error: ' + (error.message || 'Unknown error'));
      onError(error);
    });
    
    // Handle security warnings
    socketInstance.on('security_warning', (warning) => {
      console.warn('Security warning received:', warning);
      
      // Add to warnings list
      const newWarning = {
        ...warning,
        id: Date.now(),
        received: new Date()
      };
      
      setWarnings(prev => [...prev, newWarning]);
      onWarning(newWarning);
    });
    
    // Start sending heartbeats
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('security_heartbeat', { timestamp: Date.now() });
      }
    }, 10000);
    
    // Clear interval when socket disconnects
    socketInstance.on('disconnect', () => {
      clearInterval(heartbeatInterval);
    });
    
    return socketInstance;
  }, [onWarning, onError]);

  // Execute keyboard monitoring script
  const executeMonitoringScript = useCallback((scriptCode) => {
    try {
      // Create a new script element
      const scriptElement = document.createElement('script');
      scriptElement.textContent = scriptCode;
      document.head.appendChild(scriptElement);
      
      console.log('Keyboard and keybinding monitoring initialized');
    } catch (error) {
      console.error('Failed to initialize keyboard monitoring:', error);
      setError('Script initialization failed: ' + (error.message || 'Unknown error'));
      onError(error);
    }
  }, [onError]);

  // Updated to handle both keyboard and mouse monitoring scripts
  const executeMonitoringScripts = useCallback((scripts) => {
    try {
      if (scripts.keyboardMonitoring) {
        const kbScript = document.createElement('script');
        kbScript.textContent = scripts.keyboardMonitoring;
        kbScript.id = 'keyboard-monitoring-script';
        document.head.appendChild(kbScript);
        console.log('Keyboard monitoring initialized');
      }
      
      if (scripts.mouseMonitoring) {
        const mouseScript = document.createElement('script');
        mouseScript.textContent = scripts.mouseMonitoring;
        mouseScript.id = 'mouse-monitoring-script';
        document.head.appendChild(mouseScript);
        console.log('Mouse monitoring initialized with 2-second interval');
      }
    } catch (error) {
      console.error('Failed to initialize monitoring scripts:', error);
      setError('Script initialization failed: ' + (error.message || 'Unknown error'));
      onError(error);
    }
  }, [onError]);

  // Clear warnings
  const clearWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  // Enable debug mode
  const enableDebugMode = useCallback(() => {
    window.KEYBOARD_MONITORING_DEBUG = true;
    console.log('Keyboard monitoring debug mode enabled');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    status,
    isActive: monitoringActive,
    warnings,
    error,
    start: startMonitoring,
    stop: stopMonitoring,
    clearWarnings,
    enableDebugMode
  };
};

/**
 * Example component showing integration of cheating detection
 */
export default function ExamPage({ examId, userToken }) {
  const {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    tabSwitchCount
  } = useCheatingDetection(examId, userToken);
  
  useEffect(() => {
    // Start monitoring when exam begins
    startMonitoring();
    
    // Stop monitoring when component unmounts (exam ends)
    return () => {
      stopMonitoring();
    };
  }, []);
  
  return (
    <div className="exam-container">
      <div className="exam-header">
        <h1>Exam in Progress</h1>
        {isMonitoring && (
          <div className="monitoring-indicator">
            <span className="monitoring-active">🔴 Proctoring Active</span>
            {tabSwitchCount > 0 && (
              <span className="warning">
                Warning: Tab switching detected ({tabSwitchCount} times)
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Exam content would go here */}
      
      <div className="exam-footer">
        <p className="warning-text">
          Warning: Leaving this page, copying content, or using keyboard shortcuts 
          may be flagged as cheating attempts.
        </p>
      </div>
    </div>
  );
}
