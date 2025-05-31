/**
 * Advanced Anti-Abuse Detection System
 * 
 * This module provides sophisticated detection mechanisms for identifying
 * proxy tools, automated scripts, and other cheating attempts during exams.
 * Uses multiple detection vectors to avoid reliance on user-agent strings.
 */

const crypto = require('crypto');

class AntiAbuseDetector {
  constructor() {
    // Thresholds for different detection mechanisms
    this.thresholds = {
      REQUEST_TIMING: {
        TOO_FAST: 50,        // requests faster than 50ms are suspicious
        TOO_CONSISTENT: 10,   // timing variance less than 10ms is suspicious
        HUMAN_MIN: 200,      // humans rarely respond faster than 200ms
        HUMAN_MAX: 30000     // humans rarely take longer than 30s
      },
      HEADER_ANALYSIS: {
        MISSING_COMMON: 3,   // missing more than 3 common headers is suspicious
        UNUSUAL_ORDER: 5,    // unusual header order score
        PROXY_INDICATORS: 2  // presence of proxy-related headers
      },
      BEHAVIOR: {
        MOUSE_SPEED_MAX: 5000,    // pixels per second
        MOUSE_SPEED_MIN: 10,      // pixels per second
        KEYSTROKE_VARIANCE: 50,   // milliseconds
        AUTOMATION_THRESHOLD: 80  // automation risk score
      },
      JS_EXECUTION: {
        TIMEOUT: 5000,       // JS challenges should complete within 5s
        MIN_EXECUTION: 10,   // minimum execution time for complex challenges
        COMPLEXITY_FACTOR: 100 // factor for challenge complexity
      }
    };
    
    // Common headers that legitimate browsers typically send
    this.expectedHeaders = [
      'accept', 'accept-encoding', 'accept-language', 'cache-control',
      'connection', 'host', 'user-agent', 'referer', 'origin'
    ];
    
    // Headers that indicate proxy/automation tools
    this.suspiciousHeaders = [
      'x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-cluster-client-ip',
      'proxy-connection', 'x-proxy-id', 'via', 'forwarded',
      'postman-token', 'insomnia', 'httpie', 'curl', 'wget'
    ];
  }

  /**
   * Analyze request headers for proxy tool indicators
   * @param {Object} headers - Express request headers
   * @returns {Object} Analysis result with risk score and details
   */
  analyzeHeaders(headers) {
    const analysis = {
      riskScore: 0,
      indicators: [],
      suspiciousHeaders: [],
      missingHeaders: [],
      headerOrder: []
    };

    // Check for suspicious headers
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      
      if (this.suspiciousHeaders.some(suspicious => lowerKey.includes(suspicious))) {
        analysis.suspiciousHeaders.push(key);
        analysis.riskScore += 25;
        analysis.indicators.push(`Suspicious header detected: ${key}`);
      }
      
      analysis.headerOrder.push(lowerKey);
    }

    // Check for missing common headers
    for (const expectedHeader of this.expectedHeaders) {
      if (!headers[expectedHeader] && !headers[expectedHeader.toLowerCase()]) {
        analysis.missingHeaders.push(expectedHeader);
        analysis.riskScore += 5;
      }
    }

    // Analyze header order (automation tools often have different order)
    const orderScore = this.analyzeHeaderOrder(analysis.headerOrder);
    analysis.riskScore += orderScore;

    // Check accept header patterns
    const acceptHeader = headers.accept || headers.Accept || '';
    if (acceptHeader === '*/*' || acceptHeader === '') {
      analysis.riskScore += 15;
      analysis.indicators.push('Generic or missing Accept header');
    }

    // Check for automation tool signatures in header values
    const userAgent = headers['user-agent'] || '';
    if (this.detectAutomationInHeaders(headers)) {
      analysis.riskScore += 30;
      analysis.indicators.push('Automation tool signature detected');
    }

    return analysis;
  }

  /**
   * Analyze request timing patterns
   * @param {Array} requestMetrics - Array of request timing data
   * @returns {Object} Timing analysis result
   */
  analyzeRequestTiming(requestMetrics) {
    if (requestMetrics.length < 3) {
      return { riskScore: 0, patterns: [], confidence: 0 };
    }

    const analysis = {
      riskScore: 0,
      patterns: [],
      confidence: 0,
      statistics: {}
    };

    // Calculate timing gaps between requests
    const timingGaps = [];
    for (let i = 1; i < requestMetrics.length; i++) {
      const gap = new Date(requestMetrics[i].timestamp) - new Date(requestMetrics[i-1].timestamp);
      timingGaps.push(gap);
    }

    // Statistical analysis of timing patterns
    const avgGap = timingGaps.reduce((a, b) => a + b, 0) / timingGaps.length;
    const variance = timingGaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / timingGaps.length;
    const stdDev = Math.sqrt(variance);

    analysis.statistics = { avgGap, variance, stdDev };

    // Check for suspiciously consistent timing (automation)
    if (stdDev < this.thresholds.REQUEST_TIMING.TOO_CONSISTENT) {
      analysis.riskScore += 40;
      analysis.patterns.push('Extremely consistent timing patterns detected');
    }

    // Check for impossibly fast requests
    const fastRequests = timingGaps.filter(gap => gap < this.thresholds.REQUEST_TIMING.TOO_FAST);
    if (fastRequests.length > timingGaps.length * 0.3) {
      analysis.riskScore += 35;
      analysis.patterns.push('Multiple impossibly fast requests detected');
    }

    // Check for rhythmic patterns (automation often has regular intervals)
    const rhythmScore = this.detectRhythmicPatterns(timingGaps);
    analysis.riskScore += rhythmScore;

    // Response time analysis
    const responseTimes = requestMetrics.map(m => m.responseTime).filter(t => t);
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      
      // Suspiciously fast or slow response processing
      if (avgResponseTime < 10) {
        analysis.riskScore += 20;
        analysis.patterns.push('Unusually fast response processing');
      }
    }

    analysis.confidence = Math.min(requestMetrics.length * 10, 100);
    return analysis;
  }

  /**
   * Generate JavaScript challenges for client-side execution
   * These challenges help verify that JavaScript is actually running in a browser
   * @returns {Object} Challenge data and expected results
   */
  generateJSChallenge() {
    const challenges = [
      {
        type: 'canvas_fingerprint',
        code: `
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('Security check ${Date.now()}', 2, 2);
          return canvas.toDataURL();
        `,
        timeout: 1000
      },
      {
        type: 'dom_interaction',
        code: `
          const div = document.createElement('div');
          div.innerHTML = 'test';
          document.body.appendChild(div);
          const rect = div.getBoundingClientRect();
          document.body.removeChild(div);
          return { width: rect.width, height: rect.height };
        `,
        timeout: 500
      },
      {
        type: 'timing_challenge',
        code: `
          const start = performance.now();
          let sum = 0;
          for(let i = 0; i < 10000; i++) { sum += Math.random(); }
          return { duration: performance.now() - start, result: sum };
        `,
        timeout: 2000
      },
      {
        type: 'browser_api',
        code: `
          return {
            screen: { width: screen.width, height: screen.height },
            navigator: {
              hardwareConcurrency: navigator.hardwareConcurrency,
              deviceMemory: navigator.deviceMemory,
              cookieEnabled: navigator.cookieEnabled
            },
            webgl: (() => {
              const gl = document.createElement('canvas').getContext('webgl');
              return gl ? {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER)
              } : null;
            })()
          };
        `,
        timeout: 1000
      }
    ];

    // Select random challenge
    const challenge = challenges[Math.floor(Math.random() * challenges.length)];
    
    return {
      id: crypto.randomBytes(16).toString('hex'),
      challenge: challenge,
      expectedComplexity: this.calculateChallengeComplexity(challenge.type),
      timestamp: new Date()
    };
  }

  /**
   * Validate JavaScript challenge response
   * @param {Object} challengeData - Original challenge data
   * @param {Object} response - Client response
   * @param {Number} executionTime - Time taken to execute
   * @returns {Object} Validation result
   */
  validateJSChallenge(challengeData, response, executionTime) {
    const validation = {
      valid: false,
      riskScore: 0,
      indicators: [],
      confidence: 0
    };

    // Check if response was received
    if (!response || typeof response !== 'object') {
      validation.riskScore = 100;
      validation.indicators.push('No valid JavaScript response received');
      return validation;
    }

    // Check execution time
    const expectedMin = challengeData.expectedComplexity * this.thresholds.JS_EXECUTION.MIN_EXECUTION;
    const expectedMax = challengeData.challenge.timeout;

    if (executionTime < expectedMin) {
      validation.riskScore += 40;
      validation.indicators.push('JavaScript execution too fast');
    } else if (executionTime > expectedMax) {
      validation.riskScore += 20;
      validation.indicators.push('JavaScript execution timeout');
    }

    // Validate response content based on challenge type
    switch (challengeData.challenge.type) {
      case 'canvas_fingerprint':
        if (!response.startsWith || !response.startsWith('data:image/png')) {
          validation.riskScore += 50;
          validation.indicators.push('Invalid canvas fingerprint format');
        }
        break;
        
      case 'dom_interaction':
        if (!response.width || !response.height || typeof response.width !== 'number') {
          validation.riskScore += 50;
          validation.indicators.push('Invalid DOM interaction response');
        }
        break;
        
      case 'timing_challenge':
        if (!response.duration || !response.result || response.duration <= 0) {
          validation.riskScore += 50;
          validation.indicators.push('Invalid timing challenge response');
        }
        break;
        
      case 'browser_api':
        if (!response.screen || !response.navigator) {
          validation.riskScore += 50;
          validation.indicators.push('Invalid browser API response');
        }
        break;
    }

    validation.valid = validation.riskScore < 30;
    validation.confidence = Math.max(0, 100 - validation.riskScore);
    
    return validation;
  }

  /**
   * Analyze behavioral patterns for automation detection
   * @param {Object} behaviorData - Collected behavior data
   * @returns {Object} Behavior analysis result
   */
  analyzeBehavior(behaviorData) {
    const analysis = {
      riskScore: 0,
      patterns: [],
      humanLikeScore: 50,
      automationIndicators: []
    };

    // Mouse movement analysis
    if (behaviorData.avgMouseSpeed) {
      if (behaviorData.avgMouseSpeed > this.thresholds.BEHAVIOR.MOUSE_SPEED_MAX ||
          behaviorData.avgMouseSpeed < this.thresholds.BEHAVIOR.MOUSE_SPEED_MIN) {
        analysis.riskScore += 25;
        analysis.automationIndicators.push('Unnatural mouse speed');
      }
    }

    // Keystroke pattern analysis
    if (behaviorData.keystrokePattern && behaviorData.keystrokePattern.length > 5) {
      const variance = this.calculateVariance(behaviorData.keystrokePattern);
      if (variance < this.thresholds.BEHAVIOR.KEYSTROKE_VARIANCE) {
        analysis.riskScore += 30;
        analysis.automationIndicators.push('Robotic keystroke timing');
      }
    }

    // Click pattern analysis
    if (behaviorData.clickPatterns && behaviorData.clickPatterns.length > 3) {
      const clickAnalysis = this.analyzeClickPatterns(behaviorData.clickPatterns);
      analysis.riskScore += clickAnalysis.suspicionScore;
      analysis.patterns.push(...clickAnalysis.patterns);
    }

    // Calculate human-like score
    analysis.humanLikeScore = Math.max(0, 100 - analysis.riskScore);
    
    return analysis;
  }

  /**
   * Calculate overall risk assessment
   * @param {Object} allAnalyses - Combined analysis results
   * @returns {Object} Risk assessment
   */
  calculateOverallRisk(allAnalyses) {
    const riskFactors = [];
    let totalRisk = 0;
    let confidenceSum = 0;
    let factorCount = 0;

    // Weight different analysis types
    const weights = {
      headers: 0.25,
      timing: 0.30,
      javascript: 0.25,
      behavior: 0.20
    };

    for (const [type, analysis] of Object.entries(allAnalyses)) {
      if (analysis && typeof analysis.riskScore === 'number') {
        const weight = weights[type] || 0.25;
        const weightedRisk = analysis.riskScore * weight;
        totalRisk += weightedRisk;
        confidenceSum += (analysis.confidence || 50) * weight;
        factorCount++;

        if (analysis.riskScore > 20) {
          riskFactors.push({
            factor: type,
            score: analysis.riskScore,
            description: this.getRiskDescription(type, analysis),
            weight: weight
          });
        }
      }
    }

    const overallRisk = Math.min(100, totalRisk);
    const confidence = factorCount > 0 ? confidenceSum / factorCount : 0;

    return {
      overallRiskScore: Math.round(overallRisk),
      confidence: Math.round(confidence),
      riskFactors: riskFactors,
      recommendation: this.getRiskRecommendation(overallRisk),
      autoFlag: overallRisk > 70 && confidence > 60
    };
  }

  // Helper methods
  analyzeHeaderOrder(headerOrder) {
    // Common browser header orders (simplified)
    const commonOrders = [
      ['host', 'connection', 'accept', 'user-agent', 'accept-encoding', 'accept-language'],
      ['accept', 'accept-encoding', 'accept-language', 'connection', 'host', 'user-agent']
    ];
    
    let bestMatch = 0;
    for (const order of commonOrders) {
      const match = this.calculateOrderSimilarity(headerOrder, order);
      bestMatch = Math.max(bestMatch, match);
    }
    
    return Math.max(0, (100 - bestMatch) / 5); // Convert to risk score
  }

  calculateOrderSimilarity(actual, expected) {
    let matches = 0;
    for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
      if (actual[i] === expected[i]) matches++;
    }
    return (matches / Math.max(actual.length, expected.length)) * 100;
  }

  detectAutomationInHeaders(headers) {
    const automationSignatures = [
      /postman/i, /insomnia/i, /curl/i, /wget/i, /python/i, /bot/i,
      /automation/i, /headless/i, /phantom/i, /selenium/i
    ];
    
    for (const [key, value] of Object.entries(headers)) {
      const combined = `${key}:${value}`.toLowerCase();
      if (automationSignatures.some(sig => sig.test(combined))) {
        return true;
      }
    }
    return false;
  }

  detectRhythmicPatterns(timingGaps) {
    if (timingGaps.length < 5) return 0;
    
    // Check for regular intervals
    const intervals = new Set();
    for (let i = 0; i < timingGaps.length - 1; i++) {
      const interval = Math.round(timingGaps[i] / 100) * 100; // Round to nearest 100ms
      intervals.add(interval);
    }
    
    // If most requests have similar intervals, it's suspicious
    return intervals.size < timingGaps.length * 0.3 ? 25 : 0;
  }

  calculateChallengeComplexity(type) {
    const complexities = {
      'canvas_fingerprint': 3,
      'dom_interaction': 2,
      'timing_challenge': 4,
      'browser_api': 1
    };
    return complexities[type] || 2;
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  analyzeClickPatterns(clickPatterns) {
    const analysis = { suspicionScore: 0, patterns: [] };
    
    if (clickPatterns.length < 3) return analysis;
    
    // Check for perfectly straight lines or geometric patterns
    const positions = clickPatterns.map(c => ({ x: c.x, y: c.y }));
    const straightLines = this.detectStraightLines(positions);
    
    if (straightLines > positions.length * 0.5) {
      analysis.suspicionScore += 20;
      analysis.patterns.push('Geometric click patterns detected');
    }
    
    // Check timing regularity in clicks
    const timings = [];
    for (let i = 1; i < clickPatterns.length; i++) {
      timings.push(new Date(clickPatterns[i].timestamp) - new Date(clickPatterns[i-1].timestamp));
    }
    
    const timingVariance = this.calculateVariance(timings);
    if (timingVariance < 50) { // Very regular timing
      analysis.suspicionScore += 15;
      analysis.patterns.push('Regular click timing patterns');
    }
    
    return analysis;
  }

  detectStraightLines(positions) {
    let straightLineCount = 0;
    for (let i = 0; i < positions.length - 2; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      const p3 = positions[i + 2];
      
      // Calculate if three points are roughly in a straight line
      const slope1 = (p2.y - p1.y) / (p2.x - p1.x);
      const slope2 = (p3.y - p2.y) / (p3.x - p2.x);
      
      if (Math.abs(slope1 - slope2) < 0.1) {
        straightLineCount++;
      }
    }
    return straightLineCount;
  }

  getRiskDescription(type, analysis) {
    const descriptions = {
      headers: `Header analysis detected ${analysis.indicators?.length || 0} suspicious indicators`,
      timing: `Request timing patterns show ${analysis.patterns?.length || 0} automation signatures`,
      javascript: `JavaScript validation failed with ${analysis.indicators?.length || 0} issues`,
      behavior: `Behavioral analysis detected ${analysis.automationIndicators?.length || 0} automation patterns`
    };
    return descriptions[type] || 'Risk detected in security analysis';
  }

  getRiskRecommendation(riskScore) {
    if (riskScore >= 80) return 'BLOCK - High probability of automation/proxy tool usage';
    if (riskScore >= 60) return 'FLAG - Suspicious activity detected, manual review recommended';
    if (riskScore >= 40) return 'MONITOR - Elevated risk, increase monitoring';
    if (riskScore >= 20) return 'CAUTION - Some suspicious patterns detected';
    return 'ALLOW - Normal behavior patterns';
  }
}

module.exports = new AntiAbuseDetector();
