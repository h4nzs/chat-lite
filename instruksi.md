# Implementation Plan: Proper End-to-End Encryption for Chat-Lite

## Overview
The current encryption implementation uses a deterministic key derived solely from the conversation ID, making it possible for any participant (current or future) to decrypt all messages in a conversation. This is not true end-to-end encryption. This document outlines a plan to implement proper end-to-end encryption using public-key cryptography.

## Current Issues
1. **Weak Key Generation**: Encryption key depends only on conversation ID
2. **Compromised Confidentiality**: All participants can decrypt all historical messages
3. **No Forward Secrecy**: Messages remain decryptable even after leaving a conversation
4. **Server Access**: Server can potentially decrypt messages if it has conversation IDs

## Proposed Solution: Asymmetric Key Encryption with Session Keys

### 1. Architecture Overview
- Each user generates and maintains their own public/private key pair
- For each conversation, generate a unique session key
- Encrypt session key with each participant's public key
- Use session key to encrypt message content
- Store encrypted session key with each message

### 2. Implementation Steps

#### Phase 1: Key Management System
1. **User Key Pair Generation**:
   - Implement per-user public/private key pair generation using libsodium
   - Store private key in browser's secure storage (e.g., Web Crypto API with secure wrapping)
   - Store public key in the database with user profile

2. **Database Schema Changes**:
   - Add `publicKey` field to `User` model in `schema.prisma`
   - Add `encryptedSessionKey` field to `Message` model
   - Add `sessionId` field to `Message` model for grouping messages with the same session key

3. **API Endpoints**:
   - Create endpoint for users to upload their public key
   - Create endpoint for fetching user public keys

#### Phase 2: Session Key Management
1. **Session Key Generation**:
   - When a conversation starts or when new users join, generate a new random session key
   - Encrypt the session key with each participant's public key
   - Store encrypted session keys in a separate table

2. **Database Schema for Session Keys**:
   - Create `SessionKey` model with `id`, `conversationId`, `sessionId`, `userId`, `encryptedKey`, `createdAt`
   - Add indexes for efficient retrieval

#### Phase 3: Message Encryption & Decryption
1. **Frontend Changes**:
   - Update `encryptMessage()` to:
     - Fetch current session key (or generate new one if needed)
     - Encrypt message with session key
     - Include encrypted session key reference with message
   - Update `decryptMessage()` to:
     - Retrieve appropriate encrypted session key
     - Decrypt session key with user's private key
     - Decrypt message with session key

2. **Backend Changes**:
   - Update message storage to include encrypted session key reference

#### Phase 4: Migration and Security Improvements
1. **Migration Path**:
   - Plan migration for existing messages
   - Maintain backward compatibility with existing messages

2. **Forward Secrecy**:
   - Implement rotation of session keys periodically
   - Option to generate new session key when users join/leave conversations

## Technical Implementation Details

### New Schema Additions
```prisma
model User {
  // ... existing fields
  publicKey      String?
  privateKey     String?  // For migration purposes, will be removed from database
}

model SessionKey {
  id              String   @id @default(cuid())
  conversationId  String
  sessionId       String
  userId          String
  encryptedKey    String   // Session key encrypted with user's public key
  createdAt       DateTime @default(now())
  expiresAt       DateTime?
  
  @@index([conversationId])
  @@index([userId])
  @@index([sessionId])
}

model Message {
  // ... existing fields
  sessionId           String?      // References the session key set used for encryption
  encryptedSessionKey String?      // Encrypted session key for this specific message (for forward secrecy)
}
```

### Key Generation and Storage
1. **Client-side Key Generation**:
   - Use libsodium.js to generate Ed25519 key pairs
   - Store private key using Web Crypto API with password-based wrapping
   - Upload public key to server for distribution

2. **Session Key Handling**:
   - Generate a new random symmetric key (e.g., 256-bit) for each session
   - Encrypt session key with each participant's RSA public key
   - Store encrypted session keys in the database

### Encryption Process
```typescript
// When sending a message:
async function encryptMessageForParticipants(text: string, conversationId: string, participantPublicKeys: string[]) {
  // Generate or retrieve session key
  const sessionKey = await getCurrentSessionKey(conversationId);
  
  // Encrypt the message content with the session key
  const encryptedContent = await encryptWithSymmetricKey(text, sessionKey);
  
  // Encrypt the session key with each participant's public key
  const encryptedSessionKeys = participantPublicKeys.map(pubKey => 
    encryptWithPublicKey(sessionKey, pubKey)
  );
  
  return {
    encryptedContent,
    encryptedSessionKeys,  // Send to server for distribution
    sessionId: sessionKey.id
  };
}
```

### Decryption Process
```typescript
// When receiving a message:
async function decryptMessageForUser(encryptedContent: string, encryptedSessionKey: string, sessionId: string) {
  // Decrypt the session key with user's private key
  const sessionKey = await decryptWithPrivateKey(encryptedSessionKey, userPrivateKey);
  
  // Decrypt the message content with the session key
  const decryptedContent = await decryptWithSymmetricKey(encryptedContent, sessionKey);
  
  return decryptedContent;
}
```

## Implementation Timeline

### Week 1: Key Management
- Generate user key pairs
- Store public keys in database
- Create API endpoints for key management

### Week 2: Session Key System
- Implement session key generation
- Create database schema for session keys
- Update conversation creation logic

### Week 3: Encryption/Decryption Logic
- Update frontend encryption/decryption functions
- Update backend message handling
- Implement key caching for performance

### Week 4: Testing & Migration
- Comprehensive testing of new system
- Plan for migrating existing messages
- Performance optimization and security audit

## Security Considerations

### Forward Secrecy
- Option to rotate session keys periodically
- New session keys when participants join/leave conversations
- Ability to re-encrypt session keys when participants change

### Key Storage
- Client-side private key storage using Web Crypto API with password wrapping
- Server never has access to unencrypted private keys
- Secure key backup/restore mechanism

### Performance
- Efficient key caching to avoid repeated decryption
- Batch operations for multi-user session key distribution
- Consider message threading for conversation sessions

## Rollout Strategy

### Phase 1: New Conversations Only
- Implement new encryption for new conversations only
- Maintain backward compatibility for existing conversations
- Gradually migrate old conversations

### Phase 2: All Conversations
- Apply new encryption to all new messages
- Provide option to re-encrypt old conversations

### Phase 3: Complete Migration
- Complete migration of all historical messages (optional)
- Full removal of old encryption system

## Testing Requirements

1. **Unit Tests**:
   - Key generation and storage
   - Encryption/decryption functions
   - Session key management

2. **Integration Tests**:
   - End-to-end message sending/receiving
   - Multi-user conversation scenarios
   - Key rotation scenarios

3. **Security Tests**:
   - Verify that server cannot decrypt messages
   - Verify that users cannot decrypt messages from conversations they're not in
   - Test forward secrecy implementation

## Risk Mitigation

1. **User Key Loss**: Implement secure key backup/recovery system
2. **Performance Impact**: Optimize key caching, batch operations, and minimize encryption overhead
3. **Backward Compatibility**: Maintain support for existing messages during transition
4. **Migration Errors**: Thorough testing and rollback procedures

This plan provides a comprehensive approach to implementing true end-to-end encryption while maintaining system functionality and security.