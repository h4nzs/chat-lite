# 🧠 Prompt Gemini — Refactor Message Action UI with Radix UI (Dropdown + Popover)

You are a **senior frontend developer** working on **ChatLite**, a modern chat web app built with React, Zustand, and TailwindCSS.

The current in-message actions (like *Delete Message* and *React with Emoji*) sometimes get clipped by parent containers due to `overflow: hidden` or nested scrolling contexts.

Your task is to refactor these interactive UI elements using **Radix UI** for better rendering, accessibility, and UX consistency.

---

## 🎯 Goals

1. Replace current *Delete Message* and *Reaction* buttons/menus with **Radix UI components**:

   * **DropdownMenu** for message action menu (delete, reply, etc).
   * **Popover** for emoji reaction selector.
2. Ensure all menus are rendered in a **portal**, unaffected by container overflow.
3. Keep all business logic (delete message, reaction events, etc.) **unchanged**.
4. Maintain consistent styling (dark theme, rounded UI, Tailwind-based).

---

## 🧱 Implementation Details

### 1. Install Radix UI (if not already)

```bash
npm install @radix-ui/react-dropdown-menu @radix-ui/react-popover
```

---

### 2. Refactor Message Action Menu (Delete Message)

Target component: `MessageItem.tsx` (or wherever each chat bubble renders)

Replace the existing action button or menu with a **Radix DropdownMenu**, like this:

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { EllipsisVerticalIcon, TrashIcon, SmileIcon } from 'lucide-react'

export function MessageActions({ message, onDelete, onReact }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-1 rounded-full hover:bg-neutral-700 transition">
          <EllipsisVerticalIcon className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="min-w-[130px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-1 z-[9999]"
        >
          <DropdownMenu.Item
            onClick={() => onReact(message.id)}
            className="flex items-center gap-2 text-sm text-gray-300 rounded-md px-3 py-2 hover:bg-neutral-800 cursor-pointer"
          >
            <SmileIcon className="w-4 h-4 text-yellow-400" /> React
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onClick={() => onDelete(message.id)}
            className="flex items-center gap-2 text-sm text-red-400 rounded-md px-3 py-2 hover:bg-neutral-800 cursor-pointer"
          >
            <TrashIcon className="w-4 h-4" /> Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

Use this inside your `MessageItem`:

```tsx
<div className="group relative">
  {/* message bubble */}
  <div className="max-w-xs bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl px-3 py-2">
    {message.content}
  </div>

  {/* show actions on hover */}
  <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition">
    <MessageActions message={message} onDelete={handleDelete} onReact={openReactionPicker} />
  </div>
</div>
```

---

### 3. Refactor Reaction Picker with **Radix Popover**

If you already have a reaction system (e.g. emoji picker modal or overlay), replace it with **Radix Popover**.

Example:

```tsx
import * as Popover from '@radix-ui/react-popover'

export function ReactionPopover({ message, onSelectReaction }) {
  const reactions = ['👍', '❤️', '😂', '🔥', '😮', '😢']

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="p-1 rounded-full hover:bg-neutral-700 transition">
          <SmileIcon className="w-4 h-4 text-gray-300" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          className="flex gap-2 bg-neutral-900 border border-neutral-700 rounded-full px-3 py-2 shadow-lg z-[9999]"
        >
          {reactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelectReaction(message.id, emoji)}
              className="text-lg hover:scale-110 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

---

### 4. Behavior Requirements

✅ Both Dropdown and Popover menus:

* Render above all containers (portal behavior).
* Have smooth open/close transitions.
* Close automatically on action click.
* No overflow clipping, no z-index conflicts.
* Maintain dark theme and rounded Tailwind styling.

✅ Reaction logic:

* Calls existing `onSelectReaction()` or socket event.
* Emoji reactions should appear inline (below the message bubble) once added.

✅ Delete message:

* Calls existing delete logic.
* If deleted, message should change to `"This message was deleted"` without needing a refresh.

---

### 5. Optional Enhancement

Add subtle fade/scale animations using Tailwind data attributes:

```css
[data-state='open'] {
  animation: fadeIn 0.15s ease;
}
[data-state='closed'] {
  animation: fadeOut 0.1s ease;
}
```

---

### 🧩 Deliverables

Gemini should:

1. Install and configure `@radix-ui/react-dropdown-menu` and `@radix-ui/react-popover`.
2. Refactor message action menus and emoji reaction UI.
3. Ensure proper portal rendering and no layout clipping.
4. Keep delete and reaction logic unchanged.
5. Maintain consistent dark-mode UI and minimal animation.

---

### ✅ Acceptance Criteria

* Message action menu (3 dots) and emoji picker render above overflow containers.
* Delete message works normally and updates in real-time.
* Emoji reaction menu appears in correct position, responsive, and intuitive.
* No interference with chat scroll, message layout, or socket events.
* Smooth UX with consistent design.

---

> 💡 Bonus task: If Gemini detects other in-bubble context menus or attachment menus, it can also migrate them to Radix UI for full consistency.

---