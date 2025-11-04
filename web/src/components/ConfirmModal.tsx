import { useModalStore } from '@store/modal';
import ModalBase from './ui/ModalBase';

const ConfirmModal = () => {
  const { isConfirmOpen, confirmTitle, confirmMessage, onConfirm, hideConfirm } = useModalStore(state => ({
    isConfirmOpen: state.isConfirmOpen,
    confirmTitle: state.confirmTitle,
    confirmMessage: state.confirmMessage,
    onConfirm: state.onConfirm,
    hideConfirm: state.hideConfirm,
  }));

  return (
    <ModalBase
      isOpen={isConfirmOpen}
      onClose={hideConfirm}
      title={confirmTitle}
      footer={(
        <>
          <button
            onClick={hideConfirm}
            className="px-4 py-2 rounded-md bg-secondary text-text-primary hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              hideConfirm();
            }}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Confirm
          </button>
        </>
      )}
    >
      <p className="text-text-secondary whitespace-pre-wrap">{confirmMessage}</p>
    </ModalBase>
  );
};

export default ConfirmModal;
