import { useEffect, useState } from 'react';
import { useModalStore } from '@store/modal';
import { useNavigate } from 'react-router-dom';
import { toAbsoluteUrl } from '@utils/url';
import { authFetch, handleApiError } from '@lib/api';
import type { User } from '@store/auth';
import { Spinner } from './Spinner';

// The user type for the profile modal can have an optional email
type ProfileUser = User & { email?: string };

const ModalContent = () => {
  const { profileUserId, closeProfileModal } = useModalStore();
  const navigate = useNavigate();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileUserId) return;

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      setUser(null);
      try {
        const userData = await authFetch<ProfileUser>(`/api/users/${profileUserId}`);
        setUser(userData);
      } catch (e) {
        setError(handleApiError(e));
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [profileUserId]);

  const handleViewProfile = () => {
    if (!user) return;
    closeProfileModal();
    navigate(`/profile/${user.id}`);
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 m-4 min-h-[300px] flex flex-col justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {loading && <Spinner />}
      {error && <p className="text-center text-red-500">{error}</p>}
      {user && (
        <>
          <div className="flex flex-col items-center text-center">
            <img 
              src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
              alt={user.name}
              className="w-24 h-24 rounded-full bg-gray-300 object-cover mb-4"
            />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
            {user.email && (
              <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">{user.email}</p>
            )}
            <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
              {user.description || 'This user prefers to keep an air of mystery.'}
            </p>
          </div>
          <div className="mt-6 flex flex-col space-y-2">
            <button
              onClick={handleViewProfile}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              View Full Profile
            </button>
            <button
              onClick={closeProfileModal}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function UserInfoModal() {
  const { isProfileModalOpen, closeProfileModal } = useModalStore();

  if (!isProfileModalOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={closeProfileModal}
    >
      <ModalContent />
    </div>
  );
}
