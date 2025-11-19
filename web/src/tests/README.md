# Test Suite Documentation

This directory contains comprehensive unit and integration tests for the Chat-Lite application.

## Test Coverage

### Component Tests
- **VoiceMessagePlayer.test.tsx**: Tests for voice message playback, encryption/decryption, error handling, and UI interactions
- **FileAttachment.test.tsx**: Tests for file attachments, downloads, decryption, and various file types
- **LazyImage.test.tsx**: Tests for lazy-loaded images, intersection observer, and error states

### Utility Tests
- **crypto.test.ts**: Comprehensive tests for encryption/decryption utilities including:
  - File encryption and decryption
  - File key encryption and decryption
  - Integration tests for complete E2EE workflow

### Store Tests
- **messageInput.test.ts**: Tests for message input store including:
  - Text input management
  - Voice recording functionality
  - File attachment handling
  - Reply functionality
  - Upload progress tracking

## Running Tests

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
\`\`\`

## Test Patterns

### Mocking
- External dependencies (crypto utilities, fetch, MediaRecorder) are mocked
- URL.createObjectURL and URL.revokeObjectURL are mocked for blob handling
- Socket connections are mocked for real-time features

### Test Structure
- Tests are organized using describe/it blocks
- Each test file includes setup and teardown logic
- Tests cover happy paths, edge cases, and error conditions

### Best Practices
- Tests are isolated and don't depend on each other
- Cleanup is performed after each test
- Async operations use waitFor from @testing-library/react
- Mock implementations are cleared between tests

## Server Tests

Server tests are located in `server/tests/` and include:
- **messages.test.ts**: Message API endpoints and database operations
- **socket.test.ts**: Socket.IO event handling and real-time communication
- **upload.test.ts**: File upload functionality and security

Run server tests with:
\`\`\`bash
cd server
npm test
\`\`\`