import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './auth';
import { api } from '@lib/api';
import * as keyManagement from '@utils/keyManagement';

// Mock the api module
vi.mock('@lib/api', () => ({
  api: vi.fn(),
}));

// Mock the key management module
vi.mock('@utils/keyManagement', () => ({
  setupUserEncryptionKeys: vi.fn(),
  storePrivateKey: vi.fn(),
  exportPublicKey: vi.fn(),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset the store and mocks before each test
    useAuthStore.setState({ user: null });
    localStorage.clear();
    vi.mocked(api).mockClear();
    vi.mocked(keyManagement.setupUserEncryptionKeys).mockClear();
  });

  it('should set user on successful login', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', username: 'testuser' };
    vi.mocked(api).mockResolvedValue({ user: mockUser });

    // Check initial state
    expect(useAuthStore.getState().user).toBeNull();

    // Perform login
    await useAuthStore.getState().login('test@test.com', 'password');

    // Check final state
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(localStorage.getItem('user')).toEqual(JSON.stringify(mockUser));
  });

  it('should set user to null on logout', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', username: 'testuser' };
    useAuthStore.setState({ user: mockUser });

    // Check initial state
    expect(useAuthStore.getState().user).not.toBeNull();

    // Perform logout
    await useAuthStore.getState().logout();

    // Check final state
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
