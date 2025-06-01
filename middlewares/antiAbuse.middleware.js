/**
 * Anti-Abuse Middleware for Exam Attendance
 * 
 * This middleware collects and analyzes request data for detecting
 * proxy tools, automation, and other cheating attempts during exam access.
 */

const antiAbuseDetector = require('../utils/antiAbuseDetector');
const ExamAttendance = require('../models/examAttendance.model');

// Helper function to sanitize headers
const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  
  // Remove sensitive headers or replace with "present" indicator
  if (sanitized.authorization) sanitized.authorization = 'Bearer [REDACTED]';
  if (sanitized.cookie) sanitized.cookie = '[REDACTED]';
  
  return sanitized;
};

/**
 * Middleware to collect and analyze anti-abuse data
 */
const collectAntiAbuseData = async (req, res, next) => {
  try {
    // Skip in development mode for localhost origins
    const isDevelopment = process.env.NODE_ENV === 'development';
    const origin = req.headers.origin || '';
    
    if (isDevelopment && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      // Just add a basic structure for controllers that expect antiAbuseData
      req.antiAbuseData = {
        requestData: { timestamp: new Date() },
        headerAnalysis: { riskScore: 0 },
        startTime: Date.now(),
        jsChallenge: null,
        riskFactors: []
      };
      return next();
    }
    
    // Skip for non-exam attendance routes
    if (!req.route?.path?.includes('attend') && !req.route?.path?.includes('submit-answer')) {
      return next();
    }

    const startTime = Date.now();
    
    // Collect request metadata
    const requestData = {
      timestamp: new Date(),
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      headers: sanitizeHeaders(req.headers), // Sanitize headers to remove sensitive data
      requestSize: req.get('content-length') || 0,
      userAgent: req.get('user-agent') || '',
      referer: req.get('referer') || '',
      origin: req.get('origin') || ''
    };

    // Analyze headers for proxy/automation indicators
    const headerAnalysis = antiAbuseDetector.analyzeHeaders(req.headers);
    
    // Store analysis in request for use by controllers
    req.antiAbuseData = {
      requestData,
      headerAnalysis,
      startTime,
      jsChallenge: null,
      riskFactors: []
    };

    // Add risk factors based on header analysis
    if (headerAnalysis.riskScore > 20) {
      req.antiAbuseData.riskFactors.push({
        type: 'HEADER_FINGERPRINT',
        score: headerAnalysis.riskScore,
        details: {
          suspiciousHeaders: headerAnalysis.suspiciousHeaders,
          missingHeaders: headerAnalysis.missingHeaders,
          indicators: headerAnalysis.indicators
        }
      });
    }

    // Generate JavaScript challenge for verification
    if (req.method === 'GET' && req.route?.path?.includes('attend')) {
      req.antiAbuseData.jsChallenge = antiAbuseDetector.generateJSChallenge();
    }

    // Override res.json to capture response time and size
    const originalJson = res.json;
    res.json = function(body) {
      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(body).length;
      
      // Update request data with response metrics
      req.antiAbuseData.requestData.responseTime = responseTime;
      req.antiAbuseData.requestData.responseSize = responseSize;
      
      // Analyze response timing
      if (responseTime < 10) {
        req.antiAbuseData.riskFactors.push({
          type: 'TIMING_ANOMALY',
          score: 30,
          details: {
            responseTime,
            reason: 'Unusually fast response processing'
          }
        });
      }
      
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    console.error('Anti-abuse middleware error:', error);
    // Don't block the request if anti-abuse fails
    next();
  }
};

/**
 * Process and store anti-abuse data in exam attendance record
 */
const processAntiAbuseData = async (req, examId, userId) => {
  try {
    if (!req.antiAbuseData) return null;

    const { requestData, headerAnalysis, riskFactors } = req.antiAbuseData;
    
    // Find the current exam attendance record
    const attendance = await ExamAttendance.findOne({
      examId,
      userId,
      status: 'IN_PROGRESS'
    });

    if (!attendance) return null;

    // Add request metrics
    if (!attendance.requestMetrics) {
      attendance.requestMetrics = [];
    }

    const requestMetric = {
      timestamp: requestData.timestamp,
      endpoint: requestData.endpoint,
      responseTime: requestData.responseTime,
      requestSize: requestData.requestSize,
      responseSize: requestData.responseSize,
      headerConsistency: Math.max(0, 100 - headerAnalysis.riskScore),
      suspiciousHeaders: headerAnalysis.suspiciousHeaders,
      jsBeaconReceived: false // Will be updated by client-side beacon
    };

    // Calculate timing gaps and sequentiality
    if (attendance.requestMetrics.length > 0) {
      const lastRequest = attendance.requestMetrics[attendance.requestMetrics.length - 1];
      const timingGap = new Date(requestData.timestamp) - new Date(lastRequest.timestamp);
      
      if (!requestMetric.timingGaps) requestMetric.timingGaps = [];
      requestMetric.timingGaps.push(timingGap);
      
      // Calculate sequentiality score (how human-like the timing is)
      requestMetric.sequentialityScore = calculateSequentialityScore(attendance.requestMetrics);
    }

    attendance.requestMetrics.push(requestMetric);

    // Analyze overall request timing patterns
    if (attendance.requestMetrics.length >= 3) {
      const timingAnalysis = antiAbuseDetector.analyzeRequestTiming(attendance.requestMetrics);
      
      if (timingAnalysis.riskScore > 30) {
        riskFactors.push({
          type: 'REQUEST_PATTERN_ANOMALY',
          score: timingAnalysis.riskScore,
          details: {
            patterns: timingAnalysis.patterns,
            statistics: timingAnalysis.statistics
          }
        });
      }
    }

    // Store risk factors as evidence
    for (const riskFactor of riskFactors) {
      if (riskFactor.score > 25) {
        const evidence = {
          timestamp: new Date(),
          evidenceType: riskFactor.type,
          details: riskFactor.details,
          source: 'SERVER',
          severity: getSeverityLevel(riskFactor.score),
          confidence: Math.min(100, riskFactor.score + 20)
        };

        attendance.cheatEvidence.push(evidence);
        attendance.cheatDetected = true;

        // Auto-flag for review if high risk
        if (riskFactor.score > 60) {
          attendance.flaggedForReview = true;
        }
      }
    }

    // Update risk assessment
    const allAnalyses = {
      headers: headerAnalysis,
      timing: attendance.requestMetrics.length >= 3 ? 
        antiAbuseDetector.analyzeRequestTiming(attendance.requestMetrics) : null
    };

    const riskAssessment = antiAbuseDetector.calculateOverallRisk(allAnalyses);
    
    attendance.riskAssessment = {
      overallRiskScore: riskAssessment.overallRiskScore,
      riskFactors: riskAssessment.riskFactors.map(rf => ({
        factor: rf.factor,
        score: rf.score,
        description: rf.description,
        timestamp: new Date()
      })),
      lastAssessment: new Date(),
      autoFlagged: riskAssessment.autoFlag
    };

    if (riskAssessment.autoFlag) {
      attendance.flaggedForReview = true;
    }

    await attendance.save();
    return riskAssessment;

  } catch (error) {
    console.error('Error processing anti-abuse data:', error);
    return null;
  }
};

/**
 * Calculate how human-like the request timing patterns are
 */
function calculateSequentialityScore(requestMetrics) {
  if (requestMetrics.length < 3) return 50;

  const timingGaps = [];
  for (let i = 1; i < requestMetrics.length; i++) {
    const gap = new Date(requestMetrics[i].timestamp) - new Date(requestMetrics[i-1].timestamp);
    timingGaps.push(gap);
  }

  // Human behavior typically has:
  // 1. Variable timing (not too consistent)
  // 2. Reasonable response times (200ms - 30s)
  // 3. Some correlation between request complexity and timing

  const variance = calculateVariance(timingGaps);
  const avgGap = timingGaps.reduce((a, b) => a + b, 0) / timingGaps.length;

  let score = 50; // Base human score

  // Penalize overly consistent timing
  if (variance < 100) score -= 30;
  
  // Penalize unrealistic timing
  const fastRequests = timingGaps.filter(gap => gap < 200).length;
  const slowRequests = timingGaps.filter(gap => gap > 60000).length;
  
  score -= (fastRequests / timingGaps.length) * 40;
  score -= (slowRequests / timingGaps.length) * 20;

  // Reward natural variation
  if (variance > 1000 && variance < 10000) score += 20;

  return Math.max(0, Math.min(100, score));
}

function calculateVariance(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function getSeverityLevel(riskScore) {
  if (riskScore >= 80) return 'CRITICAL';
  if (riskScore >= 60) return 'HIGH';
  if (riskScore >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Middleware to validate JavaScript challenge responses
 */
const validateJSChallenge = (req, res, next) => {
  try {
    const { jsChallenge, jsResponse, jsExecutionTime } = req.body;
    
    if (jsChallenge && jsResponse) {
      const validation = antiAbuseDetector.validateJSChallenge(
        jsChallenge, 
        jsResponse, 
        jsExecutionTime
      );
      
      if (!validation.valid) {
        if (!req.antiAbuseData) req.antiAbuseData = { riskFactors: [] };
        
        req.antiAbuseData.riskFactors.push({
          type: 'JS_BEACON_FAILURE',
          score: validation.riskScore,
          details: {
            indicators: validation.indicators,
            confidence: validation.confidence,
            executionTime: jsExecutionTime
          }
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('JS challenge validation error:', error);
    next();
  }
};

module.exports = {
  collectAntiAbuseData,
  processAntiAbuseData,
  validateJSChallenge
};
