import { useState } from 'react';
import KeyManagement from '@components/KeyManagement';
import { useAuthStore } from '@store/auth';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('encryption');
  const { logout } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Settings</h1>
      
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'encryption'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('encryption')}
        >
          Encryption
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'account'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('account')}
        >
          Account
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'encryption' && <KeyManagement />}
        
        {activeTab === 'account' && (
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Account Settings</h2>
            <div className="space-y-4">
              <div>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;