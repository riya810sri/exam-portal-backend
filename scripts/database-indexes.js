/**
 * Database Index Creation Script for Anti-Abuse System
 * Run this script to optimize database performance for anti-abuse queries
 */

const mongoose = require('mongoose');
const config = require('../config/config');

// Import models
const ExamAttendance = require('../models/examAttendance.model');
const User = require('../models/user.model');

/**
 * Create indexes for optimal anti-abuse query performance
 */
async function createAntiAbuseIndexes() {
  try {
    console.log('🚀 Starting database index creation for anti-abuse system...\n');

    // Connect to database
    await mongoose.connect(config.db.url, config.db.options);
    console.log('✅ Connected to database');

    // ExamAttendance model indexes
    console.log('\n📊 Creating ExamAttendance indexes...');

    // 1. Risk assessment queries
    await ExamAttendance.collection.createIndex({
      'riskAssessment.overallRiskScore': -1,
      'status': 1,
      'startTime': -1
    }, { name: 'risk_assessment_query' });
    console.log('✅ Created risk assessment query index');

    // 2. Session monitoring
    await ExamAttendance.collection.createIndex({
      'userId': 1,
      'status': 1,
      'startTime': -1
    }, { name: 'session_monitoring' });
    console.log('✅ Created session monitoring index');

    // 3. Cheat evidence queries
    await ExamAttendance.collection.createIndex({
      'cheatEvidence.type': 1,
      'cheatEvidence.detectedAt': -1,
      'status': 1
    }, { name: 'cheat_evidence_query' });
    console.log('✅ Created cheat evidence query index');

    // 4. Real-time security dashboard
    await ExamAttendance.collection.createIndex({
      'status': 1,
      'riskAssessment.lastUpdated': -1,
      'riskAssessment.overallRiskScore': -1
    }, { name: 'security_dashboard' });
    console.log('✅ Created security dashboard index');

    // 5. Admin session analysis
    await ExamAttendance.collection.createIndex({
      'examId': 1,
      'userId': 1,
      'startTime': -1
    }, { name: 'admin_session_analysis' });
    console.log('✅ Created admin session analysis index');

    // 6. Behavioral pattern analysis
    await ExamAttendance.collection.createIndex({
      'behaviorProfile.mouseMovements.0.timestamp': -1,
      'behaviorProfile.keystrokes.0.timestamp': -1,
      'userId': 1
    }, { name: 'behavior_pattern_analysis' });
    console.log('✅ Created behavioral pattern analysis index');

    // 7. Request metrics analysis
    await ExamAttendance.collection.createIndex({
      'requestMetrics.averageResponseTime': 1,
      'requestMetrics.requestCount': -1,
      'startTime': -1
    }, { name: 'request_metrics_analysis' });
    console.log('✅ Created request metrics analysis index');

    // 8. Session fingerprint tracking
    await ExamAttendance.collection.createIndex({
      'sessionFingerprint.browserHash': 1,
      'sessionFingerprint.ipAddress': 1,
      'startTime': -1
    }, { name: 'session_fingerprint_tracking' });
    console.log('✅ Created session fingerprint tracking index');

    // 9. Time-based queries for alerts
    await ExamAttendance.collection.createIndex({
      'riskAssessment.lastUpdated': -1,
      'riskAssessment.overallRiskScore': -1
    }, { name: 'time_based_alerts' });
    console.log('✅ Created time-based alerts index');

    // 10. Composite index for complex admin queries
    await ExamAttendance.collection.createIndex({
      'examId': 1,
      'status': 1,
      'riskAssessment.overallRiskScore': -1,
      'startTime': -1
    }, { name: 'admin_complex_queries' });
    console.log('✅ Created admin complex queries index');

    // User model indexes for security monitoring
    console.log('\n👤 Creating User indexes for security...');

    // 1. User lookup for security reports
    await User.collection.createIndex({
      'role': 1,
      'isActive': 1,
      'createdAt': -1
    }, { name: 'security_user_lookup' });
    console.log('✅ Created security user lookup index');

    // 2. Email-based admin notifications
    await User.collection.createIndex({
      'email': 1,
      'role': 1,
      'isActive': 1
    }, { name: 'admin_notification_lookup' });
    console.log('✅ Created admin notification lookup index');

    console.log('\n🎉 All indexes created successfully!');
    console.log('\n📈 Performance optimization recommendations:');
    console.log('   • Regularly monitor slow queries using MongoDB profiler');
    console.log('   • Consider archiving old exam attendance records');
    console.log('   • Implement data retention policies for behavioral data');
    console.log('   • Monitor index usage with db.collection.getIndexes()');

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

/**
 * List existing indexes for verification
 */
async function listExistingIndexes() {
  try {
    await mongoose.connect(config.database.mongodb_url);
    
    console.log('\n📋 Current ExamAttendance indexes:');
    const examIndexes = await ExamAttendance.collection.listIndexes().toArray();
    examIndexes.forEach(index => {
      console.log(`   • ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n📋 Current User indexes:');
    const userIndexes = await User.collection.listIndexes().toArray();
    userIndexes.forEach(index => {
      console.log(`   • ${index.name}: ${JSON.stringify(index.key)}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error listing indexes:', error);
  }
}

/**
 * Remove anti-abuse indexes (for cleanup/testing)
 */
async function removeAntiAbuseIndexes() {
  try {
    await mongoose.connect(config.database.mongodb_url);
    
    const indexesToRemove = [
      'risk_assessment_query',
      'session_monitoring',
      'cheat_evidence_query',
      'security_dashboard',
      'admin_session_analysis',
      'behavior_pattern_analysis',
      'request_metrics_analysis',
      'session_fingerprint_tracking',
      'time_based_alerts',
      'admin_complex_queries',
      'security_user_lookup',
      'admin_notification_lookup'
    ];

    console.log('🗑️  Removing anti-abuse indexes...');
    
    for (const indexName of indexesToRemove) {
      try {
        await ExamAttendance.collection.dropIndex(indexName);
        console.log(`✅ Removed ExamAttendance index: ${indexName}`);
      } catch (error) {
        if (error.code !== 27) { // Index not found
          console.log(`⚠️  Index ${indexName} not found in ExamAttendance`);
        }
      }
    }

    // Remove user indexes
    try {
      await User.collection.dropIndex('security_user_lookup');
      console.log('✅ Removed User index: security_user_lookup');
    } catch (error) {
      console.log('⚠️  security_user_lookup index not found in User');
    }

    try {
      await User.collection.dropIndex('admin_notification_lookup');
      console.log('✅ Removed User index: admin_notification_lookup');
    } catch (error) {
      console.log('⚠️  admin_notification_lookup index not found in User');
    }

    await mongoose.disconnect();
    console.log('\n✅ Index removal completed');
  } catch (error) {
    console.error('❌ Error removing indexes:', error);
  }
}

/**
 * Analyze query performance
 */
async function analyzeQueryPerformance() {
  try {
    await mongoose.connect(config.database.mongodb_url);
    
    console.log('📊 Analyzing query performance...\n');

    // Test queries that will benefit from our indexes
    const testQueries = [
      {
        name: 'High Risk Sessions Query',
        query: () => ExamAttendance.find({
          'riskAssessment.overallRiskScore': { $gte: 70 },
          'status': 'IN_PROGRESS'
        }).explain('executionStats')
      },
      {
        name: 'Recent Cheat Evidence Query',
        query: () => ExamAttendance.find({
          'cheatEvidence.type': 'PROXY_TOOL_DETECTED',
          'cheatEvidence.detectedAt': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).explain('executionStats')
      },
      {
        name: 'User Session History Query',
        query: () => ExamAttendance.find({
          'userId': 'test-user-id',
          'status': { $in: ['COMPLETED', 'IN_PROGRESS'] }
        }).sort({ startTime: -1 }).explain('executionStats')
      }
    ];

    for (const test of testQueries) {
      console.log(`🔍 Testing: ${test.name}`);
      try {
        const result = await test.query();
        const stats = result.executionStats;
        console.log(`   • Documents examined: ${stats.totalDocsExamined}`);
        console.log(`   • Documents returned: ${stats.totalDocsReturned}`);
        console.log(`   • Execution time: ${stats.executionTimeMillis}ms`);
        console.log(`   • Index used: ${stats.executionStages?.indexName || 'NONE'}`);
        console.log('');
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error analyzing performance:', error);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'create':
    createAntiAbuseIndexes();
    break;
  case 'list':
    listExistingIndexes();
    break;
  case 'remove':
    removeAntiAbuseIndexes();
    break;
  case 'analyze':
    analyzeQueryPerformance();
    break;
  default:
    console.log('Usage: node database-indexes.js [create|list|remove|analyze]');
    console.log('');
    console.log('Commands:');
    console.log('  create  - Create all anti-abuse indexes');
    console.log('  list    - List all current indexes');
    console.log('  remove  - Remove anti-abuse indexes');
    console.log('  analyze - Analyze query performance');
    break;
}

module.exports = {
  createAntiAbuseIndexes,
  listExistingIndexes,
  removeAntiAbuseIndexes,
  analyzeQueryPerformance
};
