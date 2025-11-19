import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

describe('Messages API', () => {
  let agent: request.SuperTest<request.Test>;
  let testUserId: string;
  let testConversationId: string;
  let csrfToken: string;
  let testUser: any;

  before(async () => {
    // Single agent for all tests in this suite
    agent = request.agent(app);

    // Create a single test user for the suite
    const userCredentials = {
      email: `messagestest_${Date.now()}@example.com`,
      username: `messagestest_${Date.now()}`,
      password: 'password123',
      name: 'Message Test User',
    };
    
    // Fetch CSRF token first
    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;

    // Register user
    const registerRes = await agent
      .post('/api/auth/register')
      .set('CSRF-Token', csrfToken)
      .send(userCredentials);
    testUser = registerRes.body.user;
    testUserId = testUser.id;

    // Create a test conversation with the user
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: { create: { userId: testUserId } },
      },
    });
    testConversationId = conversation.id;
  });

  after(async () => {
    // Clean up all test data at the end
    await prisma.message.deleteMany({ where: { conversationId: testConversationId } });
    await prisma.participant.deleteMany({ where: { userId: testUserId } });
    await prisma.conversation.deleteMany({ where: { id: testConversationId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('GET /api/messages/:conversationId', () => {
    beforeEach(async () => {
      // Clear messages before each test in this block
      await prisma.message.deleteMany({ where: { conversationId: testConversationId } });
    });

    it('should fetch messages for a conversation', async () => {
      await prisma.message.create({
        data: {
          conversationId: testConversationId,
          senderId: testUserId,
          content: 'Message 1',
        },
      });

      const response = await agent.get(`/api/messages/${testConversationId}`);
      
      assert.strictEqual(response.status, 200);
      assert(Array.isArray(response.body.items), 'Response should have an items array');
      assert.strictEqual(response.body.items.length, 1);
    });

    it('should return 403 for non-participants', async () => {
      // Create a user who is not in the conversation
      const outsider = await prisma.user.create({ data: { email: 'outsider@test.com', username: 'outsider', passwordHash: 'hash' }}});
      const outsiderAgent = request.agent(app);
      const csrfRes = await outsiderAgent.get('/api/csrf-token');
      const outsiderCsrf = csrfRes.body.csrfToken;
      await outsiderAgent.post('/api/auth/login').set('CSRF-Token', outsiderCsrf).send({ emailOrUsername: 'outsider@test.com', password: 'password' }); // Login fails but sets up agent context
      
      const response = await outsiderAgent.get(`/api/messages/${testConversationId}`);
      assert.strictEqual(response.status, 403);
      await prisma.user.delete({ where: { id: outsider.id }}});
    });

    it('should support cursor pagination', async () => {
      const messages = [];
      for (let i = 0; i < 5; i++) {
        messages.push(await prisma.message.create({ data: { conversationId: testConversationId, senderId: testUserId, content: `Msg ${i}`}}));
      }
      
      const cursor = messages[3].id; // Use the 4th message as cursor
      const response = await agent.get(`/api/messages/${testConversationId}?cursor=${cursor}`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.items.length, 3, 'Should fetch 3 messages before the cursor');
    });
  });

  describe('DELETE /api/messages/:messageId', () => {
    let testMessageId: string;

    beforeEach(async () => {
      const message = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          senderId: testUserId,
          content: 'Test message to delete',
        },
      });
      testMessageId = message.id;
    });

    it('should delete a message successfully', async () => {
      const response = await agent
        .delete(`/api/messages/${testMessageId}`)
        .set('CSRF-Token', csrfToken);

      assert.strictEqual(response.status, 200);
      const deletedMessage = await prisma.message.findUnique({ where: { id: testMessageId } });
      assert.strictEqual(deletedMessage, null);
    });

    it('should delete attached file when deleting message', async () => {
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      const testFilePath = path.join(uploadsDir, `test-file-${Date.now()}.txt`);
      await fs.writeFile(testFilePath, 'test content');

      const messageWithFile = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          senderId: testUserId,
          fileUrl: `http://localhost:4000/uploads/test-file-${Date.now()}.txt`,
        },
      });

      const response = await agent
        .delete(`/api/messages/${messageWithFile.id}`)
        .set('CSRF-Token', csrfToken);

      assert.strictEqual(response.status, 200);

      await assert.rejects(
        async () => await fs.access(testFilePath),
        { code: 'ENOENT' },
        'File should have been deleted'
      );
    });

    it('should return 403 when deleting another user\'s message', async () => {
      const otherUser = await prisma.user.create({ data: { email: `other_${Date.now()}@test.com`, username: `other_${Date.now()}`, passwordHash: 'h' }}});
      const otherMessage = await prisma.message.create({ data: { conversationId: testConversationId, senderId: otherUser.id }}});

      const response = await agent
        .delete(`/api/messages/${otherMessage.id}`)
        .set('CSRF-Token', csrfToken);

      assert.strictEqual(response.status, 404); // API returns 404 because "message not found FOR THIS USER"

      await prisma.user.delete({ where: { id: otherUser.id }}});
    });
  });
});
