import { create } from 'zustand';
import type { User } from './auth';

type ModalState = {
  isConfirmOpen: boolean;
  confirmTitle: string;
  confirmMessage: string;
  onConfirm: () => void;
  isProfileModalOpen: boolean;
  profileUserId: string | null; // Changed from profileData
};

type ModalActions = {
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirm: () => void;
  openProfileModal: (userId: string) => void; // Now accepts userId
  closeProfileModal: () => void;
};

export const useModalStore = create<ModalState & ModalActions>((set) => ({
  isConfirmOpen: false,
  confirmTitle: '',
  confirmMessage: '',
  onConfirm: () => {},
  isProfileModalOpen: false,
  profileUserId: null,

  showConfirm: (title, message, onConfirm) => set({ isConfirmOpen: true, confirmTitle: title, confirmMessage: message, onConfirm }),
  hideConfirm: () => set({ isConfirmOpen: false }),
  openProfileModal: (userId) => set({ isProfileModalOpen: true, profileUserId: userId }),
  closeProfileModal: () => set({ isProfileModalOpen: false, profileUserId: null }),
}));

