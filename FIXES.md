Task: Auto-fix all `@typescript-eslint/no-unused-vars` warnings across the `web` codebase.

Context: After a massive UI component refactoring, many files have leftover, unused imports (React icons, hooks, types, and components) and defined but unused variables. The ESLint report flags numerous `@typescript-eslint/no-unused-vars` warnings. We need to clean up these files to reduce bundle size and improve code hygiene.

Action Plan & Directives:

1. Scan through the `web/src/components/` directory (specifically files like `ChatList.tsx`, `ChatWindowHeader.tsx`, `CommandPalette.tsx`, `DynamicIsland.tsx`, `GroupInfoPanel.tsx`, `MessageBubble.tsx`, `MessageInput.tsx`, `MessageItem.tsx`, `PasswordPromptModal.tsx`, `StoryTray.tsx`, `StoryViewer.tsx`, `UserProfile.tsx`).
   - Remove unused component imports (e.g., `SwipeableItem` from `ChatList.tsx`).
   - Remove unused icon imports (e.g., `FiSettings`, `FiUser`, `FiMaximize2`, etc. from `ChatList.tsx` and `MessageItem.tsx`).
   - Remove unused hooks or libraries (e.g., `motion`, `Link`, `useUserProfile` where flagged).
   - If an error variable in a `catch(e)` block is unused, remove the `e` or prefix it with an underscore (e.g., `catch (_e)`).

2. Scan through `web/src/pages/` (specifically `Chat.tsx`, `KeyManagementPage.tsx`, `LandingPage.tsx`, `ProfilePage.tsx`, `SettingsPage.tsx`).
   - Remove unused assignment variables (e.g., `Maps` in `Chat.tsx` if it's never called).
   - Clean up unused icon imports and unused state variables (`isLoading`, `updateProfile`, etc. in `ProfilePage.tsx`).

3. Scan through `web/src/store/` (specifically `auth.ts`, `commandPalette.ts`, `conversation.ts`, `message.ts`, `messageInput.ts`, `messageSearch.ts`, `story.ts`).
   - Remove unused imports and unused function variables.
   - For explicitly unused variables in map functions or state closures, prefix them with `_` (e.g., `(_state) => ...`).

Please intelligently remove these unused declarations across the requested files without altering any core logic.