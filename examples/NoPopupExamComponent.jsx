import React, { useState, useEffect } from 'react';

/**
 * Example Exam Component WITHOUT Fullscreen Popup
 * This shows the CORRECT implementation with automatic fullscreen
 */
const NoPopupExamComponent = ({ examId, studentId }) => {
  const [examStarted, setExamStarted] = useState(false);
  const [securityActive, setSecurityActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Automatic fullscreen function - no popup required
  const initializeSecureExam = async () => {
    setLoading(true);
    
    try {
      // 1. Connect to security monitoring
      const response = await fetch(`/api/exam-attendance/${examId}/monitoring-scripts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 2. Execute security scripts (this enables automatic fullscreen)
        if (data.scripts.fullscreenManager) {
          executeSecurityScript(data.scripts.fullscreenManager);
        }
        
        if (data.scripts.keyboardMonitoring) {
          executeSecurityScript(data.scripts.keyboardMonitoring);
        }
        
        if (data.scripts.mouseMonitoring) {
          executeSecurityScript(data.scripts.mouseMonitoring);
        }
        
        // 3. Set exam as active (enables automatic fullscreen behavior)
        window.examInProgress = true;
        
        // 4. Automatically enter fullscreen (NO USER POPUP REQUIRED)
        setTimeout(() => {
          if (window.enterExamFullscreen) {
            window.enterExamFullscreen();
            console.log('✅ Automatic fullscreen activated');
          }
        }, 500);
        
        setSecurityActive(true);
        setExamStarted(true);
        
      } else {
        throw new Error('Failed to initialize security monitoring');
      }
      
    } catch (error) {
      console.error('Failed to start secure exam:', error);
      alert('Failed to initialize secure exam environment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const executeSecurityScript = (scriptContent) => {
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);
  };

  const handleExamEnd = () => {
    // Exit fullscreen when exam ends
    window.examInProgress = false;
    if (window.exitExamFullscreen) {
      window.exitExamFullscreen();
    }
    setExamStarted(false);
    setSecurityActive(false);
  };

  return (
    <div className="exam-container">
      {/* Security Status Indicator */}
      <div className="security-status" style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        backgroundColor: securityActive ? '#4CAF50' : '#f44336',
        color: 'white',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 9999
      }}>
        {securityActive ? '🔒 Secure Mode Active' : '⚠️ Not Monitoring'}
      </div>

      {!examStarted ? (
        <div className="exam-start-screen" style={{ 
          padding: '50px', 
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h2>🔒 Secure Exam Environment</h2>
          
          <div className="security-notice" style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <p><strong>⚠️ Security Notice:</strong></p>
            <ul>
              <li>✅ The exam will automatically enter fullscreen mode</li>
              <li>✅ All activities are monitored during the exam</li>
              <li>✅ Tab switching and copy/paste are disabled</li>
              <li>✅ Right-click and developer tools are blocked</li>
              <li>✅ No manual steps required from you</li>
            </ul>
          </div>
          
          {/* SINGLE BUTTON - NO POPUP, NO MANUAL INSTRUCTIONS */}
          <button 
            onClick={initializeSecureExam}
            disabled={loading}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: loading ? '#ccc' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? '🔄 Initializing Secure Environment...' : '🚀 Start Secure Exam'}
          </button>
          
          <p style={{ 
            marginTop: '20px', 
            fontSize: '14px', 
            color: '#666' 
          }}>
            Click the button above to start. The exam will automatically enter secure fullscreen mode.
          </p>
        </div>
      ) : (
        <div className="exam-content" style={{ padding: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px' 
          }}>
            <h2>📝 Exam in Progress</h2>
            <button
              onClick={handleExamEnd}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              End Exam
            </button>
          </div>

          {/* Your exam content here */}
          <div style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '20px', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Question 1:</h3>
            <p>What is the capital of France?</p>
            <input 
              type="text" 
              placeholder="Your answer..." 
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginTop: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }} 
            />
          </div>

          <div style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '20px', 
            borderRadius: '8px' 
          }}>
            <h3>Question 2:</h3>
            <p>Which programming language is commonly used for web development?</p>
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                <input type="radio" name="q2" value="javascript" style={{ marginRight: '8px' }} />
                JavaScript
              </label>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                <input type="radio" name="q2" value="python" style={{ marginRight: '8px' }} />
                Python
              </label>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                <input type="radio" name="q2" value="java" style={{ marginRight: '8px' }} />
                Java
              </label>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                <input type="radio" name="q2" value="cpp" style={{ marginRight: '8px' }} />
                C++
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoPopupExamComponent;
