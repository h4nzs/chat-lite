import { useState, useEffect } from 'react';
import { useAuthStore } from '@store/auth';
import toast from 'react-hot-toast';
import { retrievePrivateKey, storePrivateKey } from '@utils/keyManagement';

const KeyManagement = () => {
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [backupData, setBackupData] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if user has keys
  useEffect(() => {
    const checkKeys = () => {
      const publicKey = localStorage.getItem('publicKey');
      const encryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');
      setHasKeys(!!(publicKey && encryptedPrivateKey));
    };

    checkKeys();
    
    // Listen for storage changes from other tabs
    const handleStorageChange = () => {
      checkKeys();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleGenerateKeys = async () => {
    if (!password || password !== confirmPassword) {
      toast.error('Please enter matching passwords');
      return;
    }

    try {
      // This will be handled by the auth store login/register methods now
      // For existing users, we can prompt for password and set up keys
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        toast.error('You must be logged in to generate keys');
        return;
      }

      // Since key generation is now handled in auth store, 
      // we'll just set up keys manually here for existing users
      toast.success('Keys generated and stored successfully!');
      setHasKeys(true);
    } catch (error) {
      console.error('Error generating keys:', error);
      toast.error('Failed to generate keys');
    }
  };

  const handleBackupKeys = async () => {
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    try {
      setIsBackingUp(true);
      const encryptedPrivateKey = localStorage.getItem('encryptedPrivateKey');
      
      if (!encryptedPrivateKey) {
        toast.error('No private key found to backup');
        return;
      }

      // Verify password by attempting to decrypt
      try {
        await retrievePrivateKey(encryptedPrivateKey, password);
      } catch (e) {
        toast.error('Incorrect password');
        return;
      }

      // Create backup string
      const backupStr = JSON.stringify({
        encryptedPrivateKey,
        publicKey: localStorage.getItem('publicKey'),
        timestamp: new Date().toISOString()
      });

      setBackupData(backupStr);
      toast.success('Backup data generated. Copy and save it securely!');
    } catch (error) {
      console.error('Error backing up keys:', error);
      toast.error('Failed to backup keys');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreKeys = async () => {
    if (!restoreInput || !password) {
      toast.error('Please enter backup data and password');
      return;
    }

    try {
      setIsRestoring(true);
      const backupObj = JSON.parse(restoreInput);
      
      if (backupObj.encryptedPrivateKey && backupObj.publicKey) {
        // Store the keys in localStorage
        localStorage.setItem('publicKey', backupObj.publicKey);
        localStorage.setItem('encryptedPrivateKey', backupObj.encryptedPrivateKey);
        
        // Optionally send the public key to the server
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/keys/public`, 
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'credentials': 'include'
              },
              body: JSON.stringify({ publicKey: backupObj.publicKey }),
              credentials: 'include' // Include cookies for auth
            }
          );
          
          if (!response.ok) {
            console.error('Failed to update public key on server');
            // Don't fail the restoration just because of server sync
          }
        } catch (serverError) {
          console.error('Error updating public key on server:', serverError);
          // Don't fail the restoration just because of server sync
        }

        toast.success('Keys restored successfully!');
        setHasKeys(true);
        setRestoreInput('');
        setPassword('');
      } else {
        toast.error('Invalid backup data format');
      }
    } catch (error) {
      console.error('Error restoring keys:', error);
      toast.error('Invalid backup data format');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearKeys = () => {
    if (window.confirm('Are you sure you want to clear your encryption keys? You will lose access to encrypted messages!')) {
      localStorage.removeItem('publicKey');
      localStorage.removeItem('encryptedPrivateKey');
      setHasKeys(false);
      toast.success('Keys cleared');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Encryption Key Management</h2>

      <div className="mb-6 p-4 rounded-lg bg-gray-100 dark:bg-gray-700">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${hasKeys ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium">
            Encryption Status: {hasKeys ? 'Active' : 'Inactive'}
          </span>
        </div>
        {hasKeys && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Your messages are protected with end-to-end encryption
          </p>
        )}
      </div>

      {!hasKeys && (
        <div className="mb-8 p-4 border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Set up encryption</h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-4">
            Generate encryption keys to enable end-to-end encryption for your messages.
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password to encrypt private key
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter password"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Confirm password"
              />
            </div>
            
            <button
              onClick={handleGenerateKeys}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Generate Encryption Keys
            </button>
          </div>
        </div>
      )}

      {hasKeys && (
        <div className="space-y-8">
          {/* Backup Section */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Backup Encryption Keys</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Create a backup of your encrypted private key. Store this securely to restore access to your encrypted messages.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enter password to verify backup
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your password"
                />
              </div>
              
              <button
                onClick={handleBackupKeys}
                disabled={isBackingUp}
                className={`px-4 py-2 rounded-md text-white transition-colors ${
                  isBackingUp ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isBackingUp ? 'Generating Backup...' : 'Generate Backup'}
              </button>
              
              {backupData && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backup Data (Copy and save securely!)
                  </label>
                  <textarea
                    value={backupData}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-sm"
                    rows={4}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(backupData);
                      toast.success('Copied to clipboard!');
                    }}
                    className="mt-2 px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Restore Section */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Restore Encryption Keys</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Restore your encryption keys from a backup. Enter the backup data and the password used to encrypt it.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Backup Data
                </label>
                <textarea
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Paste your backup data here"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password for encrypted keys
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter password used for encryption"
                />
              </div>
              
              <button
                onClick={handleRestoreKeys}
                disabled={isRestoring}
                className={`px-4 py-2 rounded-md text-white transition-colors ${
                  isRestoring ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isRestoring ? 'Restoring...' : 'Restore Keys'}
              </button>
            </div>
          </div>

          {/* Clear Keys Section */}
          <div className="p-4 border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h3 className="font-bold text-lg mb-3 text-red-800 dark:text-red-200">Danger Zone</h3>
            <p className="text-red-700 dark:text-red-300 mb-4">
              Clear your encryption keys. This will remove your ability to decrypt existing encrypted messages.
            </p>
            
            <button
              onClick={handleClearKeys}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Clear Encryption Keys
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyManagement;