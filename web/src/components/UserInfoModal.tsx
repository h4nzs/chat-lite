import { useModalStore } from '@store/modal';
import { useNavigate } from 'react-router-dom';

export default function UserInfoModal() {
  const { isProfileModalOpen, profileData, closeProfileModal } = useModalStore();
  const navigate = useNavigate();

  if (!isProfileModalOpen || !profileData) {
    return null;
  }

  const handleViewProfile = () => {
    closeProfileModal();
    navigate(`/profile/${profileData.id}`);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"
      onClick={closeProfileModal}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center">
          <img 
            src={profileData.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${profileData.name}`}
            alt={profileData.name}
            className="w-24 h-24 rounded-full bg-gray-300 object-cover mb-4"
          />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profileData.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">@{profileData.username}</p>
          <p className="text-center text-gray-600 dark:text-gray-300 mt-2">
            {profileData.description || 'This user prefers to keep an air of mystery.'}
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
      </div>
    </div>
  );
}
