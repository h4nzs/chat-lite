import { useEffect, useState } from 'react';

export const useEncryptionStatus = () => {
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkEncryptionStatus = () => {
      try {
        const publicKey = localStorage.getItem('publicKey');
        const encryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');
        setEncryptionAvailable(!!(publicKey && encryptedPrivateKey));
      } catch (error) {
        console.error('Error checking encryption status:', error);
        setEncryptionAvailable(false);
      } finally {
        setLoading(false);
      }
    };

    // Check immediately
    checkEncryptionStatus();

    // Check again when storage changes (in case keys are set in another tab/process)
    const handleStorageChange = () => {
      checkEncryptionStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { encryptionAvailable, loading };
};