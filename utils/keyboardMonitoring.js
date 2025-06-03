/**
 * Keyboard Monitoring Utility
 * 
 * This module provides functionality to track and analyze keyboard activity
 * during exams for security and anti-cheating purposes.
 */

/**
 * Analyzes keyboard data to detect patterns that might indicate cheating
 * @param {Array} keyboardData - Array of keyboard events
 * @returns {Object} Analysis results including risk assessment
 */
const analyzeKeyboardData = (keyboardData) => {
  if (!keyboardData || !Array.isArray(keyboardData) || keyboardData.length === 0) {
    return {
      riskScore: 0,
      patterns: [],
      anomalies: [],
      consistencyScore: 0
    };
  }

  const patterns = [];
  const anomalies = [];
  let riskScore = 0;

  // Calculate timing consistency (potentially automated input)
  const keyIntervals = [];
  for (let i = 1; i < keyboardData.length; i++) {
    const interval = keyboardData[i].timestamp - keyboardData[i-1].timestamp;
    keyIntervals.push(interval);
  }

  // Calculate mean and standard deviation of intervals
  const mean = keyIntervals.reduce((sum, val) => sum + val, 0) / keyIntervals.length;
  const variance = keyIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / keyIntervals.length;
  const stdDev = Math.sqrt(variance);

  // Consistency score (lower stdDev means more consistent timing, which could be suspicious)
  const consistencyScore = stdDev > 0 ? Math.min(100, 100 * (50 / stdDev)) : 100;

  // Check for suspicious patterns
  if (consistencyScore > 80) {
    patterns.push({
      type: 'CONSISTENT_TIMING',
      description: 'Unusually consistent keystroke timing detected',
      score: consistencyScore
    });
    riskScore += consistencyScore * 0.3; // Weight: 30%
  }

  // Check for rapid key sequences (automated input)
  const rapidSequences = keyIntervals.filter(interval => interval < 20).length;
  const rapidRatio = rapidSequences / keyIntervals.length;
  
  if (rapidRatio > 0.5) {
    anomalies.push({
      type: 'RAPID_KEYSTROKES',
      description: 'Unusually rapid keystroke sequences detected',
      score: rapidRatio * 100
    });
    riskScore += rapidRatio * 100 * 0.2; // Weight: 20%
  }

  // Check for suspicious key combinations
  const suspiciousKeyCombos = keyboardData.filter(event => 
    (event.ctrlKey && ['c', 'v', 'x', 'p', 'f', 's'].includes(event.key)) ||
    (event.ctrlKey && event.shiftKey && ['i', 'j'].includes(event.key)) ||
    (event.altKey && event.key === 'Tab')
  ).length;

  if (suspiciousKeyCombos > 0) {
    anomalies.push({
      type: 'SUSPICIOUS_KEY_COMBOS',
      description: 'Potentially prohibited key combinations detected',
      count: suspiciousKeyCombos,
      score: Math.min(100, suspiciousKeyCombos * 25)
    });
    riskScore += Math.min(100, suspiciousKeyCombos * 25) * 0.5; // Weight: 50%
  }

  return {
    riskScore: Math.min(100, riskScore),
    patterns,
    anomalies,
    consistencyScore,
    keyCount: keyboardData.length,
    meanInterval: mean,
    stdDevInterval: stdDev
  };
};

/**
 * Process keyboard data from client for storage and analysis
 * @param {Array} rawKeyboardData - Raw keyboard data from client
 * @returns {Object} Processed data and analysis results
 */
const processKeyboardData = (rawKeyboardData) => {
  if (!rawKeyboardData || !Array.isArray(rawKeyboardData)) {
    return {
      processed: [],
      analysis: {
        riskScore: 0,
        patterns: [],
        anomalies: []
      }
    };
  }

  // Clean and normalize the data
  const processed = rawKeyboardData.map(event => ({
    key: event.key,
    keyCode: event.keyCode || null,
    timestamp: event.timestamp,
    ctrlKey: !!event.ctrlKey,
    altKey: !!event.altKey,
    shiftKey: !!event.shiftKey,
    metaKey: !!event.metaKey
  }));

  // Analyze the processed data
  const analysis = analyzeKeyboardData(processed);

  return {
    processed,
    analysis
  };
};

/**
 * Generate a client-side keyboard monitoring script
 * @returns {String} JavaScript code to be executed on client
 */
const generateKeyboardMonitoringScript = () => {
  return `
    (function() {
      // Store keyboard events
      const keyboardEvents = [];
      
      // Track keyboard activity
      document.addEventListener('keydown', function(e) {
        const now = Date.now();
        
        // Store basic info about the key event
        keyboardEvents.push({
          key: e.key,
          keyCode: e.keyCode,
          timestamp: now,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey
        });
        
        // Keep only the last 100 events to limit memory usage
        if (keyboardEvents.length > 100) {
          keyboardEvents.shift();
        }
      });
      
      // Function to get current keyboard data
      window.getKeyboardMonitoringData = function() {
        return keyboardEvents;
      };
      
      // Report keyboard data periodically
      setInterval(function() {
        if (window.socket && window.socket.connected) {
          window.socket.emit('keyboard_data', {
            events: keyboardEvents,
            timestamp: Date.now()
          });
        }
      }, 5000); // Report every 5 seconds
      
      console.log('Keyboard monitoring initialized');
    })();
  `;
};

module.exports = {
  analyzeKeyboardData,
  processKeyboardData,
  generateKeyboardMonitoringScript
}; 