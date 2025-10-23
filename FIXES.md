# Prompt Gemini — Implement & Audit "Create Group" (ChatLite)

You are a **senior fullstack engineer** and code auditor. Project: **ChatLite** (React + TypeScript frontend `web/`, Node/Express + Prisma backend `server/`, Socket.IO realtime).
Task: **Implement the missing “Create Group” flow end-to-end, audit all related code, and apply best-practice fixes without touching unrelated logic.** Fix the current `invalid csrf token` on create attempts by ensuring proper CSRF usage and route wiring. Deliver code changes, tests, and a short report.

> Important constraints:
>
> * Only modify files that are relevant to the Create Group flow (backend route/controller, DB schema if needed, socket handlers, frontend modal + API call + store).
> * Preserve existing authentication, encryption, and socket conventions.
> * Use TypeScript and keep typings strict.
> * Keep changes minimal and well-documented.

---

## Scope (what to implement & audit)

**Frontend**

* Modal UI already exists. Tasks:

  * Ensure Create Group form gathers: `name`, `memberIds[]`, optional `avatar`.
  * Get CSRF token before POST (call `/api/csrf-token`) or reuse existing CSRF helper. Attach token header `X-CSRF-Token` and `credentials: 'include'`.
  * Submit form to backend endpoint `POST /api/groups` (or `POST /api/conversations/groups`) with form data as JSON or multipart (if avatar).
  * On success: close modal, add group to conversations list in store, navigate/open group chat, and show toast success.
  * On failure: show appropriate toast with error details (401/403/validation).
  * Ensure optimistic UI only if server ACK received (to avoid duplicate pending state).

Files likely to edit:

* `web/src/components/CreateGroupModal.tsx` (or existing modal file)
* `web/src/store/chat.ts` (createGroup action + update conversations)
* `web/src/lib/api.ts` or wherever HTTP helper exists (ensure CSRF header helper)
* `web/src/lib/socket.ts` (emit socket event if needed)

**Backend**

* Implement endpoint(s):

  * `GET /api/csrf-token` — returns `{ csrfToken }` and sets cookie (if not already present). (If exists already, ensure it's correct.)
  * `POST /api/groups` — create group conversation:

    * Request body: `{ name: string, memberIds: string[], avatar?: file }`
    * Auth required (use existing auth middleware).
    * Create Conversation record in DB (Prisma): conversation type `group`, add ConversationMembers linking creator + members.
    * Optionally save avatar to `/uploads/groups` using existing upload/multer flow.
    * Set `lastMessageId` null initially.
    * Return created conversation object with members populated and socket room info.
  * Emit socket event: `io.to(userId).emit('conversation:new', conversation)` for each member or `io.to(conversationId).emit('conversation:new', conversation)` after they join rooms. Use `io.emit` or targeted emits consistent with current server architecture.
* Ensure CSRF middleware allows POST with `X-CSRF-Token` header. If multer used, ensure CSRF is checked properly (middleware order matters).
* Update route wiring to register endpoint.

Files likely to edit:

* `server/src/routes/groups.ts` or `server/src/routes/conversations.ts`
* `server/src/socket.ts` (make sure new conversation broadcast is emitted)
* If DB needs a `Conversation` or `ConversationMember` change, update `prisma/schema.prisma` and create migration (only if missing)

  * Example schema pieces (if missing):

    ```prisma
    model Conversation {
      id String @id @default(cuid())
      name String?
      type String // 'direct' | 'group'
      lastMessageId String?
      members ConversationMember[]
      createdAt DateTime @default(now())
    }

    model ConversationMember {
      id String @id @default(cuid())
      conversationId String
      userId String
      role String?
      conversation Conversation @relation(fields:[conversationId], references:[id])
      user User @relation(fields:[userId], references:[id])
    }
    ```
  * ONLY add schema change if absolutely necessary and document migration steps.

**Socket**

* On group creation:

  * Add new conversation to each member’s conversation list in realtime:

    * For each `memberId`: `io.to(memberSocketId).emit('conversation:new', conversation)` or use `io.to(memberId).emit(...)` depending on how you map user→socket.
  * Ensure server adds member sockets to conversation room so subsequent messages broadcast properly.

**Tests & Verification**

* Add integration test script or manual test steps:

  1. With two different accounts in two browsers/clients:

     * Open Create Group modal, select members (include the other client), submit.
     * Verify no `invalid csrf token` error.
     * Group appears in both clients’ conversation lists immediately (no refresh).
     * Clicking group opens chat window (members present).
     * Sending a message in group is delivered to all members.
  2. Test avatar upload (if implemented): image saved to `uploads/groups/...` and served (CORP/CORS headers respected).
  3. Permission test: only authorized users can create group. Validate 403/401 flows.
  4. Edge cases: empty name, single member, invalid member IDs → return 400 with message.

---

## Implementation details & suggested code patterns (examples Gemini should produce)

**Frontend: CreateGroup flow**

* Use existing API helper (axios/fetch). Example fetch:

```ts
async function createGroup(payload: {name:string, memberIds:string[], avatar?:File}) {
  const csrf = await api.getCsrfToken(); // or call /api/csrf-token
  const form = new FormData();
  form.append("name", payload.name);
  payload.memberIds.forEach(id => form.append("memberIds[]", id));
  if (payload.avatar) form.append("avatar", payload.avatar);

  const res = await fetch(`${API_URL}/api/groups`, {
    method: "POST",
    body: form,
    headers: { "X-CSRF-Token": csrf, /* do not set Content-Type for formData */ },
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
```

* Update store:

```ts
// on success
set(state => ({
  conversations: [newConv, ...state.conversations]
}));
```

* Socket: after response, optionally `socket.emit('conversation:joined', { conversationId })` to join rooms.

**Backend: Route skeleton**

```ts
import express from 'express';
import { prisma } from '../prisma';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
const upload = multer({ dest: 'uploads/groups' });

const router = express.Router();

router.post('/groups', authMiddleware, upload.single('avatar'), async (req, res) => {
  const { name, memberIds } = req.body; // parse memberIds array carefully
  const creatorId = req.user.id;
  // validate input, sanitize name
  const conversation = await prisma.conversation.create({
    data: {
      name,
      type: 'group',
      members: {
        create: [
          ...memberIds.map((id: string) => ({ userId: id })),
          { userId: creatorId }
        ]
      }
    },
    include: { members: true }
  });
  // emit to members
  memberIds.concat(creatorId).forEach(uid => {
    const socketId = getSocketIdForUser(uid); // use existing mapping util
    if (socketId) io.to(socketId).emit('conversation:new', conversation);
  });
  res.json(conversation);
});
```

* Ensure `memberIds` parsed correctly if sent as form data (may be string or array).

**CSRF**

* If CSRF token invalid:

  * Either implement `GET /api/csrf-token` that returns token and sets cookie, OR ensure front sends header `X-CSRF-Token` with token obtained from page or `/api/csrf-token`.
  * If multer is used, ensure CSRF middleware runs before multer or validate token from header not body.

---

## Audit instructions for Gemini (required)

* Search repo for existing group/conversation code and reuse conventions (naming, response shape). Do not invent new endpoints unless necessary.
* Verify CSRF middleware order vs multer; fix order to check token header before multipart parser if needed.
* Confirm socket user→socket mapping function exists; if not, implement minimal helper used elsewhere (reuse `getSocketForUser` or `onlineUsers` map).
* Validate permissions: only authenticated user can create group; members must exist.
* Add small unit/integration tests or manual test scripts and list exact steps.
* For any DB schema migration, include migration commands (`npx prisma migrate dev`) and backup note.

---

## Deliverables (what Gemini should return)

1. Files changed with diffs and explanations.
2. Full new/modified file content if changes non-trivial.
3. Test instructions and sample cURL or fetch commands to reproduce.
4. Short audit report: what was broken (CSRF flow or missing route), what was changed, why safe.
5. Optional: small smoke tests (node script using `fetch` or `socket.io-client`) that create a group and verify broadcast.

---

## Acceptance Criteria (how you will validate)

* Creating a group no longer triggers `invalid csrf token`.
* Form submission results in HTTP 200 + created conversation payload.
* New group appears in both creator and selected members’ conversation lists in realtime (no page refresh).
* Avatar (if implemented) saved in `uploads/groups` and served correctly.
* No regressions to existing message sending, typing, presence logic.
* Tests / manual flows pass.

---