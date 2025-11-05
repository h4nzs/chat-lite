
import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { FiShield, FiX } from 'react-icons/fi';
import { Spinner } from './Spinner';

interface SafetyNumberModalProps {
  safetyNumber: string;
  userName: string;
  onClose: () => void;
  onVerify: () => void;
  isVerified: boolean;
}

export default function SafetyNumberModal({ 
  safetyNumber, 
  userName, 
  onClose, 
  onVerify,
  isVerified
}: SafetyNumberModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (safetyNumber) {
      setIsLoading(false);
    }
  }, [safetyNumber]);

  const formattedNumber = safetyNumber.replace(/(\d{5})/g, '$1 ').trim();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-2xl p-8 w-full max-w-md border border-border relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary">
          <FiX size={24} />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <FiShield className="text-accent text-5xl mb-4" />
          <h2 className="text-2xl font-bold text-text-primary">Verify Safety Number</h2>
          <p className="text-text-secondary mt-2 mb-6">
            To ensure your conversation with <span className="font-bold text-text-primary">{userName}</span> is end-to-end encrypted, compare this safety number. It should be the same for both of you.
          </p>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="my-4 p-4 bg-white rounded-lg">
                <QRCode
                  value={formattedNumber}
                  size={192}
                  viewBox={`0 0 256 256`}
                />
              </div>
              <div className="font-mono text-2xl tracking-wider text-text-primary my-4 p-4 bg-background rounded-lg w-full">
                {formattedNumber}
              </div>
            </>
          )}

          {isVerified ? (
            <p className="text-accent font-semibold">You have already verified this contact.</p>
          ) : (
            <button 
              onClick={onVerify}
              className="w-full mt-4 py-3 px-4 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-semibold"
            >
              Mark as Verified
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
