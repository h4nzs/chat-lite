import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { FiRefreshCw, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { Spinner } from '@components/Spinner';
import { io, Socket } from "socket.io-client";
import { getSodium } from '@lib/sodiumInitializer';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '@store/auth';

const SERVER_URL = import.meta.env.VITE_WS_URL || "http://localhost:4000";

export default function LinkDevicePage() {
  const [qrData, setQrData] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating' | 'waiting' | 'linked' | 'failed'>('generating');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const bootstrap = useAuthStore(s => s.bootstrap);

  useEffect(() => {
    // Create a dedicated, isolated socket connection for this page only.
    const socket: Socket = io(SERVER_URL, { 
      autoConnect: true,
      reconnection: false, // Don't try to reconnect if it fails
    });

    const generateLinkingInfo = async () => {
      setStatus('generating');
      setError(null);
      try {
        const sodium = await getSodium();
        const roomId = uuidv4();
        
        const linkingKeys = sodium.crypto_box_keypair();
        const linkingPubKey = sodium.to_base64(linkingKeys.publicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
        const linkingPrivKey = sodium.to_base64(linkingKeys.privateKey, sodium.base64_variants.URLSAFE_NO_PADDING);

        sessionStorage.setItem('linkingPrivKey', linkingPrivKey);

        const dataToEncode = JSON.stringify({ roomId, linkingPubKey });
        setQrData(dataToEncode);
        
        console.log(`[Linker] Joining room: ${roomId}`);
        socket.emit('linking:join_room', roomId);
        setStatus('waiting');

        socket.on('linking:receive_payload', async (payload: { encryptedMasterKey: string, linkingToken: string }) => {
          try {
            const storedLinkingPrivKey = sessionStorage.getItem('linkingPrivKey');
            if (!storedLinkingPrivKey) throw new Error('Linking session expired.');

            // Full decryption logic will be needed here
            // For now, we just proceed with the finalization step

            const response = await fetch('/api/auth/finalize-linking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ linkingToken: payload.linkingToken }),
            });

            if (!response.ok) {
              throw new Error('Failed to finalize linking on server.');
            }

            setStatus('linked');
            await bootstrap();
            setTimeout(() => navigate('/'), 2000);

          } catch (decryptionError) {
            setError('Failed to process linking payload.');
            setStatus('failed');
          }
        });

      } catch (err: any) {
        setError(err.message || 'Failed to generate linking info.');
        setStatus('failed');
      }
    };

    socket.on('connect', generateLinkingInfo);
    socket.on('connect_error', (err) => {
      setError(`Socket connection failed: ${err.message}`);
      setStatus('failed');
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('linking:receive_payload');
      socket.disconnect();
    };
  }, [bootstrap, navigate]);

  const renderStatusMessage = () => {
    const messageClasses = "flex items-center gap-2";
    switch (status) {
      case 'generating':
        return <div className={`${messageClasses} text-text-secondary`}><Spinner size="sm" /> Generating QR Code...</div>;
      case 'waiting':
        return <div className={`${messageClasses} text-text-secondary`}><FiRefreshCw className="animate-spin" /> Waiting for scan...</div>;
      case 'linked':
        return <div className={`${messageClasses} text-green-500`}><FiCheckCircle /> Device Linked! Redirecting...</div>;
      case 'failed':
        return <div className={`${messageClasses} text-red-500`}><FiXCircle /> Linking Failed: {error}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-text-primary p-4">
      <div className="bg-bg-surface p-8 rounded-xl shadow-soft text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Link a New Device</h1>
        <p className="text-text-secondary mb-6">
          Scan this QR code with an already logged-in device to securely link this new device.
        </p>

        {qrData && status !== 'generating' ? (
          <div className="bg-white p-2 rounded-lg inline-block mb-6">
            <QRCode value={qrData} size={256} level="H" />
          </div>
        ) : (
          <div className="w-64 h-64 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg mb-6">
            <Spinner size="lg" />
          </div>
        )}

        <div className="mb-6 h-6">
          {renderStatusMessage()}
        </div>

        {status !== 'generating' && status !== 'linked' && (
          <Link to="/login" className="text-text-secondary hover:text-text-primary mt-4 block">
            Cancel and Login Manually
          </Link>
        )}
      </div>
    </div>
  );
}
