/**
 * Mouse Monitoring Utility
 * 
 * This module provides functionality to track and analyze mouse activity
 * during exams for security and anti-cheating purposes.
 */

/**
 * Analyzes mouse data to detect patterns that might indicate cheating
 * @param {Array} mouseData - Array of mouse events
 * @returns {Object} Analysis results including risk assessment
 */
const analyzeMouseData = (mouseData) => {
  if (!mouseData || !Array.isArray(mouseData) || mouseData.length === 0) {
    return {
      riskScore: 0,
      patterns: [],
      anomalies: [],
      movementScore: 0
    };
  }

  const patterns = [];
  const anomalies = [];
  let riskScore = 0;

  // Calculate movement consistency (potentially automated input)
  const movements = [];
  for (let i = 1; i < mouseData.length; i++) {
    const dx = mouseData[i].x - mouseData[i-1].x;
    const dy = mouseData[i].y - mouseData[i-1].y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    const timeInterval = mouseData[i].timestamp - mouseData[i-1].timestamp;
    const speed = timeInterval > 0 ? distance / timeInterval : 0;
    
    movements.push({
      distance,
      timeInterval,
      speed,
      angle: Math.atan2(dy, dx)
    });
  }

  // Calculate mean and standard deviation of movements
  const speeds = movements.map(m => m.speed);
  const meanSpeed = speeds.reduce((sum, val) => sum + val, 0) / speeds.length || 0;
  const variance = speeds.reduce((sum, val) => sum + Math.pow(val - meanSpeed, 2), 0) / speeds.length || 0;
  const stdDev = Math.sqrt(variance);

  // Consistency score (lower stdDev means more consistent timing, which could be suspicious)
  const movementConsistency = stdDev > 0 ? Math.min(100, 100 * (20 / stdDev)) : 100;

  // Check for suspicious patterns
  if (movementConsistency > 85) {
    patterns.push({
      type: 'CONSISTENT_MOVEMENT',
      description: 'Unusually consistent mouse movement detected',
      score: movementConsistency
    });
    riskScore += movementConsistency * 0.3; // Weight: 30%
  }

  // Check for straight line movements (automated input)
  const angles = movements.map(m => m.angle);
  const angleDiffs = [];
  for (let i = 1; i < angles.length; i++) {
    const diff = Math.abs(angles[i] - angles[i-1]);
    angleDiffs.push(diff);
  }
  
  const straightLineMovements = angleDiffs.filter(diff => diff < 0.1).length;
  const straightLineRatio = angleDiffs.length > 0 ? straightLineMovements / angleDiffs.length : 0;
  
  if (straightLineRatio > 0.7) {
    anomalies.push({
      type: 'STRAIGHT_LINE_MOVEMENT',
      description: 'Unusually straight mouse movement detected',
      score: straightLineRatio * 100
    });
    riskScore += straightLineRatio * 100 * 0.4; // Weight: 40%
  }

  // Check for no movement periods
  const noMovementPeriods = movements.filter(m => m.distance < 1).length;
  const noMovementRatio = movements.length > 0 ? noMovementPeriods / movements.length : 0;
  
  if (noMovementRatio > 0.5) {
    anomalies.push({
      type: 'NO_MOVEMENT',
      description: 'Extended periods with no mouse movement',
      score: noMovementRatio * 100
    });
    riskScore += noMovementRatio * 100 * 0.2; // Weight: 20%
  }

  return {
    riskScore: Math.min(100, riskScore),
    patterns,
    anomalies,
    movementConsistency,
    mouseCount: mouseData.length,
    meanSpeed,
    stdDevSpeed: stdDev,
    straightLineRatio
  };
};

/**
 * Process mouse data from client for storage and analysis
 * @param {Array} rawMouseData - Raw mouse data from client
 * @returns {Object} Processed data and analysis results
 */
const processMouseData = (rawMouseData) => {
  if (!rawMouseData || !Array.isArray(rawMouseData)) {
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
  const processed = rawMouseData.map(event => ({
    x: event.x,
    y: event.y,
    timestamp: event.timestamp,
    type: event.type || 'mousemove',
    button: event.button || null
  }));

  // Analyze the processed data
  const analysis = analyzeMouseData(processed);

  return {
    processed,
    analysis
  };
};

/**
 * Generate a client-side mouse monitoring script
 * @returns {String} JavaScript code to be executed on client
 */
const generateMouseMonitoringScript = () => {
  return `
    (function() {
      // Store mouse events
      const mouseEvents = [];
      let lastPosition = { x: 0, y: 0 };
      let collectInterval = null;
      
      // Track mouse movement
      document.addEventListener('mousemove', function(e) {
        lastPosition = {
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now(),
          type: 'mousemove'
        };
      });
      
      // Track mouse clicks
      document.addEventListener('mousedown', function(e) {
        mouseEvents.push({
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now(),
          type: 'mousedown',
          button: e.button
        });
        
        // Keep only the last 100 events to limit memory usage
        if (mouseEvents.length > 100) {
          mouseEvents.shift();
        }
      });
      
      // Collect mouse position data every 2 seconds
      collectInterval = setInterval(function() {
        if (lastPosition.timestamp) {
          mouseEvents.push({...lastPosition});
          
          // Keep only the last 100 events to limit memory usage
          if (mouseEvents.length > 100) {
            mouseEvents.shift();
          }
        }
      }, 2000); // Collect every 2 seconds
      
      // Function to get current mouse data
      window.getMouseMonitoringData = function() {
        return mouseEvents;
      };
      
      // Report mouse data periodically
      setInterval(function() {
        if (window.socket && window.socket.connected) {
          window.socket.emit('mouse_data', {
            events: mouseEvents,
            timestamp: Date.now()
          });
        }
      }, 10000); // Report every 10 seconds
      
      // Clean up on page unload
      window.addEventListener('beforeunload', function() {
        if (collectInterval) {
          clearInterval(collectInterval);
        }
      });
      
      console.log('Mouse monitoring initialized with 2-second collection interval');
    })();
  `;
};

module.exports = {
  analyzeMouseData,
  processMouseData,
  generateMouseMonitoringScript
}; 