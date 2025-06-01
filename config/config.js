const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const envs = ['PORT', 'NODE_ENV', 'CORS_ORIGIN', 'CORS_ALLOWED_HEADERS', 'CORS_METHODS', 'DB_SERVER_SELECTION_TIMEOUT_MS', 'WS_CORS_ORIGIN'];
const envs_req = ['PORT', 'DB_URL'];

// Check if required environment variables are set
const missingEnvs = envs_req.filter(env => !process.env[env]);
if (missingEnvs.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

console.log('Loaded Environment Variables:', Object.fromEntries(
  Object.entries(process.env).filter(([key]) => envs.includes(key))
));

// Default CORS options if environment variables are missing
const defaultCorsOptions = {
  origin: "https://durbhasigurukulam.com",
  allowedHeaders: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

// Parse CORS origin from environment variable
const parseCorsOrigin = (originStr) => {
  if (!originStr) return defaultCorsOptions.origin;
  
  // For wildcard, return as is
  if (originStr === '*') return '*';
  
  // In development, allow all origins for easier testing
  if (process.env.NODE_ENV === 'development') {
    return true; // This will allow all origins in development mode
  }
  
  try {
    // First try to parse as JSON array
    let parsed;
    try {
      parsed = JSON.parse(originStr);
    } catch (e) {
      // If not valid JSON, treat as single origin or comma-separated list
      if (originStr.includes(',')) {
        parsed = originStr.split(',').map(o => o.trim());
      } else {
        // Single origin
        return originStr.trim();
      }
    }
    
    // If we have an array or parsed comma-separated list
    if (Array.isArray(parsed)) {
      // If any value contains wildcard, we need a function
      if (parsed.some(value => value.includes('*'))) {
        return function(origin, callback) {
          // Allow requests with no origin (like mobile apps, curl, postman)
          if (!origin) {
            return callback(null, true);
          }
          
          // Special case for localhost and 127.0.0.1
          if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
          }
          
          // Check exact matches first
          if (parsed.includes(origin)) {
            return callback(null, true);
          }
          
          // Check patterns with wildcards
          for (const pattern of parsed) {
            if (!pattern.includes('*')) continue;
            
            // Convert wildcard pattern to regex
            // Escape special regex chars except *
            const regexPattern = pattern
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex chars
              .replace(/\*/g, '.*'); // * becomes .* in regex
            
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(origin)) {
              return callback(null, true);
            }
          }
          
          // No match found
          console.log(`CORS rejected origin: ${origin}`);
          callback(new Error(`Origin ${origin} not allowed by CORS`), false);
        };
      } else {
        // Array without wildcards, return as is
        return parsed;
      }
    } else if (typeof parsed === 'string') {
      // Single origin as JSON string
      return parsed;
    } else {
      // Fallback to default
      return defaultCorsOptions.origin;
    }
  } catch (error) {
    console.error('Error parsing CORS_ORIGIN:', error);
    return defaultCorsOptions.origin;
  }
};

// Parse methods and headers
const parseCorsArray = (value, defaultValue) => {
  if (!value) return defaultValue;
  if (value === '*') return '*';
  
  try {
    // Try to parse as JSON array
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch (e) {
    // If not JSON, try comma-separated string
    return value.includes(',') ? value.split(',').map(item => item.trim()) : [value.trim()];
  }
};

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DB_URL || process.env.DB_URI, // Add fallback to DB_URI
    options: {
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS) || 50000,
    },
  },
  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    methods: parseCorsArray(process.env.CORS_METHODS, defaultCorsOptions.methods),
    allowedHeaders: parseCorsArray(process.env.CORS_ALLOWED_HEADERS, defaultCorsOptions.allowedHeaders),
    credentials: true // Important for cookies
  },
  websocket: {
    cors: {
      origin: parseCorsOrigin(process.env.WS_CORS_ORIGIN || process.env.CORS_ORIGIN),
      methods: ["GET", "POST"],
      credentials: true
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET
  },
  email: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
};

module.exports = config;