// Copyright (c) 2026 [han]. All rights reserved.
import { useNavigate } from 'react-router-dom';
import { FiKey, FiSmartphone, FiDownload, FiUpload, FiSend } from 'react-icons/fi';
import { ControlModule, ActionButton } from './SettingsUI';
import { exportVault, importVault } from '@services/settings.service';
import { useRef } from 'react';

export default function KeyManagementSection() {
  const navigate = useNavigate();
  const vaultInputRef = useRef<HTMLInputElement>(null);

  const triggerImport = () => {
    vaultInputRef.current?.click();
  };

  const handleImportVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importVault(file);
    } catch {
      // Error handled in service
    }
    e.target.value = '';
  };

  return (
    <div className="col-span-1 md:col-span-6 lg:col-span-4">
      <ControlModule title="Data Ports" icon={FiKey}>
        <div className="space-y-3">
          <ActionButton
            label="Encryption Keys"
            icon={FiKey}
            onClick={() => navigate('/settings/keys')}
          />
          <ActionButton
            label="Active Sessions"
            icon={FiSmartphone}
            onClick={() => navigate('/settings/sessions')}
          />

          {/* VAULT ACTIONS */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-text-secondary/10">
            <button
              onClick={exportVault}
              className="
                flex flex-col items-center justify-center gap-2 p-3 rounded-xl
                bg-bg-main text-emerald-500 font-bold text-xs uppercase tracking-wider
                shadow-neu-flat-light dark:shadow-neu-flat-dark
                active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark
                hover:brightness-110 transition-all
              "
            >
              <FiDownload size={18} />
              Export Vault
            </button>
            <button
              onClick={triggerImport}
              className="
                flex flex-col items-center justify-center gap-2 p-3 rounded-xl
                bg-bg-main text-blue-500 font-bold text-xs uppercase tracking-wider
                shadow-neu-flat-light dark:shadow-neu-flat-dark
                active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark
                hover:brightness-110 transition-all
              "
            >
              <FiUpload size={18} />
              Import Vault
            </button>
            <button
              onClick={() => navigate('/settings/migrate-send')}
              className="
                col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl
                bg-bg-main text-accent font-bold text-xs uppercase tracking-wider
                shadow-neu-flat-light dark:shadow-neu-flat-dark
                active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark
                hover:brightness-110 transition-all
              "
            >
              <FiSend size={18} />
              Transfer to New Device (QR)
            </button>
            <input
              type="file"
              ref={vaultInputRef}
              onChange={handleImportVault}
              accept=".nyxvault,.json"
              className="hidden"
            />
          </div>
        </div>
      </ControlModule>
    </div>
  );
}
