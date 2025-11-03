import { Link } from 'react-router-dom';
import { FiKey, FiShield, FiRefreshCw } from 'react-icons/fi';
import { useState } from 'react';
import { useAuthStore } from '@store/auth';
import { retrievePrivateKey } from '@utils/keyManagement';
import toast from 'react-hot-toast';
import { Spinner } from '@components/Spinner';
import { useModalStore } from '@store/modal';
import * as bip39 from 'bip39';
import RecoveryPhraseModal from '@components/RecoveryPhraseModal';

export default function KeyManagementPage() {
  const { regenerateKeys, logout } = useAuthStore(state => ({ 
    regenerateKeys: state.regenerateKeys,
    logout: state.logout,
  }));
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const { showConfirm, showPasswordPrompt } = useModalStore();

  const handleShowRecovery = () => {
    showPasswordPrompt(async (password) => {
      if (!password) return;

      setIsProcessing(true);
      try {
        const encryptedKey = localStorage.getItem('encryptedPrivateKey');
        if (!encryptedKey) {
          throw new Error("No encrypted key found in storage.");
        }

        const privateKey = await retrievePrivateKey(encryptedKey, password);
        if (!privateKey) {
          throw new Error("Failed to decrypt key. The password may be incorrect.");
        }

        // Convert the full 32-byte private key to a 24-word mnemonic
        const mnemonic = bip39.entropyToMnemonic(privateKey);
        setRecoveryPhrase(mnemonic);
        setShowRecoveryModal(true);

      } catch (error: any) {
        toast.error(error.message || "Failed to generate recovery phrase.");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleGenerateNew = () => {
    showConfirm(
      "Generate New Keys",
      "WARNING:\n\nGenerating a new key is a destructive action.\n\n- You will NOT be able to read your past encrypted messages.\n- You should back up your current key first if you want to preserve history.\n\nAre you absolutely sure you want to continue?",
      () => {
        const { showPasswordPrompt } = useModalStore.getState();
        showPasswordPrompt(async (password) => {
          if (!password) return;

          setIsGenerating(true);
          try {
            await regenerateKeys(password);
            toast.success('New keys generated successfully! Logging out for changes to take effect.', { duration: 6000 });
            setTimeout(() => {
              logout();
            }, 3000);
          } catch (error: any) {
            toast.error(error.message || "Failed to generate new keys.");
            setIsGenerating(false);
          }
        });
      }
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-main text-text-primary p-4">
      <div className="w-full max-w-2xl bg-bg-surface rounded-lg shadow-lg p-8 border border-border">
        <div className="flex items-center gap-4 mb-6">
          <FiKey className="text-accent-color text-3xl" />
          <h1 className="text-2xl font-bold text-text-primary">Encryption Key Management</h1>
        </div>
        <p className="text-text-secondary mb-6">
          Your end-to-end encryption keys ensure that only you and the recipient can read your messages. 
          Back up your key to restore your chat history on a new device. Generating a new key is a security measure but will prevent you from reading old messages.
        </p>
        
        <div className="space-y-4">
          <button onClick={handleShowRecovery} disabled={isProcessing} className="w-full flex items-center justify-center gap-3 text-left p-4 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isProcessing ? <Spinner size="sm" /> : <FiShield />}
            <span>{isProcessing ? 'Processing...' : 'Show Recovery Phrase'}</span>
          </button>
          <button onClick={handleGenerateNew} disabled={isProcessing} className="w-full flex items-center justify-center gap-3 text-left p-4 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isProcessing ? <Spinner size="sm" /> : <FiRefreshCw />}
            <span>{isProcessing ? 'Generating...' : 'Generate New Keys'}</span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link to="/settings" className="text-accent-color hover:underline">
            &larr; Back to Settings
          </Link>
        </div>
      </div>
      {showRecoveryModal && <RecoveryPhraseModal phrase={recoveryPhrase} onClose={() => setShowRecoveryModal(false)} />}
    </div>
  );
}
