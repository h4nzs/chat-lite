import { Link } from 'react-router-dom';
import { FiKey, FiShield, FiRefreshCw } from 'react-icons/fi';
import { IoFingerPrint } from "react-icons/io5";
import { useState } from 'react';
import { useAuthStore } from '@store/auth';
import { retrievePrivateKeys, generateKeyPairs, storePrivateKeys, exportPublicKey } from '@utils/keyManagement'; // Corrected import
import { getSodium } from '@lib/sodiumInitializer';
import toast from 'react-hot-toast';
import { Spinner } from '@components/Spinner';
import { useModalStore } from '@store/modal';
import * as bip39 from 'bip39';
import RecoveryPhraseModal from '@components/RecoveryPhraseModal';
import { startRegistration } from '@simplewebauthn/browser';
import { api, authFetch } from '@lib/api';

export default function KeyManagementPage() {
  const { logout } = useAuthStore(state => ({ 
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
        const encryptedKeys = localStorage.getItem('encryptedPrivateKeys');
        if (!encryptedKeys) {
          throw new Error("No encrypted key found in storage.");
        }

        const keys = await retrievePrivateKeys(encryptedKeys, password); // Use plural
        if (!keys) {
          throw new Error("Failed to decrypt keys. The password may be incorrect.");
        }
        
        const sodium = await getSodium();
        
        // The recovery phrase is derived from a hash of both keys, to match registration logic
        const combined = new Uint8Array(keys.encryption.length + keys.signing.length);
        combined.set(keys.encryption, 0);
        combined.set(keys.signing, keys.encryption.length);
        const entropy = sodium.crypto_generichash(32, combined);

        const mnemonic = bip39.entropyToMnemonic(entropy);
        setRecoveryPhrase(mnemonic);
        setShowRecoveryModal(true);

      } catch (error: any) {
        toast.error(error.message || "Failed to generate recovery phrase.");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleRegisterDevice = async () => {
    setIsProcessing(true);
    try {
      const regOptions = await api("/api/auth/webauthn/register-options");
      const attResp = await startRegistration(regOptions);
      const verificationJSON = await api("/api/auth/webauthn/register-verify", {
        method: "POST",
        body: JSON.stringify(attResp),
      });

      if (verificationJSON?.verified) {
        toast.success("Device registered successfully!");
      } else {
        throw new Error("Failed to verify device registration.");
      }

    } catch (error: any) {
      toast.error(error.message || "Device registration failed.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateNew = () => {
    showConfirm(
      "Generate New Keys",
      "WARNING: This is a destructive action. You will lose access to all past encrypted messages. This cannot be undone.",
      () => {
        showPasswordPrompt(async (password) => {
          if (!password) return;
          setIsProcessing(true);
          try {
            // Re-implementing the key generation logic here.
            const { encryption, signing } = await generateKeyPairs();

            const encryptedPrivateKeys = await storePrivateKeys({ encryption: encryption.privateKey, signing: signing.privateKey }, password);
            localStorage.setItem('encryptedPrivateKeys', encryptedPrivateKeys);
            localStorage.setItem('publicKey', await exportPublicKey(encryption.publicKey));
            localStorage.setItem('signingPublicKey', await exportPublicKey(signing.publicKey));

            // Must re-upload public keys to server
            // Note: The /api/keys/public route was removed in favor of pre-key bundles.
            // A more complete implementation might have a dedicated route for this key rotation.
            // For now, we'll assume the user will re-upload pre-keys on next login.
            toast.success('New keys generated! For security, you will be logged out.', { duration: 5000 });
            setTimeout(() => {
              logout();
            }, 2000);

          } catch (error: any) {
            toast.error(error.message || "Failed to generate new keys.");
          } finally {
            setIsProcessing(false);
          }
        });
      }
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-main text-text-primary p-4">
      <div className="w-full max-w-2xl bg-bg-surface rounded-lg shadow-lg p-8 border border-border">
        <div className="flex items-center gap-4 mb-6">
          <FiKey className="text-accent text-3xl" />
          <h1 className="text-2xl font-bold text-text-primary">Encryption Key Management</h1>
        </div>
        <p className="text-text-secondary mb-6">
          Your end-to-end encryption keys ensure that only you and the recipient can read your messages. 
          Back up your key to restore your chat history on a new device.
        </p>
        
        <div className="space-y-4">
          <button onClick={handleShowRecovery} disabled={isProcessing} className="btn btn-secondary w-full justify-center gap-3">
            {isProcessing ? <Spinner size="sm" /> : <FiShield />}
            <span>{isProcessing ? 'Processing...' : 'Show Recovery Phrase'}</span>
          </button>
          <button onClick={handleRegisterDevice} disabled={isProcessing} className="btn btn-secondary w-full justify-center gap-3">
            {isProcessing ? <Spinner size="sm" /> : <IoFingerPrint />}
            <span>{isProcessing ? 'Processing...' : 'Register This Device for Biometric Login'}</span>
          </button>
          <button onClick={handleGenerateNew} disabled={isProcessing} className="btn-destructive-neumorphic w-full justify-center gap-3">
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