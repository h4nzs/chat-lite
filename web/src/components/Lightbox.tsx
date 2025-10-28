import { useEffect } from 'react';

interface LightboxProps {
  src: string;
  onClose: () => void;
}

export default function Lightbox({ src, onClose }: LightboxProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button 
        className="absolute top-4 right-4 text-white text-3xl hover:opacity-80 transition-opacity"
        onClick={onClose}
      >
        &times;
      </button>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="Lightbox view" className="w-full h-full object-contain" />
      </div>
    </div>
  );
}
