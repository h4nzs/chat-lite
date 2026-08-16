import React from 'react';
import { FiShield, FiRefreshCw } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export const MaintenancePage: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  // Gunakan namespace 'common' (sesuaikan jika Anda ingin menaruhnya di file json lain)
  const { t } = useTranslation('common');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-main text-text-primary p-4">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Neumorphic Card */}
      <div className="relative z-10 max-w-md w-full p-8 rounded-3xl bg-bg-surface border border-text-secondary/10 flex flex-col items-center text-center" style={{ boxShadow: 'var(--shadow-neu-flat)' }}>

        {/* Animated Icon Container */}
        <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center bg-bg-main" style={{ boxShadow: 'var(--shadow-neu-pressed)' }}>
          <FiShield className="w-8 h-8 text-accent animate-pulse" />
        </div>

        <h1 className="font-display text-2xl font-bold mb-2 text-text-primary">
          {t('maintenance.title')}
        </h1>

        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
          {t('maintenance.description')}
        </p>

        {/* Neumorphic Button */}
        <button
          onClick={onRetry}
          className="group flex items-center justify-center w-full py-3 px-4 rounded-xl bg-bg-surface text-accent font-semibold transition-all"
          style={{ boxShadow: 'var(--shadow-neu-flat)' }}
          onMouseDown={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-neu-pressed)'; }}
          onMouseUp={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-neu-flat)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-neu-flat)'; }}
        >
          <FiRefreshCw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
          {t('maintenance.retryButton')}
        </button>
      </div>
    </div>
  );
};
