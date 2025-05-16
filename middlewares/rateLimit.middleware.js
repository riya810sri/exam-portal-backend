const rateLimit = require('express-rate-limit');

// Default rate limiter - moderate limits for most routes
const defaultLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Auth rate limiter - stricter limits for auth routes (login, register, etc.)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts from this IP, please try again after an hour'
});

// Admin rate limiter - moderate limits for admin routes
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many admin requests from this IP, please try again after 15 minutes'
});

// Exam submission limiter - strict limits to prevent cheating or abuse
const examSubmissionLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many exam submissions, please try again later'
});

// Certificate generation limiter - very strict limits as these are resource-intensive
const certificateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many certificate generation requests, please try again after an hour'
});

// API rate limiter - for general API endpoints
const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 150, // limit each IP to 150 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many API requests from this IP, please try again after 10 minutes'
});

module.exports = {
    defaultLimiter,
    authLimiter,
    adminLimiter,
    examSubmissionLimiter,
    certificateLimiter,
    apiLimiter
};