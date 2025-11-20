import { createWithEqualityFn } from "zustand/traditional";
import { authFetch, api } from "@lib/api";
import { getSocket, disconnectSocket } from "@lib/socket";
import { useSocketStore, resetListenersInitialized } from './socket';
import { eraseCookie } from "@lib/tokenStorage";
import { clearKeyCache } from "@utils/crypto";
import { getSodium } from '@lib/sodiumInitializer';
import { generateKeyPair, exportPublicKey, storePrivateKeys, retrievePrivateKeys } from "@utils/keyManagement";
import { useConversationStore } from "./conversation";
import { useMessageStore } from "./message";
import { retrievePrivateKey } from "@utils/keyManagement";
import { generatePreKeys, uploadPreKeys } from "@utils/preKey";
import { useModalStore } from "./modal";
import { startAuthentication } from '@simplewebauthn/browser';
import toast from "react-hot-toast";

export type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  showEmailToOthers?: boolean;
  hasCompletedOnboarding?: boolean;
};

type State = {
  user: User | null;
  isBootstrapping: boolean;
  theme: "light" | "dark";
  sendReadReceipts: boolean;
  bootstrap: () => Promise<void>;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  loginWithBiometrics: (username: string) => Promise<boolean>;
  register: (data: any) => Promise<void>;
  registerAndGeneratePhrase: (data: any) => Promise<string>;
  logout: () => Promise<void>;
  ensureSocket: () => void;
  setTheme: (t: "light" | "dark") => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  setReadReceipts: (value: boolean) => void;
  regenerateKeys: (password: string) => Promise<void>;
  getPrivateKey: () => Promise<Uint8Array>;
  getSigningPrivateKey: () => Promise<Uint8Array>;
  getEncryptionKeyPair: () => Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }>;
  setUser: (user: User) => void;
};

// Helper function to setup user encryption and signing keys
const setupUserEncryptionKeys = async (password: string): Promise<void> => {
  try {
    // Ensure sodium is initialized before generating keys
    await getSodium(); // Ensure libsodium is ready
    const { publicKey, privateKey } = await generateKeyPair();
    const signingKeyPair = await generateKeyPair(); // Generate a separate key pair for signing

    // Export public keys to base64 strings
    const publicKeyStr = await exportPublicKey(publicKey);
    const signingPublicKeyStr = await exportPublicKey(signingKeyPair.publicKey);

    // Encrypt both private keys using the user's password
    const encryptedPrivateKeys = await storePrivateKeys({
      encryption: privateKey,
      signing: signingKeyPair.privateKey
    }, password);

    // Store the public keys in localStorage
    localStorage.setItem('publicKey', publicKeyStr);
    localStorage.setItem('signingPublicKey', signingPublicKeyStr);

    // Store the encrypted private keys in localStorage
    localStorage.setItem('encryptedPrivateKey', encryptedPrivateKeys);

    // Send the public key to the server to be associated with the user
    await api(`/api/keys/public`, {
      method: "POST",
      body: JSON.stringify({ publicKey: publicKeyStr, signingKey: signingPublicKeyStr }),
    });
  } catch (error) {
    console.error("Failed to setup user encryption and signing keys:", error);
    throw error;
  }
};

// Restore user dari localStorage kalau ada
const savedUser = localStorage.getItem("user");
let privateKeyCache: Uint8Array | null = null;

export const useAuthStore = createWithEqualityFn<State>((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  isBootstrapping: true,
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
      
      // Initialize socket listeners AFTER user is authenticated
      useSocketStore.getState().initSocketListeners();

    } catch (error) {
      console.error("Bootstrap error:", error);
      set({ user: null });
      localStorage.removeItem("user");
    } finally {
      set({ isBootstrapping: false });
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
      // Continue login without encryption - user can set it up later
      // This prevents login failure if there are issues with encryption setup
    }

    // --- NEW: Generate and upload pre-keys after successful registration ---
    try {
      // After registration, we have the password. Retrieve the private keys directly.
      const storedEncryptedKeys = localStorage.getItem('encryptedPrivateKey');
      if (!storedEncryptedKeys) {
        console.warn("No encrypted private keys found after registration. User may need to set up encryption later.");
        return; // Return early instead of throwing, to avoid breaking registration flow
      }
      const privateKeys = await retrievePrivateKeys(storedEncryptedKeys, data.password);  // Use retrievePrivateKeys (plural) instead of retrievePrivateKey (singular)
      if (!privateKeys || !privateKeys.signing) {
        console.warn("Signing private key not available after registration. User may need to set up encryption later.");
        return; // Return early instead of throwing, to avoid breaking registration flow
      }
      // Use the signing private key for generating pre-keys (not the encryption key)
      const { signedPreKey, oneTimePreKeys } = await generatePreKeys(privateKeys.signing);
      await uploadPreKeys(signedPreKey, oneTimePreKeys);
      console.log("Pre-keys generated and uploaded successfully after registration.");
    } catch (e) {
      console.error("Failed to generate or upload pre-keys after registration:", e);
      // Don't throw an error that breaks the registration flow - pre-keys can be generated later
      toast.error("Warning: Could not prepare secure sessions. You may need to log out and log back in.");
    }
    // --- END NEW ---

    get().ensureSocket();
  },

  async registerAndGeneratePhrase(data) {
    const sodium = await getSodium();
    const bip39 = await import('bip39');
    const phrase = bip39.generateMnemonic(256); // 24 words
    const masterSeed = bip39.mnemonicToEntropy(phrase);

    // Derive separate seeds for encryption and signing from the master seed
    const encryptionSeed = sodium.crypto_generichash(32, sodium.from_hex(masterSeed), "encryption");
    const signingSeed = sodium.crypto_generichash(32, sodium.from_hex(masterSeed), "signing");

    // Generate key pairs from the derived seeds
    const encryptionKeyPair = sodium.crypto_box_seed_keypair(encryptionSeed);
    const signingKeyPair = sodium.crypto_sign_seed_keypair(signingSeed);

    const encryptionPublicKeyB64 = sodium.to_base64(encryptionKeyPair.publicKey, sodium.base64_variants.ORIGINAL);
    const signingPublicKeyB64 = sodium.to_base64(signingKeyPair.publicKey, sodium.base64_variants.ORIGINAL);

    // --- Definitive Validation Step ---
    if (!encryptionPublicKeyB64 || typeof encryptionPublicKeyB64 !== 'string') {
      throw new Error("FATAL: Generated public key is invalid.");
    }
    if (!phrase || typeof phrase !== 'string') {
      throw new Error("FATAL: Generated recovery phrase is invalid.");
    }

    // Encrypt and store both private keys LOCALLY first, using the original password.
    const encryptedPrivateKeys = await storePrivateKeys({
      encryption: encryptionKeyPair.privateKey,
      signing: signingKeyPair.privateKey
    }, data.password);
    localStorage.setItem('publicKey', encryptionPublicKeyB64);
    localStorage.setItem('signingPublicKey', signingPublicKeyB64);
    localStorage.setItem('encryptedPrivateKey', encryptedPrivateKeys);

    // NOW, send the registration data to the server.
    const res = await api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...data, publicKey: encryptionPublicKeyB64, signingKey: signingPublicKeyB64, recoveryPhrase: phrase }),
    });

    set({ user: res.user });
    localStorage.setItem("user", JSON.stringify(res.user));

    // --- NEW: Generate and upload pre-keys after successful registration ---
    try {
      // After registration, we have the password. Retrieve the private keys directly.
      const storedEncryptedKeys = localStorage.getItem('encryptedPrivateKey');
      if (!storedEncryptedKeys) {
        console.warn("No encrypted private keys found after registration. User may need to set up encryption later.");
        return; // Return early instead of throwing, to avoid breaking registration flow
      }
      const privateKeys = await retrievePrivateKeys(storedEncryptedKeys, data.password);  // Use retrievePrivateKeys (plural) instead of retrievePrivateKey (singular)
      if (!privateKeys || !privateKeys.signing) {
        console.warn("Signing private key not available after registration. User may need to set up encryption later.");
        return; // Return early instead of throwing, to avoid breaking registration flow
      }
      // Use the signing private key for generating pre-keys (not the encryption key)
      const { signedPreKey, oneTimePreKeys } = await generatePreKeys(privateKeys.signing);
      await uploadPreKeys(signedPreKey, oneTimePreKeys);
      console.log("Pre-keys generated and uploaded successfully after registration.");
    } catch (e) {
      console.error("Failed to generate or upload pre-keys after registration:", e);
      // Don't throw an error that breaks the registration flow - pre-keys can be generated later
      toast.error("Warning: Could not prepare secure sessions. You may need to log out and log back in.");
    }
    // --- END NEW ---

    get().ensureSocket();
    return phrase;
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

    // Clear in-memory private key cache
    privateKeyCache = null;

    // Clear encryption key cache
    clearKeyCache();

    // DO NOT clear stored encryption keys for persistent sessions
    // localStorage.removeItem('publicKey');
    // localStorage.removeItem('encryptedPrivateKey');

    // Clear state lokal
    localStorage.removeItem("user");
    localStorage.removeItem("activeId");
    set({ user: null });

    resetListenersInitialized(); // Reset the flag
    disconnectSocket();
  },

  ensureSocket() {
    getSocket();
  },

  setTheme(t: "light" | "dark") {
    localStorage.setItem("theme", t);
    set({ theme: t });
  },

  async updateProfile(data: Partial<User>) {
    const updatedUser = await authFetch<User>("/api/users/me", {
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

  setReadReceipts(value: boolean) {
    set({ sendReadReceipts: value });
    localStorage.setItem('sendReadReceipts', String(value));
  },

  async regenerateKeys(password: string) {
    // 1. Hapus kunci lama dari cache dan storage
    clearKeyCache();
    localStorage.removeItem('publicKey');
    localStorage.removeItem('encryptedPrivateKey');

    // 2. Gunakan logika yang ada untuk membuat dan menyimpan kunci baru
    await setupUserEncryptionKeys(password);

    // 3. Hapus semua state percakapan untuk memaksa sinkronisasi ulang
    useConversationStore.setState({ conversations: [], messages: {} }, true);
    useMessageStore.setState({ messages: {} }, true);
  },

  async loginWithBiometrics(username: string) {
    try {
      // 1. Get options from server
      const authOptions = await api("/api/auth/webauthn/auth-options", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      // 2. Start authentication with the browser
      const authResp = await startAuthentication(authOptions);

      // 3. Verify the response with the server
      const verification = await api("/api/auth/webauthn/auth-verify", {
        method: "POST",
        body: JSON.stringify({ username, webauthnResponse: authResp }),
      });

      if (verification?.verified) {
        // If successful, the server has set the auth cookies.
        // Now, bootstrap the app to fetch user data.
        await get().bootstrap();
        return true;
      } else {
        throw new Error("Biometric verification failed.");
      }
    } catch (err: any) {
      console.error("Biometric login error:", err);
      throw err; // Re-throw to be caught by the UI
    }
  },

  async getPrivateKey() {
    // Check in-memory cache first
    if (privateKeyCache) {
      return privateKeyCache;
    }

    return new Promise((resolve, reject) => {
      useModalStore.getState().showPasswordPrompt(async (password) => {
        if (!password) {
          return reject(new Error("Password not provided."));
        }
        try {
          const encryptedKey = localStorage.getItem('encryptedPrivateKey');
          if (!encryptedKey) {
            throw new Error("Encrypted private key not found in storage.");
          }
          // For backwards compatibility, try to decrypt with the old single-key method first
          try {
            const pk = await retrievePrivateKey(encryptedKey, password);
            if (!pk) {
              throw new Error("Incorrect password. Failed to decrypt private key.");
            }
            privateKeyCache = pk; // Cache the key
            resolve(pk);
          } catch {
            // If single-key method fails, try the new multi-key method
            const keys = await retrievePrivateKeys(encryptedKey, password);
            if (!keys || !keys.encryption) {
              throw new Error("Incorrect password. Failed to decrypt private key.");
            }
            privateKeyCache = keys.encryption; // Cache the encryption key
            resolve(keys.encryption);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
  },

  async getSigningPrivateKey() {
    return new Promise((resolve, reject) => {
      useModalStore.getState().showPasswordPrompt(async (password) => {
        if (!password) {
          return reject(new Error("Password not provided."));
        }
        try {
          const encryptedKey = localStorage.getItem('encryptedPrivateKey');
          if (!encryptedKey) {
            throw new Error("Encrypted private keys not found in storage.");
          }
          const keys = await retrievePrivateKeys(encryptedKey, password);
          if (!keys || !keys.signing) {
            throw new Error("Signing key not found or invalid password.");
          }
          resolve(keys.signing);
        } catch (e) {
          reject(e);
        }
      });
    });
  },

  async getEncryptionKeyPair() {
    return new Promise((resolve, reject) => {
      useModalStore.getState().showPasswordPrompt(async (password) => {
        if (!password) {
          return reject(new Error("Password not provided."));
        }
        try {
          const encryptedKey = localStorage.getItem('encryptedPrivateKey');
          if (!encryptedKey) {
            throw new Error("Encrypted private keys not found in storage.");
          }
          const keys = await retrievePrivateKeys(encryptedKey, password);
          if (!keys || !keys.encryption) {
            throw new Error("Encryption key not found or invalid password.");
          }
          // Generate public key from private key
          const sodium = await getSodium();
          const publicKey = sodium.crypto_scalarmult_base(keys.encryption);
          resolve({ publicKey, privateKey: keys.encryption });
        } catch (e) {
          reject(e);
        }
      });
    });
  },

  setUser(user: User) {
    set({ user });
    localStorage.setItem("user", JSON.stringify(user));
  },
}));
