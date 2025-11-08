import { createWithEqualityFn } from "zustand/traditional";
import { useMessageStore } from "./message";
import type { Message } from "./conversation";

type State = {
  searchResults: Message[];
  highlightedMessageId: string | null;
  searchQuery: string;
  
  // Actions
  searchMessages: (query: string, conversationId: string) => Promise<void>;
  setHighlightedMessageId: (messageId: string | null) => void;
  clearSearch: () => void;
};

export const useMessageSearchStore = createWithEqualityFn<State>((set, get) => ({
  searchResults: [],
  highlightedMessageId: null,
  searchQuery: '',

  searchMessages: async (query, conversationId) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    // Get messages from the main message store
    const allMessages = useMessageStore.getState().messages[conversationId] || [];
    const results = allMessages.filter(m => m.content && m.content.toLowerCase().includes(query.toLowerCase()));
    set({ searchResults: results });
  },

  setHighlightedMessageId: (messageId) => set({ highlightedMessageId: messageId }),
  
  clearSearch: () => set({ searchResults: [], searchQuery: '', highlightedMessageId: null }),
}));
