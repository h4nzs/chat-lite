import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch, handleApiError } from '@lib/api';
import type { User } from '@store/auth';
import { toAbsoluteUrl } from '@utils/url'; // Import utility

// Extend User type to include fields from the new endpoint
type ProfileUser = User & {
  createdAt: string;
  description?: string | null;
};

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
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
    return <div className="p-4">Loading profile...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!user) {
    return <div className="p-4">User not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center space-x-4">
        <img 
          src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
          alt={user.name}
          className="w-24 h-24 rounded-full bg-gray-300 object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-gray-500">@{user.username}</p>
        </div>
      </div>
      <div className="mt-6">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2 text-gray-600">
          {user.description || 'No description provided.'}
        </p>
      </div>
      <div className="mt-6 border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-500">
          Joined on {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
