import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { authFetch, api } from "@lib/api";
import { getSocket, disconnectSocket } from "@lib/socket";
import { eraseCookie } from "@lib/tokenStorage";
import { clearKeyCache } from "@utils/crypto";
import { exportPublicKey, storePrivateKey } from "@utils/keyManagement";
import { getSodium } from "@lib/sodiumInitializer";

type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
  sendReadReceipts?: boolean; // Tambahkan properti
};

type State = {
  user: User | null;
  theme: "light" | "dark";
  sendReadReceipts: boolean; // Tambahkan state
  bootstrap: () => Promise<void>;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    password: string;
    name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  ensureSocket: () => void;
  setTheme: (t: "light" | "dark") => void;
  updateProfile: (data: { name: string }) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  toggleReadReceipts: () => void; // Tambahkan fungsi
  regenerateKeys: (password: string) => Promise<void>; // Fungsi untuk regenerasi kunci
};

// Helper function to setup user encryption keys
const setupUserEncryptionKeys = async (password: string): Promise<void> => {
  try {
    // Ensure sodium is initialized before generating keys
    const sodium = await getSodium();
    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    
    // Export public key to base64 string
    const publicKeyStr = await exportPublicKey(publicKey);
    
    // Encrypt the private key using the user's password
    const encryptedPrivateKey = await storePrivateKey(privateKey, password);
    
    // Store the public key in localStorage
    localStorage.setItem('publicKey', publicKeyStr);
    
    // Store the encrypted private key in localStorage
    localStorage.setItem('encryptedPrivateKey', encryptedPrivateKey);
    
    // Send the public key to the server to be associated with the user
    await api(`/api/keys/public`, {
      method: "POST",
      body: JSON.stringify({ publicKey: publicKeyStr }),
    });
  } catch (error) {
    console.error("Failed to setup user encryption keys:", error);
    throw error;
  }
};

// Restore user dari localStorage kalau ada
const savedUser = localStorage.getItem("user");

export const useAuthStore = createWithEqualityFn<State>((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  theme: (localStorage.getItem("theme") as "light" | "dark") || "light",
  sendReadReceipts: localStorage.getItem('sendReadReceipts') === 'false' ? false : true,

  async bootstrap() {
    try {
      console.log("Bootstrapping user...");
      const me = await authFetch<User>("/api/users/me");
      set({ user: me });
      localStorage.setItem("user", JSON.stringify(me));
      
      // Check if user has already generated encryption keys
      if (!localStorage.getItem('publicKey') || !localStorage.getItem('encryptedPrivateKey')) {
        // In a real app, this would trigger a modal or redirect to key setup page
        // For now, we just log the warning and let the user set up keys later in settings
        console.warn("Encryption keys not setup - end-to-end encryption will be disabled. User should set up keys in settings.");
      }
      
      get().ensureSocket();
    } catch (error) {
      console.error("Bootstrap error:", error);
      set({ user: null });
      localStorage.removeItem("user");
    }
  },

  async login(emailOrUsername: string, password: string) {
    const res = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrUsername, password }),
    });
    set({ user: res.user });
    localStorage.setItem("user", JSON.stringify(res.user));
    
    // Check if user has already generated encryption keys
    if (!localStorage.getItem('publicKey') || !localStorage.getItem('encryptedPrivateKey')) {
      try {
        await setupUserEncryptionKeys(password); // Use the login password to encrypt private key
      } catch (encryptionError) {
        console.error("Failed to setup user encryption keys:", encryptionError);
        // Continue login without encryption - user can set it up later
        // This prevents login failure if there are issues with encryption setup
      }
    }
    
    get().ensureSocket();
  },

  async register(data) {
    const res = await api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set({ user: res.user });
    localStorage.setItem("user", JSON.stringify(res.user));
    
    // Setup encryption keys for the new user using the registration password
    try {
      await setupUserEncryptionKeys(data.password);
    } catch (encryptionError) {
      console.error("Failed to setup user encryption keys during registration:", encryptionError);
      // Continue registration without encryption - user can set it up later
      // This prevents registration failure if there are issues with encryption setup
    }
    
    get().ensureSocket();
  },

  async logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }

    // Clear token dari storage
    eraseCookie("at");
    eraseCookie("rt");

    // Clear encryption key cache
    clearKeyCache();

    // Clear stored encryption keys
    localStorage.removeItem('publicKey');
    localStorage.removeItem('encryptedPrivateKey');

    // Clear state lokal
    localStorage.removeItem("user");
    localStorage.removeItem("activeId");
    set({ user: null });

    disconnectSocket();
  },

  ensureSocket() {
    getSocket();
  },

  setTheme(t: "light" | "dark") {
    localStorage.setItem("theme", t);
    set({ theme: t });
  },

  async updateProfile(data) {
    const updatedUser = await api<User>("/api/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set({ user: updatedUser });
    localStorage.setItem("user", JSON.stringify(updatedUser));
  },

  async updateAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);

    const updatedUser = await api<User>("/api/users/me/avatar", {
      method: "POST",
      body: formData,
    });

    set({ user: updatedUser });
    localStorage.setItem("user", JSON.stringify(updatedUser));
  },

  toggleReadReceipts() {
    const current = get().sendReadReceipts;
    const next = !current;
    set({ sendReadReceipts: next });
    localStorage.setItem('sendReadReceipts', String(next));
    toast.success(`Read receipts ${next ? 'enabled' : 'disabled'}`);
  },

  async regenerateKeys(password: string) {
    // 1. Hapus kunci lama dari cache dan storage
    clearKeyCache();
    clearSessionKeyCache();
    localStorage.removeItem('publicKey');
    localStorage.removeItem('encryptedPrivateKey');

    // 2. Gunakan logika yang ada untuk membuat dan menyimpan kunci baru
    await setupUserEncryptionKeys(password);

    // 3. Hapus semua state percakapan untuk memaksa sinkronisasi ulang
    useChatStore.setState({ conversations: [], messages: {} }, true);
  },
}));
