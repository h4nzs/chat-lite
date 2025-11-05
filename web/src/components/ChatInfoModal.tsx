import ModalBase from './ui/ModalBase';
import { useModalStore } from '@store/modal';
import { FiShield, FiKey, FiAlertTriangle, FiZap, FiLock, FiHelpCircle } from 'react-icons/fi';

const InfoSection = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 text-accent-color mt-1">{icon}</div>
    <div>
      <h3 className="font-semibold text-text-primary">{title}</h3>
      <div className="text-sm text-text-secondary space-y-2">{children}</div>
    </div>
  </div>
);

export default function ChatInfoModal() {
  const { isChatInfoModalOpen, closeChatInfoModal } = useModalStore();

  return (
    <ModalBase
      isOpen={isChatInfoModalOpen}
      onClose={closeChatInfoModal}
      title="Understanding Your Security on Chat-Lite"
    >
      <div className="space-y-6">

        <InfoSection icon={<FiLock size={20} />} title="True End-to-End Encryption">
          <p>
            Your messages are protected by <span className="font-semibold text-text-primary">End-to-End Encryption</span>. Think of it like a digital vault where only you and the recipient have the key. 
          </p>
          <p>
            This means no one in between – not even the Chat-Lite server – can ever see the content of your conversations. This protection is automatic and always on.
          </p>
        </InfoSection>

        <InfoSection icon={<FiKey size={20} />} title="Your Master Key & Recovery Phrase">
          <p>
            Your entire account is secured by a single <span className="font-semibold text-text-primary">"Master Key"</span>. This key is mathematically generated from your unique, 24-word <span className="font-semibold text-text-primary">Recovery Phrase</span> that you received during registration.
          </p>
          <p className="p-3 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <span className="font-bold">This is the most important concept:</span> Your Recovery Phrase is the ultimate backup and source of truth for your account. We do not store it and cannot recover it for you. If you lose your phrase, you lose your account forever.
          </p>
        </InfoSection>

        <InfoSection icon={<FiZap size={20} />} title="How Your Keys Are Stored">
          <p>
            For your convenience, your Master Key is stored on this device in a highly secure, encrypted format. It is locked using your <span className="font-semibold text-text-primary">password</span> as the key.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Because the key is stored, you can now log out and log back in on the <span className="font-bold">same device</span> without losing your message history.</li>
            <li>Your password is the key to unlock your stored Master Key during your session. It is never sent to our servers in a readable format.</li>
          </ul>
        </InfoSection>

        <InfoSection icon={<FiAlertTriangle size={20} />} title="Switching to a New Device">
          <p>
            To access your account and messages on a new computer or phone, you must use the <span className="font-semibold text-text-primary">"Restore"</span> feature. 
          </p>
          <p>
            You will be prompted to enter your 24-word Recovery Phrase. This will securely regenerate your identical Master Key on the new device, giving you full access to your account and history.
          </p>
        </InfoSection>

        <InfoSection icon={<FiHelpCircle size={20} />} title="Best Practices & Tips">
           <ul className="list-disc list-inside space-y-2">
            <li><span className="font-semibold text-text-primary">DO</span> store your Recovery Phrase in a safe, offline location, like a password manager or a written note.</li>
            <li><span className="font-semibold text-text-primary">DO</span> verify your contacts using the security features available in the chat.</li>
            <li><span className="font-semibold text-destructive">DO NOT</span> share your password or Recovery Phrase with anyone. Ever.</li>
            <li><span className="font-semibold text-destructive">DO NOT</span> stay logged in on public or shared computers. Use the "Active Sessions" feature in your settings to log out remotely if needed.</li>
          </ul>
        </InfoSection>

      </div>
    </ModalBase>
  );
}