// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { useState, useEffect } from 'react';
import { useAuthStore } from '@store/auth';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'react-hot-toast';
import { FiShield, FiLock, FiAlertTriangle, FiZap, FiCpu } from 'react-icons/fi';
import { IoFingerPrint } from 'react-icons/io5';
import { ControlModule, RockerSwitch } from './SettingsUI';
import { setupBiometricAuth, executePoWMining } from '@services/settings.service';
import { useModalStore } from '@store/modal';
import { Spinner } from '../Spinner';
import { api } from '@lib/api';
import { getDeviceAutoUnlockKey, getEncryptedKeys } from '@lib/keyStorage';
import { getRecoveryPhrase } from '@lib/crypto-worker-proxy';
import ModalBase from '../ui/ModalBase';

export default function SecuritySection() {
  const { user, setUser } = useAuthStore(useShallow(s => ({
    user: s.user,
    setUser: s.setUser
  })));

  const { showConfirm, showPasswordPrompt } = useModalStore(useShallow(s => ({
    showConfirm: s.showConfirm,
    showPasswordPrompt: s.showPasswordPrompt
  })));

  const [hasBioVault, setHasBioVault] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [miningStatus, setMiningStatus] = useState<'idle' | 'mining' | 'verifying'>('idle');
  const [panicPass, setPanicPass] = useState('');
  const [autoDestructDays, setAutoDestructDays] = useState<number | null>(user?.autoDestructDays || null);

  useEffect(() => {
    const checkBioVault = () => {
      const vault = localStorage.getItem('nyx_bio_vault');
      setHasBioVault(!!vault);
    };
    checkBioVault();
    window.addEventListener('storage', checkBioVault);
    return () => window.removeEventListener('storage', checkBioVault);
  }, []);

  const handleRegisterPasskey = async () => {
    try {
      let phraseToLock = '';

      const autoUnlockKey = await getDeviceAutoUnlockKey();
      const encryptedKeysStr = await getEncryptedKeys();

      if (autoUnlockKey && encryptedKeysStr) {
        try {
          phraseToLock = await getRecoveryPhrase(encryptedKeysStr, autoUnlockKey);
        } catch {
          // Ignore, will prompt for password
        }
      }

      if (!phraseToLock) {
        await new Promise<void>((resolve, reject) => {
          showPasswordPrompt(async (password) => {
            if (!password) {
              reject(new Error('Password required to enable biometric unlock.'));
              return;
            }
            try {
              const encKeys = await getEncryptedKeys();
              if (!encKeys) throw new Error('No keys found.');
              phraseToLock = await getRecoveryPhrase(encKeys, password);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
      }

      toast.loading('Initializing biometric scanner...', { id: 'passkey' });
      const options = await api<Record<string, unknown>>('/api/auth/webauthn/register/options?force=true');

      toast.loading('Scan fingerprint now to LOCK your vault...', { id: 'passkey' });

      // 2. Setup Biometric with PRF
      if (user) {
        await setupBiometricAuth(user.id, (updatedUser) => {
          setUser({ ...user, ...updatedUser });
        });
      }
    } catch (error: unknown) {
      if ((error as Error).name === 'NotAllowedError') {
        toast.error('Scan cancelled.', { id: 'passkey' });
      } else {
        toast.error(`Error: ${(error as Error).message}`, { id: 'passkey' });
      }
    }
  };

  const handleProofOfWork = async () => {
    setMiningStatus('mining');
    try {
      await executePoWMining();
      setShowUpgradeModal(false);
      if (user) setUser({ ...user, isVerified: true });
    } catch {
      // Error already handled in service
    } finally {
      setMiningStatus('idle');
    }
  };

  const handleSetPanicPassword = async () => {
    const { setPanicPassword } = await import('@services/settings.service');
    await setPanicPassword(panicPass);
    toast.success('Panic Password updated.');
    setPanicPass('');
  };

  const handleAutoDestructChange = async (days: number | null) => {
    try {
      await api('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ autoDestructDays: days })
      });
      setAutoDestructDays(days);
      useAuthStore.getState().bootstrap(true);
      toast.success(days ? `Auto-destruct set to ${days} days` : 'Auto-destruct disabled');
    } catch {
      toast.error('Failed to update setting');
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="col-span-1 md:col-span-6 lg:col-span-4">
        <ControlModule title="Privacy Shield" icon={FiShield}>
          <div className="space-y-4">
            <button
              onClick={handleRegisterPasskey}
              className={`
                mt-4 w-full p-4 rounded-xl flex items-center justify-between
                bg-bg-main text-text-primary
                shadow-neu-flat-light dark:shadow-neu-flat-dark
                active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark
                hover:text-accent transition-colors
              `}
            >
              <div className="flex items-center gap-3">
                <IoFingerPrint size={20} />
                <div className="text-left">
                  <div className="font-bold text-sm">
                    {hasBioVault ? 'Vault Active (VIP)' : (user.isVerified ? 'Setup Vault Unlock' : 'Enable Biometrics')}
                  </div>
                  <div className="text-[10px] text-text-secondary">Unlock Vault & Verify VIP</div>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full shadow-[0_0_5px] ${hasBioVault ? 'bg-green-500 shadow-green-500' : 'bg-gray-500 shadow-transparent'}`}></div>
            </button>

            {/* PANIC PASSWORD */}
            <div className="pt-4 border-t border-white/5 space-y-3 mt-4">
              <div>
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <FiShield className="text-red-500" /> Panic Password
                </h4>
                <p className="text-xs text-text-secondary mt-1">
                  If forced to unlock your device, entering this password on the login screen will silently obliterate all local data.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={panicPass}
                  onChange={e => setPanicPass(e.target.value)}
                  placeholder="Enter Panic Password"
                  className="bg-bg-main border border-white/10 rounded-lg px-4 py-2 text-sm text-text-primary focus:ring-red-500/50 flex-1 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSetPanicPassword}
                  className="px-4 py-2 bg-red-500/20 text-red-500 rounded-lg text-sm font-bold hover:bg-red-500 hover:text-white transition-colors"
                >
                  Set
                </button>
              </div>
            </div>

            {/* DEAD MAN'S SWITCH */}
            <div className="pt-4 border-t border-white/5 space-y-3 mt-4">
              <div>
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="text-red-500"><FiAlertTriangle size={18} /></span> Dead Man&apos;s Switch
                </h4>
                <p className="text-xs text-text-secondary mt-1">
                  Automatically destroy your account and all associated messages if you do not open the app for a set period.
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={autoDestructDays || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const days = val === '' ? null : parseInt(val, 10);
                    handleAutoDestructChange(days);
                  }}
                  className="bg-bg-main border border-white/10 rounded-lg px-4 py-2 text-sm text-text-primary focus:ring-accent flex-1 outline-none"
                >
                  <option value="">Disabled</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>
            </div>
          </div>
        </ControlModule>
      </div>

      {/* UPGRADE MODAL */}
      <ModalBase isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Upgrade to VIP">
        <div className="space-y-6">
          <p className="text-sm text-text-secondary text-center">
            You are currently in <span className="text-yellow-500 font-bold">Sandbox Mode</span>.
            Upgrade to remove messaging limits and unlock group creation.
          </p>

          <div className="grid grid-cols-1 gap-4">
            {/* Option 1: Biometric */}
            <button
              onClick={handleRegisterPasskey}
              className="p-4 bg-bg-surface rounded-xl border border-white/5 shadow-neu-flat hover:border-accent/50 transition-all text-left flex items-start gap-4 group"
            >
              <div className="p-3 bg-accent/10 text-accent rounded-full group-hover:bg-accent group-hover:text-white transition-colors">
                <FiZap size={24} />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Instant Biometric</h3>
                <p className="text-xs text-text-secondary mt-1">Use Fingerprint or FaceID. Takes 1 second.</p>
              </div>
            </button>

            {/* Option 2: Proof of Work */}
            <button
              onClick={handleProofOfWork}
              disabled={miningStatus !== 'idle'}
              className="p-4 bg-bg-surface rounded-xl border border-white/5 shadow-neu-flat hover:border-accent/50 transition-all text-left flex items-start gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors">
                {miningStatus === 'idle' ? <FiCpu size={24} /> : <Spinner size="sm" />}
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Proof of Work Mining</h3>
                <p className="text-xs text-text-secondary mt-1">
                  {miningStatus === 'idle' ? "Solve a cryptographic puzzle with your CPU. Takes 5-10 seconds." :
                   miningStatus === 'mining' ? "Mining hash collision... CPU at 100%" : "Verifying proof..."}
                </p>
              </div>
            </button>
          </div>
        </div>
      </ModalBase>
    </>
  );
}
