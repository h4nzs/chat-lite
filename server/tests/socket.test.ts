import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HttpServer } from 'http';
import { registerSocket, getIo } from '../src/socket.js';
import { prisma } from '../src/lib/prisma.js';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';

describe('Socket.IO Integration Tests', () => {
  let httpServer: HttpServer;
  let clientSocket: ClientSocket;
  let testUserId: string;
  let port: number;

  before(async () => {
    // Create a real server from the app
    httpServer = createServer(app);
    
    // Register the real socket handlers
    registerSocket(httpServer);

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `socket-user-${Date.now()}@test.com`,
        username: `socket-user-${Date.now()}`,
        passwordHash: 'hashed-password', // Not used for socket auth directly
      },
    });
    testUserId = testUser.id;

    // Listen on a dynamic port
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  after(async () => {
    // Disconnect client and close server
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    getIo().close(); // Close the server-side instance
    httpServer.close();

    // Clean up database
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('should reject connection with an invalid token', (t, done) => {
    const socket = ClientIO(`http://localhost:${port}`, {
      // No auth token provided
      auth: { token: 'invalid' },
      transports: ['websocket'],
      reconnection: false,
    });

    socket.on('connect_error', (err) => {
      assert(err, 'Should receive a connection error');
      assert.strictEqual(err.message, 'Unauthorized', 'Error message should be "Unauthorized"');
      socket.disconnect();
      done();
    });

    socket.on('connect', () => {
      socket.disconnect();
      assert.fail('Should not have connected with an invalid token');
      done();
    });
  });

  it('should establish a connection with a valid token', (t, done) => {
    // Generate a valid JWT for the test user
    const authToken = jwt.sign({ id: testUserId, username: 'socket-user' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });

    clientSocket = ClientIO(`http://localhost:${port}`, {
      auth: { token: authToken },
      transports: ['websocket'],
      reconnection: false,
    });

    clientSocket.on('connect', () => {
      assert.strictEqual(clientSocket.connected, true, 'Client should be connected');
      done();
    });

    clientSocket.on('connect_error', (err) => {
      assert.fail(`Connection should have succeeded, but failed with: ${err.message}`);
      done();
    });
  });
  
  // NOTE: Testing specific event emissions (e.g., 'message:new') is complex in integration tests.
  // It's often better to test the *effects* of these events via API endpoints.
  // For example, after sending a message, query the GET /api/messages endpoint to see if it was created.
  // The tests for that logic reside in 'messages.test.ts'.
  // This file now focuses on correctly establishing and rejecting connections.

});
