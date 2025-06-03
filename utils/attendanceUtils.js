/**
 * Utility functions for exam attendance management
 */

const ExamAttendance = require('../models/examAttendance.model');
const mongoose = require('mongoose');

/**
 * Get user-friendly status display
 * @param {string} status - The exam attendance status
 * @returns {string} User-friendly status display
 */
function getStatusDisplay(status) {
  switch(status) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'COMPLETED': return 'Completed';
    case 'TIMED_OUT': return 'Timed Out';
    default: return status;
  }
}

/**
 * Clean up stale exam attendance records
 * @param {number} hoursThreshold - Hours threshold for considering a record stale (default: 6)
 * @returns {Promise<number>} Number of records updated
 */
async function cleanupStaleAttendances(hoursThreshold = 6) {
  try {
    const hoursAgo = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    
    const updateResult = await ExamAttendance.updateMany(
      { 
        status: 'IN_PROGRESS', 
        startTime: { $lt: hoursAgo }
      },
      { 
        status: 'TIMED_OUT', 
        endTime: new Date() 
      }
    );
    
    return updateResult.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up stale attendances:', error);
    return 0;
  }
}

/**
 * Handle abandoned exams at the end of the day
 * This function is designed to be run daily at midnight IST
 * It will mark all in-progress exams that haven't been updated in the last 3 hours as TIMED_OUT
 * @returns {Promise<{updated: number, errors: number}>} Number of records updated and errors
 */
async function handleAbandonedExams() {
  try {
    console.log('Running daily abandoned exam cleanup...');
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    // Find all in-progress exams that haven't been updated in the last 3 hours
    const abandonedExams = await ExamAttendance.find({
      status: 'IN_PROGRESS',
      lastUpdated: { $lt: threeHoursAgo }
    });
    
    console.log(`Found ${abandonedExams.length} abandoned exams to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process each abandoned exam
    for (const exam of abandonedExams) {
      try {
        exam.status = 'TIMED_OUT';
        exam.endTime = new Date();
        await exam.save();
        updatedCount++;
        
        console.log(`Marked exam ${exam._id} as TIMED_OUT (User: ${exam.userId}, Exam: ${exam.examId})`);
      } catch (error) {
        console.error(`Error updating abandoned exam ${exam._id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Abandoned exam cleanup complete. Updated: ${updatedCount}, Errors: ${errorCount}`);
    return { updated: updatedCount, errors: errorCount };
  } catch (error) {
    console.error('Error handling abandoned exams:', error);
    return { updated: 0, errors: 1 };
  }
}

/**
 * Fix inconsistent attempt numbers for a user-exam combination
 * @param {string} userId - User ID
 * @param {string} examId - Exam ID
 * @returns {Promise<number>} Number of records fixed
 */
async function fixAttemptNumbers(userId, examId) {
  try {
    // Get all records for this user and exam, sorted by start time
    const records = await ExamAttendance.find({
      userId: new mongoose.Types.ObjectId(userId),
      examId: new mongoose.Types.ObjectId(examId)
    }).sort({ startTime: 1 });
    
    // If no records found, return 0
    if (!records || records.length === 0) {
      return 0;
    }
    
    // Assign sequential attempt numbers
    for (let i = 0; i < records.length; i++) {
      records[i].attemptNumber = i + 1;
      await records[i].save();
    }
    
    return records.length;
  } catch (error) {
    console.error('Error fixing attempt numbers:', error);
    return 0;
  }
}

/**
 * Get the correct attempt number for a new attempt
 * @param {string} userId - User ID
 * @param {string} examId - Exam ID
 * @returns {Promise<number>} Next attempt number
 */
async function getNextAttemptNumber(userId, examId) {
  try {
    // Get count of all attempts (completed, timed out, and in-progress)
    const completedCount = await ExamAttendance.countDocuments({
      userId,
      examId,
      status: { $in: ['COMPLETED', 'TIMED_OUT'] }
    });
    
    const inProgressCount = await ExamAttendance.countDocuments({
      userId,
      examId,
      status: 'IN_PROGRESS'
    });
    
    // Next attempt number is the total of completed/timed out attempts plus any in-progress
    return completedCount + (inProgressCount > 0 ? 1 : 0) + 1;
  } catch (error) {
    console.error('Error getting next attempt number:', error);
    return 1; // Default to 1 on error
  }
}

/**
 * Get detailed status information for an exam attempt
 * @param {Object} attendance - The exam attendance record
 * @param {Object} userExamData - Memory cache of user exam data (optional)
 * @returns {Object} Detailed status information
 */
function getDetailedStatus(attendance, userExamData = null) {
  if (!attendance) {
    return {
      status: null,
      statusDisplay: 'Not Started',
      inProgress: false,
      attemptNumber: 0,
      completed: false,
      timedOut: false
    };
  }
  
  // Ensure status is properly formatted (enforce case-sensitivity)
  const statusValue = attendance.status || 'IN_PROGRESS';
  
  // Debug logging for troubleshooting
  console.log(`Detailed status for attendance ${attendance._id}: status=${statusValue}`);
  
  // Get answered count from memory if available
  let answeredCount = 0;
  if (userExamData && 
      userExamData[attendance.userId.toString()] && 
      userExamData[attendance.userId.toString()][attendance.examId.toString()]) {
    answeredCount = Object.keys(
      userExamData[attendance.userId.toString()][attendance.examId.toString()].userAnswers
    ).length;
  }
  
  // A more reliable way to check if the exam is in progress
  const isInProgress = statusValue === 'IN_PROGRESS' || 
                      (!attendance.endTime && statusValue !== 'COMPLETED' && statusValue !== 'TIMED_OUT');
  
  // Ensure we always have a valid status value
  const finalStatus = isInProgress ? 'IN_PROGRESS' : statusValue;
  
  return {
    status: finalStatus,
    statusDisplay: getStatusDisplay(finalStatus),
    score: isInProgress ? null : attendance.score,
    totalQuestions: attendance.totalQuestions,
    attemptedQuestions: isInProgress ? answeredCount : attendance.attemptedQuestions,
    startTime: attendance.startTime,
    endTime: attendance.endTime,
    attemptNumber: attendance.attemptNumber || 1,
    inProgress: isInProgress,
    completed: finalStatus === 'COMPLETED',
    timedOut: finalStatus === 'TIMED_OUT'
  };
}

module.exports = {
  getStatusDisplay,
  cleanupStaleAttendances,
  fixAttemptNumbers,
  getNextAttemptNumber,
  getDetailedStatus,
  handleAbandonedExams
};
