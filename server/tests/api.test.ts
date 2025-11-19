import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('General API Flow', () => {
  let agent: request.SuperTest<request.Test>;
  let csrfToken: string;
  const usersCreated: string[] = [];

  before(async () => {
    agent = request.agent(app);
    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  after(async () => {
    // Clean up all users created during the tests
    if (usersCreated.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: usersCreated } },
      });
    }
    await prisma.$disconnect();
  });

  test('register → me → logout flow', async () => {
    const email = `u${Date.now()}@ex.com`;
    const username = `u${Date.now()}`;
    
    // Register
    const res = await agent.post('/api/auth/register')
      .set('CSRF-Token', csrfToken)
      .send({ email, username, password: 'password123', name: 'User' });
    
    assert.strictEqual(res.status, 201, 'Registration should return 201 Created');
    assert(res.body.user.id, 'Registered user should have an ID');
    usersCreated.push(res.body.user.id);

    // Login (agent will persist cookies)
    await agent.post('/api/auth/login')
      .set('CSRF-Token', csrfToken)
      .send({ emailOrUsername: email, password: 'password123' });

    // Access protected route
    const meRes = await agent.get('/api/users/me');
    assert.strictEqual(meRes.status, 200, '/me should be accessible after login');
    assert.strictEqual(meRes.body.email, email, 'Email of logged-in user should match');

    // Logout
    const logoutRes = await agent.post('/api/auth/logout')
      .set('CSRF-Token', csrfToken);
    assert.strictEqual(logoutRes.status, 200, 'Logout should be successful');

    // Verify access is revoked
    const meAfterLogoutRes = await agent.get('/api/users/me');
    assert.strictEqual(meAfterLogoutRes.status, 401, '/me should be inaccessible after logout');
  });

  test('search users requires auth', async () => {
    // Use a new, unauthenticated agent
    const res = await request(app).get('/api/users/search?q=a');
    assert.strictEqual(res.status, 401, 'Search endpoint should require authentication');
  });
});