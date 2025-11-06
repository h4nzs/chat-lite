import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toAbsoluteUrl } from '@utils/url';
import { authFetch, handleApiError } from '@lib/api';
import type { User } from '@store/auth';
import { Spinner } from './Spinner';
import { generateSafetyNumber, importPublicKey } from '@utils/keyManagement';
import SafetyNumberModal from './SafetyNumberModal';
import { useConversationStore } from '@store/conversation';
import { useVerificationStore } from '@store/verification';

// The user type for the profile panel can have an optional email and public key
type ProfileUser = User & { email?: string; publicKey?: string };

export default function UserInfoPanel({ userId }: { userId: string }) {
  const { activeId } = useConversationStore(); // Get active conversation ID
  const { verifiedStatus, setVerified } = useVerificationStore();
  const navigate = useNavigate();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyNumber, setSafetyNumber] = useState('');

  const isAlreadyVerified = activeId ? verifiedStatus[activeId] : false;

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      setUser(null);
      try {
        const userData = await authFetch<ProfileUser>(`/api/users/${userId}`);
        setUser(userData);
      } catch (e) {
        setError(handleApiError(e));
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleViewProfile = () => {
    if (!user) return;
    navigate(`/profile/${user.id}`);
  };

  const handleVerifySecurity = async () => {
    if (!user?.publicKey) {
      setError("This user has not set up their encryption keys yet.");
      return;
    }

    try {
      const myPublicKeyB64 = localStorage.getItem('publicKey');
      if (!myPublicKeyB64) {
        throw new Error("Your public key is not found. Please set up your keys first.");
      }

      const myPublicKey = await importPublicKey(myPublicKeyB64);
      const theirPublicKey = await importPublicKey(user.publicKey);

      const sn = await generateSafetyNumber(myPublicKey, theirPublicKey);
      setSafetyNumber(sn);
      setShowSafetyModal(true);

    } catch (e: any) {
      setError(e.message || "Failed to generate safety number.");
    }
  };

  const renderContent = () => {
    if (loading) return <div className="flex justify-center items-center min-h-[200px]"><Spinner /></div>;
    if (error) return <p className="text-center text-destructive">{error}</p>;
    if (user) {
      return (
        <div className="flex flex-col items-center text-center p-6">
          <img 
            src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
            alt={user.name}
            className="w-24 h-24 rounded-full bg-secondary object-cover mb-4"
          />
          <h3 className="text-xl font-bold text-text-primary">{user.name}</h3>
          <p className="text-sm text-text-secondary">@{user.username}</p>
          {user.email && (
            <p className="text-sm text-accent mt-1">{user.email}</p>
          )}
          <p className="text-text-secondary mt-2 text-sm">
            {user.description || 'This user prefers to keep an air of mystery.'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border text-center">
            <h2 className="text-lg font-semibold">About {user?.name || 'User'}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
            {renderContent()}
        </div>
        {user && (
            <div className="p-4 border-t border-border space-y-2">
                <button
                onClick={handleViewProfile}
                className="w-full btn btn-primary"
                >
                View Full Profile
                </button>
                <button
                onClick={handleVerifySecurity}
                className="w-full btn btn-secondary"
                >
                Verify Security
                </button>
            </div>
        )}
      </div>
      
      {showSafetyModal && user && (
        <SafetyNumberModal 
          safetyNumber={safetyNumber} 
          userName={user.name} 
          onClose={() => setShowSafetyModal(false)} 
          onVerify={() => {
            if (activeId && user.publicKey) {
              setVerified(activeId, user.publicKey);
            }
            setShowSafetyModal(false);
          }}
          isVerified={isAlreadyVerified}
        />
      )}
    </>
  );
}
