import { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause } from 'react-icons/fi';
import { motion } from 'framer-motion';

interface VoiceMessagePlayerProps {
  src: string;
  duration: number;
}

export default function VoiceMessagePlayer({ src, duration }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleCanPlay = () => setIsLoaded(true);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 w-full max-w-[250px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button 
        onClick={togglePlay} 
        disabled={!isLoaded}
        className="p-3 rounded-full bg-accent text-accent-foreground shadow-neumorphic-convex active:shadow-neumorphic-pressed disabled:opacity-50 transition-all"
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
        <div className="w-full h-1.5 bg-bg-main shadow-neumorphic-concave rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
        <span className="text-xs text-text-secondary font-mono self-end">
          {formatTime(isPlaying ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
}