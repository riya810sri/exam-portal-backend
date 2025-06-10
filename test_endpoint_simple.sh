#!/bin/bash

# Simple curl test for monitoring endpoint
echo "🔍 Testing monitoring endpoint with curl..."

# Test 1: Without authentication (should get 401)
echo "1. Testing without auth (expecting 401):"
curl -s -X POST http://localhost:3000/api/exam-attendance/68274422db1570c33bfef3a9/start-monitoring \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Test 2: With fake auth (should get auth error)
echo "2. Testing with fake auth (expecting auth error):"
curl -s -X POST http://localhost:3000/api/exam-attendance/68274422db1570c33bfef3a9/start-monitoring \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake_token" \
  -d '{"userAgent":"test","screenResolution":"1920x1080"}' \
  -w "\nStatus: %{http_code}\n\n"

echo "✅ Endpoint tests completed"
