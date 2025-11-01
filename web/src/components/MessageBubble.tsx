import { Message } from "@store/conversation";
import { useAuthStore } from "@store/auth";
import classNames from "classnames";
import { FaCheck, FaCheckDouble } from "react-icons/fa";
import Reactions from "./Reactions";
import FileAttachment from "./FileAttachment";
import LinkPreviewCard from "./LinkPreviewCard";
import { useModalStore } from "@store/modal"; // Import modal store

interface Props {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  showAvatar: boolean;
  showName: boolean;
}

export default function MessageBubble({ message, isOwn, isGroup, showAvatar, showName }: Props) {
  const { user } = useAuthStore();
  const openProfileModal = useModalStore(state => state.openProfileModal); // Get action from store

  const handleAvatarClick = () => {
    if (message.sender) {
      openProfileModal(message.sender.id);
    }
  };

  const getStatusIcon = () => {
    if (!isOwn) return null;
    const statuses = message.statuses || [];
    const readCount = statuses.filter(s => s.status === 'READ' && s.userId !== user?.id).length;
    const deliveredCount = statuses.filter(s => s.status === 'DELIVERED').length;

    if (readCount > 0) return <FaCheckDouble className="text-blue-500" />;
    if (deliveredCount > 0) return <FaCheckDouble />;
    return <FaCheck />;
  };

  return (
    <div className={classNames("flex items-end gap-2", { "justify-end": isOwn, "justify-start": !isOwn })}>
import clsx from "clsx";
import { sanitizeText } from "@utils/sanitize";

type MessageBubbleProps = {
  m: {
    content?: string | null;
    createdAt: string;
    mine?: boolean;
  };
  isMine?: boolean;
};

export function MessageBubble({ m, isMine }: MessageBubbleProps) {
  // Allow empty string messages but not null/undefined
  if (!m || (m.content !== undefined && m.content !== null && typeof m.content !== "string")) return null;

  const mine = isMine ?? m.mine ?? false;

  return (
    <div
      className={clsx(
        "flex w-full mb-2",
        mine ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={clsx(
          "rounded-2xl px-4 py-2 max-w-[75%] break-words whitespace-pre-wrap text-sm leading-snug",
          mine
            ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white self-end"
            : "bg-gray-700 text-gray-100"
        )}
      >
        {sanitizeText(m.content ?? '')}
        <div className="text-[10px] text-gray-400 text-right mt-1">
          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}