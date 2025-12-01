import { createWithEqualityFn } from "zustand/traditional";
import { authFetch, api } from "@lib/api";
import { getSocket, disconnectSocket, connectSocket } from "@lib/socket";
import { eraseCookie } from "@lib/tokenStorage";
import { clearKeyCache } from "@utils/crypto";
import { getSodium } from '@lib/sodiumInitializer';
import { exportPublicKey, storePrivateKeys, retrievePrivateKeys } from "@utils/keyManagement";
import { useModalStore } from "./modal";
import * as bip39 from 'bip39';
import { useConversationStore } from "./conversation";
import { useMessageStore } from "./message";
import toast from "react-hot-toast";

/**
 * Retrieves the persisted signed pre-key, signs it with the identity signing key,
 * and uploads the bundle to the server.
 */
export async function setupAndUploadPreKeyBundle() {
  try {
    const { getSigningPrivateKey, getSignedPreKeyPair } = useAuthStore.getState();

    const sodium = await getSodium();
    const signingPrivateKey = await getSigningPrivateKey();
    const signedPreKeyPair = await getSignedPreKeyPair();

    const signature = sodium.crypto_sign_detached(signedPreKeyPair.publicKey, signingPrivateKey);
    const identityKey = localStorage.getItem('publicKey');
    if (!identityKey) throw new Error("Identity key not found.");

    const bundle = {
      identityKey: identityKey,
      signedPreKey: {
        key: await exportPublicKey(signedPreKeyPair.publicKey),
        signature: sodium.to_base64(signature, sodium.base64_variants.URLSAFE_NO_PADDING),
      },
    };
    await authFetch("/api/keys/prekey-bundle", {
      method: "POST",
      body: JSON.stringify(bundle),
    });
    console.log("Pre-key bundle uploaded successfully.");
  } catch (e) {
    console.error("Failed to set up and upload pre-key bundle:", e);
    toast.error("Could not prepare for secure asynchronous messages.");
  }
}

export type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  hasCompletedOnboarding?: boolean;
};

type State = {
  user: User | null;
  isBootstrapping: boolean;
  bootstrap: () => Promise<void>;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  registerAndGeneratePhrase: (data: any) => Promise<string>;
  logout: () => Promise<void>;
  getEncryptionKeyPair: () => Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }>;
  getSigningPrivateKey: () => Promise<Uint8Array>;
  getSignedPreKeyPair: () => Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }>;
  setUser: (user: User) => void;
};

const savedUser = localStorage.getItem("user");
// This cache now holds all three private keys once decrypted
let privateKeysCache: {
  encryption: Uint8Array,
  signing: Uint8Array,
  signedPreKey: Uint8Array,
  masterSeed?: Uint8Array,
} | null = null;

export const useAuthStore = createWithEqualityFn<State>((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  isBootstrapping: true,

  async bootstrap() {
    try {
      const me = await authFetch<User>("/api/users/me");
      set({ user: me });
      localStorage.setItem("user", JSON.stringify(me));
      connectSocket();
    } catch (error) {
      set({ user: null });
      localStorage.removeItem("user");
    } finally {
      set({ isBootstrapping: false });
    }
  },

  async login(emailOrUsername, password) {
    const res = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrUsername, password }),
    });
    set({ user: res.user });
    localStorage.setItem("user", JSON.stringify(res.user));
    
    if (localStorage.getItem('encryptedPrivateKeys')) {
      try {
        // This function now gets all keys internally
        await setupAndUploadPreKeyBundle();
      } catch (e) {
        toast.error("Could not prepare secure sessions.");
      }
    } else {
      toast("To enable secure messaging, please restore your account from your recovery phrase in Settings.", { duration: 7000 });
    }
    
    connectSocket();
  },

  async registerAndGeneratePhrase(data) {
    const sodium = await getSodium();
    
    const masterSeed = sodium.randombytes_buf(32);

    const encryptionSeed = sodium.crypto_generichash(32, masterSeed, new Uint8Array(new TextEncoder().encode("encryption")));
    const signingSeed = sodium.crypto_generichash(32, masterSeed, new Uint8Array(new TextEncoder().encode("signing")));
    const signedPreKeySeed = sodium.crypto_generichash(32, masterSeed, new Uint8Array(new TextEncoder().encode("signed-pre-key")));

    const encryptionKeyPair = sodium.crypto_box_seed_keypair(encryptionSeed);
    const signingKeyPair = sodium.crypto_sign_seed_keypair(signingSeed);
    const signedPreKeyPair = sodium.crypto_box_seed_keypair(signedPreKeySeed); // It's a box key for DH

    const encryptionPublicKeyB64 = await exportPublicKey(encryptionKeyPair.publicKey);
    const signingPublicKeyB64 = await exportPublicKey(signingKeyPair.publicKey);

    const encryptedPrivateKeys = await storePrivateKeys({ 
      encryption: encryptionKeyPair.privateKey, 
      signing: signingKeyPair.privateKey,
      signedPreKey: signedPreKeyPair.privateKey, // Store the third private key
      masterSeed: masterSeed
    }, data.password);

    localStorage.setItem('publicKey', encryptionPublicKeyB64);
    localStorage.setItem('signingPublicKey', signingPublicKeyB64);
    localStorage.setItem('encryptedPrivateKeys', encryptedPrivateKeys);

    const phrase = bip39.entropyToMnemonic(masterSeed);

    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ 
        ...data, 
        publicKey: encryptionPublicKeyB64, 
        signingKey: signingPublicKeyB64
      }),
    });
    
    return phrase;
  },

  async logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    eraseCookie("at");
    eraseCookie("rt");
    privateKeysCache = null;
    clearKeyCache();
    localStorage.clear();
    set({ user: null });
    disconnectSocket();
    useConversationStore.setState({ conversations: [] }, true);
    useMessageStore.setState({ messages: {} }, true);
  },

  async getSigningPrivateKey(): Promise<Uint8Array> {
    if (privateKeysCache?.signing) return privateKeysCache.signing;
    return new Promise((resolve, reject) => {
      useModalStore.getState().showPasswordPrompt(async (password) => {
        if (!password) return reject(new Error("Password not provided."));
        try {
          const encryptedKeys = localStorage.getItem('encryptedPrivateKeys');
          if (!encryptedKeys) throw new Error("Encrypted private keys not found.");
          const keys = await retrievePrivateKeys(encryptedKeys, password);
          if (!keys?.signing) throw new Error("Incorrect password or corrupted keys.");
          privateKeysCache = keys;
          resolve(keys.signing);
        } catch (e) {
          reject(e);
        }
      });
    });
  },

  async getEncryptionKeyPair(): Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }> {
    if (privateKeysCache?.encryption) {
      const sodium = await getSodium();
      const publicKey = sodium.crypto_scalarmult_base(privateKeysCache.encryption);
      return { publicKey, privateKey: privateKeysCache.encryption };
    }
    return new Promise((resolve, reject) => {
        useModalStore.getState().showPasswordPrompt(async (password) => {
            if (!password) return reject(new Error("Password not provided."));
            try {
                const encryptedKeys = localStorage.getItem('encryptedPrivateKeys');
                if (!encryptedKeys) throw new Error("Encrypted private keys not found.");
                const keys = await retrievePrivateKeys(encryptedKeys, password);
                if (!keys?.encryption) throw new Error("Incorrect password or corrupted keys.");
                privateKeysCache = keys;
                const sodium = await getSodium();
                const publicKey = sodium.crypto_scalarmult_base(keys.encryption);
                resolve({ publicKey, privateKey: keys.encryption });
            } catch (e) {
                reject(e);
            }
        });
    });
  },

  async getSignedPreKeyPair(): Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }> {
    if (privateKeysCache?.signedPreKey) {
      const sodium = await getSodium();
      const publicKey = sodium.crypto_scalarmult_base(privateKeysCache.signedPreKey);
      return { publicKey, privateKey: privateKeysCache.signedPreKey };
    }
    return new Promise((resolve, reject) => {
        useModalStore.getState().showPasswordPrompt(async (password) => {
            if (!password) return reject(new Error("Password not provided."));
            try {
                const encryptedKeys = localStorage.getItem('encryptedPrivateKeys');
                if (!encryptedKeys) throw new Error("Encrypted private keys not found.");
                const keys = await retrievePrivateKeys(encryptedKeys, password);
                if (!keys?.signedPreKey) throw new Error("Incorrect password or corrupted/legacy keys.");
                privateKeysCache = keys;
                const sodium = await getSodium();
                const publicKey = sodium.crypto_scalarmult_base(keys.signedPreKey);
                resolve({ publicKey, privateKey: keys.signedPreKey });
            } catch (e) {
                reject(e);
            }
        });
    });
  },

  setUser: (user: User) => {
    set({ user });
    localStorage.setItem("user", JSON.stringify(user));
  },
}));