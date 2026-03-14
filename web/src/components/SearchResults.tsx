import { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { User } from '@store/auth';
import { useUserProfile } from '@hooks/useUserProfile';
import { toAbsoluteUrl } from '@utils/url';

export const SearchResultItem = ({ user, onSelect }: { user: User, onSelect: (user: User) => void }) => {
  const profile = useUserProfile(user);
  // Prioritize the direct user property which might contain the optimistic rawQuery
  const displayName = user.name || profile.name;
  const displayUsername = user.username || 'unknown';

  return (
    <button 
      onClick={() => onSelect(user)}
      className="
        w-[calc(100%-32px)] mx-4 mb-3 p-3 flex items-center gap-4 rounded-xl text-left
        bg-bg-main transition-all
        shadow-neu-flat dark:shadow-neu-flat-dark hover:-translate-y-0.5
      "
    >
      <img src={toAbsoluteUrl(profile.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${displayName}`} alt="Avatar" className="w-10 h-10 rounded-full bg-secondary object-cover" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
           <p className="font-bold text-sm text-text-primary">{displayName}</p>
           {user.isVerified && <div className="w-2 h-2 rounded-full bg-accent" title="Verified"></div>}
        </div>
        <p className="text-xs text-text-secondary font-mono mt-0.5">@{displayUsername}</p>
      </div>
    </button>
  );
};

export default memo(function SearchResults({ results, onSelect }: { results: User[], onSelect: (user: User) => void }) {
  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={results}
      components={{
        Header: () => <p className="text-xs font-bold text-text-secondary px-6 mb-4 mt-2">GLOBAL SEARCH</p>,
        EmptyPlaceholder: () => <div className="p-6 text-center text-xs text-text-secondary">No users found.</div>,
      }}
      itemContent={(index, user) => <SearchResultItem key={user.id} user={user} onSelect={onSelect} />}
    />
  );
});
