import ModalBase from './ui/ModalBase';
import { useModalStore } from '@store/modal';
import { FiShield, FiKey, FiAlertTriangle } from 'react-icons/fi';

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
      title="How This Chat Works (Simple & Secure)"
    >
      <div className="space-y-6">
        <InfoSection icon={<FiKey size={20} />} title="Your Keys, Your Data">
          <p>
            Think of your messages like a letter written in a secret code. Only you and the person you're talking to have the key to read it. This is called <span className="font-semibold text-text-primary">End-to-End Encryption</span>.
          </p>
          <p>
            Not even we can read your messages. The keys are stored securely <span className="font-semibold text-text-primary">only on this device</span>.
          </p>
        </InfoSection>

        <InfoSection icon={<FiAlertTriangle size={20} />} title="The Golden Rule: Protect Your Session">
          <p className="p-3 bg-red-500/10 text-red-500 rounded-lg">
            <span className="font-bold">Warning:</span> Logging out, clearing your browser data, or switching to a new device will permanently lose the keys for this session. You <span className="font-bold">will not</span> be able to read your old messages on a new device.
          </p>
          <p>
            Your password and recovery phrase protect your account, but your message history is tied to the keys on each device.
          </p>
        </InfoSection>

        <InfoSection icon={<FiShield size={20} />} title="Verifying Your Contacts">
          <p>
            When you see a <span className="font-semibold text-green-500">green shield icon</span> next to a name, it means you have verified their identity. This protects you from impostors and ensures your conversation is secure.
          </p>
          <p>
            You can do this by clicking on a user's profile and using the "Verify Security" option.
          </p>
        </InfoSection>
      </div>
    </ModalBase>
  );
}
