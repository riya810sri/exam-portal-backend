const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const envs = ['PORT', 'NODE_ENV', 'CORS_ORIGIN', 'CORS_ALLOWED_HEADERS', 'CORS_METHODS', 'DB_SERVER_SELECTION_TIMEOUT_MS'];
const envs_req = ['PORT', 'MONGO_URI'];

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
  origin: "https://exam.techonquer.org",
  allowedHeaders: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

// Parse CORS origin - handle wildcard or multiple origins
const parseCorsOrigin = (origin) => {
  if (!origin) return defaultCorsOptions.origin;
  if (origin === '*') return origin; // Return wildcard as is
  
  // Try parsing as JSON array
  try {
    return JSON.parse(origin);
  } catch (e) {
    // If not JSON, try comma-separated string
    if (origin.includes(',')) {
      return origin.split(',').map(o => o.trim());
    }
    // Single origin
    return origin;
  }
};

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DB_URL || process.env.MONGO_URI, // Add fallback to MONGO_URI
    options: {
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS) || 500,
    },
  },
  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS || defaultCorsOptions.allowedHeaders,
    methods: (() => {
      if (!process.env.CORS_METHODS) return defaultCorsOptions.methods;
      try {
        return JSON.parse(process.env.CORS_METHODS);
      } catch (e) {
        return process.env.CORS_METHODS.split(',').map(m => m.trim());
      }
    })(),
  },
};

module.exports = config;