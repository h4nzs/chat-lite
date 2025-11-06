# Changelog

All notable changes to this project will be documented in this file.

## [1.0.7] - 2025-11-06

This release introduces theme customization, allowing users to personalize the application by choosing their preferred accent color. It also includes several critical bug fixes for recently added features.

### Added

- **Accent Color Customization:** Users can now select their preferred accent color from a palette in the Settings page under the 'Appearance' section. The chosen color is applied across the entire application and is saved for future sessions.

### Fixed

- **Infinite Loop in Components:** Resolved a critical `Maximum update depth exceeded` error by wrapping function declarations in `useCallback` within `App.tsx` and `ChatList.tsx`, preventing infinite re-render loops.
- **Missing React Import:** Fixed a `ReferenceError` by adding a missing `useCallback` import in `App.tsx`.
- **Theme Picker UI:** Corrected a UI bug in the Settings page where color swatches were not displaying correctly. The implementation was changed to use inline styles for better reliability.

## [1.0.6] - 2025-11-06

This release upgrades the `Ctrl+K` shortcut into a full-featured Command Palette, allowing for quick execution of commands from anywhere in the application.

### Added

- **Command Palette:** Implemented a Command Palette (`Ctrl+K` or `Cmd+K`) for quick access to actions.
  - Includes initial commands: 'Settings', 'Logout', and 'New Group' (contextual).
  - Features include real-time filtering, keyboard navigation (Arrow keys & Enter), and a scalable command registration system.

### Fixed

- **Build Errors:** Resolved multiple build errors related to duplicate declarations and incorrect import paths that arose during the command palette implementation.

## [1.0.5] - 2025-11-06

This release introduces significant enhancements to file sharing, including a media gallery to browse all shared files in a conversation and rich previews for PDFs, videos, and audio files.

### Added

- **Media Gallery:** Added a 'Media' tab to the Group Info and User Info panels, allowing users to easily view all images, videos, and documents shared in a conversation.
- **Rich File Previews:** File attachments in chats now show rich previews:
  - **PDFs:** Display a preview of the first page directly in the chat.
  - **Video & Audio:** Embed a playable media player for video and audio files.

### Fixed

- **Backend API:** Fixed a 500 Internal Server Error on the new `/media` API endpoint by correcting the database query to use the proper schema fields (`fileType`, `fileUrl`, `imageUrl`).
- **PDF Preview Rendering:** Resolved a build error and a runtime warning related to the `react-pdf` library in Vite by correcting CSS import paths and self-hosting the required PDF worker script.

## [1.0.4] - 2025-11-06

This release introduces major keyboard navigation enhancements for a faster, more accessible user experience, and fixes bugs related to their implementation.

### Added

- **Keyboard Navigation:** Implemented comprehensive keyboard navigation features:
  - **Chat List Navigation:** Users can now navigate the conversation list using the `Arrow Up` and `Arrow Down` keys and open a chat by pressing `Enter`.
  - **Global Escape:** Pressing the `Escape` key now closes any open modal or side panel, providing a consistent way to exit views.
  - **Quick Search Shortcut:** Added a global `Ctrl+K` (or `Cmd+K` on Mac) shortcut to immediately focus the main search bar from anywhere in the app.

### Fixed

- **Keyboard Navigation Bugs:** Resolved several reference and syntax errors in the `ChatList` component that occurred during the implementation of keyboard navigation, ensuring the feature is stable.

## [1.0.3] - 2025-11-06

This release addresses a critical message loading bug and includes several UI refinements and fixes based on user feedback after the Neumorphic redesign.

### Changed (Improvements & Refactors)

- **Button Theme:** Reverted primary action buttons from a gradient to a solid accent color (`bg-accent`). This resolves a visual bug where the button and its text were not visible in light mode and improves consistency with the Neumorphic design.

### Fixed

- **Message Loading:** Fixed a bug where older messages would not load when opening a conversation for the first time. The app now automatically fetches additional message pages to ensure the chat history is scrollable.
- **Toggle Switch UI:** Corrected a visual glitch in the Neumorphic `ToggleSwitch` where the handle was not vertically centered within its track.

## [1.0.2] - 2025-11-06

This release completes the transition to a full Neumorphic design system, ensuring a consistent and tactile UI across the entire application. It also includes several configuration and bug fixes.

### Changed (Improvements & Refactors)

- **Neumorphic Design System:** Completed the full implementation of the Neumorphic design system, replacing all remaining standard UI elements.
- **Component Styling:** Refactored all major components to use `convex` (protruding) and `concave` (recessed) neumorphic styles, including: Modals, Panels, Cards, List Items, Message Bubbles, Buttons, and Input Fields.
- **Toggle Switch Redesign:** Rebuilt all Toggle Switches to be fully neumorphic, with a concave track and a convex handle for a more tactile feel.
- **Dark Mode Tuning:** Fine-tuned dark mode neumorphic shadows to be more subtle and visually pleasing based on user feedback.

### Fixed

- **Build Failure:** Fixed a build error caused by a missing `colors` definition in the Tailwind CSS configuration.
- **JSX Syntax Errors:** Corrected JSX parsing errors in `Register.tsx` and `Login.tsx` that prevented the application from loading.
- **Corrupted Component:** Repaired the `MessageBubble.tsx` component file which contained duplicate, conflicting code.

## [1.0.1] - 2025-11-06

This release focuses on a significant UI/UX overhaul, introducing a unique visual identity and advanced responsive layouts.

### Added (New Features)

- **"Aurora" Gradient Theme:** Implemented a distinctive Teal-to-Indigo gradient as the application's new accent color, applied to primary buttons and key UI elements.
- **Three-Column "Command Center" Layout:** Introduced an adaptive three-column layout for ultrawide monitors, displaying ChatList, ChatWindow, and a contextual info panel (GroupInfoPanel or UserInfoPanel) simultaneously.
- **Hybrid Tablet Experience:** Implemented dynamic layout switching for tablets based on orientation (mobile-like in portrait, desktop-like in landscape).
- **`useOrientation` Hook:** Created a custom React hook to detect and respond to screen orientation changes.
- **`UserInfoPanel` Component:** Developed a dedicated panel to display user information in the three-column layout.
- **New `2xl` Breakpoint:** Added a `2xl` breakpoint (1920px) to Tailwind CSS for ultrawide screen optimization.

### Changed (Improvements & Refactors)

- **"Floating Glass" Sidebar:** Transformed the desktop ChatList sidebar into a semi-transparent, blurred panel (`backdrop-blur-sm`) that floats over the main content, creating a modern depth effect.
- **Dynamic Background Pattern:** Added a subtle SVG pattern to the ChatWindow background, visible through the transparent sidebar, enhancing the visual depth.
- **Unified Button Styling:** Standardized all primary buttons across the application (including Auth pages, Message Input, Create Group, Settings, and Modals) to consistently use the new "Aurora" gradient.
- **Improved Color Contrast:** Further refined color contrast ratios for secondary text in both light and dark themes to enhance accessibility.

### Fixed

- **Layout Overlap:** Resolved the issue where the floating sidebar obscured the ChatWindow content by adding responsive left padding to the main content area.
- **Solid Sidebar Background:** Fixed the bug where the ChatList sidebar appeared solid by removing an erroneous `bg-surface` class from individual chat items.
- **JSX Parsing Errors:** Corrected multiple JSX closing tag errors in `Settings.tsx`.
- **Gradient Application:** Fixed issues where the new "Aurora" gradient was not correctly applied to primary buttons on Auth pages and various in-app components.

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