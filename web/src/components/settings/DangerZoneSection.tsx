// Copyright (c) 2026 [han]. All rights reserved.
import { useState } from 'react';
import { useModalStore } from '@store/modal';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'react-hot-toast';
import { FiLogOut, FiAlertTriangle } from 'react-icons/fi';
import { deleteUserAccount } from '@services/settings.service';
import { useAuthStore } from '@store/auth';
import ModalBase from '../ui/ModalBase';

export default function DangerZoneSection() {
  const { user } = useAuthStore(useShallow(s => ({ user: s.user })));
  const { showConfirm } = useModalStore(useShallow(s => ({ showConfirm: s.showConfirm })));
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    showConfirm(
      'EMERGENCY EJECT',
      'This will instantly revoke your server sessions and obliterate all local cryptographic keys and data. Proceed?',
      async () => {
        const toastId = toast.loading('Revoking server sessions...');
        try {
          const { api } = await import('@lib/api');
          const { executeLocalWipe } = await import('@lib/nukeProtocol');

          try {
            await api('/api/sessions', { method: 'DELETE' });
          } catch {
            console.warn('Failed to clear secondary sessions, proceeding to current session logout.');
          }
          await api('/api/auth/logout', { method: 'POST' });

          toast.success('Sessions revoked. Initiating local wipe...', { id: toastId });
          await executeLocalWipe();
        } catch (error: unknown) {
          console.error('Emergency eject API failed:', error);
          toast.error('Failed to revoke remote sessions. Check your network connection.', { id: toastId });
        }
      }
    );
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword || !user) return;

    setIsDeleting(true);
    try {
      await deleteUserAccount(user.id, deletePassword);
    } catch {
      setIsDeleting(false);
      // Error already handled in service
    }
  };

  if (!user) return null;

  return (
    <>
      {/* EMERGENCY EJECT (Logout) */}
      <div className="col-span-1 md:col-span-12 mt-8 mb-10 space-y-4">
        <button
          onClick={handleLogout}
          className="
            group w-full relative overflow-hidden rounded-xl p-6
            bg-bg-main border-2 border-orange-500/20
            shadow-neu-flat-light dark:shadow-neu-flat-dark
            active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark active:scale-[0.99]
            transition-all duration-200
          "
        >
          {/* Warning Stripes Pattern */}
          <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(249,115,22,0.05)_10px,rgba(249,115,22,0.05)_20px)]"></div>

          <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-orange-500 group-hover:text-orange-600">
            <FiLogOut size={32} />
            <span className="text-xl font-black uppercase tracking-[0.2em]">Emergency Eject</span>
            <span className="text-xs font-mono opacity-70">Terminate All Sessions</span>
          </div>
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="
            group w-full relative overflow-hidden rounded-xl p-6
            bg-red-950/10 border-2 border-red-600/30
            hover:bg-red-950/20 hover:border-red-600/50
            active:scale-[0.99]
            transition-all duration-200
          "
        >
          <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-red-600">
            <div className="p-3 bg-red-600 text-white rounded-full mb-1">
              <FiAlertTriangle size={24} />
            </div>
            <span className="text-xl font-black uppercase tracking-[0.2em]">Delete Account</span>
            <span className="text-xs font-mono opacity-70 text-center max-w-md">
              PERMANENTLY erase all data from servers. This action is irreversible.
            </span>
          </div>
        </button>
      </div>

      {/* DELETE ACCOUNT MODAL */}
      <ModalBase isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} title="Confirm Deletion">
        <form onSubmit={handleDeleteAccount} className="space-y-6">
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
            <FiAlertTriangle className="text-red-500 shrink-0 mt-1" />
            <div className="space-y-2">
              <h4 className="text-red-500 font-bold text-sm">FINAL WARNING</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                You are about to execute a self-destruct sequence.
                All messages, keys, and profile data will be wiped from the server.
                Orphaned files may remain in encrypted storage but will be inaccessible forever.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary pl-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password..."
              className="
                w-full bg-bg-main text-text-primary p-4 rounded-xl outline-none
                border border-red-500/30 focus:border-red-500
                shadow-neu-pressed-light dark:shadow-neu-pressed-dark
              "
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-text-secondary hover:bg-bg-surface transition-colors"
            >
              Abort
            </button>
            <button
              type="submit"
              disabled={!deletePassword || isDeleting}
              className="
                flex-1 py-3 rounded-xl font-bold text-sm text-white
                bg-red-600 hover:bg-red-700
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-red-600/20
              "
            >
              {isDeleting ? 'Deleting...' : 'Execute Delete'}
            </button>
          </div>
        </form>
      </ModalBase>
    </>
  );
}
