/**
 * Client-side cheating detection integration example
 * 
 * This file demonstrates how to integrate the cheating detection
 * functionality in a React/Next.js frontend application.
 */

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

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
