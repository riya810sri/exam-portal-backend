const mongoose = require("mongoose");

const examAttendanceSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  attemptedQuestions: {
    type: Number,
    default: 0,
  },
  score: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["IN_PROGRESS", "COMPLETED", "TIMED_OUT", "SUSPENDED", "SUSPICIOUS_ACTIVITY"],
    default: "IN_PROGRESS",
  },
  // Anti-abuse and monitoring fields
  monitoringActive: {
    type: Boolean,
    default: false
  },
  monitoringStartTime: {
    type: Date
  },
  answers: [
    {
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
      selectedAnswer: {
        type: String,
      },
      isCorrect: {
        type: Boolean,
      },
    },
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  // Cheating detection fields
  cheatDetected: {
    type: Boolean,
    default: false
  },
  cheatEvidence: {
    type: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      evidenceType: {
        type: String,
        enum: [
          "TAB_SWITCH", "COPY_PASTE", "MULTIPLE_WINDOWS", "PROHIBITED_KEYS", 
          "FACE_DETECTION", "SERVER_DETECTED", "PROXY_TOOL_DETECTED", 
          "AUTOMATED_BEHAVIOR", "TIMING_ANOMALY", "HEADER_FINGERPRINT", 
          "JS_BEACON_FAILURE", "REQUEST_PATTERN_ANOMALY", "OTHER"
        ],
        required: true
      },
      details: {
        type: mongoose.Schema.Types.Mixed, // Flexible schema for different types of evidence
        default: {}
      },
      source: {
        type: String,
        enum: ["CLIENT", "SERVER"],
        default: "CLIENT"
      },
      severity: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "MEDIUM"
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      }
    }],
    default: []
  },
  flaggedForReview: {
    type: Boolean,
    default: false
  },
  // Advanced anti-abuse tracking (stealth fields)
  sessionFingerprint: {
    type: {
      // Browser fingerprinting data
      screenResolution: String,
      timezone: String,
      language: String,
      platform: String,
      cookiesEnabled: Boolean,
      doNotTrack: String,
      // JavaScript execution environment
      jsHeapSizeLimit: Number,
      jsUsedHeapSize: Number,
      hardwareConcurrency: Number,
      // Canvas fingerprint hash
      canvasFingerprint: String,
      // WebGL fingerprint
      webglVendor: String,
      webglRenderer: String
    },
    default: {}
  },
  requestMetrics: {
    type: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      endpoint: String,
      responseTime: Number, // in milliseconds
      requestSize: Number, // in bytes
      responseSize: Number, // in bytes
      // Timing patterns analysis
      timingGaps: [Number], // gaps between requests
      sequentialityScore: Number, // 0-100, higher = more human-like
      // Header analysis
      headerConsistency: Number, // 0-100
      suspiciousHeaders: [String],
      // JavaScript beacon confirmations
      jsBeaconReceived: {
        type: Boolean,
        default: false
      },
      jsExecutionTime: Number, // time to execute JS challenges
      domInteractionEvents: Number // count of DOM events since last request
    }],
    default: []
  },
  behaviorProfile: {
    type: {
      // Mouse and keyboard patterns
      avgMouseSpeed: Number,
      mouseMovementEntropy: Number, // randomness in movement
      avgKeyboardInterval: Number,
      keystrokePattern: [Number], // timing between keystrokes
      
      // Interaction patterns
      clickPatterns: [{
        x: Number,
        y: Number,
        timestamp: Date,
        element: String
      }],
      
      // Reading patterns
      scrollBehavior: [{
        direction: String, // 'up' or 'down'
        speed: Number,
        timestamp: Date,
        position: Number
      }],
      
      // Focus patterns
      focusEvents: [{
        element: String,
        duration: Number, // how long focused
        timestamp: Date
      }],
      
      // Timing patterns
      questionViewTime: [Number], // time spent viewing each question
      answerChangeFrequency: Number, // how often answers are changed
      
      // Behavioral scoring
      humanLikeScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      },
      automationRisk: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    },
    default: {}
  },
  // Risk assessment
  riskAssessment: {
    type: {
      overallRiskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      riskFactors: [{
        factor: String,
        score: Number,
        description: String,
        timestamp: Date
      }],
      lastAssessment: {
        type: Date,
        default: Date.now
      },
      autoFlagged: {
        type: Boolean,
        default: false
      }
    },
    default: {}
  }
});

examAttendanceSchema.index({ examId: 1, userId: 1, attemptNumber: 1 }, { unique: true });

const ExamAttendance = mongoose.model("ExamAttendance", examAttendanceSchema);

module.exports = ExamAttendance;