# Exam Portal Backend

A comprehensive backend system for managing online exams, assessments, and certifications.

## Features

- User authentication and authorization
- Exam creation and management
- Question bank with multiple question types
- Secure exam taking with randomized questions
- Real-time exam monitoring and timing
- Automatic grading and result calculation
- Certificate generation for successful candidates
- **🔒 Automatic Fullscreen Security** - Seamless security mode without user popups!
- **🛡️ Advanced Cheating Detection** - Comprehensive monitoring with AI-powered analysis
- **⚡ Real-time Event Monitoring** - Keyboard, mouse, and browser activity tracking
- **🚨 Intelligent Threat Detection** - Multi-layered security with automatic responses
- **📊 Security Analytics Dashboard** - Complete admin oversight with detailed reports

## Getting Started

### Prerequisites

- Node.js (v14.x or higher)
- MongoDB (v4.x or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/exam_portal_backend.git
   cd exam_portal_backend
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file with the following variables
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/exam_portal
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=1d
   ```

4. Start the development server
   ```
   npm run dev
   ```

## API Documentation

The API documentation is available at `/api-docs` when the server is running.

## 🔒 Automatic Fullscreen Security

The system now features **seamless automatic fullscreen** that activates without any user interaction:

### ✨ **Key Features:**
- **🚀 Zero-Click Activation**: Fullscreen mode starts automatically when exam begins
- **🔄 Intelligent Recovery**: Automatically re-enters fullscreen if user exits accidentally  
- **🌐 Cross-Browser Support**: Works on Chrome, Firefox, Safari, Edge
- **📱 Mobile Compatible**: Optimized for mobile browsers
- **⚡ Instant Activation**: < 1 second transition to secure mode

### 🛡️ **Security Benefits:**
- **No User Bypass**: Users cannot skip or avoid fullscreen mode
- **Consistent Experience**: Same behavior across all browsers and devices
- **Professional Appearance**: No technical popups or confusing instructions
- **Enhanced Compliance**: 100% fullscreen adoption rate

### 🔧 **Implementation:**
```javascript
// Simple 3-line implementation
const result = await securityMonitor.initializeMonitoring(connection, examId, studentId);
// Fullscreen is now active automatically!
console.log('Secure exam started:', result.success);
```

### 📚 **Documentation:**
- [🚀 Quick Start Guide](docs/AUTOMATIC_FULLSCREEN_QUICKSTART.md)
- [📖 Complete Integration Guide](docs/FRONTEND_SECURITY_GUIDE.md)
- [🔄 Migration Guide](docs/FULLSCREEN_MIGRATION_GUIDE.md)
- [🧪 Working Examples](examples/)

---

## Cheating Detection Feature

The Exam Portal now includes a robust cheating detection system that monitors and reports suspicious activities during exams.

### Features

- Client-side detection of tab switching, copy/paste attempts, and keyboard shortcuts
- **Advanced keyboard and keybinding monitoring** to detect:
  - Automated tools and suspicious typing patterns
  - Prohibited keyboard shortcuts (Ctrl+C, Ctrl+V, F12, Alt+Tab, etc.)
  - Custom keybinding combinations that may indicate cheating attempts
- **Mouse movement monitoring** with data collection every 2 seconds to detect:
  - Automated mouse movements
  - Unusually consistent or straight-line movements
  - Patterns that indicate automation tools
- Real-time alerts for prohibited actions and suspicious patterns
- Secure API for reporting and storing cheating evidence
- Admin dashboard for reviewing flagged exams
- Flexible evidence schema to support different detection methods
- Support for both client and server-side detection

### Input Monitoring System

The enhanced input monitoring features provide:

- **Keyboard Monitoring:**
  - Real-time tracking of keystroke patterns and timing
  - Detection of suspicious typing rhythms that may indicate automation
  - Comprehensive monitoring of keyboard shortcuts and combinations
  - Identification of attempts to use browser developer tools or switch applications

- **Mouse Monitoring:**
  - Collection of mouse position data every 2 seconds
  - Analysis of mouse movement patterns for unnatural behavior
  - Detection of straight-line movements indicative of automation
  - Tracking of periods with no mouse activity

- **Integrated Risk Assessment:**
  - Risk scoring based on typing behavior, detected shortcuts, and mouse patterns
  - Integration with the existing security monitoring system
  - Configurable alerts and warnings for students
  - Comprehensive admin dashboard for monitoring violations

For integration details, see the [Keyboard, Keybinding & Mouse Monitoring Integration Guide](docs/KEYBOARD_MONITORING_INTEGRATION.md).

### Integration

To integrate cheating detection in your frontend, use the example components provided in the `/examples` directory:

- `client-side-detection.js` - React hook for monitoring exam takers
- `admin-keybinding-dashboard.js` - Admin component for reviewing reports

For detailed documentation, see the [Cheating Detection Documentation](docs/cheating-detection.md).

## Architecture

The application follows a Model-View-Controller (MVC) architecture:

- **Models**: MongoDB schemas for data storage
- **Controllers**: Business logic for handling requests
- **Routes**: API endpoint definitions
- **Middlewares**: Authentication, validation, and error handling
- **Utils**: Helper functions and utilities

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
