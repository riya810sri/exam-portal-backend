/**
 * Example test file demonstrating how to use the test middleware
 */
const request = require('supertest');
const express = require('express');
const { expect } = require('chai');

// You would typically import your app here
// const app = require('../app');

// Simple example of a test using the test middleware
describe('Test Middleware Example', () => {
  it('should access protected routes with test mode', async () => {
    // Using supertest to make requests with test headers
    const response = await request(app)
      .get('/api/auth/me')
      .set('X-Test-Mode', 'test-token')
      .set('X-Test-Role', 'user');
    
    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('_id');
    expect(response.body).to.have.property('email');
  });

  it('should simulate admin user with test middleware', async () => {
    // Custom test user data
    const testAdminUser = {
      _id: 'admin-test-id',
      email: 'admin@test.com',
      username: 'adminuser',
      role: 'admin',
      isAdmin: true
    };

    const response = await request(app)
      .get('/api/admin/users')
      .set('X-Test-Mode', 'test-token')
      .set('X-Test-User', JSON.stringify(testAdminUser));
    
    expect(response.status).to.equal(200);
  });

  it('should simulate error responses', async () => {
    const response = await request(app)
      .get('/api/exams')
      .set('X-Test-Mode', 'test-token')
      .set('X-Test-Error', '403');
    
    expect(response.status).to.equal(403);
    expect(response.body).to.have.property('testMode', true);
  });
});

/**
 * How to use the test middleware in your application:
 * 
 * 1. For testing protected routes:
 *    - Add X-Test-Mode: test-token header
 *    - Optionally add X-Test-Role: admin (or any role)
 * 
 * 2. For custom test user data:
 *    - Add X-Test-User header with JSON string of user data
 * 
 * 3. For simulating errors:
 *    - Add X-Test-Error header with status code
 * 
 * Example with curl:
 * 
 * curl -X GET http://localhost:3456/api/auth/me \
 *   -H "X-Test-Mode: test-token" \
 *   -H "X-Test-Role: admin"
 */