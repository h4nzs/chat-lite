import { useState, useEffect, useRef } from 'react';
import { useMessageStore } from '@store/message';
import { FiSearch, FiX } from 'react-icons/fi';

interface SearchMessagesProps {
  conversationId: string;
}

export default function SearchMessages({ conversationId }: SearchMessagesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    searchQuery,
    searchResults,
    searchMessages,
    clearSearch,
    setHighlightedMessageId,
    setState
  } = useMessageStore();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      clearSearch();
    }
  }, [isOpen, clearSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    // Immediately update the input and trigger the search
    searchMessages(query, conversationId);
  };

  const handleResultClick = (messageId: string) => {
    setHighlightedMessageId(messageId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-text-secondary hover:text-white">
        {isOpen ? <FiX /> : <FiSearch />}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-72 rounded-lg border border-white/10 bg-black/30 backdrop-blur-lg shadow-lg z-50">
          <form onSubmit={(e) => e.preventDefault()} className="p-2 border-b border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search messages..."
              className="w-full bg-primary px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </form>
          <div className="max-h-80 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleResultClick(msg.id)}
                  className="p-3 hover:bg-primary cursor-pointer border-b border-gray-800 last:border-b-0"
                >
                  <p className="text-sm text-text-primary truncate">{msg.content}</p>
                  <p className="text-xs text-text-secondary mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                </div>
              ))
            ) : (
              searchQuery && <p className="p-4 text-sm text-text-secondary text-center">No results found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}