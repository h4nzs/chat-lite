import { Router } from 'express'
import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { ApiError } from '../utils/errors.js'
import { z } from 'zod'
import { zodValidate, safeEqualStrings } from '../utils/validate.js'
import { emitEventToUsers, emitEventToUser } from '../network/redisBridge.js'
import { redisClient } from '../lib/redis.js'
import { hoistConvoKeys, toConversation, asConversationId, asUserId, type RawConversationData } from '../utils/mappers.js'
import type { Conversation } from '@nyx/shared'

const ConversationSchema = z.object({
  id: z.string().optional(),
  isGroup: z.boolean().optional(),
  encryptedMetadata: z.string().nullable().optional(),
})

const router: Router = Router()
router.use(requireAuth)

// GET conversations by IDs (Inbox sync for Opaque Mailbox)
// For new users with no local IDs, discovers conversations from UserHiddenConversation
router.get('/sync', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.')
    
    const ids = String(req.query.ids ?? '');
    let conversationIds: string[] = ids ? ids.split(',') : [];

    // Discover conversations from UserHiddenConversation records
    // (created when conversations are created or messages are sent)
    const userConvs = await prisma.userHiddenConversation.findMany({
      where: { userId: req.user.id },
      select: { conversationId: true }
    });
    const hiddenIds = userConvs.map(uc => uc.conversationId);
    
    // Backfill for legacy conversations (pre-dating UserHiddenConversation tracking):
    // If no discovery records and no client-provided IDs, try SessionKey table
    // (covers conversations where E2EE session was established)
    let backfillIds: string[] = [];
    if (hiddenIds.length === 0 && conversationIds.length === 0) {
      try {
        const userDevices = await prisma.device.findMany({
          where: { userId: req.user.id },
          select: { id: true }
        });
        const deviceIds = userDevices.map(d => d.id);
        if (deviceIds.length > 0) {
          const sessionKeys = await prisma.sessionKey.findMany({
            where: { deviceId: { in: deviceIds } },
            select: { conversationId: true },
            distinct: ['conversationId']
          });
          backfillIds = sessionKeys.map(sk => sk.conversationId);
        }
      } catch (e) {
        console.warn('[Sync] SessionKey backfill failed:', e);
      }
    }
    
    // Merge known IDs with discovered IDs + backfill, deduplicate
    const allIds = [...new Set([...conversationIds, ...hiddenIds, ...backfillIds])];
    
    if (allIds.length === 0) return res.json([]);

    const conversations = await prisma.conversation.findMany({
      where: {
        id: { in: allIds }
      },
      orderBy: { lastMessageAt: 'desc' }
    })

    const safeConversations = conversations.map(c => {
       const conv = toConversation(hoistConvoKeys(c as RawConversationData));
       conv.participants = []; // Participants are stored locally in Opaque Mailbox
       return conv;
    });

    res.json(safeConversations.map(c => ({...c, unreadCount: 0})))
  } catch (error) {
    next(error)
  }
})

// CREATE a new conversation (Opaque Mailbox)
const initialSessionSchema = z.object({
  sessionId: z.string(),
  initialKeysPerDevice: z.record(z.string(), z.string()), 
  initiatorCiphertextsPerDevice: z.record(z.string(), z.string()) 
});

router.post('/', zodValidate({
  body: ConversationSchema.pick({ isGroup: true, encryptedMetadata: true }).extend({
    userIds: z.array(z.string()).min(1),
    initialSession: initialSessionSchema.optional()
  })
}), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.')
    const creatorId = req.user.id
    const { userIds, isGroup, encryptedMetadata, initialSession } = req.body

    const today = new Date().toISOString().split('T')[0];
    // INCR+EXPIRE atomik (Lua) — mencegah key hidup selamanya bila proses mati di antaranya
    const sandboxCount = Number(await redisClient.eval(`
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`, { keys: [`sandbox:newchat:${creatorId}:${today}`], arguments: ['86400'] }));

    const creator = await prisma.user.findUnique({ where: { id: creatorId }, select: { isVerified: true } });
    if (!creator?.isVerified && sandboxCount > 3) {
      return res.status(403).json({ error: 'SANDBOX_LIMIT: Unverified users can only create 3 new chats per day.' });
    }

    const allUserIds = Array.from(new Set([...userIds, creatorId]))
    
    const authSecret = crypto.randomBytes(32).toString('hex');
    
    let newConversation;
    try {
      newConversation = await prisma.$transaction(async (tx) => {
        const convo = await tx.conversation.create({
          data: {
            isGroup: isGroup === true,
            encryptedMetadata: isGroup ? encryptedMetadata : null,
            authSecret
          }
        });

        if (initialSession) {
          const { sessionId, initialKeysPerDevice, initiatorCiphertextsPerDevice } = initialSession;
          const keyRecords = [];
          for (const deviceId in initialKeysPerDevice) {
            keyRecords.push({
              conversationId: convo.id,
              deviceId,
              sessionId,
              encryptedKey: initialKeysPerDevice[deviceId],
              initiatorCiphertext: initiatorCiphertextsPerDevice[deviceId]
            });
          }
          if (keyRecords.length > 0) {
            await tx.sessionKey.createMany({ data: keyRecords });
          }
        }
        return convo;
      });
    } catch (dbError) {
      if (!creator?.isVerified) {
        try { await redisClient.decr(`sandbox:newchat:${creatorId}:${today}`); } catch (_e) { }
      }
      throw dbError;
    }

    const safeConversation = toConversation(hoistConvoKeys(newConversation as RawConversationData)) as Conversation;
    safeConversation.participants = []; 
    safeConversation.authSecret = authSecret; // Sharing with creator so they can put it in encryptedMetadata

    // PUSH creation event to userIds passed in the body
    await emitEventToUsers(allUserIds.filter(uid => uid !== creatorId), 'conversation:new', safeConversation);
    
    // Register discovery records for offline recipients
    for (const uid of allUserIds.filter(uid => uid !== creatorId)) {
        prisma.userHiddenConversation.upsert({
            where: { userId_conversationId: { userId: uid, conversationId: newConversation.id } },
            create: { userId: uid, conversationId: newConversation.id },
            update: {}
        }).catch((e: unknown) => console.warn('[OpaqueMailbox] Failed to upsert UserHiddenConversation:', e));
    }
    
    res.status(201).json({ ...safeConversation, unreadCount: 0 })
  } catch (error) {
    next(error)
  }
})

// GET a single conversation by ID
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.')
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id }
    })

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
    const safeConversation = toConversation(hoistConvoKeys(conversation as RawConversationData));
    safeConversation.participants = [];
    res.json(safeConversation)
  } catch (error) {
    next(error)
  }
})

// UPDATE group conversation details (Opaque)
router.put('/:id/details', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.')
    const { id } = req.params
    const { encryptedMetadata } = req.body
    const groupToken = req.headers['x-group-token']

    const conversation = await prisma.conversation.findUnique({ where: { id }, select: { authSecret: true } }) as { authSecret: string | null } | null;
    if (!conversation || !safeEqualStrings(conversation.authSecret, typeof groupToken === 'string' ? groupToken : '')) {
        return res.status(403).json({ error: 'BLIND_AUTH_REQUIRED: Invalid or missing X-Group-Token' });
    }

    const updatedConversation = await prisma.conversation.update({ where: { id }, data: { encryptedMetadata } })
    // Opaque Mailbox: notify explicit targetRecipients passed from client
    const targetRecipients = req.body.targetRecipients as string[] | undefined;
    if (Array.isArray(targetRecipients) && targetRecipients.length > 0) {
      await emitEventToUsers(targetRecipients, 'conversation:updated', { id: asConversationId(id), encryptedMetadata: updatedConversation.encryptedMetadata ?? undefined });
    }
    res.json(updatedConversation)
  } catch (error) {
    next(error)
  }
})

// OPAQUE MAILBOX: Member management is handled P2P by clients via encrypted messages.
// These endpoints now just broadcast the intent to the room.

router.post('/:id/participants', async (req, res, next) => {
  const { id: conversationId } = req.params;
  const { userIds } = req.body;
  const groupToken = req.headers['x-group-token'];

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { authSecret: true } }) as { authSecret: string | null } | null;
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  if (!safeEqualStrings(conversation.authSecret, typeof groupToken === 'string' ? groupToken : '')) {
      return res.status(403).json({ error: 'BLIND_AUTH_REQUIRED: Invalid or missing X-Group-Token' });
  }    const safeConv = toConversation(hoistConvoKeys(conversation as unknown as RawConversationData));
  safeConv.participants = [];
  
  for (const uid of userIds) {
      await emitEventToUser(uid, 'conversation:new', safeConv);
  }
  
  // Opaque Mailbox: notify explicit targetRecipients passed from client
  const addRecipients = req.body.targetRecipients as string[] | undefined;
  if (Array.isArray(addRecipients) && addRecipients.length > 0) {
    await emitEventToUsers(addRecipients, 'group:participants_changed', { conversationId: asConversationId(conversationId) });
  }
  res.status(201).json([]);
});

router.delete('/:id/participants/:userId', async (req, res, next) => {
  const { id: conversationId, userId } = req.params;
  const groupToken = req.headers['x-group-token'];

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { authSecret: true } }) as { authSecret: string | null } | null;
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  if (!safeEqualStrings(conversation.authSecret, typeof groupToken === 'string' ? groupToken : '')) {
      return res.status(403).json({ error: 'BLIND_AUTH_REQUIRED: Invalid or missing X-Group-Token' });
  }

  // Opaque Mailbox: notify explicit targetRecipients passed from client
  const removeRecipients = req.body.targetRecipients as string[] | undefined;
  if (Array.isArray(removeRecipients) && removeRecipients.length > 0) {
    await emitEventToUsers(removeRecipients, 'conversation:participant_removed', { conversationId: asConversationId(conversationId), userId: asUserId(userId) });
    await emitEventToUsers(removeRecipients, 'group:participants_changed', { conversationId: asConversationId(conversationId) });
  }
  await emitEventToUser(userId, 'conversation:deleted', { id: asConversationId(conversationId) });
  res.status(204).end();
});

router.delete('/:id/leave', async (req, res, next) => {
  const { id: conversationId } = req.params;
  const userId = req.user!.id;
  const groupToken = req.headers['x-group-token'];

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { authSecret: true } }) as { authSecret: string | null } | null;
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  if (!safeEqualStrings(conversation.authSecret, typeof groupToken === 'string' ? groupToken : '')) {
      return res.status(403).json({ error: 'BLIND_AUTH_REQUIRED: Invalid or missing X-Group-Token' });
  }

  // Opaque Mailbox: notify explicit targetRecipients passed from client
  const leaveRecipients = req.body.targetRecipients as string[] | undefined;
  if (Array.isArray(leaveRecipients) && leaveRecipients.length > 0) {
    await emitEventToUsers(leaveRecipients, 'conversation:participant_removed', { conversationId: asConversationId(conversationId), userId: asUserId(userId) });
    await emitEventToUsers(leaveRecipients, 'group:participants_changed', { conversationId: asConversationId(conversationId) });
  }
  res.status(204).end();
});

// DELETE a conversation (Hidden locally)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.')
    const { id } = req.params
    const userId = req.user.id
    
    await emitEventToUser(userId, 'conversation:deleted', { id: asConversationId(id) });
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// PIN conversation (Handled locally in Opaque Mailbox)
router.post('/:id/pin', async (req, res, next) => {
    res.json({ isPinned: true }); 
})

// ROTATE group key (Update updatedAt)
router.post('/:id/key-rotation', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required.')
    const { id } = req.params

    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() }
    })

    const safeConv = toConversation(hoistConvoKeys(updatedConversation as RawConversationData));
    safeConv.participants = [];
    res.json({ 
        success: true, 
        message: 'Key rotation recorded successfully', 
        conversation: safeConv 
    })
  } catch (error) { next(error) }
})

export default router
