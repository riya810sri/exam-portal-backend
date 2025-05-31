# Frontend Anti-Abuse System Integration Prompt

## 🎯 OBJECTIVE
Implement a comprehensive client-side anti-abuse detection system that integrates with our secure exam portal backend. The system must detect cheating attempts, monitor user behavior, and provide real-time security monitoring during online exams.

## 🏗️ BACKEND API ENDPOINTS AVAILABLE

### Base URL: `http://localhost:3000/api`

### 1. **Exam Attendance Anti-Abuse APIs**
```
POST /exam-attendance/:examId/start-monitoring
POST /exam-attendance/:examId/report-cheating  
POST /exam-attendance/:examId/submit-behavior-data
GET  /exam-attendance/:examId/security-status
POST /exam-attendance/:examId/validate-environment
```

### 2. **Admin Security Dashboard APIs** (for admin users)
```
GET  /admin/security/dashboard
GET  /admin/security/metrics
GET  /admin/security/threats
GET  /admin/security/sessions/:sessionId/analysis
POST /admin/security/sessions/:sessionId/suspend
GET  /admin/security/config/risk-thresholds
POST /admin/security/config/risk-thresholds
GET  /admin/security/alerts
POST /admin/security/alerts/:alertId/review
```

## 📋 REQUIRED IMPLEMENTATION

### 1. **Client-Side Detection Components**

#### A. **Tab Switch Detection**
```javascript
// Required functionality:
- Monitor document.visibilityState changes
- Track tab switch count and duration
- Report violations when threshold exceeded
- Show warnings to users
```

#### B. **Mouse & Keyboard Monitoring**
```javascript
// Required tracking:
- Mouse movements and click patterns
- Keystroke timing and rhythm analysis  
- Detect automation/bot-like behavior
- Monitor answer selection patterns
```

#### C. **Browser Environment Validation**
```javascript
// Required checks:
- Screen resolution and window size
- Timezone consistency
- Developer tools detection
- Multiple monitor detection
- Browser feature validation
```

#### D. **Real-time Behavior Analysis**
```javascript
// Required monitoring:
- Answer submission timing patterns
- Sequential answer detection (A-B-C-D patterns)
- Copy-paste detection
- Right-click and keyboard shortcut blocking
```

### 2. **React/Next.js Integration Requirements**

#### A. **Custom Hooks**
Create the following custom hooks:

1. **`useCheatingDetection(examId, token)`**
   - Initialize monitoring when exam starts
   - Handle all detection events
   - Manage communication with backend

2. **`useSecurityMonitor(examId)`**
   - Real-time security status updates
   - WebSocket connection for live alerts
   - Auto-suspend on critical violations

3. **`useAdminSecurity()` (for admin dashboard)**
   - Security dashboard data fetching
   - Session management functions
   - Alert and notification handling

#### B. **Components to Build**

1. **`<ExamSecurityWrapper>`**
   - Wraps the entire exam interface
   - Handles security initialization
   - Shows security warnings/alerts

2. **`<SecurityStatusIndicator>`**
   - Shows current security status
   - Displays violation count
   - Real-time risk level indicator

3. **`<AdminSecurityDashboard>`**
   - Security metrics overview
   - Active session monitoring
   - Threat detection interface

4. **`<ViolationWarningModal>`**
   - Shows cheating warnings to users
   - Escalating warning system
   - Final suspension notification

### 3. **API Integration Specifications**

#### A. **Authentication Headers**
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'X-Exam-Session': examId
}
```

#### B. **Required API Calls**

1. **Start Monitoring** (when exam begins)
```javascript
POST /exam-attendance/${examId}/start-monitoring
Body: {
  userAgent: navigator.userAgent,
  screenResolution: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  browserFingerprint: generateFingerprint()
}
```

2. **Report Cheating Incident**
```javascript
POST /exam-attendance/${examId}/report-cheating
Body: {
  evidenceType: "TAB_SWITCH" | "COPY_PASTE" | "SUSPICIOUS_TIMING" | "AUTOMATION_DETECTED" | "MULTIPLE_SESSIONS",
  details: {
    timestamp: Date.now(),
    description: "User switched tabs",
    metadata: { tabSwitchCount: 3, duration: 15000 }
  },
  source: "CLIENT"
}
```

3. **Submit Behavior Data** (continuous during exam)
```javascript
POST /exam-attendance/${examId}/submit-behavior-data
Body: {
  mouseMovements: [...],
  keystrokes: [...],
  answerTimings: [...],
  timestamp: Date.now()
}
```

### 4. **Security Features to Implement**

#### A. **Preventive Measures**
- Disable right-click context menu
- Block common keyboard shortcuts (Ctrl+C, Ctrl+V, F12, etc.)
- Prevent text selection
- Disable drag and drop
- Block print functionality

#### B. **Detection Features**
- Tab switching detection with escalating warnings
- Copy-paste attempt detection
- Developer tools opening detection
- Multiple browser/device detection
- Automated answer pattern detection

#### C. **User Experience**
- Progressive warning system (1st warning → 2nd warning → suspension)
- Clear security status indicator
- Countdown timers for violations
- Informative error messages

### 5. **State Management Structure**

```javascript
// Security state shape
{
  examSecurity: {
    isMonitoring: boolean,
    violations: [...],
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    warningCount: number,
    status: "ACTIVE" | "WARNED" | "SUSPENDED",
    lastViolation: timestamp,
    sessionId: string
  }
}
```

### 6. **WebSocket Integration (Optional but Recommended)**

Connect to: `ws://localhost:3000/security-monitor`

```javascript
// Messages to handle:
- VIOLATION_DETECTED
- RISK_LEVEL_CHANGED  
- SESSION_SUSPENDED
- ADMIN_ALERT
- SECURITY_UPDATE
```

## 🔧 TECHNICAL REQUIREMENTS

### Framework: React/Next.js (latest stable versions)
### State Management: Redux Toolkit or Zustand
### HTTP Client: Axios or native fetch
### WebSocket: native WebSocket or Socket.io-client
### Styling: Tailwind CSS or Material-UI
### TypeScript: Strongly recommended

## 🎨 UI/UX REQUIREMENTS

### 1. **Security Status Indicator**
- Green: All secure
- Yellow: Minor violations detected
- Red: High risk, approaching suspension
- Red with warning icon: Suspended

### 2. **Warning Modals**
- Professional, non-intimidating design
- Clear explanation of the violation
- Countdown timer for acknowledgment
- Progressive severity styling

### 3. **Admin Dashboard**
- Real-time metrics with charts
- Session monitoring table
- Alert notifications
- Bulk action capabilities

## 📱 RESPONSIVE DESIGN
- Mobile-first approach
- Tablet compatibility
- Desktop optimization
- Touch-friendly controls

## 🧪 TESTING REQUIREMENTS

### 1. **Unit Tests**
- All custom hooks
- Security detection functions
- API integration functions

### 2. **Integration Tests**
- Full exam workflow with security
- Admin dashboard functionality
- WebSocket connections

### 3. **Security Tests**
- Attempt to bypass protections
- Validate all detection mechanisms
- Test escalation scenarios

## 📋 DELIVERABLES

1. **Component Library**
   - All security-related React components
   - Custom hooks for anti-abuse functionality
   - TypeScript interfaces and types

2. **Integration Examples**
   - Complete exam page implementation
   - Admin dashboard implementation
   - Security configuration panel

3. **Documentation**
   - API integration guide
   - Component usage documentation
   - Security feature explanations

4. **Testing Suite**
   - Unit tests for all components
   - Integration test scenarios
   - Security testing guidelines

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1 (Critical - Week 1)
1. Basic tab switch detection
2. Core cheating reporting
3. Security status indicator
4. Warning modal system

### Phase 2 (Important - Week 2)
1. Mouse/keyboard monitoring
2. Admin dashboard basics
3. WebSocket integration
4. Advanced detection algorithms

### Phase 3 (Enhancement - Week 3)
1. Advanced behavior analysis
2. Automated response system
3. Reporting and analytics
4. Performance optimization

## 💡 EXAMPLE USAGE

```jsx
function ExamPage({ examId }) {
  const { token } = useAuth();
  const securityHook = useCheatingDetection(examId, token);
  
  return (
    <ExamSecurityWrapper examId={examId}>
      <SecurityStatusIndicator status={securityHook.status} />
      <ExamQuestions />
      {securityHook.showWarning && (
        <ViolationWarningModal 
          violation={securityHook.lastViolation}
          onAcknowledge={securityHook.acknowledgeWarning}
        />
      )}
    </ExamSecurityWrapper>
  );
}
```

## 🎯 SUCCESS CRITERIA

1. **Zero bypass rate** for implemented security measures
2. **< 100ms response time** for security events
3. **> 99% uptime** for security monitoring
4. **Real-time detection** of all defined violation types
5. **Seamless user experience** with minimal false positives

## 📞 BACKEND INTEGRATION SUPPORT

The backend team has provided:
- ✅ All API endpoints implemented and tested
- ✅ WebSocket server for real-time updates  
- ✅ Database optimization for performance
- ✅ Comprehensive documentation
- ✅ Example integration code

**Backend Status**: 🟢 Fully Operational
**Ready for Frontend Integration**: ✅ YES

---

**Start implementing the Phase 1 critical features first, then progressively add Phase 2 and Phase 3 enhancements. The backend is ready and waiting for your frontend integration!**
