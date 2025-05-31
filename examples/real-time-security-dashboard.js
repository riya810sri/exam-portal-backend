/**
 * Real-time Security Dashboard Component for React
 * Provides comprehensive security monitoring interface for administrators
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// =============================================================================
// 1. REAL-TIME DATA HOOK
// =============================================================================

const useRealTimeSecurityData = (apiBaseUrl, authToken) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef(null);

  const apiClient = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await apiClient.get('/admin/security/dashboard');
      setDashboardData(response.data.dashboard);
      setLastUpdate(new Date());
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setIsConnected(false);
    }
  };

  // Setup real-time updates
  useEffect(() => {
    fetchDashboardData(); // Initial fetch
    
    // Setup polling every 5 seconds
    intervalRef.current = setInterval(fetchDashboardData, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    dashboardData,
    isConnected,
    lastUpdate,
    refreshData: fetchDashboardData
  };
};

// =============================================================================
// 2. SECURITY METRICS COMPONENTS
// =============================================================================

const SecurityMetricsCard = ({ title, value, trend, color = 'blue', icon }) => (
  <div className={`security-metric-card ${color}`}>
    <div className="metric-header">
      <span className="metric-icon">{icon}</span>
      <span className="metric-title">{title}</span>
    </div>
    <div className="metric-value">{value}</div>
    {trend && (
      <div className={`metric-trend ${trend > 0 ? 'up' : 'down'}`}>
        {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
      </div>
    )}
  </div>
);

const ActiveSessionsGrid = ({ sessions = [] }) => (
  <div className="active-sessions-grid">
    <h3>🔴 Active High-Risk Sessions</h3>
    <div className="sessions-container">
      {sessions.length === 0 ? (
        <div className="no-sessions">No high-risk sessions detected</div>
      ) : (
        sessions.map(session => (
          <div key={session._id} className={`session-card risk-${session.riskLevel}`}>
            <div className="session-header">
              <span className="session-user">{session.user?.firstName} {session.user?.lastName}</span>
              <span className={`risk-badge risk-${session.riskLevel}`}>
                {session.riskScore}/100
              </span>
            </div>
            <div className="session-details">
              <div>📚 {session.exam?.title}</div>
              <div>⏱️ {new Date(session.startTime).toLocaleTimeString()}</div>
              <div>🚨 {session.violations?.length || 0} violations</div>
            </div>
            <div className="session-actions">
              <button className="btn-view" onClick={() => window.open(`/admin/sessions/${session._id}`)}>
                View Details
              </button>
              <button className="btn-suspend" onClick={() => suspendSession(session._id)}>
                Suspend
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const RecentAlertsPanel = ({ alerts = [] }) => (
  <div className="recent-alerts-panel">
    <h3>🚨 Recent Security Alerts</h3>
    <div className="alerts-container">
      {alerts.length === 0 ? (
        <div className="no-alerts">No recent alerts</div>
      ) : (
        alerts.map(alert => (
          <div key={alert._id} className={`alert-item severity-${alert.severity}`}>
            <div className="alert-header">
              <span className="alert-type">{alert.type}</span>
              <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="alert-message">{alert.message}</div>
            <div className="alert-meta">
              Session: {alert.sessionId} | User: {alert.userName}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const ThreatMapComponent = ({ threats = [] }) => {
  const threatTypes = threats.reduce((acc, threat) => {
    acc[threat.type] = (acc[threat.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="threat-map">
      <h3>🌍 Threat Distribution</h3>
      <div className="threat-types">
        {Object.entries(threatTypes).map(([type, count]) => (
          <div key={type} className="threat-type-item">
            <div className="threat-type-label">{type.replace('_', ' ')}</div>
            <div className="threat-type-count">{count}</div>
            <div className="threat-type-bar">
              <div 
                className="threat-type-fill" 
                style={{ width: `${(count / Math.max(...Object.values(threatTypes))) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// 3. MAIN SECURITY DASHBOARD COMPONENT
// =============================================================================

const RealTimeSecurityDashboard = ({ apiBaseUrl, authToken }) => {
  const { dashboardData, isConnected, lastUpdate, refreshData } = useRealTimeSecurityData(apiBaseUrl, authToken);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Handle session suspension
  const suspendSession = async (sessionId) => {
    if (!confirm('Are you sure you want to suspend this session?')) return;
    
    try {
      await axios.post(`${apiBaseUrl}/admin/security/sessions/${sessionId}/suspend`, {
        reason: 'Manual suspension from security dashboard'
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      refreshData(); // Refresh data after action
      alert('Session suspended successfully');
    } catch (error) {
      console.error('Failed to suspend session:', error);
      alert('Failed to suspend session');
    }
  };

  if (!dashboardData) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading security dashboard...</p>
      </div>
    );
  }

  return (
    <div className="real-time-security-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>🛡️ Security Dashboard</h1>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'} {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="header-right">
          <div className="last-update">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <button onClick={refreshData} className="refresh-btn">
            🔄 Refresh
          </button>
          <label className="auto-refresh-toggle">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="metrics-row">
        <SecurityMetricsCard
          title="Active Sessions"
          value={dashboardData.activeSessions || 0}
          icon="👥"
          color="blue"
        />
        <SecurityMetricsCard
          title="High-Risk Sessions"
          value={dashboardData.highRiskSessions || 0}
          trend={dashboardData.highRiskTrend}
          icon="⚠️"
          color="orange"
        />
        <SecurityMetricsCard
          title="Suspended Sessions"
          value={dashboardData.suspendedSessions || 0}
          icon="⛔"
          color="red"
        />
        <SecurityMetricsCard
          title="Detection Rate"
          value={`${dashboardData.detectionRate || 0}%`}
          trend={dashboardData.detectionTrend}
          icon="🎯"
          color="green"
        />
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-content">
        <div className="left-panel">
          <ActiveSessionsGrid 
            sessions={dashboardData.highRiskSessions || []}
          />
          
          <ThreatMapComponent 
            threats={dashboardData.threats || []}
          />
        </div>

        <div className="right-panel">
          <RecentAlertsPanel 
            alerts={dashboardData.recentAlerts || []}
          />

          {/* System Health */}
          <div className="system-health">
            <h3>📊 System Health</h3>
            <div className="health-metrics">
              <div className="health-item">
                <span>Detection Engine</span>
                <span className={`status ${dashboardData.systemHealth?.detectionEngine ? 'healthy' : 'error'}`}>
                  {dashboardData.systemHealth?.detectionEngine ? '✅ Healthy' : '❌ Error'}
                </span>
              </div>
              <div className="health-item">
                <span>Monitoring Service</span>
                <span className={`status ${dashboardData.systemHealth?.monitoring ? 'healthy' : 'error'}`}>
                  {dashboardData.systemHealth?.monitoring ? '✅ Healthy' : '❌ Error'}
                </span>
              </div>
              <div className="health-item">
                <span>Alert System</span>
                <span className={`status ${dashboardData.systemHealth?.alerts ? 'healthy' : 'error'}`}>
                  {dashboardData.systemHealth?.alerts ? '✅ Healthy' : '❌ Error'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h3>⚡ Quick Actions</h3>
            <div className="action-buttons">
              <button onClick={() => window.open('/admin/security/config')}>
                ⚙️ Configure Thresholds
              </button>
              <button onClick={() => window.open('/admin/security/reports')}>
                📊 Generate Report
              </button>
              <button onClick={() => window.open('/admin/security/alerts')}>
                🚨 View All Alerts
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 4. CSS STYLES FOR SECURITY DASHBOARD
// =============================================================================

export const securityDashboardStyles = `
.real-time-security-dashboard {
  padding: 20px;
  background: #f8f9fa;
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.header-left h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 28px;
}

.connection-status {
  font-size: 14px;
  margin-top: 5px;
}

.connection-status.connected {
  color: #28a745;
}

.connection-status.disconnected {
  color: #dc3545;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.refresh-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.security-metric-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #007bff;
}

.security-metric-card.orange {
  border-left-color: #fd7e14;
}

.security-metric-card.red {
  border-left-color: #dc3545;
}

.security-metric-card.green {
  border-left-color: #28a745;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.metric-icon {
  font-size: 20px;
}

.metric-title {
  font-weight: 600;
  color: #495057;
}

.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #2c3e50;
}

.metric-trend {
  font-size: 14px;
  margin-top: 5px;
}

.metric-trend.up {
  color: #dc3545;
}

.metric-trend.down {
  color: #28a745;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.active-sessions-grid,
.recent-alerts-panel,
.threat-map,
.system-health,
.quick-actions {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.sessions-container {
  display: grid;
  gap: 15px;
  max-height: 400px;
  overflow-y: auto;
}

.session-card {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 15px;
  background: #f8f9fa;
}

.session-card.risk-high {
  border-left: 4px solid #dc3545;
  background: #fff5f5;
}

.session-card.risk-critical {
  border-left: 4px solid #6f42c1;
  background: #f8f5ff;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.session-user {
  font-weight: 600;
  color: #2c3e50;
}

.risk-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: white;
}

.risk-badge.risk-high {
  background: #dc3545;
}

.risk-badge.risk-critical {
  background: #6f42c1;
}

.session-details {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 10px;
}

.session-details > div {
  margin-bottom: 3px;
}

.session-actions {
  display: flex;
  gap: 10px;
}

.btn-view,
.btn-suspend {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-view {
  background: #007bff;
  color: white;
}

.btn-suspend {
  background: #dc3545;
  color: white;
}

.alerts-container {
  max-height: 300px;
  overflow-y: auto;
}

.alert-item {
  border-left: 4px solid #ffc107;
  padding: 12px;
  margin-bottom: 10px;
  background: #fff;
  border-radius: 4px;
}

.alert-item.severity-HIGH {
  border-left-color: #dc3545;
}

.alert-item.severity-CRITICAL {
  border-left-color: #6f42c1;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 5px;
}

.alert-message {
  margin-bottom: 5px;
}

.alert-meta {
  font-size: 12px;
  color: #6c757d;
}

.threat-types {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.threat-type-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.threat-type-bar {
  background: #e9ecef;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}

.threat-type-fill {
  background: #007bff;
  height: 100%;
  transition: width 0.3s ease;
}

.health-metrics,
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.health-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.status.healthy {
  color: #28a745;
}

.status.error {
  color: #dc3545;
}

.action-buttons button {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}

.action-buttons button:hover {
  background: #5a6268;
}

.dashboard-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-sessions,
.no-alerts {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 20px;
}

.auto-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
}
`;

export default RealTimeSecurityDashboard;
