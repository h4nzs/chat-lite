# NYX Chat — Agent Authentication

## Overview

NYX Chat is a zero-knowledge, end-to-end encrypted messaging platform.
AI agents can authenticate with the API to send/receive messages programmatically.

## Authentication Methods

### Bearer Token (Recommended for Agents)

1. Register a user account via the web app at https://app.nyx-app.my.id
2. Generate an API token in Settings → API Keys
3. Include the token in requests: `Authorization: Bearer <token>`

### Session Cookie (Web-based Agents)

Standard session authentication via cookie is supported for browser-based agents.

## Scopes

- `messages:read` — Read messages from your conversations
- `messages:write` — Send messages to your conversations
- `conversations:read` — List your conversations
- `conversations:write` — Create/manage conversations
- `profile:read` — Read your profile
- `profile:write` — Update your profile

## Agent Requirements

- All messages are end-to-end encrypted
- Agents must support the NYX E2EE protocol for message encryption/decryption
- Rate limits apply: 100 requests/minute per user
- WebSocket connections require authentication via token

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login with credentials |
| POST | /api/auth/register | Register new account |
| GET  | /api/conversations | List conversations |
| GET  | /api/messages/{id} | Get messages |
| POST | /api/messages | Send message |
| GET  | /health | Health check |

## Support

For agent integration support: admin@nyx-app.my.id
API docs: https://nyx-app.my.id/api-docs
