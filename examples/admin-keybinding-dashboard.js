import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Admin dashboard component for monitoring input violations
 * @param {Object} props - Component props
 * @param {string} props.adminToken - Admin authentication token
 * @returns {JSX.Element} React component
 */
const MonitoringDashboard = ({ adminToken }) => {
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [activeExams, setActiveExams] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [filter, setFilter] = useState('all'); // all, keybinding, keyboard, mouse, other
  
  // Connect to admin socket
  useEffect(() => {
    // Connect to the main socket server (not the dynamic ones for individual students)
    const socketInstance = io('/admin', {
      auth: {
        token: adminToken
      }
    });
    
    socketInstance.on('connect', () => {
      console.log('Connected to admin monitoring socket');
      setIsConnected(true);
      
      // Join admin-dashboard room to receive security alerts
      socketInstance.emit('join_room', 'admin-dashboard');
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Disconnected from admin monitoring socket');
      setIsConnected(false);
    });
    
    socketInstance.on('security_alert', (alert) => {
      console.log('Security alert received:', alert);
      
      // Add alert to the list with unique ID
      setSecurityAlerts(prev => [
        {
          ...alert,
          id: Date.now(),
          receivedAt: new Date()
        },
        ...prev
      ].slice(0, 100)); // Keep only the latest 100 alerts
    });
    
    socketInstance.on('active_exams_update', (exams) => {
      setActiveExams(exams);
    });
    
    setSocket(socketInstance);
    
    // Request initial active exams data
    fetchActiveExams();
    
    return () => {
      socketInstance.disconnect();
    };
  }, [adminToken]);
  
  // Fetch active exams
  const fetchActiveExams = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/active-exams', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveExams(data.exams || []);
      }
    } catch (error) {
      console.error('Failed to fetch active exams:', error);
    }
  }, [adminToken]);
  
  // Fetch security alerts for a specific exam
  const fetchExamAlerts = useCallback(async (examId) => {
    try {
      const response = await fetch(`/api/admin/exams/${examId}/security-alerts`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSecurityAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error(`Failed to fetch alerts for exam ${examId}:`, error);
    }
  }, [adminToken]);
  
  // Handle exam selection
  const handleExamSelect = (examId) => {
    setSelectedExam(examId);
    
    if (examId) {
      fetchExamAlerts(examId);
    } else {
      // Clear filters when viewing all exams
      setSecurityAlerts([]);
    }
  };
  
  // Filter alerts based on type
  const filteredAlerts = securityAlerts.filter(alert => {
    if (filter === 'all') return true;
    
    if (filter === 'keybinding') {
      return alert.event_type === 'KEYBOARD_ANOMALY' && 
             alert.keybindingViolations && 
             alert.keybindingViolations > 0;
    }
    
    if (filter === 'keyboard') {
      return alert.event_type === 'KEYBOARD_ANOMALY';
    }
    
    if (filter === 'mouse') {
      return alert.event_type === 'MOUSE_ANOMALY';
    }
    
    return alert.event_type !== 'KEYBOARD_ANOMALY' && alert.event_type !== 'MOUSE_ANOMALY';
  });
  
  // Get formatted time from date
  const formatTime = (date) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    return d.toLocaleTimeString();
  };
  
  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h2>Exam Security Monitoring Dashboard</h2>
        <div className="connection-status">
          Status: {isConnected ? 
            <span className="connected">Connected</span> : 
            <span className="disconnected">Disconnected</span>}
        </div>
      </div>
      
      <div className="dashboard-controls">
        <div className="exam-selector">
          <label htmlFor="exam-select">Select Exam:</label>
          <select 
            id="exam-select" 
            value={selectedExam || ''} 
            onChange={(e) => handleExamSelect(e.target.value || null)}
          >
            <option value="">All Active Exams</option>
            {activeExams.map(exam => (
              <option key={exam.examId} value={exam.examId}>
                {exam.title} ({exam.activeStudents} active)
              </option>
            ))}
          </select>
        </div>
        
        <div className="alert-filter">
          <label htmlFor="alert-filter">Filter Alerts:</label>
          <select 
            id="alert-filter" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Alerts</option>
            <option value="keybinding">Keybinding Violations</option>
            <option value="keyboard">All Keyboard Anomalies</option>
            <option value="mouse">Mouse Anomalies</option>
            <option value="other">Other Security Alerts</option>
          </select>
        </div>
        
        <button onClick={fetchActiveExams} className="refresh-button">
          Refresh Exams
        </button>
      </div>
      
      <div className="security-alerts">
        <h3>
          Security Alerts 
          {selectedExam ? ` for Exam ${activeExams.find(e => e.examId === selectedExam)?.title || selectedExam}` : ''}
          {filter !== 'all' ? ` (${filter} only)` : ''}
        </h3>
        
        {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            No security alerts to display
          </div>
        ) : (
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Exam</th>
                <th>Student</th>
                <th>Alert Type</th>
                <th>Risk Score</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(alert => (
                <tr key={alert.id} className={`risk-level-${getRiskLevel(alert.risk_score)}`}>
                  <td>{formatTime(alert.timestamp || alert.receivedAt)}</td>
                  <td>{alert.exam_id}</td>
                  <td>{alert.student_id}</td>
                  <td>{formatAlertType(alert.event_type)}</td>
                  <td>{alert.risk_score}</td>
                  <td>
                    {alert.event_type === 'KEYBOARD_ANOMALY' ? (
                      <div>
                        {alert.keybindingViolations > 0 ? (
                          <span className="violation-badge">
                            {alert.keybindingViolations} keybinding violation(s)
                          </span>
                        ) : 'Keyboard pattern anomaly'}
                      </div>
                    ) : alert.event_type === 'MOUSE_ANOMALY' ? (
                      <div>
                        <span className="anomaly-badge">
                          Mouse movement anomaly
                        </span>
                      </div>
                    ) : (
                      alert.details || '-'
                    )}
                  </td>
                  <td>
                    <button 
                      onClick={() => handleViewDetails(alert)}
                      className="view-details-button"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// Helper function to determine risk level
const getRiskLevel = (score) => {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

// Format alert type for display
const formatAlertType = (type) => {
  switch (type) {
    case 'KEYBOARD_ANOMALY':
      return 'Keyboard/Keybinding';
    case 'MOUSE_ANOMALY':
      return 'Mouse Movement';
    case 'TAB_SWITCH':
      return 'Tab Switch';
    case 'MULTIPLE_TABS':
      return 'Multiple Tabs';
    case 'DEVTOOLS_DETECTED':
      return 'Dev Tools';
    default:
      return type.replace(/_/g, ' ').toLowerCase();
  }
};

// Handle viewing alert details
const handleViewDetails = (alert) => {
  // Implement detailed view functionality here
  console.log('View details for alert:', alert);
  
  // This would typically open a modal or navigate to a details page
  // For this example, we just log to console
};

export default MonitoringDashboard;

/**
 * CSS Styles (add to your stylesheet):
 * 
 * .monitoring-dashboard {
 *   padding: 1rem;
 *   background-color: #f7f9fc;
 *   border-radius: 8px;
 *   box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
 * }
 * 
 * .dashboard-header {
 *   display: flex;
 *   justify-content: space-between;
 *   align-items: center;
 *   margin-bottom: 1.5rem;
 *   padding-bottom: 0.5rem;
 *   border-bottom: 1px solid #e0e0e0;
 * }
 * 
 * .connection-status {
 *   font-size: 0.9rem;
 * }
 * 
 * .connected {
 *   color: #2ecc71;
 *   font-weight: bold;
 * }
 * 
 * .disconnected {
 *   color: #e74c3c;
 *   font-weight: bold;
 * }
 * 
 * .dashboard-controls {
 *   display: flex;
 *   gap: 1rem;
 *   margin-bottom: 1.5rem;
 * }
 * 
 * .alerts-table {
 *   width: 100%;
 *   border-collapse: collapse;
 * }
 * 
 * .alerts-table th, .alerts-table td {
 *   padding: 0.75rem;
 *   border: 1px solid #e0e0e0;
 * }
 * 
 * .alerts-table th {
 *   background-color: #f1f3f5;
 *   text-align: left;
 * }
 * 
 * .risk-level-high {
 *   background-color: rgba(231, 76, 60, 0.1);
 * }
 * 
 * .risk-level-medium {
 *   background-color: rgba(241, 196, 15, 0.1);
 * }
 * 
 * .risk-level-low {
 *   background-color: rgba(46, 204, 113, 0.1);
 * }
 * 
 * .violation-badge {
 *   background-color: #e74c3c;
 *   color: white;
 *   padding: 0.25rem 0.5rem;
 *   border-radius: 4px;
 *   font-size: 0.8rem;
 *   font-weight: bold;
 * }
 * 
 * .view-details-button {
 *   background-color: #3498db;
 *   color: white;
 *   border: none;
 *   padding: 0.25rem 0.5rem;
 *   border-radius: 4px;
 *   cursor: pointer;
 * }
 * 
 * .no-alerts {
 *   padding: 2rem;
 *   text-align: center;
 *   color: #7f8c8d;
 * }
 */ 