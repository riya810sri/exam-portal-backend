/**
 * Utility functions for server-side cheating detection
 * Focused on identifying API manipulation and proxy tools
 */

const crypto = require('crypto');
const ExamAttendance = require('../models/examAttendance.model');

/**
 * Generate a unique session token with embedded timing data
 * @returns {Object} Token and its hash
 */
const generateSessionToken = () => {
  // Create a random token with embedded timestamp
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const token = `${timestamp}:${random}`;
  
  // Create a hash of the token that will be stored server-side
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, hash, timestamp };
};

/**
 * Verify a session token and check for timing anomalies
 * @param {string} token - The token from client
 * @param {string} storedHash - The hash stored server-side
 * @param {number} storedTimestamp - Original timestamp
 * @returns {Object} Verification result with confidence score
 */
const verifySessionToken = (token, storedHash, storedTimestamp) => {
  // Verify the token matches what we expect
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const isValid = hash === storedHash;
  
  // Extract timestamp from token
  const [tokenTimestamp] = token.split(':');
  
  // Calculate time drift - in a normal browser this should be minimal
  // Proxy tools often add significant delay
  const timeDrift = Math.abs(parseInt(tokenTimestamp) - storedTimestamp);
  
  // Check for suspicious time drift (over 5 seconds)
  const hasTimingAnomaly = timeDrift > 5000;
  
  return {
    isValid,
    hasTimingAnomaly,
    timeDrift,
    confidence: isValid ? (hasTimingAnomaly ? 0.7 : 0) : 0.9
  };
};

/**
 * Analyze request headers for anomalies that might indicate proxy tools
 * @param {Object} headers - Request headers
 * @returns {Object} Analysis results with confidence score
 */
const analyzeRequestHeaders = (headers) => {
  let anomalyScore = 0;
  const anomalies = [];
  
  // Check for standard browser headers that are commonly missing in tools like Postman
  const expectedHeaders = ['accept-language', 'sec-fetch-site', 'sec-fetch-mode', 'sec-ch-ua'];
  const missingHeaders = expectedHeaders.filter(header => !headers[header]);
  
  if (missingHeaders.length > 0) {
    anomalyScore += 0.2 * missingHeaders.length;
    anomalies.push(`Missing standard browser headers: ${missingHeaders.join(', ')}`);
  }
  
  // Check for suspicious header combinations
  if (headers['postman-token'] || headers['x-postman-proxy']) {
    anomalyScore += 0.9;
    anomalies.push('Detected Postman-specific headers');
  }
  
  if (headers['x-requested-with'] === 'XMLHttpRequest' && !headers.referer) {
    anomalyScore += 0.5;
    anomalies.push('XHR request without referer');
  }
  
  // Check header order and consistency
  // Most browsers send headers in a consistent order
  const headerKeys = Object.keys(headers).join(',');
  const hasUnusualPattern = !headerKeys.includes('accept,accept-language,connection');
  
  if (hasUnusualPattern) {
    anomalyScore += 0.3;
    anomalies.push('Unusual header pattern detected');
  }
  
  return {
    anomalyScore: Math.min(anomalyScore, 1), // Cap at 1.0
    anomalies,
    isSuspicious: anomalyScore > 0.5
  };
};

/**
 * Analyze the request rate and pattern for a user
 * @param {string} userId - The user ID
 * @param {string} examId - The exam ID
 * @returns {Promise<Object>} Analysis results
 */
const analyzeRequestPattern = async (userId, examId) => {
  try {
    // Get the user's exam attendance record
    const attendance = await ExamAttendance.findOne({
      userId,
      examId,
      status: "IN_PROGRESS"
    });
    
    if (!attendance || !attendance.requestLog) {
      return { isSuspicious: false, anomalyScore: 0, reason: 'No request log available' };
    }
    
    const { requestLog } = attendance;
    
    // If we don't have enough requests to analyze, return early
    if (requestLog.length < 3) {
      return { isSuspicious: false, anomalyScore: 0, reason: 'Not enough requests to analyze' };
    }
    
    // Sort the log by timestamp
    const sortedLog = [...requestLog].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate time intervals between requests
    const intervals = [];
    for (let i = 1; i < sortedLog.length; i++) {
      intervals.push(sortedLog[i].timestamp - sortedLog[i-1].timestamp);
    }
    
    // Calculate mean and standard deviation of intervals
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length
    );
    
    // Analyze for suspicious patterns
    
    // 1. Too regular intervals (scripted)
    const regularityScore = stdDev / mean;
    const tooRegular = regularityScore < 0.1;
    
    // 2. Too many requests in a short time
    const requestRate = sortedLog.length / 
      ((sortedLog[sortedLog.length - 1].timestamp - sortedLog[0].timestamp) / 1000);
    const tooFrequent = requestRate > 2; // More than 2 requests per second on average
    
    // 3. Identical request paths/methods in sequence
    let repeatedPatterns = 0;
    for (let i = 1; i < sortedLog.length; i++) {
      if (sortedLog[i].path === sortedLog[i-1].path && 
          sortedLog[i].method === sortedLog[i-1].method) {
        repeatedPatterns++;
      }
    }
    const repeatedPatternRatio = repeatedPatterns / (sortedLog.length - 1);
    
    // Calculate overall anomaly score
    let anomalyScore = 0;
    const anomalies = [];
    
    if (tooRegular) {
      anomalyScore += 0.4;
      anomalies.push('Suspiciously regular request timing');
    }
    
    if (tooFrequent) {
      anomalyScore += 0.4;
      anomalies.push(`High request rate (${requestRate.toFixed(2)} req/s)`);
    }
    
    if (repeatedPatternRatio > 0.7) {
      anomalyScore += 0.3;
      anomalies.push(`Repeated request patterns (${(repeatedPatternRatio * 100).toFixed(0)}%)`);
    }
    
    return {
      isSuspicious: anomalyScore > 0.5,
      anomalyScore: Math.min(anomalyScore, 1),
      anomalies,
      stats: {
        requestCount: sortedLog.length,
        averageInterval: mean,
        standardDeviation: stdDev,
        regularityScore,
        requestRate,
        repeatedPatternRatio
      }
    };
    
  } catch (error) {
    console.error('Error analyzing request pattern:', error);
    return { isSuspicious: false, anomalyScore: 0, reason: 'Analysis error' };
  }
};

/**
 * Report a detected cheating incident to the system
 * @param {string} userId - The user ID
 * @param {string} examId - The exam ID
 * @param {string} evidenceType - Type of cheating detected
 * @param {Object} details - Evidence details
 * @returns {Promise<Object>} Result of the reporting
 */
const reportServerDetectedCheating = async (userId, examId, evidenceType, details) => {
  try {
    // Find the user's active exam attendance
    const attendance = await ExamAttendance.findOne({
      userId,
      examId,
      status: "IN_PROGRESS"
    });
    
    if (!attendance) {
      return { success: false, reason: 'No active exam found' };
    }
    
    // Add the cheating evidence
    const newEvidence = {
      timestamp: new Date(),
      evidenceType,
      details,
      source: "SERVER"
    };
    
    // Update the record
    attendance.cheatEvidence.push(newEvidence);
    attendance.cheatDetected = true;
    attendance.flaggedForReview = true;
    
    await attendance.save();
    
    console.log(`Server detected cheating for user ${userId}, exam ${examId}, type: ${evidenceType}`);
    
    return { 
      success: true, 
      evidenceId: attendance.cheatEvidence[attendance.cheatEvidence.length - 1]._id 
    };
    
  } catch (error) {
    console.error('Error reporting server-detected cheating:', error);
    return { success: false, reason: error.message };
  }
};

module.exports = {
  generateSessionToken,
  verifySessionToken,
  analyzeRequestHeaders,
  analyzeRequestPattern,
  reportServerDetectedCheating
};
