# 23 — Shared Package & Rust Sidecar Reference

## 23.1 `packages/shared` (`@nyx/shared`)

Consumed from `dist/` — after editing `packages/shared/src`, run `pnpm --filter @nyx/shared run build` before typechecking web/server (the changes are otherwise invisible).

### `brands.ts`
Branded nominal types (`UserId`, `ConversationId`, `MessageId`, `StoryId`) + cast helpers `asUserId` / `asConversationId` / `asMessageId` / `asStoryId`. Used everywhere to prevent id-type confusion.

### `constants.ts`
- `LIMITS` — per-tier rate/group/upload limits (UNVERIFIED 5 msg/min & 0 groups & no uploads; FREE 15 / 100 members / 100 MB; SUBSCRIBER 50 / 500 / 500 MB; avatar 5 MB).
- `enum SubscriptionTier { FREE, SUBSCRIBER }`.

### `schemas.ts` (271 L)
- **Zod jitless bootstrap:** `globalThis.__zod_globalConfig.jitless = true` (direct mutation — `zod.config()` is tree-shaken). Must stay.
- Branded id schemas, `EncryptionModeEnum` (`SENDER_KEY | PQ_DR | SPQR`), `MinimalUserSchema`, `ParticipantSchema`, `ConversationSchema` (recursive `lastMessage`), `ConversationUiSchema`.
- `MessageSendPayloadSchema` (client send), `IncomingMessageSchema` (safe date preprocessing + `.passthrough()`), `RawServerMessageSchema` (recursive `repliedTo`), `ShadowVaultMessageSchema`, `WebRTCSignalingSchema`, `DistributeKeysPayloadSchema`, `KeyRequest/GroupKeyRequest/KeyFulfillment/PushSubscribe` payload schemas.

### `socket.ts` (191 L)
- `ServerToClientEvents` (~40): message/conversation/user/session/group events, `force_logout`, `auth:banned`, `webrtc:secure_signal`, `migration:*`, `burner:receive/terminated`, `subscription_updated`, …
- `ClientToServerEvents` (~25): presence, `message:send`, session/group keys, push, webrtc, migration, `message:unsend`, `message:view_once_opened`, `burner:*`, …
- Payload interfaces (`TypingPayload`, `MessageSendPayload`, `MarkAsReadPayload`, …).

### `transport.ts` (33 L)
- `enum TransportOpCode`: `CHAFF=0x00, CHAT_MESSAGE=0x01, KEY_SYNC=0x02, WEBRTC_SIGNAL=0x03, WEBRTC_ICE=0x04, PRESENCE=0x05, ACK=0x06, KICK=0x07, HANDSHAKE=0x0A`.
- `BinaryPayload`, `WebRtcSignalPayload`, `TransportWorkerToMain`/`MainToTransportWorker` worker messages.

### `types.ts` (232 L)
`User`, `ProfileUser`, `Message`, `Participant`, `Conversation`/`ConversationUi` (with `decryptedMetadata`), `Story`, `EncryptedPayload`, `AuthJwtPayload`, `DoubleRatchetState`, `ISignedPreKey`, `IOneTimePreKey`, `IPreKeyBundle`, `SystemMessagePayload` + group-key payloads.

### `index.ts` — re-exports everything.

## 23.2 Rust transport sidecar (`server/transport-sidecar/src/main.rs`, 562 L)

Single-file binary on `wtransport 0.7` + `rcgen`, `tokio`, `redis`, `jsonwebtoken`, `dashmap`, `serde`, `data-encoding`, `uuid`, `time`, `url`.

### Startup
1. **TLS cert**: prod → `PROD_CERT_PATH`/`PROD_KEY_PATH`; dev → persistent self-signed DER (`transport_cert.der`/`transport_key.der`), SAN localhost/127.0.0.1, 10-day validity. Prints the **SHA-256 cert hash** → paste into `web/.env` as `VITE_TRANSPORT_CERT_HASH`.
2. Bind `0.0.0.0:TRANSPORT_PORT` (default 33333, UDP).
3. Subscribe `nyx:downstream` (reconnect loop 3 s); frames `[op|len(4 BE)|payload]`; `0x07` KICK → `conn.close(1000, "Kicked by server")`; route by `user:device:` prefix or broadcast `user:`.

### Auth (two paths)
1. **URL ticket** `?ticket=` (HS256 JWT, 15 s exp).
2. **Bidi AUTH frame** `[0x00][len][token]` (≤4096 bytes) → verify JWT → `id|sub` + `deviceId`.

### `handle_connection`
- **Single active device:** scan `user:` sessions in the `DashMap<String, Arc<Connection>>` → kick old ("Logged in on another device"); insert `{user}:{device}:{uuid}`.
- Three reader loops: **bidi** (drop `0x00` chaff; max 32 KB; `0x0A` → ACK `[0x06,0,0,0,0]`), **uni-stream**, **datagram** — each publishes to `nyx:upstream:<opcode>`.
- On `conn.closed()`: remove session + publish opcode `99` (disconnect) for Node cleanup.

### Hardcoded opcodes (must stay in sync with `packages/shared/src/transport.ts`)
`0x00` (chaff/ignore), `0x0A` (handshake + ACK), `0x07` (KICK), `99` (disconnect). All other opcodes are passed through opaquely.

## 23.3 Files to know

| File | Role |
|---|---|
| `packages/shared/src/transport.ts` | `TransportOpCode` (canonical opcode source) |
| `packages/shared/src/socket.ts` | event maps |
| `packages/shared/src/schemas.ts` | Zod validation + jitless |
| `packages/shared/src/brands.ts` | branded id types |
| `server/transport-sidecar/src/main.rs` | QUIC termination, session map, kick, chaff |
