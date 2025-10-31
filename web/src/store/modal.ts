import { create } from 'zustand';

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirmation: () => void;
};

const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
  showConfirmation: (title, message, onConfirm) => set({
    isOpen: true,
    title,
    message,
    onConfirm: () => {
      onConfirm();
      set({ isOpen: false }); // Automatically hide after confirm
    },
  }),
  hideConfirmation: () => set({ isOpen: false }),
}));

export default useModalStore;
