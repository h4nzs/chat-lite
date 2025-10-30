import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";

type State = {
  presence: string[];
  typing: Record<string, string[]>;
  setPresence: (userIds: string[]) => void;
  userJoined: (userId: string) => void;
  userLeft: (userId: string) => void;
  setTyping: (conversationId: string, userIds: string[]) => void;
};

export const usePresenceStore = createWithEqualityFn<State>((set) => ({
  presence: [],
  typing: {},

  setPresence: (userIds) => set({ presence: userIds }),

  userJoined: (userId) =>
    set((state) => ({ presence: [...state.presence, userId] })),

  userLeft: (userId) =>
    set((state) => ({ presence: state.presence.filter((id) => id !== userId) })),

  setTyping: (conversationId, userIds) =>
    set((state) => ({ 
      typing: { ...state.typing, [conversationId]: userIds } 
    })),
}));
