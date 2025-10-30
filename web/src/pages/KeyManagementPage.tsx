import { Link } from 'react-router-dom';
import { FiKey, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { useState } from 'react';
import { useAuthStore } from '@store/auth';
import { retrievePrivateKey } from '@utils/keyManagement';
import toast from 'react-hot-toast';
import { Spinner } from '@components/Spinner';
import { shallow } from 'zustand/shallow';

export default function KeyManagementPage() {
  const { regenerateKeys, logout } = useAuthStore(state => ({
    regenerateKeys: state.regenerateKeys,
    logout: state.logout,
  }), shallow);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleBackup = async () => {
    const password = prompt("To back up your key, please enter your current password:");
    if (!password) return;

    setIsBackingUp(true);
    try {
      const encryptedKey = localStorage.getItem('encryptedPrivateKey');
      if (!encryptedKey) {
        throw new Error("No encrypted key found in storage.");
      }

      const privateKey = await retrievePrivateKey(encryptedKey, password);
      if (!privateKey) {
        throw new Error("Failed to decrypt key. The password may be incorrect.");
      }

      // Create a downloadable file
      const blob = new Blob([privateKey], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-lite-private-key.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Key backup downloaded successfully!', { duration: 5000 });
      toast('IMPORTANT: Store this file in a secure location. Do not share it with anyone.', { icon: '⚠️', duration: 8000 });

    } catch (error: any) {
      toast.error(error.message || "Backup failed.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleGenerateNew = async () => {
    const confirmed = window.confirm(
      "WARNING:\n\nGenerating a new key is a destructive action.\n\n- You will NOT be able to read your past encrypted messages.\n- You should back up your current key first if you want to preserve history.\n\nAre you absolutely sure you want to continue?"
    );
    if (!confirmed) return;

    const password = prompt("To generate a new key, please enter your current password:");
    if (!password) return;

    setIsGenerating(true);
    try {
      await regenerateKeys(password);
      toast.success('New keys generated successfully! Logging out for changes to take effect.', { duration: 6000 });
      // Logout to force a clean state
      setTimeout(() => {
        logout();
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate new keys.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-text-primary p-4">
      <div className="w-full max-w-2xl bg-surface rounded-lg shadow-lg p-8 border border-gray-800">
        <div className="flex items-center gap-4 mb-6">
          <FiKey className="text-accent text-3xl" />
          <h1 className="text-2xl font-bold text-white">Encryption Key Management</h1>
        </div>
        <p className="text-text-secondary mb-6">
          Your end-to-end encryption keys ensure that only you and the recipient can read your messages. 
          Back up your key to restore your chat history on a new device. Generating a new key is a security measure but will prevent you from reading old messages.
        </p>
        
        <div className="space-y-4">
          <button onClick={handleBackup} disabled={isBackingUp || isGenerating} className="w-full flex items-center justify-center gap-3 text-left p-4 rounded-lg bg-primary hover:bg-primary/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isBackingUp ? <Spinner size="sm" /> : <FiDownload />}
            <span>{isBackingUp ? 'Processing...' : 'Back Up My Encryption Key'}</span>
          </button>
          <button onClick={handleGenerateNew} disabled={isGenerating || isBackingUp} className="w-full flex items-center justify-center gap-3 text-left p-4 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isGenerating ? <Spinner size="sm" /> : <FiRefreshCw />}
            <span>{isGenerating ? 'Generating...' : 'Generate New Keys'}</span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link to="/settings" className="text-accent hover:underline">
            &larr; Back to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
