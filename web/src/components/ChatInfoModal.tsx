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
      title="Understanding Chat-Lite: A Guide to Your Privacy"
    >
      <div className="space-y-6">

        <InfoSection icon={<FiLock size={20} />} title="True End-to-End Encryption">
          <p>
            Think of your messages like a letter locked in a digital box. Only you and the person you're talking to have the unique key to open it. This is called <span className="font-semibold text-text-primary">End-to-End Encryption</span>.
          </p>
          <p>
            This means no one in between – not hackers, not internet providers, and not even the Chat-Lite server – can ever see what's inside your messages. This protection is automatic for everything you send.
          </p>
        </InfoSection>

        <InfoSection icon={<FiZap size={20} />} title="The Concept of 'Sessions'">
          <p>
            Each time you log in on a new device or a new browser, you start a new, unique <span className="font-semibold text-text-primary">"Session"</span>. Every session has its own set of encryption keys. This is a security feature to ensure that even if one session is compromised, your past and future conversations on other devices remain secure.
          </p>
        </InfoSection>

        <InfoSection icon={<FiAlertTriangle size={20} />} title="The Golden Rule: Your Device Holds the Keys">
          <p className="p-3 bg-red-500/10 text-red-500 rounded-lg">
            <span className="font-bold">This is the most important concept:</span> The keys to read your past messages are stored <span className="font-bold">only on the device</span> where you received them. They are never sent to our servers.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>If you log out and log back in, you start a new session. You will not be able to read your old message history.</li>
            <li>If you switch from your laptop to your phone, you will not see your laptop's message history on your phone.</li>
            <li>If you clear your browser's data, your keys will be erased and your history will be unreadable.</li>
          </ul>
          <p className="mt-2">
            This design provides maximum privacy, but it means you are in full control of your message history on a per-device basis.
          </p>
        </InfoSection>

        <InfoSection icon={<FiKey size={20} />} title="Your Master Key: Password & Recovery Phrase">
          <p>
            Your Password and Recovery Phrase are for your <span className="font-semibold text-text-primary">Account</span>, not your messages. They are used to prove you are you.
          </p>
          <p>
            They <span className="font-bold text-destructive">do not</span> restore message history from other devices. Remember, message history is locked to each device.
          </p>
        </InfoSection>

        <InfoSection icon={<FiHelpCircle size={20} />} title="Best Practices & Tips">
           <ul className="list-disc list-inside space-y-2">
            <li><span className="font-semibold text-text-primary">DO</span> verify your contacts using the "Verify Security" feature. This ensures you aren't talking to an impostor.</li>
            <li><span className="font-semibold text-text-primary">DO</span> treat your Recovery Phrase like a passport. Store it somewhere safe and offline.</li>
            <li><span className="font-semibold text-destructive">DO NOT</span> share your password or Recovery Phrase with anyone. Ever.</li>
            <li><span className="font-semibold text-destructive">DO NOT</span> stay logged in on public or shared computers.</li>
          </ul>
        </InfoSection>

      </div>
    </ModalBase>
  );
}