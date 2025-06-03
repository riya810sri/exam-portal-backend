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
      const response = await axios.post('/api/exams', formData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
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
      
      <style jsx>{`
        .exam-creation-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #f9f9f9;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
          margin-bottom: 20px;
          color: #333;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        input, textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }
        
        .form-row {
          display: flex;
          gap: 20px;
        }
        
        .form-row .form-group {
          flex: 1;
        }
        
        small {
          display: block;
          margin-top: 5px;
          color: #666;
          font-size: 12px;
        }
        
        .error-message {
          padding: 10px;
          background-color: #ffebee;
          color: #c62828;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .success-message {
          padding: 10px;
          background-color: #e8f5e9;
          color: #2e7d32;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .btn-submit {
          padding: 10px 20px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        
        .btn-submit:hover {
          background-color: #1976d2;
        }
        
        .btn-submit:disabled {
          background-color: #bbdefb;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ExamCreationForm; 