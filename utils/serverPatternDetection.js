/**
 * Server-side pattern detection for real-time monitoring
 * Advanced algorithms to detect cheating patterns and automated behavior
 */

const ExamAttendance = require('../models/examAttendance.model');
const { reportServerDetectedCheating } = require('./cheatDetection');

/**
 * Advanced behavioral pattern analyzer
 * Detects multiple types of suspicious patterns in real-time
 */
class PatternDetector {
  constructor() {
    // Cache for user session data to detect patterns across requests
    this.userSessions = new Map();
    
    // Thresholds for different types of suspicious behavior
    this.thresholds = {
      rapidResponse: 2000, // Less than 2 seconds per question is suspicious
      identicalTiming: 500, // Identical timing within 500ms suggests automation
      perfectPattern: 0.95, // Consistency score above 95% is suspicious
      massiveDeviation: 0.1, // Deviation below 10% suggests scripted behavior
      sequentialPattern: 0.8, // Sequential answering pattern above 80% is suspicious
      mouseVelocity: 5000, // Pixels per second - too fast suggests automation
      keystrokePattern: 0.9 // Keystroke timing consistency above 90% is suspicious
    };
  }

  /**
   * Analyze answer submission patterns for automation detection
   * @param {string} userId - User ID
   * @param {string} examId - Exam ID  
   * @param {string} questionId - Question ID
   * @param {string} selectedAnswer - Selected answer
   * @param {Object} metaData - Additional metadata (timing, mouse data, etc.)
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeAnswerPattern(userId, examId, questionId, selectedAnswer, metaData = {}) {
    try {
      const sessionKey = `${userId}-${examId}`;
      
      // Get or create session data
      let session = this.userSessions.get(sessionKey);
      if (!session) {
        session = {
          startTime: Date.now(),
          answers: [],
          timings: [],
          mouseMovements: [],
          keystrokes: [],
          patterns: {
            rapidResponses: 0,
            identicalTimings: 0,
            sequentialAnswers: 0
          }
        };
        this.userSessions.set(sessionKey, session);
      }

      const currentTime = Date.now();
      const answerData = {
        questionId,
        selectedAnswer,
        timestamp: currentTime,
        timeTaken: metaData.timeTaken || 0,
        mouseData: metaData.mouseData || {},
        keyboardData: metaData.keyboardData || {}
      };

      session.answers.push(answerData);
      session.timings.push(answerData.timeTaken);

      // Analyze patterns
      const analysis = await this.performAnalysis(session, answerData);
      
      // Report suspicious behavior if detected
      if (analysis.isSuspicious) {
        await this.reportSuspiciousPattern(userId, examId, analysis);
      }

      return analysis;

    } catch (error) {
      console.error('Error in analyzeAnswerPattern:', error);
      return { isSuspicious: false, error: error.message };
    }
  }

  /**
   * Perform comprehensive pattern analysis
   * @param {Object} session - User session data
   * @param {Object} currentAnswer - Current answer data
   * @returns {Object} Analysis results
   */
  async performAnalysis(session, currentAnswer) {
    const analysis = {
      isSuspicious: false,
      suspiciousPatterns: [],
      riskScore: 0,
      patterns: {}
    };

    // 1. Rapid response detection
    if (currentAnswer.timeTaken > 0 && currentAnswer.timeTaken < this.thresholds.rapidResponse) {
      analysis.patterns.rapidResponse = true;
      analysis.suspiciousPatterns.push(`Rapid response: ${currentAnswer.timeTaken}ms`);
      analysis.riskScore += 25;
      session.patterns.rapidResponses++;
    }

    // 2. Identical timing pattern detection
    if (session.timings.length >= 3) {
      const lastThree = session.timings.slice(-3);
      const timingVariance = this.calculateVariance(lastThree);
      
      if (timingVariance < this.thresholds.identicalTiming) {
        analysis.patterns.identicalTiming = true;
        analysis.suspiciousPatterns.push(`Identical timing pattern detected: variance ${timingVariance}`);
        analysis.riskScore += 30;
        session.patterns.identicalTimings++;
      }
    }

    // 3. Sequential answering pattern (A, B, C, D, A, B, C, D...)
    if (session.answers.length >= 4) {
      const sequentialScore = this.detectSequentialPattern(session.answers);
      if (sequentialScore > this.thresholds.sequentialPattern) {
        analysis.patterns.sequentialAnswering = true;
        analysis.suspiciousPatterns.push(`Sequential answering pattern: ${(sequentialScore * 100).toFixed(1)}%`);
        analysis.riskScore += 35;
        session.patterns.sequentialAnswers++;
      }
    }

    // 4. Mouse movement analysis (if provided)
    if (currentAnswer.mouseData && currentAnswer.mouseData.movements) {
      const mouseAnalysis = this.analyzeMouseMovement(currentAnswer.mouseData);
      if (mouseAnalysis.isSuspicious) {
        analysis.patterns.suspiciousMouse = true;
        analysis.suspiciousPatterns.push(`Suspicious mouse behavior: ${mouseAnalysis.reason}`);
        analysis.riskScore += 20;
      }
    }

    // 5. Keyboard timing analysis (if provided)
    if (currentAnswer.keyboardData && currentAnswer.keyboardData.keystrokes) {
      const keyboardAnalysis = this.analyzeKeyboardTiming(currentAnswer.keyboardData);
      if (keyboardAnalysis.isSuspicious) {
        analysis.patterns.suspiciousKeyboard = true;
        analysis.suspiciousPatterns.push(`Suspicious keyboard behavior: ${keyboardAnalysis.reason}`);
        analysis.riskScore += 15;
      }
    }

    // 6. Overall session pattern analysis
    if (session.answers.length >= 5) {
      const sessionAnalysis = this.analyzeSessionConsistency(session);
      if (sessionAnalysis.isSuspicious) {
        analysis.patterns.suspiciousSession = true;
        analysis.suspiciousPatterns.push(`Session-wide suspicious pattern: ${sessionAnalysis.reason}`);
        analysis.riskScore += sessionAnalysis.riskIncrease;
      }
    }

    // Determine if overall behavior is suspicious
    analysis.isSuspicious = analysis.riskScore >= 50 || analysis.suspiciousPatterns.length >= 3;

    return analysis;
  }

  /**
   * Calculate variance in timing
   * @param {number[]} timings - Array of timing values
   * @returns {number} Variance
   */
  calculateVariance(timings) {
    const mean = timings.reduce((sum, time) => sum + time, 0) / timings.length;
    const squaredDiffs = timings.map(time => Math.pow(time - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / timings.length;
  }

  /**
   * Detect sequential answering patterns
   * @param {Object[]} answers - Array of answers
   * @returns {number} Sequential score (0-1)
   */
  detectSequentialPattern(answers) {
    const lastFour = answers.slice(-4);
    const answerPattern = lastFour.map(a => a.selectedAnswer);
    
    // Check for ABCD pattern
    const expectedPattern = ['A', 'B', 'C', 'D'];
    let matches = 0;
    
    for (let i = 0; i < answerPattern.length; i++) {
      if (answerPattern[i] === expectedPattern[i % 4]) {
        matches++;
      }
    }

    return matches / answerPattern.length;
  }

  /**
   * Analyze mouse movement patterns
   * @param {Object} mouseData - Mouse movement data
   * @returns {Object} Analysis result
   */
  analyzeMouseMovement(mouseData) {
    const { movements, clicks } = mouseData;
    
    if (!movements || movements.length < 2) {
      return { isSuspicious: false };
    }

    // Calculate movement velocity
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 1; i < movements.length; i++) {
      const prev = movements[i - 1];
      const curr = movements[i];
      
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      
      const timeDiff = curr.timestamp - prev.timestamp;
      
      totalDistance += distance;
      totalTime += timeDiff;
    }

    const avgVelocity = totalTime > 0 ? totalDistance / totalTime : 0;

    // Check for suspicious patterns
    if (avgVelocity > this.thresholds.mouseVelocity) {
      return {
        isSuspicious: true,
        reason: `Extremely high mouse velocity: ${avgVelocity.toFixed(2)} px/ms`
      };
    }

    // Check for perfectly straight lines (automation)
    const straightLineCount = this.countStraightLines(movements);
    if (straightLineCount / movements.length > 0.8) {
      return {
        isSuspicious: true,
        reason: `Too many straight line movements: ${(straightLineCount / movements.length * 100).toFixed(1)}%`
      };
    }

    return { isSuspicious: false };
  }

  /**
   * Count straight line movements (automation indicator)
   * @param {Object[]} movements - Mouse movements
   * @returns {number} Count of straight lines
   */
  countStraightLines(movements) {
    let straightLines = 0;
    
    for (let i = 2; i < movements.length; i++) {
      const p1 = movements[i - 2];
      const p2 = movements[i - 1];
      const p3 = movements[i];
      
      // Calculate if three points are collinear (straight line)
      const area = Math.abs(
        (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
      );
      
      if (area < 1) { // Very small area means nearly straight line
        straightLines++;
      }
    }
    
    return straightLines;
  }

  /**
   * Analyze keyboard timing patterns
   * @param {Object} keyboardData - Keyboard timing data
   * @returns {Object} Analysis result
   */
  analyzeKeyboardTiming(keyboardData) {
    const { keystrokes } = keyboardData;
    
    if (!keystrokes || keystrokes.length < 3) {
      return { isSuspicious: false };
    }

    // Calculate inter-keystroke intervals
    const intervals = [];
    for (let i = 1; i < keystrokes.length; i++) {
      intervals.push(keystrokes[i].timestamp - keystrokes[i - 1].timestamp);
    }

    // Check for too-consistent typing (automation)
    const variance = this.calculateVariance(intervals);
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const coefficientOfVariation = variance / mean;

    if (coefficientOfVariation < this.thresholds.keystrokePattern) {
      return {
        isSuspicious: true,
        reason: `Highly consistent keystroke timing: CV ${coefficientOfVariation.toFixed(3)}`
      };
    }

    return { isSuspicious: false };
  }

  /**
   * Analyze overall session consistency for automation detection
   * @param {Object} session - Session data
   * @returns {Object} Analysis result
   */
  analyzeSessionConsistency(session) {
    const { timings, patterns } = session;
    
    // Check if user has too many rapid responses
    if (patterns.rapidResponses / session.answers.length > 0.7) {
      return {
        isSuspicious: true,
        reason: `Too many rapid responses: ${patterns.rapidResponses}/${session.answers.length}`,
        riskIncrease: 40
      };
    }

    // Check if user has too many identical timings
    if (patterns.identicalTimings > 3) {
      return {
        isSuspicious: true,
        reason: `Repeated identical timing patterns: ${patterns.identicalTimings}`,
        riskIncrease: 35
      };
    }

    // Check overall timing consistency (too perfect = automation)
    if (timings.length >= 5) {
      const variance = this.calculateVariance(timings);
      const mean = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const consistency = 1 - (Math.sqrt(variance) / mean);
      
      if (consistency > this.thresholds.perfectPattern) {
        return {
          isSuspicious: true,
          reason: `Suspiciously consistent timing: ${(consistency * 100).toFixed(1)}%`,
          riskIncrease: 30
        };
      }
    }

    return { isSuspicious: false };
  }

  /**
   * Report suspicious patterns to the system
   * @param {string} userId - User ID
   * @param {string} examId - Exam ID
   * @param {Object} analysis - Analysis results
   */
  async reportSuspiciousPattern(userId, examId, analysis) {
    try {
      await reportServerDetectedCheating(
        userId,
        examId,
        'AUTOMATED_BEHAVIOR',
        {
          source: 'pattern_detection',
          riskScore: analysis.riskScore,
          patterns: analysis.patterns,
          suspiciousPatterns: analysis.suspiciousPatterns,
          timestamp: new Date(),
          detector: 'ServerPatternDetection'
        }
      );

      console.warn(`AUTOMATED BEHAVIOR DETECTED: User ${userId}, Exam ${examId}, Risk: ${analysis.riskScore}%`);
      console.warn(`Patterns: ${analysis.suspiciousPatterns.join('; ')}`);

    } catch (error) {
      console.error('Error reporting suspicious pattern:', error);
    }
  }

  /**
   * Clean up old session data to prevent memory leaks
   * @param {number} maxAge - Maximum age in milliseconds (default: 4 hours)
   */
  cleanupSessions(maxAge = 4 * 60 * 60 * 1000) {
    const now = Date.now();
    
    for (const [sessionKey, session] of this.userSessions) {
      if (now - session.startTime > maxAge) {
        this.userSessions.delete(sessionKey);
      }
    }
  }

  /**
   * Get session statistics for monitoring
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    return {
      activeSessions: this.userSessions.size,
      sessions: Array.from(this.userSessions.entries()).map(([key, session]) => ({
        sessionKey: key,
        duration: Date.now() - session.startTime,
        answersCount: session.answers.length,
        suspiciousPatterns: session.patterns
      }))
    };
  }
}

// Create singleton instance
const patternDetector = new PatternDetector();

// Clean up sessions every hour
setInterval(() => {
  patternDetector.cleanupSessions();
}, 60 * 60 * 1000);

module.exports = {
  PatternDetector,
  patternDetector
};
