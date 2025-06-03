# Frontend Implementation Guide for Exam Portal

## 1. Fullscreen Mode Implementation

### A. Install Required Dependencies
```bash
npm install screenfull
```

### B. Create FullscreenManager Component
Create a new component file `src/components/FullscreenManager.js`:

```jsx
import React, { useEffect, useState } from 'react';
import screenfull from 'screenfull';

const FullscreenManager = ({ active, onFullscreenExit, children }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  
  // Initialize fullscreen when component mounts if active is true
  useEffect(() => {
    if (active && screenfull.isEnabled) {
      enterFullscreen();
      
      // Add event listener for change
      screenfull.on('change', handleFullscreenChange);
      
      // Cleanup
      return () => {
        if (screenfull.isEnabled && screenfull.isFullscreen) {
          screenfull.exit();
        }
        screenfull.off('change', handleFullscreenChange);
      };
    }
  }, [active]);
  
  const enterFullscreen = () => {
    if (screenfull.isEnabled && !screenfull.isFullscreen) {
      screenfull.request().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error enabling fullscreen:', err);
      });
    }
  };
  
  const handleFullscreenChange = () => {
    const fullscreenActive = screenfull.isFullscreen;
    setIsFullscreen(fullscreenActive);
    
    if (!fullscreenActive && active) {
      // User exited fullscreen during exam
      setWarningCount(prev => prev + 1);
      setShowWarning(true);
      
      // Notify parent component about exit
      if (onFullscreenExit) {
        onFullscreenExit({
          timestamp: new Date(),
          warningCount: warningCount + 1
        });
      }
      
      // Automatically re-enter fullscreen after warning
      setTimeout(() => {
        setShowWarning(false);
        enterFullscreen();
      }, 5000);
    }
  };
  
  return (
    <div className="fullscreen-container">
      {showWarning && (
        <div className="fullscreen-warning">
          <div className="warning-content">
            <h3>⚠️ Warning: Fullscreen Exit Detected</h3>
            <p>Exiting fullscreen during an exam is not allowed and may be considered cheating.</p>
            <p>This incident has been recorded. ({warningCount}/3)</p>
            <p>Please return to fullscreen mode to continue your exam.</p>
            <button onClick={enterFullscreen}>Return to Fullscreen</button>
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
};

export default FullscreenManager;
```

### C. Add CSS Styles
Add the following CSS to your styles (in your CSS/SCSS file or styled-components):

```css
.fullscreen-container {
  width: 100%;
  height: 100%;
}

.fullscreen-warning {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(220, 53, 69, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.warning-content {
  background-color: #343a40;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  text-align: center;
}

.warning-content button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: white;
  color: #343a40;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
```

### D. Integrate into Exam Page
Update your exam attendance page to use the FullscreenManager:

```jsx
import React, { useState, useEffect } from 'react';
import FullscreenManager from '../components/FullscreenManager';
import axios from 'axios';

const ExamPage = () => {
  const [examData, setExamData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenExits, setFullscreenExits] = useState([]);
  
  useEffect(() => {
    // Fetch exam data
    fetchExamData();
  }, []);
  
  const fetchExamData = async () => {
    try {
      // Replace with your actual API endpoint
      const response = await axios.get('/api/exams/attend/123');
      setExamData(response.data);
      setIsLoading(false);
      
      // Activate fullscreen after data is loaded
      setFullscreenActive(true);
    } catch (error) {
      console.error('Error fetching exam:', error);
      setIsLoading(false);
    }
  };
  
  const handleFullscreenExit = (exitData) => {
    // Record fullscreen exit
    setFullscreenExits(prev => [...prev, exitData]);
    
    // Report to server if needed
    reportFullscreenExit(exitData);
  };
  
  const reportFullscreenExit = async (exitData) => {
    try {
      await axios.post('/api/exams/report-cheating/123', {
        evidenceType: 'FULLSCREEN_EXIT',
        details: exitData,
        source: 'CLIENT'
      });
    } catch (error) {
      console.error('Error reporting fullscreen exit:', error);
    }
  };
  
  const handleExamComplete = async () => {
    // Submit exam answers
    try {
      const response = await axios.post('/api/exams/complete/123');
      
      // Disable fullscreen when showing results
      setFullscreenActive(false);
      
      // Show results or redirect
      // ...
    } catch (error) {
      console.error('Error completing exam:', error);
    }
  };
  
  if (isLoading) {
    return <div>Loading exam...</div>;
  }
  
  return (
    <FullscreenManager 
      active={fullscreenActive} 
      onFullscreenExit={handleFullscreenExit}
    >
      <div className="exam-container">
        <h1>{examData?.examTitle}</h1>
        
        {/* Exam content here */}
        
        <button onClick={handleExamComplete}>Complete Exam</button>
      </div>
    </FullscreenManager>
  );
};

export default ExamPage;
```

## 2. Dynamic Attempt Count Implementation

### A. Update Exam List Component
Update your exam listing component to display attempt information:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchExams();
  }, []);
  
  const fetchExams = async () => {
    try {
      const response = await axios.get('/api/exams');
      setExams(response.data.exams);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return <div>Loading exams...</div>;
  }
  
  return (
    <div className="exams-list-container">
      <h2>Available Exams</h2>
      
      {exams.length === 0 ? (
        <p>No exams available at this time.</p>
      ) : (
        <div className="exam-cards">
          {exams.map(exam => (
            <div key={exam._id} className="exam-card">
              <h3>{exam.title}</h3>
              <p>{exam.description}</p>
              
              <div className="exam-details">
                <div className="detail-item">
                  <span>Duration:</span> {exam.duration} minutes
                </div>
                <div className="detail-item">
                  <span>Questions:</span> {exam.totalQuestions}
                </div>
                <div className="detail-item">
                  <span>Passing Score:</span> {exam.passingScore}%
                </div>
                <div className="detail-item">
                  <span>Attempts:</span> {exam.userStatus.attemptCount}/{exam.maxAttempts}
                </div>
              </div>
              
              {exam.userStatus.inProgress ? (
                <Link to={`/exams/attend/${exam._id}`} className="btn-continue">
                  Continue Exam
                </Link>
              ) : exam.userStatus.canAttempt ? (
                <Link to={`/exams/attend/${exam._id}`} className="btn-start">
                  Start Exam
                </Link>
              ) : (
                <div className="attempt-limit-reached">
                  {exam.userStatus.bestPercentage >= exam.passingScore ? 
                    "Exam Passed ✓" : 
                    `Maximum attempts reached (${exam.maxAttempts})`}
                </div>
              )}
              
              {exam.userStatus.attemptCount > 0 && (
                <div className="previous-attempts">
                  <div className="best-score">
                    Best Score: {exam.userStatus.bestPercentage}%
                    {exam.userStatus.bestPercentage >= exam.passingScore && " (Passed)"}
                  </div>
                  <div className="remaining-attempts">
                    Remaining Attempts: {exam.userStatus.remainingAttempts}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamList;
```

### B. Add CSS for Exam List
Add the following CSS styles:

```css
.exams-list-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.exam-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.exam-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  transition: transform 0.2s;
}

.exam-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.exam-details {
  margin: 15px 0;
}

.detail-item {
  margin-bottom: 5px;
}

.detail-item span {
  font-weight: bold;
  color: #555;
}

.btn-start, .btn-continue {
  display: block;
  text-align: center;
  padding: 10px;
  border-radius: 4px;
  margin-top: 15px;
  text-decoration: none;
  font-weight: bold;
}

.btn-start {
  background-color: #28a745;
  color: white;
}

.btn-continue {
  background-color: #007bff;
  color: white;
}

.attempt-limit-reached {
  display: block;
  text-align: center;
  padding: 10px;
  border-radius: 4px;
  margin-top: 15px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #6c757d;
}

.previous-attempts {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  font-size: 0.9em;
}

.best-score {
  font-weight: bold;
}
```

### C. Update Exam Creation Form
Update the exam creation form to include maxAttempts and passingScore:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ExamCreationForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    maxAttempts: 3,
    passingScore: 60
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'duration' || name === 'maxAttempts' || name === 'passingScore' 
        ? parseInt(value, 10) 
        : value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Validate the form data
      if (!formData.title || !formData.description) {
        throw new Error('Title and description are required');
      }
      
      if (formData.duration < 5 || formData.duration > 240) {
        throw new Error('Duration must be between 5 and 240 minutes');
      }
      
      if (formData.maxAttempts < 1 || formData.maxAttempts > 10) {
        throw new Error('Maximum attempts must be between 1 and 10');
      }
      
      if (formData.passingScore < 1 || formData.passingScore > 100) {
        throw new Error('Passing score must be between 1 and 100');
      }
      
      // Submit the form data to the API
      const response = await axios.post('/api/exams', formData);
      
      // Set success message
      setSuccess(true);
      
      // Reset form after success
      setFormData({
        title: '',
        description: '',
        duration: 60,
        maxAttempts: 3,
        passingScore: 60
      });
      
      console.log('Exam created successfully:', response.data);
    } catch (err) {
      setError(err.message || 'Failed to create exam');
      console.error('Error creating exam:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="exam-creation-container">
      <h2>Create New Exam</h2>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="success-message">
          <p>Exam created successfully!</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Exam Title*</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter exam title"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description*</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter exam description"
            rows="4"
            required
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="duration">Duration (minutes)*</label>
            <input
              type="number"
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              min="5"
              max="240"
              required
            />
            <small>Exam duration in minutes (5-240)</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="maxAttempts">Maximum Attempts*</label>
            <input
              type="number"
              id="maxAttempts"
              name="maxAttempts"
              value={formData.maxAttempts}
              onChange={handleChange}
              min="1"
              max="10"
              required
            />
            <small>Number of attempts allowed per student (1-10)</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="passingScore">Passing Score (%)*</label>
            <input
              type="number"
              id="passingScore"
              name="passingScore"
              value={formData.passingScore}
              onChange={handleChange}
              min="1"
              max="100"
              required
            />
            <small>Minimum percentage required to pass (1-100)</small>
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Exam'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExamCreationForm;
```

### D. Display Results with Fullscreen Exit
Update your exam results component to handle exiting fullscreen mode:

```jsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ExamResults = ({ results, attemptNumber }) => {
  const navigate = useNavigate();
  
  // Exit fullscreen when showing results
  useEffect(() => {
    // Check if document is in fullscreen mode
    if (document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement) {
      
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }, []);
  
  // Calculate if passed
  const passed = parseFloat(results.percentage) >= (results.passingScore || 60);
  
  return (
    <div className="exam-results">
      <h2>Exam Results</h2>
      
      <div className={`result-summary ${passed ? 'passed' : 'failed'}`}>
        <h3>{passed ? 'Exam Passed!' : 'Exam Not Passed'}</h3>
        <div className="score">
          <span>Score:</span> {results.score}/{results.totalQuestions} ({results.percentage}%)
        </div>
        <div className="attempt-info">
          <span>Attempt:</span> {attemptNumber} of {results.maxAttempts}
        </div>
        <div className="passing-info">
          <span>Passing Score:</span> {results.passingScore || 60}%
        </div>
      </div>
      
      {results.certificateId && (
        <div className="certificate-section">
          <h3>Congratulations!</h3>
          <p>You have successfully passed this exam and earned a certificate.</p>
          <button 
            onClick={() => window.open(`/api/certificates/${results.certificateId}`, '_blank')}
            className="btn-view-certificate"
          >
            View Certificate
          </button>
        </div>
      )}
      
      {!passed && results.remainingAttempts > 0 && (
        <div className="retry-section">
          <p>You can try again. Remaining attempts: {results.remainingAttempts}</p>
          <button 
            onClick={() => navigate('/exams')} 
            className="btn-back"
          >
            Back to Exams
          </button>
        </div>
      )}
      
      {!passed && results.remainingAttempts <= 0 && (
        <div className="no-attempts-section">
          <p>You have no remaining attempts for this exam.</p>
          <button 
            onClick={() => navigate('/exams')} 
            className="btn-back"
          >
            Back to Exams
          </button>
        </div>
      )}
    </div>
  );
};

export default ExamResults;
```

## 3. Integration Instructions

1. Install all necessary dependencies
2. Create the components as shown above
3. Integrate the FullscreenManager into your exam taking flow
4. Update your API calls to handle the new fields (maxAttempts, passingScore)
5. Update your UI to show attempt counts and passing score information
6. Test the functionality to ensure:
   - Fullscreen mode activates when starting an exam
   - Warnings appear when fullscreen is exited
   - Fullscreen exits automatically when showing results
   - Attempt limits and passing scores are displayed correctly
   - Users cannot retake exams they've passed or exhausted attempt limits for

## 4. Additional Tips

1. Make sure to handle browser compatibility issues with fullscreen API
2. Consider adding animation to the fullscreen warning for better UX
3. Add clear instructions for students about the fullscreen requirement
4. Implement a confirmation dialog before starting an exam that explains the rules
5. Test on different browsers and devices to ensure consistent behavior 