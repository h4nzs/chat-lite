import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch, handleApiError } from '@lib/api';
import type { User } from '@store/auth';
import { toAbsoluteUrl } from '@utils/url';
import { motion } from 'framer-motion';
import { IoArrowBack } from 'react-icons/io5';

// Extend User type to include fields from the new endpoint
type ProfileUser = User & {
  createdAt: string;
  description?: string | null;
};

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      try {
        setLoading(true);
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

  if (loading) {
    return <div className="p-4 text-center">Loading profile...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (!user) {
    return <div className="p-4 text-center">User not found.</div>;
  }

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors duration-200"
        >
          <IoArrowBack size={20} />
          <span className="font-semibold">Back</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-4xl mx-auto p-6 sm:p-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-1 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 pb-6 md:pb-0 md:pr-8">
            <img 
              src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
              alt={user.name}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-blue-500/50 p-1"
            />
            <h1 className="text-2xl font-bold mt-4 text-gray-900 dark:text-white">{user.name}</h1>
            <p className="text-md text-gray-500 dark:text-gray-400">@{user.username}</p>
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">About</h2>
                <p className="mt-2 text-gray-700 dark:text-gray-300 italic">
                  {user.description || 'No description provided.'}
                </p>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700"></div>
              <div>
                <h2 className="text-sm font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Details</h2>
                <dl className="mt-2 space-y-2 text-gray-700 dark:text-gray-300">
                  <div className="flex">
                    <dt className="w-28 font-semibold">Joined on</dt>
                    <dd>{new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
