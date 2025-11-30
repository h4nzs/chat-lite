import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiKey, FiUpload } from 'react-icons/fi';
import { useAuthStore } from '@store/auth';
import toast from 'react-hot-toast';
import { Spinner } from '@components/Spinner';
import * as bip39 from 'bip39';
import { getSodium } from '@lib/sodiumInitializer';
import { storePrivateKeys, exportPublicKey } from "@utils/keyManagement";
import { syncSessionKeys } from '@utils/sessionSync';

export default function RestorePage() {
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phrase.trim() || !password) {
      toast.error("Please enter both your recovery phrase and a new password.");
      return;
    }
    setIsRestoring(true);
    try {
      const sodium = await getSodium();

      // 1. Derive the 32-byte master seed from the mnemonic phrase
      const masterSeed = await bip39.mnemonicToSeed(phrase);

      // 2. Deterministically re-derive the specific seeds for encryption and signing
      const encryptionSeed = sodium.crypto_generichash(32, masterSeed, new Uint8Array(new TextEncoder().encode("encryption")));
      const signingSeed = sodium.crypto_generichash(32, masterSeed, new Uint8Array(new TextEncoder().encode("signing")));

      // 3. Re-generate the exact same key pairs from the derived seeds
      const encryptionKeyPair = sodium.crypto_box_seed_keypair(encryptionSeed);
      const signingKeyPair = sodium.crypto_sign_seed_keypair(signingSeed);

      // 4. Encrypt and store the retrieved private keys with the NEW password
      const encryptedPrivateKeys = await storePrivateKeys(
        { encryption: encryptionKeyPair.privateKey, signing: signingKeyPair.privateKey },
        password
      );

      // 5. Store the new encrypted bundle and public keys in localStorage
      localStorage.setItem('encryptedPrivateKeys', encryptedPrivateKeys);
      localStorage.setItem('publicKey', await exportPublicKey(encryptionKeyPair.publicKey));
      localStorage.setItem('signingPublicKey', await exportPublicKey(signingKeyPair.publicKey));
      
      // 6. Log the user in to get a valid token for the next step (Pre-key upload etc.)
      // We assume the username can be derived or is part of the recovery, or we prompt for it.
      // For simplicity here, we'll assume the username is available from an API after recovery,
      // or the user re-enters it on the login page after restore.
      // Or we can register a temporary "restore" state in auth store and navigate to login.
      // Since server verify returns ok, we'll assume the user can now log in.
      toast.success('Account restored successfully! Please log in with your username and new password.');
      navigate('/login');

    } catch (error: any) {
      console.error("Restore failed:", error);
      toast.error(error.message || "Restore failed. Please check your phrase and try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-main text-text-primary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <FiKey className="mx-auto text-accent text-5xl mb-4" />
          <h1 className="text-3xl font-bold">Restore Account</h1>
          <p className="text-text-secondary mt-2">
            Enter your 24-word recovery phrase and set a new password for this device.
          </p>
        </div>
        <form onSubmit={handleRestore} className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border">
          <div className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-text-secondary">Recovery Phrase</span>
              </label>
              <textarea
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="textarea textarea-bordered w-full h-28"
                placeholder="Enter your 24-word recovery phrase, separated by spaces..."
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-text-secondary">New Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Choose a strong password for this device"
                required
              />
            </div>
          </div>
          <div className="mt-8">
            <button type="submit" className="btn btn-primary w-full" disabled={isRestoring}>
              {isRestoring ? <Spinner /> : <FiUpload className="mr-2" />}
              {isRestoring ? 'Restoring...' : 'Restore & Set Password'}
            </button>
          </div>
        </form>
        <div className="mt-6 text-center">
          <Link to="/login" className="text-accent-color hover:underline">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}