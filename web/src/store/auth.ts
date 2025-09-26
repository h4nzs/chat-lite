import { create } from "zustand";
import { authFetch, api } from "@lib/api";
import { getSocket, disconnectSocket } from "@lib/socket";
import { eraseCookie } from "@lib/tokenStorage";
import { clearKeyCache } from "@utils/crypto";
import { useChatStore } from "./chat";

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
    get().ensureSocket();
  },

  async register(data) {
    const res = await api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set({ user: res.user });
    localStorage.setItem("user", JSON.stringify(res.user));
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
