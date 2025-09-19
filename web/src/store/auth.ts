import { create } from "zustand";
import { authFetch, api } from "@lib/api";
import { getSocket, disconnectSocket } from "@lib/socket";
import { setSecureCookie, eraseCookie } from "@lib/tokenStorage";

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

export const useAuthStore = create<State>((set, get) => ({
  user: null,
  theme: (localStorage.getItem("theme") as "light" | "dark") || "light",

  async bootstrap() {
    try {
      const me = await authFetch<User>("/api/users/me");
      set({ user: me });
      get().ensureSocket();
    } catch {
      // not logged in
      set({ user: null });
    }
  },

  async login(emailOrUsername: string, password: string) {
    const res = await api<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrUsername, password }),
    });

    // Store token in localStorage and secure cookie
    if (res.token) {
      localStorage.setItem("token", res.token);
      setSecureCookie("token", res.token, 30); // 30 days
    }

    set({ user: res.user });
    get().ensureSocket();
  },

  async register(data: {
    email: string;
    username: string;
    password: string;
    name: string;
  }) {
    const res = await api<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // Store token in localStorage and secure cookie
    if (res.token) {
      localStorage.setItem("token", res.token);
      setSecureCookie("token", res.token, 30); // 30 days
    }

    set({ user: res.user });
    get().ensureSocket();
  },

  async logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }

    // Clear token from localStorage and cookies
    localStorage.removeItem("token");
    eraseCookie("token");

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
}));