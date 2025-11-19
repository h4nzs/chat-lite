import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

describe('File Upload API', () => {
  let agent: request.SuperTest<request.Test>;
  let testUserId: string;
  let testConversationId: string;
  let csrfToken: string;

  before(async () => {
    agent = request.agent(app);

    const userCredentials = {
      email: `uploadtest_${Date.now()}@example.com`,
      username: `uploadtest_${Date.now()}`,
      password: 'password123',
      name: 'Upload Test User',
    };

    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;

    const registerRes = await agent.post('/api/auth/register').set('CSRF-Token', csrfToken).send(userCredentials);
    testUserId = registerRes.body.user.id;
    
    // Login to establish session for subsequent requests
    await agent.post('/api/auth/login').set('CSRF-Token', csrfToken).send(userCredentials);

    const conversation = await prisma.conversation.create({
      data: { participants: { create: { userId: testUserId } } },
    });
    testConversationId = conversation.id;
  });

  after(async () => {
    // Clean up test data
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    await fs.rm(uploadsDir, { recursive: true, force: true });
    
    await prisma.participant.deleteMany({ where: { userId: testUserId } });
    await prisma.conversation.deleteMany({ where: { id: testConversationId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('POST /api/uploads/:conversationId/upload', () => {
    it('should upload a file successfully and return file metadata', async () => {
      const testFile = Buffer.from('test file content');
      
      const response = await agent
        .post(`/api/uploads/${testConversationId}/upload`)
        .set('CSRF-Token', csrfToken)
        .attach('file', testFile, 'test.txt');

      assert.strictEqual(response.status, 200);
      assert(response.body.file.url.includes('/uploads/'), 'Should have a file URL');
      assert.strictEqual(response.body.file.fileName, 'test.txt');
      assert.strictEqual(response.body.file.size, 17);
    });

    it('should reject upload if user is not a participant', async () => {
      const outsiderAgent = request.agent(app);
      const csrfRes = await outsiderAgent.get('/api/csrf-token');
      // No login for this agent
      
      const response = await outsiderAgent
        .post(`/api/uploads/${testConversationId}/upload`)
        .set('CSRF-Token', csrfRes.body.csrfToken)
        .attach('file', Buffer.from('trespassing'), 'trespass.txt');
        
      assert.strictEqual(response.status, 401, 'Should be 401 for unauthenticated user');
    });

    it('should return 400 if no file is attached', async () => {
      const response = await agent
        .post(`/api/uploads/${testConversationId}/upload`)
        .set('CSRF-Token', csrfToken);
        
      assert.strictEqual(response.status, 400);
    });

    it('should sanitize dangerous file names', async () => {
      const response = await agent
        .post(`/api/uploads/${testConversationId}/upload`)
        .set('CSRF-Token', csrfToken)
        .attach('file', Buffer.from('malicious'), '../../../etc/passwd.txt');
        
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.file.fileName, '.._.._.._etc_passwd.txt', 'Filename should be sanitized');
    });

    it('should generate unique file paths to prevent collisions', async () => {
      const res1 = await agent
        .post(`/api/uploads/${testConversationId}/upload`)
        .set('CSRF-Token', csrfToken)
        .attach('file', Buffer.from('content1'), 'collision.txt');
        
      const res2 = await agent
        .post(`/api/uploads/${testConversationId}/upload`)
        .set('CSRF-Token', csrfToken)
        .attach('file', Buffer.from('content2'), 'collision.txt');
        
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);
      assert.notStrictEqual(res1.body.file.url, res2.body.file.url, 'File URLs should be unique');
    });
  });
});
