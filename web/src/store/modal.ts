import { create } from 'zustand';

type ModalState = {
  isConfirmOpen: boolean;
  confirmTitle: string;
  confirmMessage: string;
  onConfirm: () => void;
  isProfileModalOpen: boolean;
  profileUserId: string | null;
  isPasswordPromptOpen: boolean;
  onPasswordSubmit: (password: string | null) => void;
  isChatInfoModalOpen: boolean;
};

type ModalActions = {
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirm: () => void;
  openProfileModal: (userId: string) => void;
  closeProfileModal: () => void;
  showPasswordPrompt: (onSubmitted: (password: string | null) => void) => void;
  hidePasswordPrompt: () => void;
  openChatInfoModal: () => void;
  closeChatInfoModal: () => void;
};

export const useModalStore = create<ModalState & ModalActions>((set) => ({
  isConfirmOpen: false,
  confirmTitle: '',
  confirmMessage: '',
  onConfirm: () => {},
  isProfileModalOpen: false,
  profileUserId: null,
  isPasswordPromptOpen: false,
  onPasswordSubmit: () => {},
  isChatInfoModalOpen: false,

  showConfirm: (title, message, onConfirm) => set({ isConfirmOpen: true, confirmTitle: title, confirmMessage: message, onConfirm }),
  hideConfirm: () => set({ isConfirmOpen: false }),
  openProfileModal: (userId) => set({ isProfileModalOpen: true, profileUserId: userId }),
  closeProfileModal: () => set({ isProfileModalOpen: false, profileUserId: null }),
  showPasswordPrompt: (onSubmitted) => set({ isPasswordPromptOpen: true, onPasswordSubmit: onSubmitted }),
  hidePasswordPrompt: () => set({ isPasswordPromptOpen: false }),
  openChatInfoModal: () => set({ isChatInfoModalOpen: true }),
  closeChatInfoModal: () => set({ isChatInfoModalOpen: false }),
}));

