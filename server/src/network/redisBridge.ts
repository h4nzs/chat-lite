import { createClient, type RedisClientType } from 'redis';
import { prisma } from '../lib/prisma.js';
import { redisClient } from '../lib/redis.js';
import { getSodium } from '../lib/sodium.js';
import { toRawServerMessage } from '../utils/mappers.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';
import { sanitizeForLog } from '../utils/logger.js';
import { safeEqualStrings } from '../utils/validate.js';
import { TransportOpCode, MessageSendPayloadSchema } from '@nyx/shared';
import type { MessageSendPayload, ServerToClientEvents, ClientToServerEvents, RawServerMessage, KeyRequestPayload, KeyFulfillmentPayload, GroupKeyRequestPayload, DistributeKeysPayload, PushSubscribePayload } from '@nyx/shared';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Unified connection management
export const pubClient: RedisClientType = createClient({ url: redisUrl });
export const subClient: RedisClientType = pubClient.duplicate();

export async function initializeRedisBridge() {
  await Promise.all([pubClient.connect(), subClient.connect()]);
  console.log('🌐 Redis Bridge initialized and connected.');

  // Subscribe to all upstream messages from Rust Sidecar
  await subClient.pSubscribe('nyx:upstream:*', async (message, channel) => {
    try {
      const opCode = parseInt(channel.split(':').pop() || '0', 10);
      const data = JSON.parse(message) as { user_id: string; device_id: string; op_code: number; payload: string; msgId?: string };
      
      await handleUpstreamMessage(data.user_id, data.device_id, opCode, data.payload, data.msgId);
    } catch (error) {
      console.error('❌ Error processing upstream message:', error);
    }
  });
}

/**
 * Sends a message to the Rust Sidecar to be delivered to a specific client.
 */
export async function sendToUser(targetUserId: string, opCode: TransportOpCode, base64Payload: string, isDatagram = false, deviceId?: string) {
  const downstreamPayload = {
    user_id: targetUserId,
    device_id: deviceId,
    op_code: opCode,
    is_datagram: isDatagram,
    payload: base64Payload
  };
  await pubClient.publish('nyx:downstream', JSON.stringify(downstreamPayload));
}

export async function sendToDevice(targetUserId: string, targetDeviceId: string, opCode: TransportOpCode, base64Payload: string, isDatagram = false) {
  await sendToUser(targetUserId, opCode, base64Payload, isDatagram, targetDeviceId);
}

/**
 * Emits a named event to a specific user (legacy compatibility).
 */
export async function emitEventToUser(userId: string, event: string, data: unknown, deviceId?: string) {
  await sendJsonToUser(userId, TransportOpCode.KEY_SYNC, { event, data }, false, deviceId);
}

/**
 * Emits a named event to multiple users.
 */
export async function emitEventToUsers(userIds: string[], event: string, data: unknown) {
  await Promise.all(userIds.map(userId => emitEventToUser(userId, event, data)));
}

/**
 * Utility to send JSON payload (encoded to Base64) to a user.
 */
export async function sendJsonToUser(targetUserId: string, opCode: TransportOpCode, data: unknown, isDatagram = false, deviceId?: string) {
  const base64 = Buffer.from(JSON.stringify(data)).toString('base64');
  await sendToUser(targetUserId, opCode, base64, isDatagram, deviceId);
}

/**
 * Broadcasts a message to multiple users.
 */
export async function broadcastToUsers(userIds: string[], opCode: TransportOpCode, data: unknown) {
  await Promise.all(userIds.map(userId => sendJsonToUser(userId, opCode, data)));
}

// 🔒 Single active device check (per-opcode) dengan cache lokal 60 detik.
// Migration mode membolehkan device lama & baru bersamaan (sama seperti AUTH).
const activeDeviceCache = new Map<string, { deviceId: string; expiresAt: number }>();

async function isActiveDeviceAllowed(userId: string, deviceId: string): Promise<boolean> {
  const now = Date.now();
  const cached = activeDeviceCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.deviceId === '' || cached.deviceId === deviceId;
  }
  const isMigrating = await redisClient.exists(`is_migrating:${userId}`).catch(() => 0);
  if (isMigrating) {
    activeDeviceCache.set(userId, { deviceId: '', expiresAt: now + 30000 });
    return true;
  }
  const active = await redisClient.get(`active_device:${userId}`).catch(() => null);
  activeDeviceCache.set(userId, { deviceId: active ?? '', expiresAt: now + 60000 });
  return !active || active === deviceId;
}

async function handleUpstreamMessage(userId: string, deviceId: string, opCode: number, base64Payload: string, _msgIdFromWrapper?: string) {  const buffer = Buffer.from(base64Payload, 'base64');
  const payloadStr = buffer.toString('utf-8');
  let payload: Record<string, unknown>;
  
  try {
    payload = JSON.parse(payloadStr) as Record<string, unknown>;
  } catch (e) {
    payload = { raw: payloadStr };
  }
  
  const msgId = typeof payload?.msgId === 'string' ? payload.msgId : undefined;

  // 🔒 SINGLE ACTIVE DEVICE — dicek untuk SETIAP opcode data (bukan hanya auth).
  // Device yang di-kick (login di perangkat lain) tidak boleh terus mengirim pesan
  // sampai melakukan re-auth. Cache lokal 60 detik untuk hindari Redis GET beruntun.
  if (opCode !== 0x00 && opCode !== 99) {
    const allowed = await isActiveDeviceAllowed(userId, deviceId);
    if (!allowed) {
      console.warn(`[Security] Blocked opcode ${opCode} from non-active device ${sanitizeForLog(deviceId)} (user ${sanitizeForLog(userId)})`);
      return;
    }
  }

  switch (opCode) {
    case TransportOpCode.CHAT_MESSAGE:
      await handleChatMessage(userId, deviceId, payload as unknown as MessageSendPayload, msgId);
      break;
    case TransportOpCode.WEBRTC_SIGNAL:
      await handleWebRtcRelay(userId, payload as { to: string, type: string, payload: string }, TransportOpCode.WEBRTC_SIGNAL);
      break;
    case TransportOpCode.WEBRTC_ICE:
      await handleWebRtcRelay(userId, payload as { to: string, type: string, payload: string }, TransportOpCode.WEBRTC_ICE);
      break;
    case TransportOpCode.PRESENCE:
      await handlePresence(userId, payload as { event: 'active' | 'away' | 'typing:start' | 'typing:stop', conversationId?: string });
      break;
    case TransportOpCode.KEY_SYNC:
      await handleKeySync(userId, deviceId, payload as { event: string, msgId: string, data: Record<string, unknown> }, msgId);
      break;
    case 99: // DISCONNECT
      await handleDisconnect(userId);
      break;
    case 0x00: // AUTH (Lapis 1 & 2 Security: Session & Hardware Binding)
      try {
        // Payload OpCode 0x00 sekarang adalah JSON string: { token: string, identity: { fingerprint, installationId } }
        let authData: { token: string, identity?: { fingerprint: string, installationId: string } };
        try {
           const parsed = JSON.parse(payloadStr) as unknown;
           if (typeof parsed === 'object' && parsed !== null && 'token' in parsed) {
             authData = parsed as { token: string, identity?: { fingerprint: string, installationId: string } };
           } else {
             authData = { token: payloadStr };
           }
        } catch (e) {
           // Fallback untuk klien lama yang hanya mengirim token sebagai string mentah
           authData = { token: payloadStr };
        }

        // 🛡️ LAPIS 1: SINGLE ACTIVE DEVICE CHECK
        const activeDeviceId = await redisClient.get(`active_device:${userId}`);
        const isMigrating = await redisClient.exists(`is_migrating:${userId}`);
        
        if (activeDeviceId && activeDeviceId !== deviceId && !isMigrating) {
          console.warn(`[Security-L1] Revoked device ${deviceId} (User ${userId}) tried to connect. Kicking...`);
          const kickPayload = Buffer.from(JSON.stringify({ 
            reason: 'SESSION_REVOKED', 
            deviceId,
            message: 'You have been logged in from another device.' 
          })).toString('base64');
          await sendToDevice(userId, deviceId, TransportOpCode.KICK, kickPayload);
          return;
        }

        // 🛡️ LAPIS 2: HARDWARE BINDING (FINGERPRINT CHECK)
        const device = await prisma.device.findUnique({
          where: { id: deviceId },
          select: { fingerprint: true, installationId: true }
        });

        if (device && device.fingerprint) {
           // 🛡️ PERBAIKAN: Cegah bypass dengan menghilangkan payload 'identity'
           if (!authData.identity) {
              console.warn(`[Security-L2] Missing identity payload from device ${deviceId} (User ${userId}). Kicking...`);
              const kickPayload = Buffer.from(JSON.stringify({ 
                reason: 'HARDWARE_MISMATCH', 
                deviceId,
                message: 'Security Alert: Incomplete device identity. Please login again.' 
              })).toString('base64');
              await sendToDevice(userId, deviceId, TransportOpCode.KICK, kickPayload);
              return;
           }

           const isFingerprintMatch = device.fingerprint === authData.identity.fingerprint;
           // Kita beri toleransi: Jika installationId (Anchor) cocok, kita izinkan meskipun fingerprint browser berubah sedikit
           const isAnchorMatch = device.installationId && device.installationId === authData.identity.installationId;

           if (!isFingerprintMatch && !isAnchorMatch) {
              console.warn(`[Security-L2] Hardware mismatch for device ${deviceId} (User ${userId}). Possible session cloning. Kicking...`);
              const kickPayload = Buffer.from(JSON.stringify({ 
                reason: 'HARDWARE_MISMATCH', 
                deviceId,
                message: 'Security Alert: Device identity mismatch. Please login again.' 
              })).toString('base64');
              await sendToDevice(userId, deviceId, TransportOpCode.KICK, kickPayload);
              return;
           }
        }
      } catch (err) {
        console.error('[Security] Failed to verify session binding:', err);
      }
      break;
    default:
      console.warn(`⚠️ Unhandled OpCode: 0x${opCode.toString(16)} from user ${userId}`);
  }
  }

  async function handleDisconnect(userId: string) {
  await pubClient.sRem('online_users', userId);

  // Cleanup presence and rooms
  const onlineUsers = await pubClient.sMembers('online_users');
  await broadcastToUsers(onlineUsers, TransportOpCode.PRESENCE, { event: 'leave', userId });

  // Optional: Best-effort cleanup for burner/migration rooms
  try {
    let cursor = '0';
    do {
      const result = await pubClient.scan(cursor, { MATCH: 'burner:room:*', COUNT: 100 });
      cursor = result.cursor;
      for (const key of result.keys) {
        await pubClient.sRem(key, userId);
      }
    } while (cursor !== '0');

    cursor = '0';
    do {
      const result = await pubClient.scan(cursor, { MATCH: 'migration:room:*', COUNT: 100 });
      cursor = result.cursor;
      for (const key of result.keys) {
        await pubClient.sRem(key, userId);
      }
    } while (cursor !== '0');
  } catch (e) {
    console.error('[RedisBridge] Room cleanup error:', e);
  }
  }

async function handleChatMessage(userId: string, deviceId: string, payload: unknown, msgId?: string) {
  let validatedPayload;
  try {
    validatedPayload = MessageSendPayloadSchema.parse(payload);
  } catch (e) {
    console.error("Invalid chat message payload:", e);
    if (msgId) await sendAck(userId, deviceId, msgId, { ok: false, error: "Invalid payload format" });
    return;
  }

  const { conversationId, content, sessionId, tempId, expiresAt, isViewOnce, pushPayloads, repliedToId, targetRecipients, deleteSecret } = validatedPayload;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      if (msgId) await sendAck(userId, deviceId, msgId, { ok: false, error: "Conversation not found" });
      return;
    }

    const [newMessageRaw] = await prisma.$transaction([
      prisma.message.create({
        data: {
            conversationId, senderId: conversation.isGroup ? userId : null, content, sessionId: sessionId || null,
            repliedToId: repliedToId || null, expiresAt: expiresAt ? new Date(expiresAt) : null, 
            isViewOnce: isViewOnce === true,
            deleteSecret
        },
        include: { sender: { select: { id: true, encryptedProfile: true } } }
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() }
      })
    ]);

    const safeMessage = toRawServerMessage(newMessageRaw) as RawServerMessage;
    if (tempId !== undefined) safeMessage.tempId = typeof tempId === 'string' ? parseInt(tempId, 10) : tempId;

    // Acknowledge the sender
    if (msgId) await sendAck(userId, deviceId, msgId, { ok: true, msg: safeMessage });

    // Relay to target recipients explicitly passed by the sender (Opaque Mailbox routing)
    if (Array.isArray(targetRecipients)) {
        if (targetRecipients.length > 500) {
            console.warn('[Security] User', sanitizeForLog(userId), 'attempted to send message to', targetRecipients.length, 'recipients (max 500)');
            if (msgId) await sendAck(userId, deviceId, msgId, { ok: false, error: 'Too many recipients (max 500)' });
            return;
        }
        // PARALEL: publish ke semua penerima sekaligus (sebelumnya sequential per recipient)
        await Promise.all(targetRecipients.map(async (targetIdRaw) => {
            const targetId = String(targetIdRaw);
            await sendJsonToUser(targetId, TransportOpCode.CHAT_MESSAGE, safeMessage);

            if (targetId !== userId) {
                sendPushNotification(targetId, {
                    type: pushPayloads ? 'ENCRYPTED_MESSAGE' : 'GENERIC_MESSAGE',
                    data: { conversationId, messageId: safeMessage.id, pushPayloadMap: pushPayloads || undefined }
                }).catch((e: unknown) => { console.error("[RedisBridge] Failed to send push notification:", e); });

                // Register this conversation for the target recipient so they can discover it later
                // (Critical for new users who have never synced this conversation before)
                prisma.userHiddenConversation.upsert({
                    where: { userId_conversationId: { userId: targetId, conversationId } },
                    create: { userId: targetId, conversationId },
                    update: {} // No-op if already exists
                }).catch((e: unknown) => console.warn('[OpaqueMailbox] Failed to upsert UserHiddenConversation:', e));
            }
        }));
    }
  } catch (error) {
    console.error('Failed to handle chat message:', error);
    if (msgId) await sendAck(userId, deviceId, msgId, { ok: false, error: "Internal server error" });
  }
}

async function handleWebRtcRelay(fromUserId: string, payload: { to: string, type: string, payload: string }, opCode: TransportOpCode) {
  if (!payload.to) return;
  const relayPayload = { from: fromUserId, type: payload.type, payload: payload.payload };
  await sendJsonToUser(payload.to, opCode, relayPayload, opCode === TransportOpCode.WEBRTC_ICE);
}

async function handlePresence(userId: string, payload: { event: string, conversationId?: string }) {
  if (payload.event === 'active' || payload.event === 'user:active') {
    const added = await pubClient.sAdd('online_users', userId);
    const onlineUsers = await pubClient.sMembers('online_users');
    
    // Send the current list of online users to this user
    await sendJsonToUser(userId, TransportOpCode.PRESENCE, { type: 'bulk', userIds: onlineUsers });

    if (added === 1) {
      await broadcastToUsers(onlineUsers, TransportOpCode.PRESENCE, { type: 'join', userId });
    }
  } else if (payload.event === 'away' || payload.event === 'user:away') {
    const removed = await pubClient.sRem('online_users', userId);
    if (removed === 1) {
      const onlineUsers = await pubClient.sMembers('online_users');
      await broadcastToUsers(onlineUsers, TransportOpCode.PRESENCE, { type: 'leave', userId });
    }
  }

  if (payload.conversationId && (payload.event === 'typing:start' || payload.event === 'typing:stop' || payload.event === 'typing')) {
     const conversationId = payload.conversationId;
     const isTyping = payload.event === 'typing:start' || payload.event === 'typing';
     const typingData = { type: 'typing', userId, conversationId, isTyping };
     
     // Opaque Mailbox: sender explicitly provides targetRecipients
     const targetRecipients = (payload as { targetRecipients?: string[] }).targetRecipients;
     if (Array.isArray(targetRecipients) && targetRecipients.length > 0) {
         for (const pId of targetRecipients) {
             if (typeof pId === 'string' && pId !== userId) {
               await sendJsonToUser(pId, TransportOpCode.PRESENCE, typingData);
             }
         }
     }
  }
}

// Lua atomic: INCR + EXPIRE dalam satu perintah — mencegah key hidup selamanya
// bila proses mati di antara dua perintah (race condition rate limit permanen).
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export async function checkRateLimit(userId: string, event: string, limit: number, windowSeconds: number) {
    const key = `rate_limit:socket:${event}:${userId}`;
    const current = await redisClient.eval(RATE_LIMIT_LUA, {
      keys: [key],
      arguments: [String(windowSeconds)]
    });
    return Number(current) <= limit;
}

async function handleKeySync(userId: string, deviceId: string, payload: { event: string, msgId: string, data: unknown }, msgIdFromRust?: string) {
   const { event, msgId, data } = payload;

   try {
     switch (event) {
       case 'session:request_key': {
         const { conversationId, sessionId, targetId } = data as KeyRequestPayload;
         if (!conversationId) return;
         if (!await checkRateLimit(userId, 'session_request_key', 20, 60)) return;

         if (targetId) {
             const me = await prisma.user.findUnique({ where: { id: userId }, include: { devices: { where: { id: deviceId } } } });
             const meDevice = me?.devices[0];

             await emitEventToUser(targetId, 'session:request_key', {
                 conversationId,
                 requesterId: userId,
                 sessionId,
                 requesterPublicKey: meDevice?.publicKey ? Buffer.from(meDevice.publicKey).toString('base64url') : undefined,
                 requesterPqPublicKey: meDevice?.pqPublicKey ? Buffer.from(meDevice.pqPublicKey).toString('base64url') : undefined,
                 requesterDeviceId: deviceId
             });
         } else if (sessionId) {
             // In Opaque Mailbox, we can't find an online participant automatically because we don't know who they are.
             // We require the client to provide targetId.
             await emitEventToUser(userId, "session:request_key_failed", { sessionId, targetId: "UNKNOWN", reason: "Opaque Mailbox requires targetId" });
         }
         break;
       }

       case 'session:fulfill_response': {
         const { requesterId, conversationId, sessionId, encryptedKey, targetDeviceId } = data as KeyFulfillmentPayload;
         if (!requesterId || !encryptedKey) return;
         if (!await checkRateLimit(userId, 'session_fulfill_response', 60, 60)) return;

         const emitPayload = { conversationId, sessionId, encryptedKey, type: 'SESSION_KEY', senderId: userId };
         await emitEventToUser(requesterId, 'session:new_key', emitPayload, targetDeviceId);
         break;
       }

       case 'session:request_missing': {
         const { conversationId, targetId } = data as { conversationId: string, targetId?: string };
         if (conversationId && targetId) {
           await emitEventToUser(targetId, 'session:key_requested', {
              conversationId,
              requesterId: userId,
              deviceId
           });
         }
         break;
       }

       case 'messages:distribute_keys': {
         const { conversationId, keys } = data as DistributeKeysPayload;
         if (!conversationId || !Array.isArray(keys)) {
            if (msgId) await sendAck(userId, deviceId, msgId, { ok: false, error: 'Invalid payload' });
            return;
         }
         if (!await checkRateLimit(userId, 'distribute_keys', 40, 60)) {
            if (msgId) await sendAck(userId, deviceId, msgId, { ok: false, error: 'Rate limit exceeded' });
            return;
         }

         for (const k of keys) {
              const { userId: targetId, key, targetDeviceId, senderDeviceKey, drHeader } = k;
              const emitPayload: Record<string, unknown> = { conversationId, encryptedKey: key, type: 'GROUP_KEY', senderId: userId, senderDeviceKey };
              if (drHeader) emitPayload.drHeader = drHeader;
             
             // Restore offline catchup: persist distributed keys to the database
             await prisma.message.create({
                 data: {
                     id: `msg_sys_key_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                     conversationId,
                     senderId: userId, // Store actual sender for group key routing
                     type: 'SYSTEM',
                     content: JSON.stringify(emitPayload),
                     isViewOnce: false,
                     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                 }
             });

             await emitEventToUser(targetId, 'session:new_key', emitPayload, targetDeviceId);
         }
         if (msgId) await sendAck(userId, deviceId, msgId, { ok: true });
         break;
       }

       case 'group:request_key': {
         const { conversationId, targetSenderId, targetDeviceKey } = data as GroupKeyRequestPayload;
         if (!conversationId) return;
         if (!await checkRateLimit(userId, 'group_request_key', 20, 60)) return;

         let fulfillerId = targetSenderId;
         if (!fulfillerId) {
             // Opaque Mailbox requires targetSenderId to be provided by client
             return;
         }

         if (fulfillerId) {
             const me = await prisma.user.findUnique({ where: { id: userId }, include: { devices: { where: { id: deviceId } } } });
             const meDevice = me?.devices[0];

             if (meDevice?.publicKey && meDevice?.pqPublicKey) {
                 await emitEventToUser(fulfillerId, 'group:fulfill_key_request', {
                     conversationId,
                     requesterId: userId,
                     requesterPublicKey: Buffer.from(meDevice.publicKey).toString('base64url'),
                     requesterPqPublicKey: Buffer.from(meDevice.pqPublicKey).toString('base64url'),
                     requesterDeviceId: deviceId,
                     targetDeviceKey
                 });
             } else {
                 await emitEventToUser(userId, "group:key_request_failed", { conversationId, reason: "Missing classical or PQ public key" });
             }
         }
         break;
       }

       case 'group:fulfilled_key': {
           const { requesterId, conversationId, encryptedKey, targetDeviceId, senderDeviceKey, drHeader } = data as KeyFulfillmentPayload;
           if (!requesterId || !conversationId || !encryptedKey) return;
           if (!await checkRateLimit(userId, 'group_fulfilled_key', 60, 60)) return;

           const emitPayload: Record<string, unknown> = { conversationId, encryptedKey, type: 'GROUP_KEY', senderId: userId, senderDeviceKey };
           if (drHeader) emitPayload.drHeader = drHeader;
           await emitEventToUser(requesterId, 'session:new_key', emitPayload, targetDeviceId);
           break;
         }

        case 'metadata:updated': {
           const { conversationId, encryptedMetadata, targetRecipients } = data as { conversationId: string; encryptedMetadata: string; targetRecipients: string[] };
           if (!conversationId || !encryptedMetadata || !Array.isArray(targetRecipients)) return;
           if (!await checkRateLimit(userId, 'metadata_updated', 20, 60)) return;

           // Persist to DB for offline delivery (like messages:distribute_keys)
           await prisma.message.create({
               data: {
                   id: `msg_sys_meta_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                   conversationId,
                   senderId: userId,
                   type: 'SYSTEM',
                   content: JSON.stringify({ type: 'METADATA_UPDATED', encryptedMetadata }),
                   isViewOnce: false,
                   expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
               }
           });

           for (const targetId of targetRecipients) {
               if (typeof targetId === 'string') {
                   await emitEventToUser(targetId, 'conversation:updated', { id: conversationId, encryptedMetadata });
               }
           }
           break;
         }

        case 'auth:request_linking_qr': {
         if (!await checkRateLimit(userId, 'linking_qr', 5, 60)) return;
         const sodium = await getSodium();
         const linkingToken = sodium.to_hex(sodium.randombytes_buf(32));
         
         // Simpan di Redis: linkingToken -> { userId, deviceId }
         await redisClient.setEx(`linking_token:${linkingToken}`, 300, JSON.stringify({ userId, deviceId }));
         
         await emitEventToUser(userId, 'auth:linking_qr_ready', { linkingToken }, deviceId);
         break;
       }

        case 'message:unsend': {
          const { messageId, conversationId, targetRecipients, deleteSecret } = data as { messageId: string, conversationId: string, targetRecipients?: string[], deleteSecret?: string };
          if (!messageId || !conversationId) return;
          const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true, senderId: true, deleteSecret: true } });
          if (!msg || msg.conversationId !== conversationId) return;

          // Authorization: pengirim pesan ATAU pemegang deleteSecret (blind auth) yang boleh unsend.
          // Pesan 1:1 disimpan dengan senderId null (Opaque Mailbox), jadi proof via deleteSecret.
          const isSender = msg.senderId !== null && msg.senderId === userId;
          const hasValidSecret = typeof deleteSecret === 'string' && !!msg.deleteSecret && safeEqualStrings(deleteSecret, msg.deleteSecret);
          if (!isSender && !hasValidSecret) {
            console.warn('[Security] Unauthorized unsend attempt by', sanitizeForLog(userId), 'for message', sanitizeForLog(messageId));
            return;
          }

          await prisma.message.delete({ where: { id: messageId } });
         
         // Notify recipients about the unsend (Opaque Mailbox: explicit targetRecipients from client)
         const recipients = Array.isArray(targetRecipients) && targetRecipients.length > 0 
           ? targetRecipients 
           : (msg.senderId ? [msg.senderId] : []);
         for (const targetId of recipients) {
           if (typeof targetId === 'string' && targetId !== userId) {
             await emitEventToUser(targetId, 'message:deleted_remotely', { messageId, conversationId, deletedBy: userId });
           }
         }
         break;
       }

       case 'message:view_once_opened': {
         const { messageId, conversationId, targetRecipient } = data as { messageId: string, conversationId: string, targetRecipient?: string };
         if (!messageId || !conversationId) return;
         const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true, senderId: true } });
         if (!msg || msg.conversationId !== conversationId) return;

         // Emit viewed event to sender then OBLITERATE from server
         // Opaque Mailbox: use explicit targetRecipient from client if available, fallback to msg.senderId
         const notifyTarget = targetRecipient || msg.senderId;
         if (notifyTarget && notifyTarget !== userId) {
           await emitEventToUser(notifyTarget, 'message:viewed', { messageId, conversationId });
         }
         await prisma.message.delete({ where: { id: messageId } }).catch(() => {});
         break;
       }

       case 'push:subscribe': {
         const { endpoint, keys } = data as PushSubscribePayload;
         if (!endpoint || !keys?.p256dh || !keys?.auth) return;
         await prisma.pushSubscription.upsert({
           where: { endpoint },
           update: { p256dh: keys.p256dh, auth: keys.auth, deviceId },
           create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, deviceId }
         });
         break;
       }

       case 'push:unsubscribe': {
         await prisma.pushSubscription.deleteMany({ where: { deviceId } });
         break;
       }

       // --- BURNER CHAT EVENTS ---
       case 'burner:join': {
         const { roomId } = data as { roomId?: string };
         if (roomId) await pubClient.sAdd(`burner:room:${roomId}`, userId);
         break;
       }
       case 'burner:send': {
         const { roomId, targetDeviceId, hostUserId, ciphertext } = data as { roomId: string, targetDeviceId?: string, hostUserId: string, ciphertext: string };
         if (await redisClient.exists(`burner:terminated:${roomId}`)) return;
         
         // Broadcast to all active sessions of the host if specific device ID fails or isn't strictly required
         await sendJsonToUser(hostUserId, TransportOpCode.KEY_SYNC, { event: 'burner:receive', data: { roomId, ciphertext } }, false, targetDeviceId);
         
         if (msgId) await sendAck(userId, deviceId, msgId, { ok: true });
         break;
       }
       case 'burner:reply': {
         const { roomId, ciphertext } = data as { roomId: string, ciphertext: string };
         if (await redisClient.exists(`burner:terminated:${roomId}`)) return;
         const members = await pubClient.sMembers(`burner:room:${roomId}`);
         for (const memberId of members) {
            if (memberId !== userId) await sendJsonToUser(memberId, TransportOpCode.KEY_SYNC, { event: 'burner:receive', data: { roomId, ciphertext } });
         }
         break;
       }
       case 'burner:destroy': {
         const { roomId } = data as { roomId: string };
         await redisClient.set(`burner:terminated:${roomId}`, "1", { EX: 86400 });
         const members = await pubClient.sMembers(`burner:room:${roomId}`);
         for (const memberId of members) {
            await sendJsonToUser(memberId, TransportOpCode.KEY_SYNC, { event: 'burner:terminated', data: { roomId } });
         }
         await pubClient.del(`burner:room:${roomId}`);
         break;
       }

       // --- MIGRATION EVENTS ---
       case 'migration:prepare': {
         await redisClient.set(`is_migrating:${userId}`, "1", { EX: 900 }); // 15 mins grace period
         if (msgId) await sendAck(userId, deviceId, msgId, { ok: true });
         break;
       }
       case 'migration:cancel': {
         await redisClient.del(`is_migrating:${userId}`);
         break;
       }
       case 'migration:join': {
         if (data) await pubClient.sAdd(`migration:room:${data}`, userId);
         break;
       }
       case 'migration:start': {
         const { roomId } = data as { roomId: string };
         await redisClient.set(`migration_owner:${roomId}`, userId, { EX: 3600 });
         const members = await pubClient.sMembers(`migration:room:${roomId}`);
         for (const memberId of members) {
            if (memberId !== userId) await sendJsonToUser(memberId, TransportOpCode.KEY_SYNC, { event: 'migration:start', data });
         }
         break;
       }
       case 'migration:chunk': {
         const { roomId } = data as { roomId: string };
         const ownerId = await redisClient.get(`migration_owner:${roomId}`);
         if (ownerId !== userId) return;
         const members = await pubClient.sMembers(`migration:room:${roomId}`);
         for (const memberId of members) {
            if (memberId !== userId) await sendJsonToUser(memberId, TransportOpCode.KEY_SYNC, { event: 'migration:chunk', data });
         }
         break;
       }
       case 'migration:ack': {
         const { roomId } = data as { roomId: string };
         const ownerId = await redisClient.get(`migration_owner:${roomId}`);

         // Clear migration grace period flag as it's finished
         await redisClient.del(`is_migrating:${userId}`);

         if (ownerId) await sendJsonToUser(ownerId, TransportOpCode.KEY_SYNC, { event: 'migration:ack', data });
         break;
       }

       case 'message:mark_read':
       case 'message:mark_as_read': {
         const { conversationId, messageId, targetRecipient } = data as { conversationId: string, messageId: string, targetRecipient?: string };
         await handleMessageStatusUpdate(userId, conversationId, messageId, 'READ', targetRecipient);
         break;
       }

       case 'message:ack_delivered': {
         const { conversationId, messageId, targetRecipient } = data as { conversationId: string, messageId: string, targetRecipient?: string };
         await handleMessageStatusUpdate(userId, conversationId, messageId, 'DELIVERED', targetRecipient);
         break;
       }

       case 'messages:mark_as_read':
       case 'messages:mark_read':
       case 'messages:mark_delivered': {
         const { conversationId, messageIds } = data as { conversationId: string, messageIds: string[] };
         const status = (event === 'messages:mark_read' || event === 'messages:mark_as_read') ? 'READ' : 'DELIVERED';
         if (!conversationId || !Array.isArray(messageIds)) return;
         
         // 1. Lakukan update status secara batch
         for (const messageId of messageIds) {
             // Re-use logic penghapusan yang sudah matang di handleMessageStatusUpdate
             await handleMessageStatusUpdate(userId, conversationId, messageId, status);
         }
         break;
       }

       case 'message:deleted': {
         const { conversationId, id: messageId, targetRecipients } = data as { conversationId: string, id: string, targetRecipients?: string[] };
         if (!conversationId || !messageId) return;

         const message = await prisma.message.findUnique({ where: { id: messageId } });
         if (!message || message.senderId !== userId) return;

         await prisma.message.delete({ where: { id: messageId } });
         
         // Notify recipients about the deletion (Opaque Mailbox: explicit targetRecipients from client)
         const recipients = Array.isArray(targetRecipients) && targetRecipients.length > 0 
           ? targetRecipients 
           : (message.senderId ? [message.senderId] : []);
         for (const targetId of recipients) {
           if (typeof targetId === 'string' && targetId !== userId) {
             await emitEventToUser(targetId, 'message:deleted', { conversationId, id: messageId });
           }
         }
         break;
       }
       
       default:
         console.warn(`[RedisBridge] Unhandled generic event: ${event}`);
     }
   } catch (e) {
     console.error(`[RedisBridge] Error in handleKeySync:`, e);
   }
}

async function sendAck(userId: string, deviceId: string, msgId: string, data: Record<string, unknown>) {
  await sendJsonToUser(userId, TransportOpCode.ACK, { msgId, data }, false, deviceId);
}

async function handleMessageStatusUpdate(userId: string, conversationId: string, messageId: string, status: 'READ' | 'DELIVERED', targetRecipient?: string) {
  if (!conversationId || !messageId) return;

  try {
    // 1. Cek keberadaan pesan & info grup (karena pesan ephemeral/cepat dihapus)
    const msg = await prisma.message.findUnique({ 
      where: { id: messageId }, 
      select: { id: true, senderId: true, conversation: { select: { isGroup: true } } } 
    });
    if (!msg) return;

    // Jangan update status jika pengirim sedang membaca pesan sendiri
    if (msg.senderId === userId) return;

    await prisma.messageStatus.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { status },
      create: { messageId, userId, status }
    });

    // Notify the original message sender about the status update
    // Opaque Mailbox: use explicit targetRecipient from client if available, fallback to msg.senderId
    const notifyTarget = targetRecipient || msg.senderId;
    if (notifyTarget && notifyTarget !== userId) {
      await emitEventToUser(notifyTarget, 'message:status_updated', {
        conversationId,
        messageId,
        userId,
        status
      });
    }

    // 2. LOGIKA PENGHAPUSAN OTOMATIS (Store-and-Forward Ephemerality)
    if (status === 'READ') {
        if (!msg.conversation.isGroup) {
            // Dalam chat 1:1, jika penerima sudah baca, hapus dari server.
            await prisma.message.delete({ where: { id: messageId } }).catch(() => {});
        }
        // Dalam grup (Opaque Mailbox), server tidak tahu jumlah partisipan.
        // Pesan akan dihapus otomatis oleh TTL (expiresAt).
    }
  } catch (e: unknown) {
    // Tangani P2003 (FK Violation) jika pesan dihapus tepat saat kueri berjalan
    if ((e as Record<string, unknown>).code === 'P2003') return;
    console.error(`[RedisBridge] Failed to update message status:`, e);
  }
}
