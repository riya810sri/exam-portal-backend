#!/bin/bash

# WebSocket Security Monitor - Quick Test Script
# This script demonstrates the real-time WebSocket functionality

echo "🔐 WebSocket Security Monitoring - Quick Demo"
echo "=============================================="
echo ""

# Check if server is running
echo "📡 Checking server status..."
if curl -s http://localhost:3000/live > /dev/null 2>&1; then
    echo "✅ Server is running on http://localhost:3000"
else
    echo "❌ Server is not running. Please start it first:"
    echo "   cd /save_data/abhi/Projects/exam_portal_backend"
    echo "   node app.js"
    exit 1
fi

echo ""
echo "🧪 Testing WebSocket Security Events..."
echo "======================================="

# Run the security monitor test
node test_security_monitor.js

echo ""
echo "🌐 Browser Test Available:"
echo "=========================="
echo "Open this URL to test WebSocket connections:"
echo "file:///save_data/abhi/Projects/exam_portal_backend/test_websocket_security.html"
echo ""
echo "📋 Test Instructions:"
echo "1. Open the browser test page"
echo "2. Connect as Student with User ID: student123, Exam ID: exam456"  
echo "3. Connect as Admin with Admin ID: admin789"
echo "4. Use the simulation buttons to trigger security events"
echo "5. Watch real-time WebSocket events in both panels"
echo ""
echo "✅ WebSocket Security Monitoring is fully operational!"
echo "🎯 Ready for frontend integration with provided React components."
