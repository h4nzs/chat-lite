import { Message } from "@store/conversation";
import classNames from "classnames";
import { FiCamera, FiVideo, FiMic, FiEyeOff } from "react-icons/fi";
import FileAttachment from "./FileAttachment";
import LinkPreviewCard from "./LinkPreviewCard";
import LazyImage from "./LazyImage";
import { useShallow } from 'zustand/react/shallow';
import MarkdownMessage from "./MarkdownMessage";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import clsx from 'clsx'; 
import { useSettingsStore } from '@store/settings';
import { useState } from "react";
import ReplyQuote from "./ReplyQuote";
import MessageMetadata from "./MessageMetadata";

interface Props {
  message: Message;
  isOwn: boolean;
  onImageClick?: (message: Message) => void;
  isLastInSequence?: boolean;
  participants?: any[];
}

export default function MessageBubble({ message, isOwn, onImageClick, isLastInSequence = true, participants = [] }: Props) {
  const privacyCloak = useSettingsStore(s => s.privacyCloak);
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  const content = message.content || '';
  // Trigger Read More if > 800 chars OR > 12 lines
  const isLongMessage = content.length > 800 || content.split('\n').length > 12;
  const isPlaceholder = content === 'waiting_for_key' || content.startsWith('[') || content === 'Decryption failed';

  const cloakClass = privacyCloak ? "blur-[6px] opacity-75 hover:blur-none hover:opacity-100 active:blur-none active:opacity-100 transition-all duration-300 select-none" : "";

  const isImage = message.fileType?.startsWith('image/');
  const isVoiceMessage = message.fileType?.startsWith('audio/webm');
  const isDeleted = !!message.deletedAt;

  const hasBubbleStyle = !isPlaceholder && !message.fileUrl || message.fileUrl && !isImage && !isVoiceMessage;

  const bubbleClasses = clsx(
    'relative max-w-md md:max-w-lg shadow-neumorphic-bubble rounded-2xl',
    {
      'px-4 py-3': hasBubbleStyle,
      'bg-accent text-accent-foreground': isOwn && !isDeleted,
      'bg-bg-surface text-text-primary': !isOwn && !isDeleted,
      'bg-bg-main text-text-secondary rounded-xl shadow-neumorphic-concave italic text-xs py-2 px-3': isDeleted,
      'rounded-bl-2xl': isOwn, 'rounded-br-2xl': !isOwn,
      'rounded-br-sm': isOwn && isLastInSequence, 'rounded-bl-sm': !isOwn && isLastInSequence,
      'p-1': isImage && !message.content, 
    }
  );

  return (
    <div className={bubbleClasses}>
      {message.repliedTo && <ReplyQuote message={message.repliedTo} />}
      
      <div className={cloakClass}>
        {isDeleted ? (
          <span className="flex items-center gap-2 opacity-60">
            🚫 Message deleted
          </span>
        ) : (
          <>
            {message.isViewOnce && message.fileUrl ? (
              <div className="p-3 bg-black/20 rounded-xl flex items-center justify-center min-w-[160px] my-1 mx-2 border border-white/5">
                {message.isViewed ? (
                  <div className="flex items-center gap-2 text-text-secondary/50 italic select-none">
                    <FiEyeOff size={18} />
                    <span className="text-sm font-medium">Opened</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => onImageClick?.(message)} 
                    className="flex items-center gap-2 text-accent hover:text-indigo-400 hover:scale-105 active:scale-95 transition-all"
                  >
                    {message.fileType?.startsWith('video/') ? <FiVideo size={20} /> : 
                     message.fileType?.startsWith('audio/') ? <FiMic size={20} /> : 
                     <FiCamera size={20} />}
                    <span className="text-sm font-bold tracking-wider uppercase">View Once</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {isVoiceMessage && message.fileUrl && (
                  <div className="p-2 w-[250px]">
                    <VoiceMessagePlayer message={message} />
                  </div>
                )}
                
                {message.fileUrl && isImage && (
                  <button onClick={() => onImageClick?.(message)} className="block w-full min-w-[200px] sm:min-w-[250px] relative">
                    <LazyImage 
                      message={message} 
                      alt={message.fileName || 'Image attachment'} 
                      className="rounded-lg max-h-[350px] w-full object-cover cursor-pointer hover:opacity-95" 
                    />
                  </button>
                )}
                
                {message.fileUrl && !isImage && !isVoiceMessage && (
                  <FileAttachment message={message} isOwn={isOwn} />
                )}
              </>
            )}
            
            {!message.fileUrl && (
              isPlaceholder ? (
                <p className="text-base whitespace-pre-wrap break-words italic text-text-secondary">{content}</p>
              ) : (
                <div className={classNames("text-base break-words w-full", { "text-white/95": isOwn, "text-text-primary": !isOwn })}>
                  <div 
                    className={classNames("relative overflow-hidden transition-all duration-300", {
                      "max-h-[250px]": isLongMessage && !isTextExpanded,
                      "max-h-none": !isLongMessage || isTextExpanded
                    })}
                    style={isLongMessage && !isTextExpanded ? { maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' } : {}}
                  >
                    <MarkdownMessage content={content} isOwn={isOwn} />
                  </div>                  {isLongMessage && (
                    <button
                      onClick={() => setIsTextExpanded(!isTextExpanded)}
                      className={classNames("mt-2 text-xs font-bold uppercase tracking-wider block active:scale-95 transition-all", {
                        "text-white/80 hover:text-white": isOwn,
                        "text-accent hover:text-indigo-400": !isOwn
                      })}
                    >
                      {isTextExpanded ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>
              )
            )}
            {message.linkPreview && !message.fileUrl && (
              <div className="mt-2">
                <LinkPreviewCard preview={message.linkPreview} />
              </div>
            )}
          </>
        )}
      </div>

      <MessageMetadata message={message} isOwn={isOwn} isImage={!!isImage} isDeleted={isDeleted} />
    </div>
  );
}
