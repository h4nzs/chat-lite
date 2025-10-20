import { create } from "zustand";
import { authFetch, api } from "@lib/api";
import { getSocket, disconnectSocket } from "@lib/socket";
import { eraseCookie } from "@lib/tokenStorage";
import { clearKeyCache } from "@utils/crypto";
import { clearSessionKeyCache } from "@utils/advancedCrypto";
import { useChatStore } from "./chat";
import { generateKeyPair, exportPublicKey, exportPrivateKey, storePrivateKey } from "@utils/keyManagement";

type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
};

type State = {
  user: User | null;
  theme: "light" | "dark";
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
};

// Helper function to setup user encryption keys
const setupUserEncryptionKeys = async (password: string): Promise<void> => {
  try {
    // Generate a new key pair
    const { publicKey, privateKey } = await generateKeyPair();
    
    // Export public and private keys to base64 strings
    const publicKeyStr = await exportPublicKey(publicKey);
    const privateKeyStr = await exportPrivateKey(privateKey);
    
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

export const useAuthStore = create<State>((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  theme: (localStorage.getItem("theme") as "light" | "dark") || "light",

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

    // Clear session key cache (for forward secrecy)
    clearSessionKeyCache();

    // Clear stored encryption keys
    localStorage.removeItem('publicKey');
    localStorage.removeItem('encryptedPrivateKey');

    // Clear state lokal
    localStorage.removeItem("user");
    localStorage.removeItem("activeId");
    set({ user: null });
    useChatStore.setState({ activeId: null });

    disconnectSocket();
  },

  ensureSocket() {
    getSocket();
  },

  setTheme(t: "light" | "dark") {
    localStorage.setItem("theme", t);
    set({ theme: t });
  },
}));
