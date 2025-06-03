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
 * Analyzes keybinding patterns to detect potential cheating
 * @param {Array} keyboardData - Array of keyboard events
 * @returns {Object} Analysis of keybinding patterns and potential violations
 */
const analyzeKeybindings = (keyboardData) => {
  if (!keyboardData || !Array.isArray(keyboardData) || keyboardData.length === 0) {
    return {
      keybindingRiskScore: 0,
      detectedBindings: [],
      keybindingViolations: []
    };
  }

  // Define prohibited keybindings (shortcuts that could be used for cheating)
  const prohibitedKeybindings = [
    // Browser navigation/interaction
    { keys: ['F5'], description: 'Page refresh' },
    { keys: ['Escape'], description: 'Cancel dialog' },
    { keys: ['Alt', 'Tab'], description: 'Switch application' },
    { keys: ['Alt', 'F4'], description: 'Close window' },
    
    // Browser dev tools
    { keys: ['F12'], description: 'Developer tools' },
    { keys: ['Ctrl', 'Shift', 'I'], description: 'Developer tools' },
    { keys: ['Ctrl', 'Shift', 'J'], description: 'Developer console' },
    { keys: ['Ctrl', 'Shift', 'C'], description: 'Element inspector' },
    
    // Content manipulation
    { keys: ['Ctrl', 'C'], description: 'Copy content' },
    { keys: ['Ctrl', 'V'], description: 'Paste content' },
    { keys: ['Ctrl', 'X'], description: 'Cut content' },
    { keys: ['Ctrl', 'F'], description: 'Find in page' },
    { keys: ['Ctrl', 'P'], description: 'Print page' },
    { keys: ['Ctrl', 'S'], description: 'Save page' },
    { keys: ['Ctrl', 'O'], description: 'Open file' },
    
    // Browser tab management
    { keys: ['Ctrl', 'T'], description: 'New tab' },
    { keys: ['Ctrl', 'W'], description: 'Close tab' },
    { keys: ['Ctrl', 'Shift', 'T'], description: 'Reopen closed tab' },
    { keys: ['Ctrl', 'Tab'], description: 'Switch tab' },
    
    // Browser window management
    { keys: ['Ctrl', 'N'], description: 'New window' },
    { keys: ['Alt', 'Space'], description: 'Window menu' },
    
    // Screenshot
    { keys: ['PrtScn'], description: 'Screenshot' },
    { keys: ['Win', 'Shift', 'S'], description: 'Screenshot tool' },
    
    // Operating system
    { keys: ['Win'], description: 'Open start menu' },
    { keys: ['Win', 'E'], description: 'Open file explorer' },
    { keys: ['Win', 'R'], description: 'Run dialog' },
    { keys: ['Win', 'D'], description: 'Show desktop' },
    
    // Mac specific
    { keys: ['Cmd', 'C'], description: 'Copy content (Mac)' },
    { keys: ['Cmd', 'V'], description: 'Paste content (Mac)' },
    { keys: ['Cmd', 'X'], description: 'Cut content (Mac)' },
    { keys: ['Cmd', 'Option', 'I'], description: 'Developer tools (Mac)' },
    { keys: ['Cmd', 'Option', 'J'], description: 'Developer console (Mac)' },
    { keys: ['Cmd', 'Shift', 'C'], description: 'Element inspector (Mac)' }
  ];

  // Detect active keybindings from the keyboard data
  const activeBindings = new Map();
  const detectedBindings = [];
  const keybindingViolations = [];
  
  // Track currently pressed keys
  const pressedKeys = new Set();

  // Process keyboard events in sequence
  keyboardData.forEach(event => {
    // Check if it's a keydown or keyup event
    const isKeyDown = event.type === 'keydown' || event.type === undefined; // Default to keydown if type not specified
    const key = event.key;
    
    if (isKeyDown) {
      // For keydown events, add the key to pressedKeys
      pressedKeys.add(key);
      
      // Add modifier key states
      if (event.ctrlKey && !pressedKeys.has('Ctrl')) pressedKeys.add('Ctrl');
      if (event.altKey && !pressedKeys.has('Alt')) pressedKeys.add('Alt');
      if (event.shiftKey && !pressedKeys.has('Shift')) pressedKeys.add('Shift');
      if (event.metaKey && !pressedKeys.has('Cmd')) pressedKeys.add('Cmd');
      if (event.metaKey && !pressedKeys.has('Win')) pressedKeys.add('Win');
      
      // Convert pressedKeys to sorted array for consistent matching
      const currentBinding = Array.from(pressedKeys).sort();
      const bindingKey = currentBinding.join('+');
      
      // If we have at least 2 keys pressed or certain specific keys, record the binding
      if (currentBinding.length >= 2 || 
          ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 
           'PrtScn', 'Escape'].includes(key)) {
        
        if (!activeBindings.has(bindingKey)) {
          activeBindings.set(bindingKey, {
            keys: currentBinding,
            count: 1,
            timestamps: [event.timestamp],
            isProhibited: false,
            description: ''
          });
        } else {
          const binding = activeBindings.get(bindingKey);
          binding.count++;
          binding.timestamps.push(event.timestamp);
        }
        
        // Check if this is a prohibited keybinding
        for (const prohibited of prohibitedKeybindings) {
          // Check if all prohibited keys are in the current binding
          const isMatch = prohibited.keys.every(k => currentBinding.includes(k));
          
          if (isMatch) {
            // Mark the binding as prohibited
            const binding = activeBindings.get(bindingKey);
            binding.isProhibited = true;
            binding.description = prohibited.description;
            
            // Add to violations if not already there
            const existingViolation = keybindingViolations.find(v => 
              v.keys.every(k => binding.keys.includes(k)) && 
              binding.keys.every(k => v.keys.includes(k))
            );
            
            if (!existingViolation) {
              keybindingViolations.push({
                keys: binding.keys,
                description: prohibited.description,
                timestamp: event.timestamp,
                riskLevel: 'HIGH'
              });
            }
            
            break;
          }
        }
      }
    } else {
      // For keyup events, remove the key from pressedKeys
      pressedKeys.delete(key);
      
      // Remove modifier key states if they're not active
      if (!event.ctrlKey) pressedKeys.delete('Ctrl');
      if (!event.altKey) pressedKeys.delete('Alt');
      if (!event.shiftKey) pressedKeys.delete('Shift');
      if (!event.metaKey) {
        pressedKeys.delete('Cmd');
        pressedKeys.delete('Win');
      }
    }
  });
  
  // Convert activeBindings Map to array and sort by frequency
  activeBindings.forEach(binding => {
    detectedBindings.push({
      keys: binding.keys,
      count: binding.count,
      isProhibited: binding.isProhibited,
      description: binding.description
    });
  });
  
  // Sort by count (most frequent first)
  detectedBindings.sort((a, b) => b.count - a.count);
  
  // Calculate risk score based on prohibited keybindings
  const prohibitedBindingCount = detectedBindings.filter(b => b.isProhibited).length;
  const prohibitedBindingUsageCount = detectedBindings
    .filter(b => b.isProhibited)
    .reduce((sum, b) => sum + b.count, 0);
  
  // Risk score calculation:
  // - Base score from count of different prohibited bindings
  // - Additional score from frequency of usage
  const baseScore = Math.min(75, prohibitedBindingCount * 25);
  const usageScore = Math.min(25, prohibitedBindingUsageCount * 5);
  const keybindingRiskScore = baseScore + usageScore;
  
  return {
    keybindingRiskScore,
    detectedBindings,
    keybindingViolations,
    prohibitedBindingCount,
    prohibitedBindingUsageCount
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
      },
      keybindingAnalysis: {
        keybindingRiskScore: 0,
        detectedBindings: [],
        keybindingViolations: []
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
    metaKey: !!event.metaKey,
    type: event.type || 'keydown'
  }));

  // Analyze the processed data
  const analysis = analyzeKeyboardData(processed);
  
  // Analyze keybindings
  const keybindingAnalysis = analyzeKeybindings(processed);
  
  // Combine the risk scores, giving more weight to keybinding violations
  const combinedRiskScore = Math.min(100, analysis.riskScore * 0.4 + keybindingAnalysis.keybindingRiskScore * 0.6);

  return {
    processed,
    analysis,
    keybindingAnalysis,
    combinedRiskScore
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
      const activeKeys = new Set();
      
      // Helper to track key state
      const updateKeyState = (e, isDown) => {
        const keyInfo = {
          key: e.key,
          keyCode: e.keyCode,
          timestamp: Date.now(),
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          type: isDown ? 'keydown' : 'keyup'
        };
        
        keyboardEvents.push(keyInfo);
        
        // Keep only the last 100 events to limit memory usage
        if (keyboardEvents.length > 100) {
          keyboardEvents.shift();
        }
        
        // Track key state for better keybinding detection
        if (isDown) {
          activeKeys.add(e.key);
        } else {
          activeKeys.delete(e.key);
        }
      };
      
      // Track keyboard activity
      document.addEventListener('keydown', function(e) {
        updateKeyState(e, true);
      });
      
      document.addEventListener('keyup', function(e) {
        updateKeyState(e, false);
      });
      
      // Function to get current keyboard data
      window.getKeyboardMonitoringData = function() {
        return keyboardEvents;
      };
      
      // Function to get currently active keys
      window.getActiveKeys = function() {
        return Array.from(activeKeys);
      };
      
      // Report keyboard data periodically
      setInterval(function() {
        if (window.socket && window.socket.connected) {
          window.socket.emit('keyboard_data', {
            events: keyboardEvents,
            activeKeys: Array.from(activeKeys),
            timestamp: Date.now()
          });
        }
      }, 5000); // Report every 5 seconds
      
      // Enable debug logging if debug mode is on
      if (window.KEYBOARD_MONITORING_DEBUG) {
        console.log('Keyboard monitoring initialized with keybinding detection');
        document.addEventListener('keydown', function(e) {
          if (e.ctrlKey || e.altKey || e.metaKey || 
              e.key.startsWith('F') || activeKeys.size > 1) {
            console.log('Keybinding detected:', 
              (e.ctrlKey ? 'Ctrl+' : '') + 
              (e.altKey ? 'Alt+' : '') + 
              (e.shiftKey ? 'Shift+' : '') + 
              (e.metaKey ? 'Meta+' : '') + 
              e.key);
          }
        });
      } else {
        console.log('Keyboard monitoring initialized');
      }
    })();
  `;
};

module.exports = {
  analyzeKeyboardData,
  analyzeKeybindings,
  processKeyboardData,
  generateKeyboardMonitoringScript
}; 