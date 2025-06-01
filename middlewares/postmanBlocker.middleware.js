/**
 * Postman and API Testing Tools Blocker Middleware
 * 
 * This middleware detects and blocks requests from Postman, Insomnia, 
 * curl, wget and other API testing tools to protect exam integrity.
 */

/**
 * Middleware to detect and block Postman and other API testing tools
 */
const blockPostman = (req, res, next) => {
  try {
    const userAgent = req.get('user-agent') || '';
    const postmanToken = req.get('postman-token');
    const headers = req.headers;
    
    // List of user-agent patterns that indicate API testing tools
    const blockedUserAgents = [
      /postman/i,
      /insomnia/i,
      /httpie/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /python-urllib/i,
      /axios/i,
      /node-fetch/i,
      /go-http-client/i,
      /java/i,
      /apache-httpclient/i,
      /okhttp/i,
      /restsharp/i,
      /powershell/i
    ];
    
    // List of headers that indicate API testing tools
    const blockedHeaders = [
      'postman-token',
      'postman-runtime',
      'insomnia',
      'httpie',
      'x-postman-token',
      'x-insomnia',
      'x-api-key' // Often used by testing tools
    ];
    
    // Check for Postman-specific token
    if (postmanToken) {
      console.log(`🚫 Blocked Postman request from IP: ${req.ip}, User-Agent: ${userAgent}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. API testing tools are not allowed.",
        error: "TOOL_BLOCKED",
        hint: "Please use the official web application to access this service."
      });
    }
    
    // Check for blocked user agents
    for (const pattern of blockedUserAgents) {
      if (pattern.test(userAgent)) {
        console.log(`🚫 Blocked API tool request from IP: ${req.ip}, User-Agent: ${userAgent}`);
        return res.status(403).json({
          success: false,
          message: "Access denied. API testing tools are not allowed.",
          error: "TOOL_BLOCKED",
          tool_detected: userAgent.split('/')[0],
          hint: "Please use the official web application to access this service."
        });
      }
    }
    
    // Check for blocked headers
    for (const header of blockedHeaders) {
      if (headers[header]) {
        console.log(`🚫 Blocked request with suspicious header '${header}' from IP: ${req.ip}`);
        return res.status(403).json({
          success: false,
          message: "Access denied. API testing tools are not allowed.",
          error: "TOOL_BLOCKED",
          detected_header: header,
          hint: "Please use the official web application to access this service."
        });
      }
    }
    
    // Check for missing browser-specific headers (legitimate browsers always send these)
    const requiredBrowserHeaders = ['accept', 'accept-language', 'accept-encoding'];
    const missingHeaders = requiredBrowserHeaders.filter(header => !headers[header]);
    
    if (missingHeaders.length > 1) {
      console.log(`🚫 Blocked request missing browser headers from IP: ${req.ip}, Missing: ${missingHeaders.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid request format.",
        error: "INVALID_CLIENT",
        hint: "Please use a supported web browser to access this service."
      });
    }
    
    // Check for suspicious header combinations
    const acceptHeader = headers['accept'] || '';
    const acceptLanguage = headers['accept-language'] || '';
    
    // API tools often use generic accept headers
    if (acceptHeader === '*/*' && !acceptLanguage) {
      console.log(`🚫 Blocked request with generic headers from IP: ${req.ip}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid request format.",
        error: "SUSPICIOUS_HEADERS",
        hint: "Please use a supported web browser to access this service."
      });
    }
    
    // Additional check: No referer + generic accept headers is suspicious
    const referer = headers['referer'] || headers['referrer'] || '';
    if (!referer && acceptHeader === '*/*' && userAgent.length < 50) {
      console.log(`🚫 Blocked suspicious request from IP: ${req.ip}, Short UA: ${userAgent}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid request source.",
        error: "INVALID_SOURCE",
        hint: "Please access this service through the official web application."
      });
    }
    
    // If all checks pass, continue to next middleware
    next();
    
  } catch (error) {
    console.error('Error in postman blocker middleware:', error);
    // In case of error, allow the request but log it
    next();
  }
};

/**
 * More lenient version for non-critical endpoints
 * Only blocks obvious API testing tools
 */
const blockPostmanLenient = (req, res, next) => {
  try {
    const userAgent = req.get('user-agent') || '';
    const postmanToken = req.get('postman-token');
    
    // Only block obvious cases
    if (postmanToken || /postman|insomnia/i.test(userAgent)) {
      console.log(`🚫 Blocked API tool request from IP: ${req.ip}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. API testing tools are not allowed.",
        error: "TOOL_BLOCKED"
      });
    }
    
    next();
  } catch (error) {
    console.error('Error in lenient postman blocker:', error);
    next();
  }
};

module.exports = {
  blockPostman,
  blockPostmanLenient
};
