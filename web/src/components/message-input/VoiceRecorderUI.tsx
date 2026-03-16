// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { FiTrash2, FiSend } from 'react-icons/fi';

interface VoiceRecorderUIProps {
  recordingTime: number;
  onCancel: () => void;
  onStop: () => void;
}

export function VoiceRecorderUI({ recordingTime, onCancel, onStop }: VoiceRecorderUIProps) {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 animate-fade-in p-2 md:p-4 w-full">
      <button
        onClick={onCancel}
        className="
          p-3 rounded-full text-text-secondary
          hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0
        "
        title="Cancel Recording"
        aria-label="Cancel recording"
      >
        <FiTrash2 size={20} />
      </button>
      <div className="flex-1 bg-bg-main shadow-neu-pressed dark:shadow-neu-pressed-dark rounded-full h-12 flex items-center px-4 md:px-6 gap-3 min-w-0">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red] flex-shrink-0" />
        <span className="font-mono text-sm md:text-lg text-text-primary tracking-widest flex-shrink-0">
          {formatTime(recordingTime)}
        </span>
        <span className="hidden md:inline text-xs text-text-secondary uppercase tracking-wider ml-auto truncate">
          Recording Audio Feed...
        </span>
      </div>
      <button
        onClick={onStop}
        className="
          p-3 rounded-full bg-accent text-white
          shadow-[0_0_15px_rgba(var(--accent),0.5)]
          hover:scale-110 active:scale-95 transition-all flex-shrink-0
        "
        title="Send Voice Message"
        aria-label="Send voice message"
      >
        <FiSend size={20} />
      </button>
    </div>
  );
}
