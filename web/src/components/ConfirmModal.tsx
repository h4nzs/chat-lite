import useModalStore from '@store/modal';
import { useEffect, useState } from 'react';

const ConfirmModal = () => {
  const { isOpen, title, message, onConfirm, hideConfirmation } = useModalStore();
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendering(true);
    } else {
      // Delay hiding to allow for exit animation
      const timer = setTimeout(() => setIsRendering(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendering) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={hideConfirmation}></div>

      {/* Modal Panel */}
      <div 
        className={`bg-surface rounded-lg shadow-xl w-full max-w-sm m-4 transition-all duration-200 ${isOpen ? 'opacity-100 scale-100' : 'opacity-95 scale-95'}`}
      >
        <div className="p-6">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="mt-2 text-text-secondary">{message}</p>
        </div>
        <div className="bg-primary px-6 py-3 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={hideConfirmation}
            className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
