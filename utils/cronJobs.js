/**
 * Cron Jobs Configuration
 * This file sets up all scheduled tasks for the application
 */

const cron = require('node-cron');
const attendanceUtils = require('./attendanceUtils');

/**
 * Initialize all cron jobs
 */
function initCronJobs() {
  console.log('Initializing cron jobs...');
  
  // Daily abandoned exam cleanup at midnight IST (6:30 PM UTC)
  // Cron format: second(optional) minute hour day-of-month month day-of-week
  cron.schedule('0 30 18 * * *', async () => {
    console.log('Running daily abandoned exam cleanup cron job...');
    try {
      const result = await attendanceUtils.handleAbandonedExams();
      console.log(`Abandoned exam cleanup completed: ${result.updated} exams updated, ${result.errors} errors`);
    } catch (error) {
      console.error('Error in abandoned exam cleanup cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // IST timezone
  });
  
  // Hourly stale attendance cleanup
  cron.schedule('0 0 * * * *', async () => {
    console.log('Running hourly stale attendance cleanup...');
    try {
      const updatedCount = await attendanceUtils.cleanupStaleAttendances(6); // 6 hours threshold
      if (updatedCount > 0) {
        console.log(`Cleaned up ${updatedCount} stale exam attendances`);
      }
    } catch (error) {
      console.error('Error in stale attendance cleanup cron job:', error);
    }
  });
  
  console.log('Cron jobs initialized successfully');
}

module.exports = {
  initCronJobs
}; 