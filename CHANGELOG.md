# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-11-05

This is a massive overhaul release, focusing on security, new features, and a complete UI/UX redesign.

### Added (New Features)

- **Secure Device Linking:** Implemented a new, secure flow to link a new device using a QR code, eliminating the need to re-enter the recovery phrase.
- **Biometric Login:** Added support for logging in using platform authenticators (e.g., fingerprint, face ID).
- **Account Restore:** Created a new flow for restoring an account from the 24-word recovery phrase.
- **Session Management:** Added a new page where users can view and manage all their active sessions.
- **Group Chat:** Implemented full support for creating and managing group conversations.
- **E2EE & Security:**
  - Implemented the Double Ratchet algorithm for robust, self-healing E2EE session management.
  - Added Safety Number verification to allow users to confirm the identity of their contacts.
  - Strengthened the master key generation and storage process.
- **In-App Notifications:** Built a notification center and popup system for real-time, in-app alerts.
- **User Profiles:** Added user profiles with display names and descriptions.
- **Message Features:**
  - Implemented link previews for URLs shared in messages.
  - Added message search functionality.
  - Implemented read receipts and unread message counts.
  - Added an emoji picker to the message input.
  - Implemented message replies.

### Changed (Improvements & Refactors)

- **Major UI/UX Overhaul:**
  - Defined and implemented a new professional, HSL-based color palette with full light/dark mode support.
  - Redesigned all key components (`ChatList`, `MessageBubble`, `ChatWindow`, Modals) for a modern and consistent look.
  - Standardized all forms, inputs, and buttons across the application with clear `hover`, `focus`, and `disabled` states.
  - Added smooth CSS transitions and `framer-motion` animations for a more dynamic and responsive user experience (e.g., sidebar slide-in, message fade-in, list re-ordering).
  - Improved color contrast ratios for better accessibility.
- **Architecture & Performance:**
  - Migrated device linking state from server memory to **Redis** for improved scalability and reliability.
  - Refactored socket logic for more efficient real-time communication, including implicit 1-on-1 chat creation.
  - Replaced CSS-based animations with `framer-motion` for smoother, physics-based transitions.
  - Implemented `react-virtuoso` for efficient rendering of long message and conversation lists.

### Fixed

- **Server Stability:** Fixed a critical server crash that occurred during `typing` events by adding defensive checks for the user object.
- **Client-Side Errors:**
  - Resolved a `ReferenceError` in the `ChatList` component that occurred after a refactor.
  - Fixed a bug that prevented messages from being decrypted correctly on the client.
- **UI/UX Bugs:**
  - Fixed an issue where modals and dropdowns had a transparent background, adding a `backdrop-blur` effect for a modern look.
  - Corrected numerous visual and contrast issues across the app after the new theme was implemented.
- **Authentication:** Patched a token unauthorization bug.
- **General Stability:** Numerous miscellaneous bug fixes and stability improvements (as noted by commits like `stable`, `stable3`, `stable4`, `stable5`, etc.).
