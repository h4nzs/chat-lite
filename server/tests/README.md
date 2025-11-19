# Server Test Suite Documentation

This directory contains comprehensive tests for the Chat-Lite backend.

## Test Coverage

### API Tests
- **messages.test.ts**: Tests for message CRUD operations, file attachments, and encryption
- **upload.test.ts**: Tests for file upload security, validation, and storage

### Socket Tests
- **socket.test.ts**: Tests for real-time communication including:
  - Connection and authentication
  - Message sending and receiving
  - Typing indicators
  - Presence management
  - Session key exchange

## Running Tests

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- messages.test.ts
\`\`\`

## Test Setup

Tests use:
- Jest as the test framework
- Supertest for HTTP testing
- Socket.IO client for WebSocket testing
- Prisma for database operations

## Database

Tests use a separate test database. Ensure your `.env.test` file is configured correctly:

\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/chat_lite_test"
JWT_SECRET="test-secret"
\`\`\`

## Best Practices

- Each test suite creates and cleans up its own test data
- Tests are isolated from each other
- Database state is reset between test runs
- Authentication tokens are generated programmatically
- Uploaded files are cleaned up after tests