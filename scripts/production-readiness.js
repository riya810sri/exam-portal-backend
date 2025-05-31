#!/usr/bin/env node
/**
 * Production Readiness Checker for Anti-Abuse System
 * Validates all components are production-ready
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue.bold('\n🏭 Production Readiness Check - Anti-Abuse System\n'));

async function checkProductionReadiness() {
  const checks = [];
  let criticalIssues = 0;
  let warnings = 0;

  try {
    // 1. Environment Configuration Check
    console.log(chalk.yellow.bold('🔧 Checking environment configuration...'));
    
    const requiredEnvVars = ['DB_URL', 'PORT', 'NODE_ENV'];
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
    
    if (missingEnvVars.length === 0) {
      checks.push({ category: 'Environment', item: 'Required Variables', status: 'PASS', level: 'CRITICAL' });
      console.log(chalk.green('✅ All required environment variables present'));
    } else {
      checks.push({ 
        category: 'Environment', 
        item: 'Required Variables', 
        status: 'FAIL', 
        level: 'CRITICAL',
        details: `Missing: ${missingEnvVars.join(', ')}`
      });
      console.log(chalk.red(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`));
      criticalIssues++;
    }

    // 2. Security Configuration Check
    console.log(chalk.yellow.bold('\n🛡️ Checking security configuration...'));
    
    const config = require('../config/config');
    
    // Check CORS configuration
    if (config.cors && config.cors.origin !== '*') {
      checks.push({ category: 'Security', item: 'CORS Configuration', status: 'PASS', level: 'CRITICAL' });
      console.log(chalk.green('✅ CORS properly configured'));
    } else {
      checks.push({ 
        category: 'Security', 
        item: 'CORS Configuration', 
        status: 'WARN', 
        level: 'WARNING',
        details: 'CORS allows all origins - review for production'
      });
      console.log(chalk.yellow('⚠️ CORS allows all origins - review for production'));
      warnings++;
    }

    // Check if helmet middleware is available
    try {
      require('helmet');
      checks.push({ category: 'Security', item: 'Helmet Middleware', status: 'PASS', level: 'CRITICAL' });
      console.log(chalk.green('✅ Helmet security middleware available'));
    } catch (error) {
      checks.push({ 
        category: 'Security', 
        item: 'Helmet Middleware', 
        status: 'FAIL', 
        level: 'CRITICAL',
        details: 'Helmet not installed'
      });
      console.log(chalk.red('❌ Helmet security middleware not available'));
      criticalIssues++;
    }

    // 3. Database Performance Check
    console.log(chalk.yellow.bold('\n📊 Checking database configuration...'));
    
    try {
      const mongoose = require('mongoose');
      
      // Check if we can connect
      await mongoose.connect(config.db.url, config.db.options);
      checks.push({ category: 'Database', item: 'Connection', status: 'PASS', level: 'CRITICAL' });
      console.log(chalk.green('✅ Database connection successful'));
      
      // Check for indexes (basic check)
      const ExamAttendance = require('../models/examAttendance.model');
      const indexes = await ExamAttendance.collection.getIndexes();
      
      if (Object.keys(indexes).length > 1) { // More than just _id index
        checks.push({ category: 'Database', item: 'Performance Indexes', status: 'PASS', level: 'IMPORTANT' });
        console.log(chalk.green(`✅ Database indexes present (${Object.keys(indexes).length} indexes)`));
      } else {
        checks.push({ 
          category: 'Database', 
          item: 'Performance Indexes', 
          status: 'WARN', 
          level: 'WARNING',
          details: 'Run npm run setup:db to create indexes'
        });
        console.log(chalk.yellow('⚠️ Database indexes missing - run npm run setup:db'));
        warnings++;
      }
      
      await mongoose.connection.close();
      
    } catch (error) {
      checks.push({ 
        category: 'Database', 
        item: 'Connection', 
        status: 'FAIL', 
        level: 'CRITICAL',
        details: error.message
      });
      console.log(chalk.red(`❌ Database connection failed: ${error.message}`));
      criticalIssues++;
    }

    // 4. Anti-Abuse Components Check
    console.log(chalk.yellow.bold('\n🚨 Checking anti-abuse components...'));
    
    const requiredComponents = [
      './utils/antiAbuseDetector',
      './utils/serverPatternDetection', 
      './utils/securityMonitor',
      './utils/cheatDetection',
      './middlewares/antiAbuse.middleware',
      './controllers/admin.antiAbuse.controller'
    ];

    let componentsLoaded = 0;
    for (const component of requiredComponents) {
      try {
        require(component);
        componentsLoaded++;
      } catch (error) {
        checks.push({ 
          category: 'Anti-Abuse', 
          item: component, 
          status: 'FAIL', 
          level: 'CRITICAL',
          details: error.message
        });
        console.log(chalk.red(`❌ Failed to load ${component}`));
        criticalIssues++;
      }
    }

    if (componentsLoaded === requiredComponents.length) {
      checks.push({ category: 'Anti-Abuse', item: 'Core Components', status: 'PASS', level: 'CRITICAL' });
      console.log(chalk.green(`✅ All ${componentsLoaded} anti-abuse components loaded`));
    }

    // 5. File Structure Check
    console.log(chalk.yellow.bold('\n📁 Checking file structure...'));
    
    const requiredDirs = ['controllers', 'models', 'routes', 'middlewares', 'utils', 'config'];
    const missingDirs = requiredDirs.filter(dir => !fs.existsSync(path.join(__dirname, '..', dir)));
    
    if (missingDirs.length === 0) {
      checks.push({ category: 'Structure', item: 'Required Directories', status: 'PASS', level: 'CRITICAL' });
      console.log(chalk.green('✅ All required directories present'));
    } else {
      checks.push({ 
        category: 'Structure', 
        item: 'Required Directories', 
        status: 'FAIL', 
        level: 'CRITICAL',
        details: `Missing: ${missingDirs.join(', ')}`
      });
      console.log(chalk.red(`❌ Missing directories: ${missingDirs.join(', ')}`));
      criticalIssues++;
    }

    // 6. Documentation Check
    console.log(chalk.yellow.bold('\n📚 Checking documentation...'));
    
    const docsPath = path.join(__dirname, '..', 'docs', 'ANTI_ABUSE_SYSTEM.md');
    if (fs.existsSync(docsPath)) {
      checks.push({ category: 'Documentation', item: 'System Documentation', status: 'PASS', level: 'IMPORTANT' });
      console.log(chalk.green('✅ System documentation available'));
    } else {
      checks.push({ 
        category: 'Documentation', 
        item: 'System Documentation', 
        status: 'WARN', 
        level: 'WARNING',
        details: 'System documentation missing'
      });
      console.log(chalk.yellow('⚠️ System documentation missing'));
      warnings++;
    }

  } catch (error) {
    console.log(chalk.red(`❌ Critical error during checks: ${error.message}`));
    criticalIssues++;
  }

  // Generate Report
  console.log(chalk.blue.bold('\n📋 Production Readiness Report:'));
  console.log('═'.repeat(80));

  // Group by category
  const categories = ['Environment', 'Security', 'Database', 'Anti-Abuse', 'Structure', 'Documentation'];
  
  categories.forEach(category => {
    const categoryChecks = checks.filter(check => check.category === category);
    if (categoryChecks.length > 0) {
      console.log(chalk.cyan.bold(`\n${category}:`));
      categoryChecks.forEach(check => {
        const statusColor = check.status === 'PASS' ? 'green' : 
                           check.status === 'WARN' ? 'yellow' : 'red';
        const levelIcon = check.level === 'CRITICAL' ? '🔴' : 
                         check.level === 'IMPORTANT' ? '🟡' : '🔵';
        
        console.log(`  ${levelIcon} ${chalk[statusColor](check.status.padEnd(4))} ${check.item}`);
        if (check.details) {
          console.log(`      ${chalk.gray(check.details)}`);
        }
      });
    }
  });

  console.log('\n' + '═'.repeat(80));
  
  // Summary
  const totalChecks = checks.length;
  const passedChecks = checks.filter(c => c.status === 'PASS').length;
  const warnChecks = checks.filter(c => c.status === 'WARN').length;
  const failedChecks = checks.filter(c => c.status === 'FAIL').length;

  console.log(`Total Checks: ${totalChecks}`);
  console.log(`${chalk.green('Passed:')} ${passedChecks}`);
  console.log(`${chalk.yellow('Warnings:')} ${warnChecks}`);
  console.log(`${chalk.red('Failed:')} ${failedChecks}`);

  // Final Assessment
  if (criticalIssues === 0 && warnings <= 2) {
    console.log(chalk.green.bold('\n🎉 READY FOR PRODUCTION!'));
    console.log(chalk.green('✅ All critical checks passed'));
    if (warnings > 0) {
      console.log(chalk.yellow(`⚠️ ${warnings} warning(s) - review recommended`));
    }
  } else if (criticalIssues === 0) {
    console.log(chalk.yellow.bold('\n⚠️ PRODUCTION READY WITH WARNINGS'));
    console.log(chalk.yellow(`${warnings} warning(s) detected - review recommended`));
  } else {
    console.log(chalk.red.bold('\n❌ NOT READY FOR PRODUCTION'));
    console.log(chalk.red(`${criticalIssues} critical issue(s) must be resolved`));
    process.exit(1);
  }

  console.log(chalk.blue('\n📖 For detailed setup guide: docs/ANTI_ABUSE_SYSTEM.md'));
  console.log(chalk.blue('🔧 For deployment info: docs/DEPLOYMENT_STATUS.md\n'));
}

checkProductionReadiness().catch(error => {
  console.error(chalk.red.bold('\n💥 Production readiness check failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});
