import { useState, useRef, useEffect, useCallback } from 'react';
import { FiPlay, FiPause, FiDownload, FiAlertTriangle, FiClock } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { Message } from '@store/conversation';
import { decryptMessage, decryptFile } from '@utils/crypto';
import { toAbsoluteUrl } from '@utils/url';
import { useKeychainStore } from '@store/keychain';
import { Spinner } from './Spinner';

type DecryptionStatus = 'pending' | 'decrypting' | 'succeeded' | 'failed' | 'waiting_for_key';

interface VoiceMessagePlayerProps {
  message: Message;
}

export default function VoiceMessagePlayer({ message }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [decryptionStatus, setDecryptionStatus] = useState<DecryptionStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const lastKeychainUpdate = useKeychainStore(s => s.lastUpdated);

  const duration = message.duration || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    const handleDecryption = async () => {
      if (!message.fileUrl || !message.fileKey || !message.sessionId) {
        if (isMounted) {
          setError("Incomplete message data for decryption.");
          setDecryptionStatus('failed');
        }
        return;
      }
      
      if (isMounted) {
        setDecryptionStatus('decrypting');
        setError(null);
      }

      try {
        let fileKey = message.fileKey;

        if (!message.optimistic && fileKey && fileKey.length > 50) {
          fileKey = await decryptMessage(message.fileKey, message.conversationId, message.sessionId);
        }

        if (!fileKey) {
          throw new Error("Could not retrieve file key.");
        }
        
        // Handle the case where a key request is in progress
        if (fileKey.startsWith('[')) {
          if (isMounted) {
            setDecryptionStatus('waiting_for_key');
            setError(fileKey); // Store the placeholder message
          }
          return;
        }

        const response = await fetch(toAbsoluteUrl(message.fileUrl));
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const encryptedBlob = await response.blob();

        const decryptedBlob = await decryptFile(encryptedBlob, fileKey, 'audio/webm');
        
        if (isMounted) {
          objectUrl = URL.createObjectURL(decryptedBlob);
          setAudioSrc(objectUrl);
          setDecryptionStatus('succeeded');
        }
      } catch (e: any) {
        console.error("Voice message decryption failed:", e);
        if (isMounted) {
          setError(e.message || "Failed to decrypt voice message.");
          setDecryptionStatus('failed');
        }
      }
    };

    if (message.fileType?.includes(';encrypted=true')) {
      handleDecryption();
    } else if (message.fileUrl) {
      setAudioSrc(toAbsoluteUrl(message.fileUrl));
      setDecryptionStatus('succeeded');
    }

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [message, lastKeychainUpdate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(e => console.error("Audio play failed:", e));
    } else {
      audio.pause();
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSrc]);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  if (decryptionStatus === 'decrypting' || decryptionStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 w-full max-w-[250px] h-[60px]">
        <Spinner size="sm" />
        <span className="text-sm text-text-secondary">Decrypting...</span>
      </div>
    );
  }

  if (decryptionStatus === 'failed') {
    return (
      <div className="flex items-center gap-2 w-full max-w-[250px] p-2 bg-destructive/10 rounded-lg">
        <FiAlertTriangle className="text-destructive flex-shrink-0" />
        <p className="text-xs text-destructive italic">{error}</p>
      </div>
    );
  }

  if (decryptionStatus === 'waiting_for_key') {
    return (
      <div className="flex items-center gap-2 w-full max-w-[250px] p-2 bg-yellow-500/10 rounded-lg">
        <FiClock className="text-yellow-500 flex-shrink-0" />
        <p className="text-xs text-yellow-500 italic">{error || 'Waiting for key...'}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full max-w-[250px] p-1">
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" />}
      <button 
        onClick={togglePlay} 
        disabled={!audioSrc}
        className="p-3 rounded-full bg-bg-surface text-accent shadow-neumorphic-convex active:shadow-neumorphic-pressed disabled:opacity-50 transition-all"
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        <motion.div
          key={isPlaying ? 'pause' : 'play'}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {isPlaying ? <FiPause size={18} /> : <FiPlay size={18} className="ml-0.5" />}
        </motion.div>
      </button>
      <div className="flex-1 flex flex-col justify-center gap-1.5">
        <div className="w-full h-1.5 bg-black/20 shadow-neumorphic-concave rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="w-3 h-3 bg-white rounded-full absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 shadow-lg" />
          </div>
        </div>
        <span className="text-xs text-text-secondary/80 font-mono self-end">
          {formatTime(isPlaying ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
}
