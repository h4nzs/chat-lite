# Advanced Layout & Composition Roadmap

This document outlines the plan to evolve the application's layout from a standard design to a unique, adaptive, and premium experience across all devices.

---

### **Phase 1: "Floating Glass" Sidebar & Dynamic Background**

**Goal:** To create a sense of depth and a modern aesthetic that becomes the application's signature visual identity.

- **Tasks:**
  1.  **Glass Sidebar:** Transform the `ChatList` (sidebar) on desktop/tablet views into a semi-transparent "glass" panel. This will utilize a `backdrop-blur` effect, allowing the main chat window's background pattern to be subtly visible behind it.
  2.  **Floating Position:** Position the sidebar to "float" on top of the `ChatWindow`, rather than pushing it to the side. The `ChatWindow` will span the full width of the screen behind the sidebar.
  3.  **Subtle Background Pattern:** Add a very subtle, repeating SVG pattern to the `ChatWindow` background. This will provide texture and enhance the depth effect when viewed through the glass sidebar.
- **Reason:** This "glassmorphism" approach is highly modern and will immediately give the app a sophisticated and unique look, setting it apart from other chat applications.

---

### **Phase 2: The Three-Column "Command Center" Layout (for Ultrawide Monitors)**

**Goal:** To leverage extra horizontal screen real estate for an efficient "power user" experience.

- **Tasks:**
  1.  **New Breakpoint:** Define a new breakpoint in Tailwind CSS for ultrawide screens (e.g., `2xl`).
  2.  **Contextual Third Column:** At this new breakpoint, activate a three-column layout:
      - **Column 1 (Left):** The floating `ChatList` sidebar.
      - **Column 2 (Center):** The main `ChatWindow`.
      - **Column 3 (Right):** A context-aware information panel. This panel will automatically display the `GroupInfoPanel` when a group chat is open, or a `UserInfo` panel for direct messages.
- **Reason:** This drastically reduces the number of clicks needed to access important information and creates a highly productive and immersive desktop experience.

---

### **Phase 3: The "Hybrid" Tablet Experience**

**Goal:** To optimize the user experience on tablets, which are often awkward with standard responsive web layouts.

- **Tasks:**
  1.  **Orientation Detection:** Implement a React hook to detect the device's orientation (portrait or landscape).
  2.  **Portrait Mode:** In portrait mode, the app will behave like the mobile layout (single column, slide-out sidebar).
  3.  **Landscape Mode:** In landscape mode, the app will adopt the new "Floating Glass" desktop layout, providing a richer experience.
- **Reason:** Instead of simply stretching the mobile layout or shrinking the desktop one, this hybrid approach provides the most optimal and "native" feeling experience for each tablet orientation.
