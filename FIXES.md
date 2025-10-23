# Prompt Gemini — Implement Group & Chat Deletion (ChatLite)

You are a **senior fullstack developer** working on a realtime chat app called **ChatLite**
(Stack: React + Zustand + Socket.IO frontend, Node.js + Express + Prisma + Socket.IO backend).
Implement two new deletion features with full audit and minimal disturbance to existing logic.

---

## 🧱 Goals

1. **Group Deletion**

   * Only the **creator (owner)** of the group can delete it.
   * Deleting a group removes:

     * All messages in that group conversation.
     * The conversation record itself.
     * All member relationships (`ConversationMember`).
   * When deleted:

     * All group members are notified in realtime via Socket.IO (`conversation:deleted` event).
     * The deleted group is removed from their chat list instantly.

2. **Conversation Deletion (One-to-One Chat)**

   * A user can delete a private chat (via “...” menu on chat list).
   * This should **only clear messages from that user’s view** (soft delete), *not delete the other user’s copy*.
   * Add a new table or flag if necessary (`UserConversationHidden` or a “hiddenBy” column).
   * Realtime updates: when user deletes a conversation, it disappears from *their* chatlist.
   * Other user still keeps their messages unless they also delete it.

3. **Frontend UI**

   * Add a **"..." menu (3 dots)** beside each chat (both user and group) in the chat list.
   * Menu options:

     * For group creator: `Delete Group`
     * For private chat: `Delete Chat`
   * Confirmation modal before delete (`Are you sure you want to delete this conversation?`)
   * Toast success or error based on API response.
   * After successful delete → remove item from UI immediately (Zustand state update).

---

## 🔒 Rules & Requirements

* Only the **group owner** can delete their group.
* Deleting a **private chat** should not delete it for the other user (soft delete).
* Preserve CSRF protection.
* Keep **existing message send, receive, and typing** features untouched.
* Use existing coding conventions (naming, store patterns, socket events, etc.)
* Keep TypeScript strict.
* Apply backend permission checks, validation, and use best practices.

---

## 🔧 Backend Tasks

### **1. Delete Group Endpoint**

**Route:**
`DELETE /api/groups/:id`

**Logic:**

```ts
// Pseudocode
router.delete('/groups/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const groupId = req.params.id;

  const group = await prisma.conversation.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.creatorId !== userId) return res.status(403).json({ error: 'Not allowed' });

  await prisma.message.deleteMany({ where: { conversationId: groupId } });
  await prisma.conversationMember.deleteMany({ where: { conversationId: groupId } });
  await prisma.conversation.delete({ where: { id: groupId } });

  // Notify members
  group.members.forEach(m => {
    io.to(m.userId).emit('conversation:deleted', { id: groupId });
  });

  res.json({ success: true, message: 'Group deleted' });
});
```

> Ensure `creatorId` exists on `Conversation` model (if not, add it in schema and migration).

**Prisma Schema Update (if missing):**

```prisma
model Conversation {
  id            String   @id @default(cuid())
  name          String?
  type          String   // 'direct' | 'group'
  creatorId     String?  // for groups
  members       ConversationMember[]
  messages      Message[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

### **2. Delete Conversation (User Chat)**

**Route:**
`DELETE /api/conversations/:id`

**Logic:**

```ts
router.delete('/conversations/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const convId = req.params.id;

  const conversation = await prisma.conversation.findUnique({ where: { id: convId } });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  // Soft delete: only hide for current user
  await prisma.userConversationHidden.upsert({
    where: { userId_conversationId: { userId, conversationId: convId } },
    update: {},
    create: { userId, conversationId: convId },
  });

  io.to(userId).emit('conversation:deleted', { id: convId });
  res.json({ success: true });
});
```

**Schema (if needed):**

```prisma
model UserConversationHidden {
  id             String   @id @default(cuid())
  userId         String
  conversationId String
  createdAt      DateTime @default(now())
  @@unique([userId, conversationId])
}
```

> When fetching chat list, filter out any `Conversation` hidden by the user:

```ts
where: {
  NOT: {
    hiddenBy: {
      some: { userId: currentUserId }
    }
  }
}
```

---

## 🖥️ Frontend Tasks

### **1. UI Menu**

Add 3-dot menu beside each chat in chatlist.

**Component**: `ChatListItem.tsx`

```tsx
<Menu>
  <MenuTrigger>
    <EllipsisVerticalIcon className="w-5 h-5 cursor-pointer text-gray-500" />
  </MenuTrigger>
  <MenuContent>
    {chat.type === 'group' && chat.creatorId === currentUser.id && (
      <MenuItem onClick={() => handleDeleteGroup(chat.id)}>Delete Group</MenuItem>
    )}
    {chat.type === 'direct' && (
      <MenuItem onClick={() => handleDeleteChat(chat.id)}>Delete Chat</MenuItem>
    )}
  </MenuContent>
</Menu>
```

---

### **2. API Calls**

**In `api.ts`:**

```ts
export async function deleteGroup(id: string) {
  const csrf = await getCsrfToken();
  const res = await fetch(`${API_URL}/api/groups/${id}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': csrf },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteConversation(id: string) {
  const csrf = await getCsrfToken();
  const res = await fetch(`${API_URL}/api/conversations/${id}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': csrf },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

### **3. Store Updates**

**In `chat.ts` (Zustand store):**

```ts
socket.on('conversation:deleted', ({ id }) => {
  set(state => ({
    conversations: state.conversations.filter(c => c.id !== id)
  }));
});
```

**Actions:**

```ts
async function handleDeleteGroup(id: string) {
  try {
    await api.deleteGroup(id);
    toast.success('Group deleted');
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== id)
    }));
  } catch (e) {
    toast.error('Failed to delete group');
  }
}

async function handleDeleteChat(id: string) {
  try {
    await api.deleteConversation(id);
    toast.success('Chat deleted');
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== id)
    }));
  } catch (e) {
    toast.error('Failed to delete chat');
  }
}
```

---

## ⚡ Socket Events

* `conversation:deleted`
  Payload: `{ id: string }`
  Triggered for all members (for groups) or just the deleting user (for private chat).
  Client removes chat from list instantly.

---

## ✅ Acceptance Criteria

* Only the **creator** can delete a group.
* When deleted, group disappears from all members' lists in realtime.
* Group messages + relations removed from DB.
* Private chat deletion only affects the deleting user.
* Both deletions are CSRF-protected and auth-required.
* No other logic (typing indicator, online presence, lastMessage) affected.
* Realtime sync via socket working properly.
* All schema changes documented and safe for migration.

---

## 🧩 Deliverables

Gemini should:

1. Provide updated backend routes (with middleware + CSRF + Prisma logic).
2. Add/update Prisma schema & migration commands (if needed).
3. Provide frontend UI + store + API code updates.
4. Add socket handling for `conversation:deleted`.
5. Include brief audit + test plan.

---

> Optional enhancement (Gemini may add):
>
> * Confirmation modal component (`ConfirmDeleteDialog`)
> * Toast success/error
> * Reuse shared delete handlers for both chat + group deletions.

---