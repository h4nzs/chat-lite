import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from './auth';
import { api } from '@lib/api';
import * as keyManagement from '@utils/keyManagement';
import * as sodium from 'libsodium-wrappers';
import * as bip39 from 'bip39';

// --- Mocks ---
vi.mock('@lib/api', () => ({
  api: vi.fn(),
  authFetch: vi.fn(),
}));

vi.mock('@lib/sodiumInitializer', () => ({
  getSodium: vi.fn(),
}));

vi.mock('@utils/keyManagement', () => ({
  generateKeyPair: vi.fn(),
  exportPublicKey: vi.fn(),
  storePrivateKey: vi.fn(),
  retrievePrivateKey: vi.fn(),
}));

vi.mock('bip39', () => ({
  generateMnemonic: vi.fn(),
  mnemonicToEntropy: vi.fn(),
}));

const mockUser = { id: 'user-1', name: 'Test User', email: 'test@test.com', username: 'testuser' };
const initialState = useAuthStore.getState();

describe('useAuthStore', () => {

  beforeEach(() => {
    // Reset the store to its initial state before each test
    useAuthStore.setState(initialState, true);
    // Clear all mocks
    vi.clearAllMocks();
    localStorage.clear();
    
    // Provide default mock implementations
    vi.mocked(api).mockResolvedValue({ user: mockUser });
    vi.mocked(authFetch).mockResolvedValue(mockUser);
  });

  describe('login', () => {
    it('should set user on successful login and update localStorage', async () => {
      expect(useAuthStore.getState().user).toBeNull();

      await useAuthStore.getState().login('test@test.com', 'password');

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(localStorage.getItem('user')).toEqual(JSON.stringify(mockUser));
      expect(api).toHaveBeenCalledWith('/api/auth/login', expect.any(Object));
    });

    it('should not setup keys if they already exist in localStorage', async () => {
      localStorage.setItem('publicKey', 'existing-pk');
      localStorage.setItem('encryptedPrivateKey', 'existing-epk');

      await useAuthStore.getState().login('test@test.com', 'password');

      expect(keyManagement.generateKeyPair).not.toHaveBeenCalled();
    });
  });

  describe('registerAndGeneratePhrase', () => {
    it('should generate keys, call register API, and set user state', async () => {
      // Mock dependencies
      const mockSodium = {
        from_hex: vi.fn().mockReturnValue(new Uint8Array(32)),
        crypto_scalarmult_base: vi.fn().mockReturnValue(new Uint8Array(32)),
        to_base64: vi.fn().mockReturnValue('base64-public-key'),
      };
      vi.mocked(require('@lib/sodiumInitializer').getSodium).mockResolvedValue(mockSodium);
      vi.mocked(bip39.generateMnemonic).mockReturnValue('mock phrase');
      vi.mocked(bip39.mnemonicToEntropy).mockReturnValue('mock-entropy-hex');
      vi.mocked(keyManagement.storePrivateKey).mockResolvedValue('encrypted-private-key');
      
      const registerData = { email: 'new@test.com', password: 'password', username: 'newuser', name: 'New User' };

      const phrase = await useAuthStore.getState().registerAndGeneratePhrase(registerData);

      expect(phrase).toBe('mock phrase');
      expect(keyManagement.storePrivateKey).toHaveBeenCalledWith(expect.any(Uint8Array), 'password');
      expect(localStorage.getItem('publicKey')).toBe('base64-public-key');
      expect(localStorage.getItem('encryptedPrivateKey')).toBe('encrypted-private-key');
      expect(api).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
        body: JSON.stringify({
          ...registerData,
          publicKey: 'base64-public-key',
          recoveryPhrase: 'mock phrase',
        })
      }));
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });
  
  describe('logout', () => {
    it('should clear user, localStorage (except keys), and caches', async () => {
      // Setup initial logged-in state
      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('publicKey', 'pk');
      localStorage.setItem('encryptedPrivateKey', 'epk');
      useAuthStore.setState({ user: mockUser });

      expect(useAuthStore.getState().user).not.toBeNull();
      
      await useAuthStore.getState().logout();
      
      expect(useAuthStore.getState().user).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      // Important: Keys should NOT be cleared on logout for session persistence
      expect(localStorage.getItem('publicKey')).toBe('pk');
      expect(localStorage.getItem('encryptedPrivateKey')).toBe('epk');
      expect(api).toHaveBeenCalledWith('/api/auth/logout', expect.any(Object));
    });
  });

  describe('bootstrap', () => {
    it('should set isBootstrapping to false on success', async () => {
      useAuthStore.setState({ isBootstrapping: true });
      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().isBootstrapping).toBe(false);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('should set isBootstrapping to false and user to null on failure', async () => {
      useAuthStore.setState({ isBootstrapping: true });
      vi.mocked(authFetch).mockRejectedValue(new Error('Auth failed'));
      
      await useAuthStore.getState().bootstrap();
      
      expect(useAuthStore.getState().isBootstrapping).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});