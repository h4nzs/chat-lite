// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { useState, useRef, useEffect, useCallback, ChangeEvent, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSmile,
  FiMic,
  FiAlertTriangle,
  FiPaperclip,
  FiSend,
  FiClock,
  FiPlus,
  FiEye,
  FiCpu,
  FiVolumeX,
  FiEdit3,
} from 'react-icons/fi';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useShallow } from 'zustand/react/shallow';
import { useMessageInputStore } from '@store/messageInput';
import { useConnectionStore } from '@store/connection';
import { useAuthStore } from '@store/auth';
import { useThemeStore } from '@store/theme';
import LinkPreviewCard from './LinkPreviewCard';
import SmartReply from './SmartReply';
import { useMessageStore } from '@store/message';
import { triggerSendFeedback } from '@utils/feedback';
import { ReplyPreview } from './message-input/ReplyPreview';
import { EditPreview } from './message-input/EditPreview';
import { FileStagingArea } from './message-input/FileStagingArea';
import { VoiceRecorderUI } from './message-input/VoiceRecorderUI';
import {
  startAudioRecording,
  cancelAudioRecording,
  processFileSelection,
  validateFileCount,
  formatRecordingTime,
  startRecordingTimer,
} from '@services/mediaComposition.service';
import { Spinner } from './Spinner';

const AttachmentCropperModal = lazy(() => import('./AttachmentCropperModal'));
const ImageEditorModal = lazy(() => import('./ImageEditorModal'));

// ============================================================================
// Types
// ============================================================================

interface MessageInputProps {
  onSend: (data: { content: string }) => void;
  onTyping: () => void;
  onVoiceSend: (blob: Blob, duration: number) => void;
  conversation: {
    id: string;
    isGroup: boolean;
    participants?: Array<{ id: string; role?: string }>;
  };
}

// ============================================================================
// Helper: Debounce
// ============================================================================

function debounce<F extends (...args: Parameters<F>) => unknown>(
  func: F,
  waitFor: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

// ============================================================================
// Constants
// ============================================================================

const DURATIONS = [
  { label: 'Off', value: null },
  { label: '1m', value: 60 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES_PER_MESSAGE = 10;

// ============================================================================
// Main Component
// ============================================================================

export default function MessageInput({
  onSend,
  onTyping,
  onVoiceSend,
  conversation,
}: MessageInputProps) {
  // --------------------------------------------------------------------------
  // State: UI Controls
  // --------------------------------------------------------------------------
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showSilentMenu, setShowSilentMenu] = useState(false);

  // --------------------------------------------------------------------------
  // State: Crop & Paint Modals
  // --------------------------------------------------------------------------
  const [cropTarget, setCropTarget] = useState<{
    id: string;
    url: string;
    file: File;
  } | null>(null);
  const [paintTarget, setPaintTarget] = useState<{
    id: string;
    file: File;
  } | null>(null);

  // --------------------------------------------------------------------------
  // State: Voice Recording
  // --------------------------------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // --------------------------------------------------------------------------
  // Refs
  // --------------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const timerMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<(() => void) | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldSendVoiceRef = useRef<boolean>(true);
  const recordingTimeRef = useRef(0);

  // --------------------------------------------------------------------------
  // Store: Message Input
  // --------------------------------------------------------------------------
  const {
    typingLinkPreview,
    fetchTypingLinkPreview,
    clearTypingLinkPreview,
    expiresIn,
    setExpiresIn,
    isViewOnce,
    setIsViewOnce,
    stagedFiles,
    addStagedFiles,
    removeStagedFile,
    clearStagedFiles,
    updateStagedFile,
    isHD,
    setIsHD,
    isVoiceAnonymized,
    setIsVoiceAnonymized,
    editingMessage,
    setEditingMessage,
    sendEdit,
  } = useMessageInputStore(
    useShallow((s) => ({
      typingLinkPreview: s.typingLinkPreview,
      fetchTypingLinkPreview: s.fetchTypingLinkPreview,
      clearTypingLinkPreview: s.clearTypingLinkPreview,
      expiresIn: s.expiresIn,
      setExpiresIn: s.setExpiresIn,
      isViewOnce: s.isViewOnce,
      setIsViewOnce: s.setIsViewOnce,
      stagedFiles: s.stagedFiles,
      addStagedFiles: s.addStagedFiles,
      removeStagedFile: s.removeStagedFile,
      clearStagedFiles: s.clearStagedFiles,
      updateStagedFile: s.updateStagedFile,
      isHD: s.isHD,
      setIsHD: s.setIsHD,
      isVoiceAnonymized: s.isVoiceAnonymized,
      setIsVoiceAnonymized: s.setIsVoiceAnonymized,
      editingMessage: s.editingMessage,
      setEditingMessage: s.setEditingMessage,
      sendEdit: s.sendEdit,
    }))
  );

  // --------------------------------------------------------------------------
  // Store: Other
  // --------------------------------------------------------------------------
  const { status: connectionStatus } = useConnectionStore(
    useShallow((s) => ({ status: s.status }))
  );
  const blockedUserIds = useAuthStore((state) => state.blockedUserIds);
  const user = useAuthStore((state) => state.user);
  const messages = useMessageStore((state) => state.messages[conversation.id] || []);
  const theme = useThemeStore((state) => state.theme);

  // --------------------------------------------------------------------------
  // Computed Values
  // --------------------------------------------------------------------------
  const handleSendTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => setShowSilentMenu(true), 500);
  };
  const handleSendTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const isOneToOne = !conversation.isGroup;
  const otherParticipant =
    isOneToOne &&
    conversation.participants?.find(
      (p: { id: string }) => p.id !== useAuthStore.getState().user?.id
    );
  const isOtherParticipantBlocked =
    isOneToOne && otherParticipant && blockedUserIds.includes(otherParticipant.id);
  const isConnected = connectionStatus === 'connected';
  const hasText = text.trim().length > 0;
  const isInputDisabled = !isConnected || isOtherParticipantBlocked;

  // Smart Reply Logic
  const absoluteLastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isLastMessageFromOther = absoluteLastMessage?.senderId !== user?.id;
  const isValidTextMessage =
    absoluteLastMessage &&
    !absoluteLastMessage.fileUrl &&
    !absoluteLastMessage.imageUrl &&
    absoluteLastMessage.content;
  const lastDecryptedText =
    isLastMessageFromOther && isValidTextMessage
      ? absoluteLastMessage.content || null
      : null;

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  // Sync text with editing message
  useEffect(() => {
    if (editingMessage && editingMessage.content) {
      setText(editingMessage.content);
    }
  }, [editingMessage]);

  // Debounced Link Preview
  const debouncedFetchPreview = useCallback(
    debounce((inputText: string) => fetchTypingLinkPreview(inputText), 500),
    [fetchTypingLinkPreview]
  );

  // Close Popovers on Click Outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        timerMenuRef.current &&
        !timerMenuRef.current.contains(event.target as Node)
      ) {
        setShowTimerMenu(false);
      }
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setShowPlusMenu(false);
      }
      if (
        sendButtonRef.current &&
        !sendButtonRef.current.contains(event.target as Node)
      ) {
        setShowSilentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --------------------------------------------------------------------------
  // Handlers: Text & Emoji
  // --------------------------------------------------------------------------

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    if (isConnected) {
      onTyping();
      debouncedFetchPreview(newText);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
  };

  // --------------------------------------------------------------------------
  // Handlers: File Selection
  // --------------------------------------------------------------------------

  const handleLocalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const selectedFiles = Array.from(e.target.files);

    // Validate file count
    if (!validateFileCount(stagedFiles.length, selectedFiles.length, MAX_FILES_PER_MESSAGE)) {
      toast.error(`You can only send up to ${MAX_FILES_PER_MESSAGE} files at once.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate and process files
    const { validFiles, rejectedFiles } = processFileSelection(selectedFiles, {
      maxFileSize: MAX_FILE_SIZE,
    });

    // Show error toasts for rejected files
    rejectedFiles.forEach(({ file, reason }) => {
      toast.error(`"${file.name}" ${reason}`);
    });

    if (validFiles.length > 0) {
      addStagedFiles(validFiles);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --------------------------------------------------------------------------
  // Handlers: Submit
  // --------------------------------------------------------------------------

  const hasContentToSend = hasText || stagedFiles.length > 0;

  const handleSubmit = async (e?: React.FormEvent, forceSilent = false) => {
    if (e) e.preventDefault();
    if (!hasContentToSend || !isConnected) return;

    if (!forceSilent) triggerSendFeedback();
    setShowSilentMenu(false);

    // Handle edit mode
    if (editingMessage) {
      await sendEdit(conversation.id, editingMessage.id, text);
      setText('');
      return;
    }

    // Process staged files
    if (stagedFiles.length > 0) {
      const filesToProcess = [...stagedFiles];
      clearStagedFiles();

      (async () => {
        for (const staged of filesToProcess) {
          await useMessageInputStore
            .getState()
            .uploadFile(conversation.id, staged.file);
        }
      })();
    }

    // Process text
    if (hasText) {
      let finalContent = text;
      if (forceSilent) {
        finalContent = JSON.stringify({ type: 'silent', text });
      }
      onSend({ content: finalContent });
      setText('');
      setIsHD(false);
      setIsVoiceAnonymized(false);
    }

    clearTypingLinkPreview();
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
    setShowTimerMenu(false);
  };

  const handleSmartReplySelect = (reply: string) => {
    setText(reply);
    if (isConnected) {
      onTyping();
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Voice Recording
  // --------------------------------------------------------------------------

  const handleStartRecording = async () => {
    if (!isConnected) return;

    try {
      const { mediaRecorder, stream, audioContext } = await startAudioRecording({
        anonymizeVoice: isVoiceAnonymized,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioContextRef.current = audioContext;
      audioChunksRef.current = [];
      shouldSendVoiceRef.current = true;

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (shouldSendVoiceRef.current) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm',
          });
          onVoiceSend(audioBlob, recordingTimeRef.current);
        }
        stream.getTracks().forEach((track) => track.stop());
        setRecordingTime(0);
        recordingTimeRef.current = 0;
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      const clearTimer = startRecordingTimer((time) => {
        setRecordingTime(time);
        recordingTimeRef.current = time;
      });
      recordingIntervalRef.current = clearTimer;
    } catch (error) {
      console.error('Mic access denied:', error);
      toast.error('Microphone access denied');
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    shouldSendVoiceRef.current = true;
    mediaRecorderRef.current.stop();

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setIsRecording(false);
    if (recordingIntervalRef.current) {
      recordingIntervalRef.current();
      recordingIntervalRef.current = null;
    }
  };

  const handleCancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    shouldSendVoiceRef.current = false;
    const stream = mediaRecorderRef.current.stream;
    cancelAudioRecording(
      mediaRecorderRef.current,
      stream,
      audioContextRef.current
    );

    audioContextRef.current = null;
    setIsRecording(false);

    if (recordingIntervalRef.current) {
      recordingIntervalRef.current();
      recordingIntervalRef.current = null;
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Crop & Paint
  // --------------------------------------------------------------------------

  const handleCropSave = (newFile: File) => {
    if (cropTarget) {
      updateStagedFile(cropTarget.id, newFile);
      setCropTarget(null);
    }
  };

  const handlePaintSave = (newFile: File) => {
    if (paintTarget) {
      updateStagedFile(paintTarget.id, newFile);
      setPaintTarget(null);
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="bg-bg-main border-t border-white/10 z-20 relative">
      {/* Previews Stack */}
      <div className="absolute bottom-full left-0 w-full">
        <SmartReply
          lastMessage={lastDecryptedText}
          isFromMe={!isLastMessageFromOther}
          onSelectReply={handleSmartReplySelect}
        />
        <div className="px-4">
          <EditPreview />
          <ReplyPreview />

          {typingLinkPreview && (
            <div className="mb-2">
              <LinkPreviewCard
                preview={
                  typingLinkPreview as unknown as React.ComponentProps<
                    typeof LinkPreviewCard
                  >['preview']
                }
              />
            </div>
          )}

          {/* Staged Files Carousel */}
          <FileStagingArea
            onPaint={(staged) => setPaintTarget({ id: staged.id, file: staged.file })}
            onCrop={(staged, url) => setCropTarget({ id: staged.id, url, file: staged.file })}
          />
        </div>
      </div>

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-24 left-4 z-50 shadow-2xl rounded-xl overflow-hidden"
        >
          <Suspense
            fallback={
              <div className="w-[350px] h-[450px] bg-bg-surface flex items-center justify-center text-text-secondary">
                Loading Emojis...
              </div>
            }
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              lazyLoadEmojis={true}
              theme={theme as unknown as Theme}
            />
          </Suspense>
        </div>
      )}

      {/* Disappearing Messages Menu */}
      {showTimerMenu && (
        <div
          ref={timerMenuRef}
          className="absolute bottom-full left-10 mb-2 z-50 bg-bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[120px]"
        >
          <div className="p-2 text-[10px] uppercase font-bold text-text-secondary border-b border-white/5">
            Auto-Delete
          </div>
          {DURATIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setExpiresIn(opt.value);
                setShowTimerMenu(false);
                setShowPlusMenu(false);
              }}
              className={clsx(
                'w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between',
                expiresIn === opt.value
                  ? 'text-orange-500 font-bold'
                  : 'text-text-primary'
              )}
            >
              {opt.label}
              {expiresIn === opt.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Plus Menu */}
      {showPlusMenu && (
        <div
          ref={plusMenuRef}
          className="absolute bottom-full left-4 mb-2 z-50 bg-bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px] flex flex-col p-1"
        >
          <button
            onClick={() => {
              fileInputRef.current?.click();
              setShowPlusMenu(false);
            }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5 rounded-lg transition-colors text-text-primary"
          >
            <FiPaperclip size={18} />
            <span>Attachment</span>
          </button>
          <button
            onClick={() => {
              setShowTimerMenu(true);
              setShowPlusMenu(false);
            }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5 rounded-lg transition-colors text-text-primary"
          >
            <FiClock
              size={18}
              className={expiresIn ? 'text-orange-500' : ''}
            />
            <span>Auto-Delete</span>
          </button>
          <button
            onClick={() => {
              setIsViewOnce(!isViewOnce);
              setShowPlusMenu(false);
            }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5 rounded-lg transition-colors text-text-primary"
          >
            <FiEye size={18} className={isViewOnce ? 'text-accent' : ''} />
            <span>View Once</span>
          </button>
          <button
            onClick={() => {
              setIsHD(!isHD);
              setShowPlusMenu(false);
            }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5 rounded-lg transition-colors text-text-primary font-bold"
          >
            <span className={isHD ? 'text-accent' : 'text-text-secondary'}>
              HD
            </span>
            <span>{isHD ? 'HD Quality: ON' : 'Standard Quality'}</span>
          </button>
          <button
            onClick={() => {
              setIsVoiceAnonymized(!isVoiceAnonymized);
              setShowPlusMenu(false);
            }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5 rounded-lg transition-colors text-text-primary font-bold"
          >
            <FiCpu
              size={18}
              className={isVoiceAnonymized ? 'text-red-500' : 'text-text-secondary'}
            />
            <span className={isVoiceAnonymized ? 'text-red-500' : ''}>
              {isVoiceAnonymized ? 'Anon Voice: ON' : 'Anon Voice: OFF'}
            </span>
          </button>
          <button
            onClick={() => {
              setShowEmojiPicker(true);
              setShowPlusMenu(false);
            }}
            className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5 rounded-lg transition-colors text-text-primary"
          >
            <FiSmile size={18} />
            <span>Emoji</span>
          </button>
        </div>
      )}

      {/* Input Module */}
      {isOtherParticipantBlocked ? (
        <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-xl border border-red-500/20 m-4">
          <div className="flex items-center gap-3 text-red-500">
            <FiAlertTriangle size={20} />
            <span className="font-bold text-sm">TRANSMISSION BLOCKED</span>
          </div>
          <button
            onClick={() =>
              useAuthStore.getState().unblockUser(otherParticipant.id)
            }
            className="text-xs font-mono uppercase bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-600"
          >
            Unblock Signal
          </button>
        </div>
      ) : isRecording ? (
        // Voice Recording Mode
        <VoiceRecorderUI
          recordingTime={recordingTime}
          onCancel={handleCancelRecording}
          onStop={handleStopRecording}
        />
      ) : (
        // Text Input Mode - TRENCH DESIGN
        <form
          onSubmit={handleSubmit}
          className="
            relative flex items-center gap-2 p-2 rounded-2xl
            bg-bg-main w-full m-4
            shadow-neu-pressed dark:shadow-neu-pressed-dark
            max-w-[calc(100%-2rem)]
          "
        >
          {/* Action Buttons (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isInputDisabled}
              aria-label="Attach file"
              className="
                p-3 rounded-xl text-text-secondary transition-all
                hover:text-accent active:scale-95
                shadow-neu-icon dark:shadow-neu-icon-dark
              "
            >
              <FiPaperclip size={18} />
            </button>
            <button
              type="button"
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              disabled={isInputDisabled}
              aria-label="Set disappearing message timer"
              className={clsx(
                'p-3 rounded-xl transition-all active:scale-95 shadow-neu-icon dark:shadow-neu-icon-dark',
                expiresIn
                  ? 'text-orange-500 bg-orange-500/10'
                  : 'text-text-secondary hover:text-orange-500'
              )}
            >
              <FiClock size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIsViewOnce(!isViewOnce)}
              disabled={isInputDisabled}
              aria-label="Toggle View Once"
              className={clsx(
                'p-3 rounded-xl transition-all active:scale-95 shadow-neu-icon dark:shadow-neu-icon-dark',
                isViewOnce
                  ? 'text-accent bg-accent/10'
                  : 'text-text-secondary hover:text-accent'
              )}
            >
              <FiEye size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIsHD(!isHD)}
              disabled={isInputDisabled}
              aria-label="Toggle HD Quality"
              className={clsx(
                'p-3 rounded-xl transition-all active:scale-95 shadow-neu-icon dark:shadow-neu-icon-dark font-bold text-xs flex items-center justify-center',
                isHD
                  ? 'text-accent bg-accent/10'
                  : 'text-text-secondary hover:text-accent'
              )}
            >
              HD
            </button>
            <button
              type="button"
              onClick={() => setIsVoiceAnonymized(!isVoiceAnonymized)}
              disabled={isInputDisabled}
              aria-label="Toggle Anonymous Voice"
              className={clsx(
                'p-3 rounded-xl transition-all active:scale-95 shadow-neu-icon dark:shadow-neu-icon-dark font-bold text-xs flex items-center gap-1 justify-center',
                isVoiceAnonymized
                  ? 'text-red-500 bg-red-500/10 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]'
                  : 'text-text-secondary hover:text-red-400'
              )}
            >
              <FiCpu size={14} /> ANON
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={isInputDisabled}
              aria-label="Insert emoji"
              className="
                p-3 rounded-xl text-text-secondary transition-all
                hover:text-yellow-500 active:scale-95
                shadow-neu-icon dark:shadow-neu-icon-dark
              "
            >
              <FiSmile size={18} />
            </button>
          </div>

          {/* Action Button (Mobile) - Plus Menu Trigger */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              disabled={isInputDisabled}
              aria-label="More actions"
              className={clsx(
                'p-3 rounded-xl transition-all active:scale-95 shadow-neu-icon dark:shadow-neu-icon-dark',
                showPlusMenu ? 'text-accent bg-accent/10' : 'text-text-secondary'
              )}
            >
              <motion.div
                animate={{ rotate: showPlusMenu ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <FiPlus size={20} />
              </motion.div>
            </button>
          </div>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleLocalFileChange}
            disabled={isInputDisabled}
          />

          {/* Main Transmission Slot */}
          <div className="flex-1 relative group">
            <input
              type="text"
              value={text}
              onChange={handleTextChange}
              disabled={isInputDisabled}
              aria-label="Message text"
              placeholder={
                isConnected
                  ? expiresIn
                    ? 'Disappearing message...'
                    : 'Transmit secure message...'
                  : 'Connection Lost'
              }
              className="
                w-full bg-transparent border-none outline-none
                text-text-primary placeholder:text-text-secondary/50
                h-10 px-2 font-medium
              "
            />
          </div>

          {/* Send / Mic Button */}
          <div className="relative">
            <AnimatePresence>
              {showSilentMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="absolute bottom-full right-0 mb-2 p-2 bg-bg-surface backdrop-blur-xl border border-white/10 rounded-xl shadow-neumorphic-convex z-50 whitespace-nowrap"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit(undefined, true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-text-primary hover:bg-white/5 rounded-lg transition-colors w-full"
                  >
                    <FiVolumeX className="text-accent" size={16} /> Send
                    without sound
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            {hasContentToSend ? (
              <button
                ref={sendButtonRef}
                type="submit"
                onMouseDown={handleSendTouchStart}
                onMouseUp={handleSendTouchEnd}
                onMouseLeave={handleSendTouchEnd}
                onTouchStart={handleSendTouchStart}
                onTouchEnd={handleSendTouchEnd}
                disabled={isInputDisabled}
                aria-label="Send message"
                className="
                  p-3 rounded-xl bg-accent text-white
                  shadow-neu-flat dark:shadow-neu-flat-dark
                  hover:-translate-y-0.5 active:translate-y-0 transition-all
                "
              >
                <FiSend
                  size={18}
                  className={hasContentToSend ? 'translate-x-0.5' : ''}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={isInputDisabled}
                aria-label="Record voice message"
                className="
                  p-3 rounded-xl text-text-secondary
                  shadow-neu-icon dark:shadow-neu-icon-dark
                  hover:text-red-500 active:scale-95 transition-all
                "
              >
                <FiMic size={18} />
              </button>
            )}
          </div>
        </form>
      )}

      {/* Crop Modal */}
      {cropTarget && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-sm">
              <Spinner />
            </div>
          }
        >
          <AttachmentCropperModal
            file={cropTarget.file}
            url={cropTarget.url}
            onClose={() => setCropTarget(null)}
            onSave={handleCropSave}
          />
        </Suspense>
      )}

      {/* Paint Modal */}
      {paintTarget && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-sm">
              <Spinner />
            </div>
          }
        >
          <ImageEditorModal
            file={paintTarget.file}
            onSave={handlePaintSave}
            onCancel={() => setPaintTarget(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
