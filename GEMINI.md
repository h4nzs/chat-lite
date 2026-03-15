# NYX - Zero-Knowledge Messenger

> **Context for AI Agents:** This document outlines the architecture, security protocols, and development standards for the NYX project.

## 1. Project Overview

NYX is a privacy-first, zero-knowledge messaging application that operates without collecting Personally Identifiable Information (PII). It decouples digital identity from physical identity using a "Trust No One" (TNO) architecture.

*   **Core Principle:** The server cannot read messages or identify users.
*   **Identity:** Blind Indexing (Argon2id hashing of usernames). No emails or phone numbers.
*   **Storage:** Local-first (IndexedDB) for messages; Server stores only encrypted blobs and delivery metadata.

## 2. Architecture

The project is structured as a monorepo managed by `pnpm`.

### Tech Stack

*   **Frontend (`web/`):**
    *   **Framework:** React 19 + Vite 7 (TypeScript)
    *   **State:** Zustand v5
    *   **Styling:** Tailwind CSS v4
    *   **Crypto:** `libsodium-wrappers` (WASM), Web Workers for off-main-thread encryption.
    *   **Storage:** IndexedDB (`idb-keyval`, `dexie`) for the "Shadow Vault".
*   **Backend (`server/`):**
    *   **Runtime:** Node.js (Express)
    *   **Database:** PostgreSQL 15 + Prisma ORM v7
    *   **Real-time:** Socket.IO v4 + Redis Adapter
    *   **Storage:** Cloudflare R2 (Encrypted binary blobs)
*   **Infrastructure:** Docker Compose (Postgres, Redis, API, Web).

### Key Directories

*   `server/`: Backend API and Socket.IO server.
    *   `src/routes/`: API endpoints (Auth, Messages, Keys).
    *   `src/middleware/`: Auth and Rate Limiting.
    *   `prisma/`: Database schema and migrations.
*   `web/`: Frontend PWA.
    *   `src/utils/crypto.ts`: Core cryptographic operations (Signal Protocol).
    *   `src/lib/`: Low-level helpers (Sodium, Workers, Database).
    *   `src/store/`: State management (Auth, Messages).

## 3. Security & Cryptography

### Zero-Knowledge Authentication (`server/src/routes/auth.ts`)

1.  **Registration:**
    *   Client hashes username: `Argon2id(username) -> usernameHash`.
    *   Client generates Key Pairs: Identity Key, Signed PreKey, One-Time PreKeys.
    *   Server receives: `usernameHash`, `passwordHash`, `encryptedProfile`, and Public Keys.
    *   Server **never** sees the plaintext username.
2.  **Login:**
    *   User authenticates with `usernameHash` and `password`.
    *   Server issues JWTs (`at` access token, `rt` refresh token) in HTTP-Only cookies.
3.  **Trust Tiers:**
    *   **Sandbox:** Default state. Restricted.
    *   **Verified:** Unlocked via WebAuthn (FIDO2) or Proof-of-Work (SHA-256 puzzle).

### Signal Protocol Implementation

*   **Key Exchange:** X3DH (Extended Triple Diffie-Hellman).
*   **Encryption:** Double Ratchet Algorithm for Perfect Forward Secrecy (PFS).
*   **Primitives:** XChaCha20-Poly1305, Ed25519, SHA-256.
*   **Location:**
    *   `web/src/utils/crypto.ts`: High-level protocol logic.
    *   `web/src/lib/crypto-worker-proxy.ts`: Offloads heavy crypto to Web Worker.
    *   `server/prisma/schema.prisma`: Stores public key bundles (`PreKeyBundle`, `OneTimePreKey`).

## 4. Database Schema (`server/prisma/schema.prisma`)

*   **`User`:** Stores `usernameHash`, `encryptedProfile`, and `isVerified`. No PII fields.
*   **`Message`:** Stores encrypted content blobs (`content`), `senderId`, `sessionId`.
    *   **Blind Indexing:** Messages are indexed by `senderId` and `conversationId`, but content is opaque.
*   **`SessionKey` / `PreKeyBundle`:** Infrastructure for the Signal Protocol key exchange.
*   **`OneTimePreKey`:** Replenishable keys for asynchronous communication.

## 5. Development Workflow

### Setup & Run

1.  **Install Dependencies:**
    ```bash
    pnpm install
    ```
2.  **Environment Setup:**
    *   Copy `.env.example` to `server/.env` and `web/.env`.
    *   Ensure `DATABASE_URL` and `JWT_SECRET` are set.
3.  **Database:**
    ```bash
    cd server
    npx prisma db push
    ```
4.  **Start Development:**
    *   **Root:** `pnpm run build` (Builds both)
    *   **Server:** `cd server && pnpm dev`
    *   **Web:** `cd web && pnpm dev`
    *   **Docker:** `docker-compose up --build`

### Conventions

*   **Linting:** ESLint v10 (Flat Config). Run `pnpm lint` before committing.
*   **Formatting:** Prettier.
*   **Commits:** Use descriptive messages.
*   **Crypto:** **NEVER** modify `libsodium-wrappers` version or usage without explicit instruction. Backward compatibility is critical.

## 6. Critical Constraints

*   **No PII:** Do not add fields for email, phone, or real names to the database.
*   **Local-First:** Chat history is authoritative on the client (IndexedDB). The server is a relay.
*   **Security:** Always use `safeUser` objects in API responses. Never return `passwordHash` or raw secrets.
