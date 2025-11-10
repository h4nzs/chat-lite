# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2025-11-10

This release introduces a comprehensive, professional landing page to serve as the application's public-facing "front door". It also includes numerous UI/UX enhancements and critical routing fixes.

### Added
- **New Landing Page:** Created a full-featured, animated landing page at the root (`/`) of the application, including:
  - A hero section with a call-to-action.
  - An interactive theme comparison slider to showcase light and dark modes.
  - A "Features" section with animated cards.
  - A "How It Works" section visually explaining the security flow.
  - A "Works Everywhere" section displaying the app on multiple devices.
  - A "Testimonials" section for social proof.
- **Scroll Animations:** Implemented "fade-in" and "slide-up" animations on all sections of the landing page, triggered as the user scrolls.
- **Hover Animations:** Added a more dynamic, spring-based "expand and lift" effect to the feature cards on hover.

### Changed
- **Root Routing:** The application's root route (`/`) now serves the public landing page. The main chat interface is now exclusively accessible via the `/chat` route.

### Fixed
- **Post-Login Redirect:** Fixed a critical bug where users were redirected to the landing page after logging in, registering, or restoring an account. All authentication flows now correctly redirect to `/chat`.
- **In-App Back Buttons:** Corrected multiple "back" buttons (e.g., from Settings) to navigate to `/chat` instead of the root landing page.
- **Landing Page Scrolling:** Fixed a bug where a global `overflow: hidden` style prevented the new landing page from being scrollable.
- **Component Rendering:** Fixed several React/JSX errors in the landing page that caused build failures or prevented components (like the theme slider and testimonials) from rendering correctly.

## [1.2.0] - 2025-11-08


This is a major architectural release focused on improving the long-term maintainability, stability, and performance of the application by refactoring core components and fixing critical real-time functionality bugs.

### Changed

- **Theming:**
  - Overhauled the color palettes for both light and dark modes to create a more authentic and cohesive Neumorphic aesthetic.
  - Dark mode now uses a neutral dark gray theme, removing all blue tints for a "true black" feel.
  - Light mode now uses a softer, off-gray background for both the main view and component surfaces, creating a more subtle "soft UI" effect.
  - Adjusted all shadow and border colors to complement the new palettes and enhance the 3D effect.

- **Major State Management Refactor:** The monolithic `useMessageStore` has been broken down into smaller, more focused stores (`useMessageStore`, `useMessageInputStore`, `useMessageSearchStore`) to improve separation of concerns and simplify state management.
- **Component Logic Extraction:** Refactored the `ChatList` component into a purely presentational component. All of its business logic, state selection, and side effects have been extracted into a new, dedicated `useChatList` custom hook.
- **Conversation Creation Flow:** Moved 1-on-1 conversation creation logic from a WebSocket event (`message:send`) to the `POST /api/conversations` REST endpoint, making the creation process more explicit and robust.
- **Centralized File Uploads:** Consolidated file upload logic into a new `apiUpload` helper function, removing direct `axios` usage from the stores and ensuring consistent authentication handling.

### Fixed

- **Real-time Connection for New Chats:**
  - Fixed a critical bug where the creator of a new group or 1-on-1 chat would not receive real-time messages until refreshing. The client now immediately joins the new conversation's socket room.
  - Fixed an issue where users added to a new conversation would not receive real-time updates. The client now correctly handles the `conversation:new` socket event and joins the room.
- **Server Race Condition:** Fixed a `P2003 Foreign key constraint violated` error on the server that occurred when marking a message as read too quickly. Message creation is now wrapped in a database transaction to ensure atomicity.
- **UI & Data Sync:**
  - Fixed a bug where deleting a group or conversation would not be reflected in the UI until a page refresh.
  - Fixed the user search functionality within the "Create Group" modal, which was failing due to an authentication issue.
  - Fixed a UI bug where the sender's name in group chats was invisible in dark mode by applying a theme-aware CSS filter.
- **General Stability:**
  - Fixed a bug where the initial page load would get stuck in a loading state indefinitely.
  - Resolved a Vite configuration error (`fs.allow`) that prevented `react-pdf` styles from loading.
  - Corrected multiple JavaScript `ReferenceError` and syntax errors (`Unexpected ")"`, misplaced `import`) that were introduced during the extensive refactoring process.

## [1.1.2] - 2025-11-08

This release addresses critical backend architecture and frontend user experience issues, improving application stability and robustness.

### Fixed

- **Online Status Race Condition:** Migrated the online presence tracking system from a local in-memory `Set` to a centralized Redis set. This resolves a potential race condition and ensures that the presence status and the E2EE key recovery mechanism work reliably across multiple server instances.
- **Conversation Load Error Handling:** Improved the user experience for data loading errors. The conversation list now displays a descriptive error message and a "Retry" button if conversations fail to load, allowing users to recover from network failures without a full page refresh.

## [1.1.1] - 2025-11-08

This release focuses on enhancing user experience with smoother UI transitions and a critical improvement to end-to-end encryption key recovery for offline messages.

### Added

- **Real-time E2EE Key Recovery:** Implemented a robust client-to-client key recovery mechanism via WebSocket. When a user comes online and encounters messages encrypted with a session key they don't possess (e.g., sent while offline), the client now securely requests the missing key from another online participant in the conversation.
  - Server-side Socket.IO now orchestrates key requests and fulfillment between clients.
  - Client-side Socket.IO handles emitting key requests and fulfilling requests from other clients.
  - Client-side cryptographic logic (`crypto.ts`) now non-blockingly requests keys and re-encrypts keys for other clients.
  - Client-side message store (`message.ts`) now re-decrypts messages after a missing key is successfully received.

### Changed

- **Animated Tab Indicators:** Refactored tab components (`GroupInfoPanel`, `UserInfoPanel`) to use a new `AnimatedTabs` component. The active tab indicator now slides smoothly between tabs using `framer-motion`'s `tween` transition, providing a more dynamic and responsive UI.
- **Backdrop Contrast Improvement:** Adjusted the styling of `backdrop-blur` elements to ensure better color contrast in both light and and dark themes, making blurred backgrounds darker in light mode and lighter in dark mode.

## [1.1.0] - 2025-11-08

This release introduces a complete and robust account restore flow, ensuring users can access their full, decrypted message history on a new device. It also fixes critical bugs related to the restore process.

### Added

- **Full History Sync on Restore:** When restoring an account with a recovery phrase, the application now automatically fetches, decrypts, and stores the entire history of message encryption keys. This allows users to seamlessly view their old, encrypted messages on a new device.
- **Backend Sync Endpoint:** Created a new, secure API endpoint (`/api/session-keys/sync`) to facilitate the secure transfer of historical keys to a newly restored device.

### Fixed

- **Failed Decryption on New Device:** Fixed the critical bug where messages in existing conversations would fail to decrypt after restoring an account.
- **Stuck "Syncing" Notification:** Resolved an issue where the "Syncing message keys..." notification would get stuck in a loading state. This was traced to a race condition in React's Strict Mode and has been fixed by preventing concurrent synchronization processes.

### Changed

- **Code Cleanup:** Removed an obsolete and unused encryption utility file (`web/src/utils/e2ee.ts`) to reduce technical debt and improve clarity.

## [1.0.9] - 2025-11-06

This release focuses on improving UI clarity and accessibility.

### Changed

- **Message Bubble Styling:** Adjusted the styling of self-sent messages. The chosen accent color is now applied to the message bubble's background instead of the text, improving visual distinction.

### Fixed

- **Accessibility:** 
  - Added descriptive `aria-label` attributes to all icon-only buttons across the application to improve screen reader compatibility.
  - Fixed color contrast issues in the light theme for the blue and purple accent colors to ensure text remains readable.
- **Performance:** Resolved a critical performance issue that caused high CPU usage when the onboarding modal was displayed by fixing a re-render loop.

## [1.0.8] - 2025-11-06

This release introduces a crucial onboarding experience for new users to familiarize them with the app's key security concepts.

### Added

- **New User Onboarding Tour:** Implemented a multi-step guided tour for first-time users that explains core security features like the Recovery Phrase and Safety Numbers.
- **Backend Support for Onboarding:** Added a `hasCompletedOnboarding` flag to the user model in the database and created a new API endpoint to track the tour's completion status.

### Fixed

- **Onboarding API Call:** Fixed a `TypeError` that occurred when finishing the tour by correcting the API call syntax.
- **Server-Side Rendering Issues:** Resolved an issue where a server restart was required for new backend changes to take effect.
- **Database Schema Validation:** Corrected multiple validation errors in the Prisma schema that were preventing database migrations.
- **Broken Registration Route:** Restored critical logic in the `/register` API endpoint that was accidentally deleted in a previous modification.

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
