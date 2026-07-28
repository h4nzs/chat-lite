// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
//
// OpenAPI 3.0.3 Specification for NYX Chat API
// Auto-generated from route definitions. Keep in sync with route changes.

// Define minimal OpenAPI type locally to avoid external dependency
interface OpenAPIObject {
  openapi: string;
  info: Record<string, unknown>;
  servers?: Array<Record<string, string>>;
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  tags?: Array<Record<string, string>>;
  [key: string]: unknown;
}

const spec: OpenAPIObject = {
  openapi: "3.0.3",
  info: {
    title: "NYX Chat API",
    version: "2.0.0",
    description: `# NYX Chat — Zero-Knowledge Messenger API

**Privacy-first, end-to-end encrypted messaging platform.**

## Authentication

Most endpoints require authentication via:
1. **Cookie-based auth** — \`at\` (access token, 15min) and \`rt\` (refresh token, 30d) HTTP-only cookies
2. **Bearer token** — \`Authorization: Bearer <accessToken>\` header

Get tokens via \`POST /api/auth/login\` or \`POST /api/auth/register\`.

## Rate Limiting

- General API: 300 requests per 15 minutes
- Auth endpoints: 20 requests per hour
- Upload: 20 requests per hour`,
    contact: {
      name: "NYX Support",
      email: "admin@nyx-app.my.id",
      url: "https://nyx-app.my.id"
    },
    license: {
      name: "AGPL-3.0 (Commercial Dual-License Available)",
      url: "https://github.com/nyx-chat/nyx-chat/blob/main/LICENSE"
    }
  },
  servers: [
    { url: "https://api.nyx-app.my.id", description: "Production" },
    { url: "http://localhost:4000", description: "Development" }
  ],
  paths: {
    // =========================================================
    // AUTH
    // =========================================================
    "/api/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a new user account",
        description: "Creates a new user with cryptographic identity keys. Requires Turnstile CAPTCHA token.",
        operationId: "registerUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["usernameHash", "password", "publicKey", "signingKey"],
                properties: {
                  usernameHash: { type: "string", description: "Argon2id hash of username (min 10 chars)" },
                  password: { type: "string", minLength: 8, maxLength: 128 },
                  encryptedProfile: { type: "string", description: "E2E encrypted profile data (optional)" },
                  publicKey: { type: "string", description: "X25519 public key (base64url, 32 bytes)" },
                  pqPublicKey: { type: "string", description: "ML-KEM public key (base64url, 1216 bytes, optional)" },
                  signingKey: { type: "string", description: "Ed25519 signing key (base64url, 32 bytes)" },
                  encryptedPrivateKeys: { type: "string", description: "E2E encrypted private key bundle" },
                  deviceName: { type: "string" },
                  turnstileToken: { type: "string", description: "Cloudflare Turnstile CAPTCHA token" }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Registration successful. Returns user, accessToken, deviceId" },
          "400": { description: "Validation error or bot detected" },
          "409": { description: "Username already taken (hash collision)" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Login with credentials",
        description: "Authenticates user and issues JWT tokens via cookies and response body.",
        operationId: "loginUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["usernameHash", "password"],
                properties: {
                  usernameHash: { type: "string" },
                  password: { type: "string", minLength: 8 },
                  publicKey: { type: "string", description: "For device registration (optional on subsequent logins)" },
                  pqPublicKey: { type: "string" },
                  signingKey: { type: "string" },
                  encryptedPrivateKey: { type: "string" },
                  deviceName: { type: "string" },
                  deviceId: { type: "string", description: "Existing device ID to resume session" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Login successful. Sets at+rt cookies, returns user + accessToken" },
          "401": { description: "Invalid credentials" },
          "403": { description: "Account suspended" }
        }
      }
    },
    "/api/auth/burner": {
      post: {
        tags: ["Authentication"],
        summary: "Create burner (guest) session",
        description: "Issues ephemeral JWT tokens for anonymous guest users without DB persistence.",
        operationId: "createBurnerSession",
        responses: {
          "200": { description: "Burner session created. Returns accessToken + guest user object" }
        }
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh access token",
        description: "Rotates refresh token with family-based reuse detection. Issues new at+rt cookies.",
        operationId: "refreshToken",
        responses: {
          "200": { description: "Tokens rotated successfully" },
          "401": { description: "Invalid/expired refresh token or reuse detected" }
        }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Logout current session",
        description: "Revokes refresh token family, clears cookies, unregisters push subscription.",
        operationId: "logoutUser",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  endpoint: { type: "string", description: "Push subscription endpoint to unregister" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Logout successful" }
        }
      }
    },
    "/api/auth/logout-all": {
        operationId: "logoutAllSessions",
      post: {
        tags: ["Authentication"],
        summary: "Logout all sessions",
        description: "Revokes ALL refresh token families across all devices. Clears active device cache.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "All sessions terminated" },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/api/auth/transport-ticket": {
        operationId: "getTransportTicket",
      get: {
        tags: ["Authentication"],
        summary: "Get WebTransport ticket",
        description: "Issues a short-lived (15s) JWT ticket for WebTransport connection authentication.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Transport ticket issued",
            content: { "application/json": { schema: { type: "object", properties: { ticket: { type: "string" } } } } }
          },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/api/auth/recover/challenge": {
        operationId: "getRecoveryChallenge",
      get: {
        tags: ["Authentication"],
        summary: "Get account recovery challenge",
        description: "Returns a cryptographic nonce to sign for account recovery proof.",
        parameters: [{
          name: "identifier",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Username hash identifier"
        }],
        responses: {
          "200": { description: "Returns nonce for signing" },
          "400": { description: "Missing identifier" }
        }
      }
    },
    "/api/auth/recover": {
      post: {
        tags: ["Authentication"],
        summary: "Recover account",
        description: "Recovers account with cryptographic proof of ownership. Resets password and device keys.",
        operationId: "recoverAccount",
        responses: {
          "200": { description: "Account recovered successfully" },
          "400": { description: "Invalid or expired recovery request" },
          "401": { description: "Cryptographic signature verification failed" }
        }
      }
    },
    "/api/auth/pow/challenge": {
        operationId: "getPowChallenge",
      get: {
        tags: ["Authentication"],
        summary: "Get Proof-of-Work challenge",
        description: "Returns PoW salt and difficulty for anti-spam verification. Difficulty scales with request count.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Returns { salt, difficulty }" },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/api/auth/pow/verify": {
        operationId: "verifyPow",
      post: {
        tags: ["Authentication"],
        summary: "Verify Proof-of-Work",
        description: "Verifies Argon2id PoW solution, marks account as verified on success.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nonce"],
                properties: { nonce: { type: "number" } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Account verified" },
          "400": { description: "Invalid PoW solution" }
        }
      }
    },
    "/api/auth/webauthn/register/options": {
        operationId: "getWebAuthnRegisterOptions",
      get: {
        tags: ["Authentication", "WebAuthn"],
        summary: "Get WebAuthn registration options",
        description: "Returns WebAuthn credential creation options for passkey registration.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{
          name: "force",
          in: "query",
          schema: { type: "string", enum: ["true", "false"] },
          description: "Force new registration even if credentials exist"
        }],
        responses: {
          "200": { description: "WebAuthn registration options (PublicKeyCredentialCreationOptions)" },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/api/auth/webauthn/register/verify": {
        operationId: "verifyWebAuthnRegister",
      post: {
        tags: ["Authentication", "WebAuthn"],
        summary: "Verify WebAuthn registration",
        description: "Verifies WebAuthn attestation response and stores authenticator.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Returns { verified: true }" },
          "400": { description: "Verification failed" }
        }
      }
    },
    "/api/auth/webauthn/login/options": {
        operationId: "getWebAuthnLoginOptions",
      get: {
        tags: ["Authentication", "WebAuthn"],
        summary: "Get WebAuthn login options",
        description: "Returns WebAuthn authentication options for passkey login. Sets webauthn_challenge cookie.",
        responses: {
          "200": { description: "WebAuthn authentication options" }
        }
      }
    },
    "/api/auth/webauthn/login/verify": {
        operationId: "verifyWebAuthnLogin",
      post: {
        tags: ["Authentication", "WebAuthn"],
        summary: "Verify WebAuthn login",
        description: "Verifies WebAuthn assertion response. Issues JWT tokens on success.",
        responses: {
          "200": { description: "Returns { verified: true, user, accessToken }" },
          "400": { description: "Verification failed or challenge expired" }
        }
      }
    },
    "/api/csrf-token": {
        operationId: "getCsrfToken",
      get: {
        tags: ["Authentication"],
        summary: "Get CSRF token",
        description: "Generates and returns a CSRF token via double-submit cookie pattern.",
        responses: {
          "200": { description: "Returns { csrfToken: string }" }
        }
      }
    },

    // =========================================================
    // USERS
    // =========================================================
    "/api/users/me": {
        operationId: "getMe",
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        description: "Returns authenticated user's profile including subscription status. Lazy expiration check for SUBSCRIBER tier.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "User profile object" },
          "401": { description: "Unauthorized" }
        }
      },
      put: {
        operationId: "updateMe",
        tags: ["Users"],
        summary: "Update current user profile",
        description: "Updates encrypted profile and auto-destruct settings.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  encryptedProfile: { type: "string", description: "E2E encrypted profile JSON" },
                  autoDestructDays: { type: "number", minimum: 0, maximum: 365 }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated user profile" },
          "401": { description: "Unauthorized" }
        }
      },
      delete: {
        operationId: "deleteMe",
        tags: ["Users"],
        summary: "Delete current user account",
        description: "Permanently deletes account, removes R2 files, clears sessions.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: { type: "string" },
                  fileKeys: { type: "array", items: { type: "string" }, description: "R2 file keys to delete" }
                }
              }
            }
          }
        },
        responses: {
          "204": { description: "Account deleted" },
          "401": { description: "Invalid password or unauthorized" }
        }
      }
    },
    "/api/users/me/devices": {
        operationId: "getDevices",
      get: {
        tags: ["Users", "Devices"],
        summary: "Get user devices",
        description: "Returns list of authenticated user's devices with current device marked.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Array of devices",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      lastActiveAt: { type: "string", format: "date-time" },
                      createdAt: { type: "string", format: "date-time" },
                      isCurrent: { type: "boolean" }
                    }
                  }
                }
              }
            }
          },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/api/users/me/devices/{deviceId}": {
        operationId: "revokeDevice",
      delete: {
        tags: ["Users", "Devices"],
        summary: "Revoke device session",
        description: "Removes a device, deletes its refresh tokens, kicks WebTransport connection.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "deviceId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Device access revoked" },
          "404": { description: "Device not found" }
        }
      }
    },
    "/api/users/me/keys": {
        operationId: "updateUserKeys",
      put: {
        tags: ["Users", "Encryption Keys"],
        summary: "Update public keys",
        description: "Updates E2EE identity keys for the current device.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Keys updated successfully" },
          "400": { description: "Invalid key format" }
        }
      }
    },
    "/api/users/me/complete-onboarding": {
        operationId: "completeOnboarding",
      post: {
        tags: ["Users"],
        summary: "Complete onboarding",
        description: "Marks the user's onboarding as completed.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Onboarding completed" }
        }
      }
    },
    "/api/users/me/blocked": {
        operationId: "getBlockedUsers",
      get: {
        tags: ["Users", "Blocking"],
        summary: "Get blocked users",
        description: "Returns list of users blocked by the authenticated user.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Array of blocked user profiles" }
        }
      }
    },
    "/api/users/me/logout": {
        operationId: "logoutDevice",
      post: {
        tags: ["Users"],
        summary: "Logout current device",
        description: "Clears refresh token and cookies for the current device session.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Logout successful" }
        }
      }
    },
    "/api/users/search": {
        operationId: "searchUsers",
      get: {
        tags: ["Users"],
        summary: "Search users by hash ID",
        description: "Searches users by username hash. Unverified users can only search exact hash IDs.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{
          name: "q",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Username hash to search (43 chars base64url for exact match)"
        }],
        responses: {
          "200": { description: "Array of matching users with public keys" },
          "403": { description: "Sandbox search restriction" }
        }
      }
    },
    "/api/users/{id}": {
        operationId: "getUserById",
      get: {
        tags: ["Users"],
        summary: "Get user by ID",
        description: "Returns minimal public profile for a user.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "User profile" },
          "404": { description: "User not found" }
        }
      }
    },
    "/api/users/{id}/block": {
        operationId: "blockUser",
      post: {
        tags: ["Users", "Blocking"],
        summary: "Block a user",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "User blocked" },
          "400": { description: "Cannot block yourself" },
          "404": { description: "User not found" }
        }
      },
      delete: {
        operationId: "unblockUser",
        tags: ["Users", "Blocking"],
        summary: "Unblock a user",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "User unblocked" }
        }
      }
    },

    // =========================================================
    // CONVERSATIONS
    // =========================================================
    "/api/conversations/sync": {
        operationId: "syncConversations",
      get: {
        tags: ["Conversations"],
        summary: "Sync conversations (Opaque Mailbox)",
        description: "Returns known conversations for the user. Discovers from UserHiddenConversation records and SessionKey backfill.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{
          name: "ids",
          in: "query",
          schema: { type: "string" },
          description: "Comma-separated list of known conversation IDs"
        }],
        responses: {
          "200": { description: "Array of conversation objects (participants empty — stored client-side)" }
        }
      }
    },
    "/api/conversations": {
        operationId: "createConversation",
      post: {
        tags: ["Conversations"],
        summary: "Create a new conversation",
        description: "Creates a conversation (1-1 or group) with Opaque Mailbox architecture. No participant list stored server-side.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userIds"],
                properties: {
                  userIds: { type: "array", items: { type: "string" }, minItems: 1, description: "User IDs to include" },
                  isGroup: { type: "boolean" },
                  encryptedMetadata: { type: "string", description: "E2E encrypted group metadata (required for groups)" },
                  initialSession: {
                    type: "object",
                    properties: {
                      sessionId: { type: "string" },
                      initialKeysPerDevice: { type: "object", additionalProperties: { type: "string" } },
                      initiatorCiphertextsPerDevice: { type: "object", additionalProperties: { type: "string" } }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Conversation created with authSecret" },
          "403": { description: "Sandbox daily limit reached" }
        }
      }
    },
    "/api/conversations/{id}": {
        operationId: "getConversation",
      get: {
        tags: ["Conversations"],
        summary: "Get conversation by ID",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Conversation object" },
          "404": { description: "Conversation not found" }
        }
      },
      delete: {
        operationId: "deleteConversation",
        tags: ["Conversations"],
        summary: "Hide/delete conversation locally",
        description: "Emits conversation:deleted event to the user. Actual data remains in Opaque Mailbox until expired.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "Conversation hidden" }
        }
      }
    },
    "/api/conversations/{id}/details": {
        operationId: "updateConversationDetails",
      put: {
        tags: ["Conversations", "Groups"],
        summary: "Update group details",
        description: "Updates group metadata. Requires X-Group-Token for blind authorization.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Group details updated" },
          "403": { description: "BLIND_AUTH_REQUIRED: Invalid X-Group-Token" }
        }
      }
    },
    "/api/conversations/{id}/participants": {
        operationId: "addConversationParticipants",
      post: {
        tags: ["Conversations", "Groups"],
        summary: "Add participants to group",
        description: "Broadcasts new conversation to added users. Requires X-Group-Token.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "201": { description: "Participants notified" },
          "403": { description: "Invalid X-Group-Token" }
        }
      }
    },
    "/api/conversations/{id}/participants/{userId}": {
        operationId: "removeConversationParticipant",
      delete: {
        tags: ["Conversations", "Groups"],
        summary: "Remove participant from group",
        description: "Broadcasts removal to remaining participants and notifies removed user. Requires X-Group-Token.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "userId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "204": { description: "Participant removed" },
          "404": { description: "Conversation not found" },
          "403": { description: "Invalid X-Group-Token" }
        }
      }
    },
    "/api/conversations/{id}/leave": {
        operationId: "leaveConversation",
      delete: {
        tags: ["Conversations", "Groups"],
        summary: "Leave a group conversation",
        description: "Broadcasts self-removal to remaining participants. Requires X-Group-Token.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "Left the conversation" },
          "403": { description: "Invalid X-Group-Token" }
        }
      }
    },
    "/api/conversations/{id}/pin": {
        operationId: "pinConversation",
      post: {
        tags: ["Conversations"],
        summary: "Toggle pin conversation",
        description: "Pin state is handled client-side in Opaque Mailbox. Server returns ack.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Returns { isPinned: boolean }" }
        }
      }
    },
    "/api/conversations/{id}/key-rotation": {
        operationId: "rotateConversationKey",
      post: {
        tags: ["Conversations", "Encryption Keys"],
        summary: "Record key rotation",
        description: "Updates conversation updatedAt timestamp to signal key rotation.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Key rotation recorded" }
        }
      }
    },

    // =========================================================
    // MESSAGES
    // =========================================================
    "/api/messages": {
        operationId: "sendMessage",
      post: {
        tags: ["Messages"],
        summary: "Send a message (Store & Forward)",
        description: "Stores an encrypted message for offline delivery. Messages auto-expire in 14 days.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["conversationId", "content"],
                properties: {
                  conversationId: { type: "string" },
                  content: { type: "string", maxLength: 20000, description: "E2E encrypted message payload" },
                  sessionId: { type: "string" },
                  tempId: { type: "number", description: "Client-generated temporary ID for optimistic UI" },
                  expiresIn: { type: "number", description: "TTL in seconds (default: 14 days)" },
                  isViewOnce: { type: "boolean" },
                  targetRecipients: { type: "array", items: { type: "string" }, maxItems: 500, description: "Explicit recipient IDs for Opaque Mailbox delivery" }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Message stored. Returns message object with ID." }
        }
      }
    },
    "/api/messages/{conversationId}": {
        operationId: "getMessages",
      get: {
        tags: ["Messages"],
        summary: "Get pending messages (offline catch-up)",
        description: "Returns recent messages (up to 250) and system messages for a conversation. Messages are E2E encrypted — server cannot read them.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Returns { items: Message[] } sorted oldest-first",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/Message" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/messages/{id}": {
        operationId: "deleteMessage",
      delete: {
        tags: ["Messages"],
        summary: "Delete message (file cleanup)",
        description: "Deletes encrypted file from R2 storage. Requires X-Delete-Token for blind authorization.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "r2Key", in: "query", schema: { type: "string" }, description: "R2 file key to delete" }
        ],
        responses: {
          "204": { description: "Message/file deleted" },
          "403": { description: "BLIND_AUTH_REQUIRED: Invalid X-Delete-Token" },
          "404": { description: "Message not found" }
        }
      }
    },
    "/api/messages/{id}/viewed": {
        operationId: "markMessageViewed",
      put: {
        tags: ["Messages"],
        summary: "Mark view-once message as viewed",
        description: "Tombstone endpoint. View-once tracking is handled via E2EE silent messages.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Tombstone acknowledged" }
        }
      }
    },

    // =========================================================
    // ENCRYPTION KEYS
    // =========================================================
    "/api/keys/prekey-bundle": {
        operationId: "uploadPreKeyBundle",
      post: {
        tags: ["Encryption Keys"],
        summary: "Upload pre-key bundle",
        description: "Uploads or updates the device's signed pre-key bundle. Clears existing one-time pre-keys.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "201": { description: "Pre-key bundle updated" },
          "400": { description: "Device ID missing from session" }
        }
      }
    },
    "/api/keys/prekey-bundle/{userId}": {
        operationId: "getPreKeyBundle",
      get: {
        tags: ["Encryption Keys"],
        summary: "Get pre-key bundle for a user",
        description: "Fetches a user's device template + consumes one one-time pre-key (atomic DELETE+RETURN).",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "IPreKeyBundle with optional oneTimePreKey" },
          "404": { description: "User has no active devices" }
        }
      }
    },
    "/api/keys/prekey-bundles": {
        operationId: "getPreKeyBundles",
      post: {
        tags: ["Encryption Keys"],
        summary: "Bulk fetch pre-key bundles",
        description: "Fetches pre-key bundles + consumes OTPKs for multiple users atomically. Max 50 users per request.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userIds"],
                properties: { userIds: { type: "array", items: { type: "string" }, maxItems: 50 } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Map of userId → IPreKeyBundle[]" }
        }
      }
    },
    "/api/keys/public-keys": {
        operationId: "getPublicKeys",
      post: {
        tags: ["Encryption Keys"],
        summary: "Bulk fetch public keys",
        description: "Fetches public keys for multiple users without consuming OTPKs. Uses Redis cache (1 hour TTL).",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userIds"],
                properties: { userIds: { type: "array", items: { type: "string" }, maxItems: 50 } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Map of userId → device bundles[]" }
        }
      }
    },
    "/api/keys/upload-otpk": {
        operationId: "uploadOneTimePreKeys",
      post: {
        tags: ["Encryption Keys"],
        summary: "Upload one-time pre-keys",
        description: "Uploads up to 100 one-time pre-keys (OTPK) for the current device. Used for forward secrecy in X3DH.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "201": { description: "OTPKs uploaded" }
        }
      }
    },
    "/api/keys/count-otpk": {
        operationId: "countOneTimePreKeys",
      get: {
        tags: ["Encryption Keys"],
        summary: "Count one-time pre-keys",
        description: "Returns the number of remaining OTPKs for the current device.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Returns { count: number }" }
        }
      }
    },
    "/api/keys/otpk": {
        operationId: "clearOneTimePreKeys",
      delete: {
        tags: ["Encryption Keys"],
        summary: "Clear one-time pre-keys",
        description: "Deletes all OTPKs for the current device.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "204": { description: "OTPKs cleared" }
        }
      }
    },
    "/api/keys/turn": {
        operationId: "getTurnCredentials",
      get: {
        tags: ["Encryption Keys", "WebRTC"],
        summary: "Get TURN credentials",
        description: "Returns TURN/ICE server credentials for WebRTC calls. Uses Cloudflare TURN if configured, else Google STUN.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Returns { iceServers: [...] }" }
        }
      }
    },
    "/api/keys/initial-session/{conversationId}/{sessionId}": {
        operationId: "getInitialSessionKey",
      get: {
        tags: ["Encryption Keys", "Session Keys"],
        summary: "Get initial session key data",
        description: "Retrieves encrypted initial session key and initiator's ciphertext for a specific conversation+session.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Session key data" },
          "404": { description: "Session data not found" }
        }
      }
    },

    // =========================================================
    // SESSION KEYS
    // =========================================================
    "/api/session-keys/{conversationId}/devices/{deviceId}": {
        operationId: "getSessionKeys",
      get: {
        tags: ["Session Keys"],
        summary: "Get session keys for a conversation+device",
        description: "Fetches E2EE session keys for the specified device in a conversation.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "deviceId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Array of session keys" },
          "403": { description: "Device not found or unauthorized" }
        }
      }
    },
    "/api/session-keys/{conversationId}/ratchet": {
        operationId: "ratchetSessionKeys",
      post: {
        tags: ["Session Keys"],
        summary: "Relay ratcheted session keys",
        description: "Stores client-ratcheted session keys for a conversation. Client-driven Double Ratchet update.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "201": { description: "Session keys relayed" },
          "400": { description: "Missing sessionId or keys" }
        }
      }
    },

    // =========================================================
    // UPLOADS
    // =========================================================
    "/api/uploads/presigned": {
        operationId: "getPresignedUploadUrl",
      post: {
        tags: ["Uploads"],
        summary: "Generate presigned upload URL",
        description: "Generates R2 presigned URL for encrypted file upload. Only application/octet-stream allowed (zero-knowledge enforcement).",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileName", "fileType", "folder"],
                properties: {
                  fileName: { type: "string" },
                  fileType: { type: "string", enum: ["application/octet-stream"] },
                  folder: { type: "string", enum: ["avatars", "attachments", "groups"] },
                  fileSize: { type: "number" },
                  fileRetention: { type: "number", description: "Auto-delete TTL in seconds" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Returns { uploadUrl, key, publicUrl }" },
          "400": { description: "Invalid request or protocol violation" },
          "403": { description: "Unverified users cannot upload" }
        }
      }
    },
    "/api/uploads/burner-presigned": {
        operationId: "getBurnerPresignedUrl",
      post: {
        tags: ["Uploads"],
        summary: "Generate burner presigned upload URL",
        description: "Presigned URL for anonymous burner chat file uploads. Max 50MB, no auth required.",
        responses: {
          "200": { description: "Returns { uploadUrl, key, publicUrl }" },
          "400": { description: "Invalid request" }
        }
      }
    },
    "/api/uploads/groups/{id}/avatar": {
        operationId: "uploadGroupAvatar",
      post: {
        tags: ["Uploads", "Groups"],
        summary: "Upload group avatar",
        description: "Generates presigned URL for group avatar upload. Original fileUrl endpoint returns URL for client to use in encrypted metadata.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Returns { fileUrl, fileKey }" },
          "404": { description: "Group not found" }
        }
      }
    },

    // =========================================================
    // SYSTEM
    // =========================================================
    "/api/system/status": {
        operationId: "getSystemStatus",
      get: {
        tags: ["System"],
        summary: "Get system status",
        description: "Returns maintenance mode and banner status from Redis. Degrades gracefully if Redis is down.",
        responses: {
          "200": {
            description: "System status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    maintenance: { type: "boolean" },
                    banner: {
                      type: "object",
                      properties: {
                        active: { type: "boolean" },
                        message: { type: "string" },
                        type: { type: "string", enum: ["info", "warning", "error"] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/system/openapi.json": {
        operationId: "getOpenApiSpec",
      get: {
        tags: ["System"],
        summary: "Get OpenAPI specification",
        description: "Returns the complete OpenAPI 3.0.3 specification for the NYX Chat API.",
        responses: {
          "200": {
            description: "OpenAPI spec",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },

    // =========================================================
    // SESSIONS
    // =========================================================
    "/api/sessions": {
      get: {
        tags: ["Sessions"],
        summary: "List active sessions",
        operationId: "listSessions",
        description: "Returns all active (non-revoked) refresh token sessions for the current user. Includes device info and IP masking.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Returns { sessions: Array} with device info, IP (masked), isCurrent flag",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          jti: { type: "string" },
                          deviceId: { type: "string" },
                          deviceName: { type: "string" },
                          ipAddress: { type: "string", description: "IP address hash — masked as 'Hidden for privacy' for non-matching sessions" },
                          isCurrent: { type: "boolean" },
                          deviceInfo: { type: "string" },
                          lastUsedAt: { type: "string", format: "date-time" },
                          createdAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/api/sessions/{jti}": {
      delete: {
        tags: ["Sessions"],
        summary: "Revoke a specific session",
        operationId: "revokeSession",
        description: "Revokes a refresh token session by JTI, including entire token family. Sends force_logout + KICK to affected device.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "jti", in: "path", required: true, schema: { type: "string" }, description: "JWT Token ID to revoke" }],
        responses: {
          "204": { description: "Session revoked successfully" },
          "401": { description: "Unauthorized" },
          "404": { description: "Session not found or unauthorized" }
        }
      }
    },

    // =========================================================
    // AI — SMART REPLY
    // =========================================================
    "/api/ai/smart-reply": {
      post: {
        tags: ["AI"],
        summary: "Generate smart replies with Gemini AI",
        operationId: "generateSmartReplies",
        description: "Generates 3 short contextual reply suggestions using Gemini 2.5 Flash. Rate-limited to prevent abuse.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string", description: "Incoming message to generate replies for" } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Returns { replies: string[] } — up to 3 short suggestions" },
          "400": { description: "Message is required" },
          "500": { description: "AI generation failed" }
        }
      }
    },

    // =========================================================
    // LINK PREVIEWS
    // =========================================================
    "/api/previews": {
      post: {
        tags: ["Link Previews"],
        summary: "Get link preview metadata",
        operationId: "getLinkPreview",
        description: "Fetches and extracts Open Graph metadata from a URL for rich link previews. SSRF-protected via secure link preview utility.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: { url: { type: "string", format: "uri", description: "Target URL to extract preview from" } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Returns link preview with title, description, image, etc." },
          "400": { description: "URL is required or preview extraction failed" },
          "404": { description: "Could not generate preview for this link" }
        }
      }
    },
    "/api/previews/image": {
      get: {
        tags: ["Link Previews"],
        summary: "Proxy preview image",
        operationId: "proxyPreviewImage",
        description: "Fetches and proxies an image for link preview display. Enforces 5MB limit, SSRF protection, and image content-type validation.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{
          name: "url",
          in: "query",
          required: true,
          schema: { type: "string", format: "uri" },
          description: "Image URL to proxy"
        }],
        responses: {
          "200": { description: "Image binary with Cache-Control: public, max-age=86400" },
          "400": { description: "Image fetch failed, exceeds 5MB, or invalid content-type" }
        }
      }
    },

    // =========================================================
    // REPORTS
    // =========================================================
    "/api/reports": {
      post: {
        tags: ["Reports"],
        summary: "Submit a bug report",
        operationId: "submitBugReport",
        description: "Submits a bug report to the configured Discord webhook. Degrades gracefully if webhook URL is not configured.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description"],
                properties: {
                  title: { type: "string", description: "Bug report title" },
                  description: { type: "string", description: "Detailed bug description" },
                  deviceInfo: { type: "string", description: "Client device/browser information" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Report submitted successfully" }
        }
      }
    },
    "/api/reports/user": {
      post: {
        tags: ["Reports"],
        summary: "Report a user",
        operationId: "reportUser",
        description: "Reports a user to the configured Discord webhook for moderation review.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reportedUserId", "reason"],
                properties: {
                  reportedUserId: { type: "string", description: "ID of the user being reported" },
                  reason: { type: "string", description: "Reason for the report" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Report submitted successfully" },
          "500": { description: "Failed to send report" }
        }
      }
    },

    // =========================================================
    // SUBSCRIPTIONS & PAYMENTS
    // =========================================================
    "/api/subscriptions/create": {
      post: {
        tags: ["Subscriptions"],
        summary: "Create Tripay payment",
        operationId: "createTripayPayment",
        description: "Creates a Tripay payment transaction for NYX PRO subscription (Rp 55.000/30 days). Returns checkout URL.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  method: { type: "string", description: "Payment method (default: QRIS)", enum: ["QRIS", "VIRTUAL_ACCOUNT", "CONVENIENCE_STORE"] }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Returns { checkout_url: string }" },
          "400": { description: "Already a subscriber" },
          "401": { description: "Unauthorized" },
          "500": { description: "Payment creation failed" }
        }
      }
    },
    "/api/subscriptions/webhook": {
      post: {
        tags: ["Subscriptions"],
        summary: "Tripay payment webhook",
        operationId: "tripayWebhook",
        description: "Receives Tripay payment status callbacks. Verifies HMAC signature, upgrades user to SUBSCRIBER on PAID status.",
        responses: {
          "200": { description: "Webhook processed" },
          "400": { description: "Invalid signature or order ID format" }
        }
      }
    },
    "/api/subscriptions/create-crypto-transaction": {
      post: {
        tags: ["Subscriptions"],
        summary: "Create NOWPayments crypto invoice",
        operationId: "createCryptoInvoice",
        description: "Creates a cryptocurrency payment invoice via NOWPayments for NYX PRO subscription.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Returns { invoice_url: string }" },
          "400": { description: "Already a subscriber" },
          "500": { description: "Invoice creation failed" }
        }
      }
    },
    "/api/subscriptions/nowpayments-webhook": {
      post: {
        tags: ["Subscriptions"],
        summary: "NOWPayments IPN webhook",
        operationId: "nowPaymentsWebhook",
        description: "Receives NOWPayments Instant Payment Notification. Verifies HMAC-SHA512 signature, upgrades user on 'finished' status.",
        responses: {
          "200": { description: "Webhook processed" },
          "400": { description: "Invalid order ID format" },
          "403": { description: "Invalid signature" }
        }
      }
    },

    // =========================================================
    // ENGINE (B2B)
    // =========================================================
    "/api/engine/rooms": {
      post: {
        tags: ["Engine (B2B)"],
        summary: "Create B2B encrypted conversation room",
        operationId: "createB2BRoom",
        description: "Creates a 2-party encrypted conversation room for B2B tenants. Uses tenant API key for authentication (not user JWT). Auto-creates user accounts if they don't exist. Returns embed URLs with JWT tokens.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userA", "userB"],
                properties: {
                  userA: {
                    type: "object",
                    required: ["externalId"],
                    properties: {
                      externalId: { type: "string", description: "Tenant-specific external user ID for party A" },
                      displayName: { type: "string" }
                    }
                  },
                  userB: {
                    type: "object",
                    required: ["externalId"],
                    properties: {
                      externalId: { type: "string", description: "Tenant-specific external user ID for party B" },
                      displayName: { type: "string" }
                    }
                  },
                  metadata: { type: "object", description: "Optional conversation metadata" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Returns { userAUrl, userBUrl } — embed chat URLs with access tokens" },
          "400": { description: "Missing externalId for userA or userB" },
          "500": { description: "Room creation failed" }
        }
      }
    },

    // =========================================================
    // STORIES
    // =========================================================
    "/api/stories": {
        operationId: "createStory",
      post: {
        tags: ["Stories"],
        summary: "Create a story",
        description: "Creates a new story that auto-expires after 24 hours.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["encryptedPayload"],
                properties: { encryptedPayload: { type: "string" } }
              }
            }
          }
        },
        responses: {
          "201": { description: "Story created" },
          "400": { description: "Invalid payload" }
        }
      }
    },
    "/api/stories/user/{userId}": {
        operationId: "getUserStories",
      get: {
        tags: ["Stories"],
        summary: "Get active stories for user",
        description: "Returns all active (non-expired) stories for a specific user.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Array of active stories" }
        }
      }
    },
    "/api/stories/{id}": {
        operationId: "getStory",
      get: {
        tags: ["Stories"],
        summary: "Get story by ID",
        description: "Returns a story if it hasn't expired.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Story object" },
          "404": { description: "Story not found" },
          "410": { description: "Story has expired" }
        }
      },
      delete: {
        operationId: "deleteStory",
        tags: ["Stories"],
        summary: "Delete own story",
        description: "Deletes a story. Only the sender can delete their own stories.",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Story deleted" },
          "403": { description: "Unauthorized to delete this story" },
          "404": { description: "Story not found" }
        }
      }
    },

    // =========================================================
    // HEALTH
    // =========================================================
    "/health": {
        operationId: "healthCheck",
      get: {
        tags: ["System"],
        summary: "Health check",
        description: "Simple health check endpoint. Returns OK status.",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok bang" } }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "at",
        description: "Access token cookie (JWT, 15min TTL). Obtained via POST /api/auth/login or /api/auth/register."
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token in Authorization header. Format: Bearer <token>"
      }
    },
    schemas: {
      Message: {
        type: "object",
        properties: {
          id: { type: "string", description: "Message ID" },
          conversationId: { type: "string" },
          senderId: { type: "string", description: "Null for Opaque Mailbox (sealed sender)" },
          content: { type: "string", description: "E2E encrypted ciphertext" },
          ciphertext: { type: "string" },
          type: { type: "string", enum: ["USER", "SYSTEM"] },
          createdAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          isViewOnce: { type: "boolean" },
          sessionId: { type: "string", nullable: true },
          repliedToId: { type: "string" },
          tempId: { type: "number" },
          fileUrl: { type: "string", nullable: true },
          fileKey: { type: "string", nullable: true },
          fileName: { type: "string", nullable: true },
          fileType: { type: "string" },
          fileSize: { type: "number" },
          isBlindAttachment: { type: "boolean" },
          linkPreview: { type: "object" }
        }
      },
      Conversation: {
        type: "object",
        properties: {
          id: { type: "string" },
          isGroup: { type: "boolean" },
          encryptedMetadata: { type: "string", nullable: true },
          creatorId: { type: "string", nullable: true },
          participants: { type: "array", items: { type: "object" }, description: "Empty in Opaque Mailbox responses — stored client-side" },
          lastMessageAt: { type: "string", format: "date-time" },
          unreadCount: { type: "number" },
          encryptionMode: { type: "string", enum: ["SENDER_KEY", "PQ_DR", "SPQR"] },
          authSecret: { type: "string", description: "Group management auth secret (returned on creation only)" }
        }
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          usernameHash: { type: "string" },
          encryptedProfile: { type: "string", nullable: true },
          isVerified: { type: "boolean" },
          role: { type: "string", enum: ["USER", "ADMIN", "GUEST"] },
          subscriptionTier: { type: "string", enum: ["FREE", "SUBSCRIBER"] },
          hasCompletedOnboarding: { type: "boolean" }
        }
      },
      ApiError: {
        type: "object",
        properties: {
          error: { type: "string", description: "Error message" },
          reason: { type: "string", description: "Additional context (e.g., ban reason)" }
        }
      }
    }
  },
  tags: [
    { name: "Authentication", description: "Auth, registration, WebAuthn, PoW" },
    { name: "Users", description: "User profiles, devices, blocking" },
    { name: "Conversations", description: "Inbox sync, create/manage conversations" },
    { name: "Messages", description: "Send/receive messages" },
    { name: "Encryption Keys", description: "Pre-key bundles, OTPK management" },
    { name: "Session Keys", description: "E2EE session key relay" },
    { name: "Uploads", description: "File upload presigned URLs" },
    { name: "Stories", description: "Ephemeral stories" },
    { name: "System", description: "Health, status, OpenAPI spec" },
    { name: "WebAuthn", description: "Passkey authentication" },
    { name: "Devices", description: "Device management" },
    { name: "Blocking", description: "User blocking management" },
    { name: "Groups", description: "Group conversation management" },
    { name: "Sessions", description: "Session management & remote logout" },
    { name: "AI", description: "AI-powered smart replies" },
    { name: "Link Previews", description: "Rich link preview metadata extraction" },
    { name: "Reports", description: "Bug reports and user moderation reports" },
    { name: "Subscriptions", description: "Payment processing (Tripay + NOWPayments)" },
    { name: "Engine (B2B)", description: "B2B encrypted conversation rooms" }
  ]
};

export default spec;
