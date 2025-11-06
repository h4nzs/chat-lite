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