import { create } from 'zustand';
import type { User } from './auth';

type ModalState = {
  isConfirmOpen: boolean;
  confirmTitle: string;
  confirmMessage: string;
  onConfirm: () => void;
  isProfileModalOpen: boolean; // New state
  profileData: User | null; // New state
};

type ModalActions = {
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirm: () => void;
  openProfileModal: (user: User) => void; // New action
  closeProfileModal: () => void; // New action
};

export const useModalStore = create<ModalState & ModalActions>((set) => ({
  isConfirmOpen: false,
  confirmTitle: '',
  confirmMessage: '',
  onConfirm: () => {},
  isProfileModalOpen: false,
  profileData: null,

  showConfirm: (title, message, onConfirm) => set({ isConfirmOpen: true, confirmTitle: title, confirmMessage: message, onConfirm }),
  hideConfirm: () => set({ isConfirmOpen: false }),
  openProfileModal: (user) => set({ isProfileModalOpen: true, profileData: user }),
  closeProfileModal: () => set({ isProfileModalOpen: false, profileData: null }),
}));

