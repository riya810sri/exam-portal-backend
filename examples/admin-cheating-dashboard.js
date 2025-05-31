/**
 * Admin Dashboard component for reviewing cheating reports
 * 
 * This file demonstrates how to integrate the cheating detection
 * functionality in the admin panel of a React/Next.js frontend application.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Custom hook for accessing and managing cheating reports
 * @param {string} token - Admin's authentication token
 * @returns {Object} - Methods and state for cheating reports
 */
export function useCheatingReports(token) {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  
  // Configure axios client with authentication
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  /**
   * Fetch cheating reports for a specific exam
   * @param {string} examId - The ID of the exam to get reports for
   */
  const fetchReports = async (examId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/exam-attendance/admin/${examId}/cheating-reports`);
      setReports(response.data.reports || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch cheating reports');
      console.error('Error fetching cheating reports:', err);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Mark a report as reviewed
   * This would require an additional API endpoint to be implemented
   * @param {string} attendanceId - The ID of the attendance record
   * @param {boolean} flagged - Whether to keep it flagged or not
   */
  const markAsReviewed = async (attendanceId, flagged = false) => {
    try {
      // This endpoint would need to be implemented
      await apiClient.post(`/exam-attendance/admin/mark-reviewed`, {
        attendanceId,
        flaggedForReview: flagged
      });
      
      // Update local state
      setReports(prevReports => 
        prevReports.map(report => 
          report.attendanceId === attendanceId 
            ? { ...report, flaggedForReview: flagged } 
            : report
        )
      );
      
      return true;
    } catch (err) {
      console.error('Error marking report as reviewed:', err);
      return false;
    }
  };
  
  return {
    reports,
    loading,
    error,
    fetchReports,
    markAsReviewed
  };
}

/**
 * Helper to format a date for display
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

/**
 * Helper to get a readable label for evidence type
 */
const getEvidenceTypeLabel = (type) => {
  const labels = {
    'TAB_SWITCH': 'Tab Switching',
    'COPY_PASTE': 'Copy/Paste Attempt',
    'MULTIPLE_WINDOWS': 'Multiple Windows',
    'PROHIBITED_KEYS': 'Prohibited Keys',
    'FACE_DETECTION': 'Face Detection Alert',
    'SERVER_DETECTED': 'Server-side Detection',
    'OTHER': 'Other Suspicious Activity'
  };
  
  return labels[type] || type;
};

/**
 * Evidence detail component that adapts to different evidence types
 */
const EvidenceDetail = ({ evidence }) => {
  switch (evidence.evidenceType) {
    case 'TAB_SWITCH':
      return (
        <div className="evidence-detail tab-switch">
          <p><strong>Action:</strong> {evidence.details.action}</p>
          {evidence.details.hiddenDuration && (
            <p><strong>Time Away:</strong> {Math.round(evidence.details.hiddenDuration / 1000)} seconds</p>
          )}
          <p><strong>Tab Switch Count:</strong> {evidence.details.tabSwitchCount}</p>
        </div>
      );
      
    case 'COPY_PASTE':
      return (
        <div className="evidence-detail copy-paste">
          <p><strong>Action:</strong> {evidence.details.action}</p>
          <p><strong>Target:</strong> {evidence.details.targetElement}</p>
          {evidence.details.selection && (
            <p><strong>Selected Text:</strong> "{evidence.details.selection}..."</p>
          )}
        </div>
      );
      
    case 'PROHIBITED_KEYS':
      return (
        <div className="evidence-detail prohibited-keys">
          <p><strong>Action:</strong> {evidence.details.action}</p>
          <p><strong>Key Combination:</strong> {evidence.details.modifier ? `${evidence.details.modifier}+` : ''}{evidence.details.key}</p>
        </div>
      );
      
    default:
      return (
        <div className="evidence-detail json">
          <pre>{JSON.stringify(evidence.details, null, 2)}</pre>
        </div>
      );
  }
};

/**
 * Example Admin Dashboard Component for Cheating Reports
 */
export default function CheatingReportsDashboard({ adminToken }) {
  const [selectedExam, setSelectedExam] = useState('');
  const [exams, setExams] = useState([]);
  const [expandedReports, setExpandedReports] = useState({});
  
  const {
    reports,
    loading,
    error,
    fetchReports,
    markAsReviewed
  } = useCheatingReports(adminToken);
  
  // Fetch available exams when component mounts
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/exams`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        const data = await response.json();
        setExams(data.exams || []);
      } catch (err) {
        console.error('Error fetching exams:', err);
      }
    };
    
    fetchExams();
  }, [adminToken]);
  
  // Handle exam selection change
  const handleExamChange = (e) => {
    const examId = e.target.value;
    setSelectedExam(examId);
    
    if (examId) {
      fetchReports(examId);
    } else {
      setReports([]);
    }
  };
  
  // Toggle expanded state for a report
  const toggleReportExpanded = (attendanceId) => {
    setExpandedReports(prev => ({
      ...prev,
      [attendanceId]: !prev[attendanceId]
    }));
  };
  
  // Handle marking a report as reviewed
  const handleMarkReviewed = async (attendanceId, flagged) => {
    const success = await markAsReviewed(attendanceId, flagged);
    
    if (success) {
      alert(`Report ${flagged ? 'kept flagged' : 'marked as reviewed'} successfully.`);
    } else {
      alert('Failed to update report status.');
    }
  };
  
  return (
    <div className="admin-dashboard cheating-reports-container">
      <h1>Exam Cheating Reports</h1>
      
      <div className="filter-section">
        <label htmlFor="exam-select">Select Exam:</label>
        <select 
          id="exam-select" 
          value={selectedExam} 
          onChange={handleExamChange}
        >
          <option value="">-- Select an exam --</option>
          {exams.map(exam => (
            <option key={exam._id} value={exam._id}>
              {exam.title}
            </option>
          ))}
        </select>
      </div>
      
      {loading && <div className="loading">Loading reports...</div>}
      
      {error && <div className="error-message">{error}</div>}
      
      {!loading && reports.length === 0 && selectedExam && (
        <div className="no-reports">
          No cheating reports found for this exam.
        </div>
      )}
      
      {reports.length > 0 && (
        <div className="reports-list">
          <div className="reports-summary">
            Found {reports.length} report(s) with cheating evidence.
          </div>
          
          {reports.map(report => (
            <div 
              key={report.attendanceId}
              className={`report-card ${report.flaggedForReview ? 'flagged' : ''}`}
            >
              <div className="report-header" onClick={() => toggleReportExpanded(report.attendanceId)}>
                <div className="student-info">
                  <h3>{report.user.name}</h3>
                  <p className="email">{report.user.email}</p>
                </div>
                
                <div className="report-summary">
                  <span className="attempt">Attempt #{report.attemptNumber}</span>
                  <span className="status">{report.status}</span>
                  <span className="evidence-count">
                    {report.evidenceCount} {report.evidenceCount === 1 ? 'incident' : 'incidents'}
                  </span>
                  {report.flaggedForReview && (
                    <span className="flag">⚠️ Flagged for Review</span>
                  )}
                </div>
                
                <div className="expand-toggle">
                  {expandedReports[report.attendanceId] ? '▼' : '►'}
                </div>
              </div>
              
              {expandedReports[report.attendanceId] && (
                <div className="report-details">
                  <div className="time-info">
                    <p><strong>Start Time:</strong> {formatDate(report.startTime)}</p>
                    <p><strong>End Time:</strong> {formatDate(report.endTime)}</p>
                  </div>
                  
                  <h4>Evidence ({report.evidenceCount})</h4>
                  
                  <div className="evidence-list">
                    {report.evidence.map(evidence => (
                      <div key={evidence.id} className="evidence-item">
                        <div className="evidence-header">
                          <span className="evidence-type">
                            {getEvidenceTypeLabel(evidence.evidenceType)}
                          </span>
                          <span className="evidence-time">
                            {formatDate(evidence.timestamp)}
                          </span>
                          <span className="evidence-source">
                            Source: {evidence.source}
                          </span>
                        </div>
                        
                        <EvidenceDetail evidence={evidence} />
                      </div>
                    ))}
                  </div>
                  
                  <div className="report-actions">
                    <button 
                      className="review-button"
                      onClick={() => handleMarkReviewed(report.attendanceId, false)}
                    >
                      Mark as Reviewed
                    </button>
                    
                    <button 
                      className={`flag-button ${report.flaggedForReview ? 'active' : ''}`}
                      onClick={() => handleMarkReviewed(report.attendanceId, !report.flaggedForReview)}
                    >
                      {report.flaggedForReview ? 'Remove Flag' : 'Flag for Review'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
