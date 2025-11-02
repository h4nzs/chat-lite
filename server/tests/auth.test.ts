import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';

// Helper to generate unique user credentials for each test run
const generateUniqueUser = () => {
  const timestamp = Date.now();
  return {
    email: `testuser_${timestamp}@test.com`,
    username: `testuser_${timestamp}`,
    password: 'password123',
    name: 'Test User',
  };
};

describe('Auth Endpoints', () => {
  let agent: request.SuperTest<request.Test>;
  let csrfToken: string;

  // Before each test, create a new agent and fetch a CSRF token
  beforeEach(async () => {
    agent = request.agent(app);
    await prisma.user.deleteMany({});
    
    const res = await agent.get('/api/csrf-token');
    csrfToken = res.body.csrfToken;
  });

  after(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = generateUniqueUser();
      const res = await agent
        .post('/api/auth/register')
        .set('CSRF-Token', csrfToken)
        .send(newUser);

      assert.strictEqual(res.statusCode, 201, 'Expected status code 201');
      assert(res.body.user.id, 'Response body should have a user ID');
      assert.strictEqual(res.body.user.email, newUser.email, 'Emails should match');
    });

    it('should fail to register with a duplicate email', async () => {
      const newUser = generateUniqueUser();
      await prisma.user.create({ data: { 
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        passwordHash: 'hashed_password' 
      } });

      const res = await agent
        .post('/api/auth/register')
        .set('CSRF-Token', csrfToken)
        .send({ ...newUser, username: 'another_username' });

      assert.strictEqual(res.statusCode, 409, 'Expected status code 409 for duplicate email');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login an existing user and set cookies', async () => {
      const newUser = generateUniqueUser();
      await agent.post('/api/auth/register').set('CSRF-Token', csrfToken).send(newUser);

      const res = await agent
        .post('/api/auth/login')
        .set('CSRF-Token', csrfToken)
        .send({ emailOrUsername: newUser.email, password: newUser.password });

      assert.strictEqual(res.statusCode, 200, 'Expected status code 200 for login');
      assert(res.headers['set-cookie'], 'Set-Cookie header should be present');
    });

    it('should fail to login with an incorrect password', async () => {
      const newUser = generateUniqueUser();
      await agent.post('/api/auth/register').set('CSRF-Token', csrfToken).send(newUser);

      const res = await agent
        .post('/api/auth/login')
        .set('CSRF-Token', csrfToken)
        .send({ emailOrUsername: newUser.email, password: 'wrongpassword' });

      assert.strictEqual(res.statusCode, 401, 'Expected status code 401 for incorrect password');
    });
  });

  describe('Protected Routes', () => {
    it('should not allow access to /api/users/me without a token', async () => {
      // This test uses a new agent without session cookies
      const res = await request(app).get('/api/users/me');
      assert.strictEqual(res.statusCode, 401, 'Expected status code 401 for unauthenticated access');
    });

    it('should allow access to /api/users/me with a valid token', async () => {
      const newUser = generateUniqueUser();
      await agent.post('/api/auth/register').set('CSRF-Token', csrfToken).send(newUser);
      await agent.post('/api/auth/login').set('CSRF-Token', csrfToken).send({ emailOrUsername: newUser.email, password: newUser.password });

      const res = await agent.get('/api/users/me');

      assert.strictEqual(res.statusCode, 200, 'Expected status code 200 for authenticated access');
      assert.strictEqual(res.body.email, newUser.email, 'Returned user email should match');
    });
  });
});

