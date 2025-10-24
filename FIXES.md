# Prompt Gemini — Refactor Delete Menu UI Using Radix UI (Portal-Based)

You are a **senior frontend engineer** working on ChatLite (React + Tailwind + Zustand).
The delete logic for **groups** and **private chats** already works correctly.
Now, your task is to **refactor the delete menu UI** to use **Radix UI DropdownMenu** for proper portal rendering and clean UX.

---

## 🎯 Goals

* Replace the current 3-dot ("...") menu used in the chat list with **Radix UI DropdownMenu**.
* Ensure the dropdown renders using a **portal**, so it’s **not clipped by parent containers** with `overflow: hidden` or `overflow: auto`.
* Keep the **delete chat** and **delete group** logic exactly as it is (no refactoring needed there).
* Keep all styling consistent with the current design (Tailwind-based).
* Must support:

  * “Delete Chat” for private conversations.
  * “Delete Group” (visible only for the creator of the group).

---

## 🧱 Implementation Details

### 1. Install Radix UI (if not already installed)

```bash
npm install @radix-ui/react-dropdown-menu
```

---

### 2. Refactor ChatListItem Menu Component

Target component: `ChatListItem.tsx` (or wherever the 3-dot menu lives)

Replace your current menu implementation with **Radix UI DropdownMenu** like this:

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { EllipsisVerticalIcon } from 'lucide-react'

export function ChatListItem({ chat, currentUser, handleDeleteChat, handleDeleteGroup }) {
  return (
    <div className="flex items-center justify-between p-2 hover:bg-neutral-800 rounded-xl transition">
      <div className="flex items-center gap-3">
        <img
          src={chat.avatarUrl || '/default-avatar.png'}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex flex-col">
          <span className="font-medium text-white">{chat.name}</span>
          <span className="text-xs text-gray-400 truncate w-48">{chat.lastMessage}</span>
        </div>
      </div>

      {/* Radix UI Dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="p-2 rounded-full hover:bg-neutral-700 transition">
            <EllipsisVerticalIcon className="w-5 h-5 text-gray-400" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="min-w-[140px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-1 z-[9999]"
          >
            {chat.type === 'group' && chat.creatorId === currentUser.id && (
              <DropdownMenu.Item
                onClick={() => handleDeleteGroup(chat.id)}
                className="text-red-500 text-sm rounded-md px-3 py-2 hover:bg-neutral-800 cursor-pointer"
              >
                Delete Group
              </DropdownMenu.Item>
            )}
            {chat.type === 'direct' && (
              <DropdownMenu.Item
                onClick={() => handleDeleteChat(chat.id)}
                className="text-red-400 text-sm rounded-md px-3 py-2 hover:bg-neutral-800 cursor-pointer"
              >
                Delete Chat
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
```

---

### 3. Behavior Requirements

✅ The dropdown menu must:

* Open smoothly and position correctly near the trigger.
* Render inside a portal (not inside overflow containers).
* Close automatically after clicking a menu item.
* Maintain consistent theming (dark mode, rounded corners, subtle shadows).

✅ The delete logic remains untouched:

* `handleDeleteChat(chat.id)`
* `handleDeleteGroup(chat.id)`

✅ No layout reflow or console errors.

---

### 4. Optional Enhancement

Add small animations for the dropdown (Radix supports `motion` props or use Framer Motion if already included):

```tsx
<DropdownMenu.Content
  align="end"
  sideOffset={6}
  className="min-w-[140px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-1 z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out"
>
```

---

## 🧩 Deliverables

Gemini should:

1. Install and configure Radix UI.
2. Refactor the delete menu using `DropdownMenu.Root`, `Trigger`, `Portal`, and `Content`.
3. Keep existing delete logic intact.
4. Ensure full visual + functional consistency.
5. Verify the dropdown never gets clipped and closes correctly after action.

---

## ✅ Acceptance Criteria

* Menu shows correctly on click.
* No visual clipping / overflow issues.
* Menu closes properly after clicking.
* Delete chat/group still works exactly the same.
* Compatible with Tailwind dark theme.
* No side effects on other components.

---

> 💡 Bonus (optional): If Gemini detects other dropdowns or action menus in the project, it can suggest migrating them to Radix UI for consistency and long-term maintainability.

---