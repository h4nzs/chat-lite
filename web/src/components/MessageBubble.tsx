import { useAuthStore } from "@store/auth";
import type { Message } from "@store/chat";
import cls from "classnames";
import { useChatStore } from "@store/chat";
import { Spinner } from "./Spinner";
import { memo } from "react";

// Simple function to sanitize HTML content to prevent XSS
function sanitizeHtml(content: string): string {
  if (!content) return '';
  
  // Remove potentially dangerous tags and attributes
  let sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
  
  return sanitized;
}

function MessageBubble({ m }: { m: Message }) {
  if (!m || !m.id || !m.content) {
    console.warn('Invalid message render skipped:', m)
    return null
  }
  
  const me = useAuthStore((s) => s.user?.id);
  const mine = m.senderId === me;
  const activeId = useChatStore((s) => s.activeId);
  const conversations = useChatStore((s) => s.conversations);
  const deleteLoading = useChatStore((state) => state.deleteLoading[m.id]);

  // Ambil partisipan
  const conversation = conversations.find((c) => c.id === activeId);
  const participants = conversation?.participants || [];
  const otherParticipants = participants.filter((p) => p.id !== me);

  // Flag decrypt gagal
  const isDecryptionFailed =
    m.content &&
    (m.content.includes("[Failed to decrypt") ||
      m.content.includes("[Invalid encrypted message]") ||
      m.content.includes("[Decryption key not available]"));

  // Pesan sudah dibaca
  const isRead = mine && m.readBy && m.readBy.length > 0;
  const readByCount = m.readBy ? m.readBy.length : 0;

  return (
    <div
      className={cls(
        "relative px-4 py-2 rounded-2xl shadow-sm max-w-[70%] whitespace-pre-wrap break-words",
        mine
          ? "ml-auto bg-gradient-to-r from-blue-500 to-purple-500 text-white"
          : "mr-auto bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      )}
    >
      {deleteLoading ? (
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-sm">Deleting...</span>
        </div>
      ) : m.imageUrl ? (
        <img
          src={m.imageUrl}
          alt="img"
          className="rounded-md max-w-[220px] max-h-[200px] object-contain shadow cursor-pointer hover:opacity-90"
          onClick={() => window.open(m.imageUrl!, "_blank")}
        />
      ) : isDecryptionFailed ? (
        <div className="text-sm italic text-red-200">
          🔒 Message could not be decrypted
        </div>
      ) : (
        <span className="leading-relaxed" dangerouslySetInnerHTML={{__html: sanitizeHtml(m.content || '')}} />
      )}

      {/* Read receipts */}
      {mine && isRead && (
        <div className="absolute -bottom-4 right-2 text-xs text-gray-400 flex items-center gap-1">
          <span>✓✓</span>
          {otherParticipants.length > 1 && readByCount > 0 && (
            <span>{readByCount}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(
  MessageBubble,
  (prevProps, nextProps) =>
    prevProps.m.id === nextProps.m.id &&
    prevProps.m.content === nextProps.m.content &&
    prevProps.m.imageUrl === nextProps.m.imageUrl &&
    prevProps.m.senderId === nextProps.m.senderId
);
