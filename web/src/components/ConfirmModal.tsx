import { useModalStore } from '@store/modal';
import { useEffect, useState } from 'react';

const ConfirmModal = () => {
  const { isConfirmOpen, confirmTitle, confirmMessage, onConfirm, hideConfirm } = useModalStore(state => ({
    isConfirmOpen: state.isConfirmOpen,
    confirmTitle: state.confirmTitle,
    confirmMessage: state.confirmMessage,
    onConfirm: state.onConfirm,
    hideConfirm: state.hideConfirm,
  }));
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (isConfirmOpen) {
      setIsRendering(true);
    } else {
      const timer = setTimeout(() => setIsRendering(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isConfirmOpen]);

  if (!isRendering) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-200 ${isConfirmOpen ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={hideConfirm}></div>

      {/* Modal Panel */}
      <div 
        className={`bg-bg-surface rounded-lg shadow-xl w-full max-w-sm m-4 transition-all duration-200 ${isConfirmOpen ? 'opacity-100 scale-100' : 'opacity-95 scale-95'}`}
      >
        <div className="p-6">
          <h3 className="text-xl font-bold text-text-primary">{confirmTitle}</h3>
          <p className="mt-2 text-text-secondary whitespace-pre-wrap">{confirmMessage}</p>
        </div>
        <div className="bg-bg-primary px-6 py-3 flex justify-end gap-3 rounded-b-lg border-t border-border">
          <button
            onClick={hideConfirm}
            className="px-4 py-2 rounded-md bg-secondary text-text-primary hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              hideConfirm();
            }}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;