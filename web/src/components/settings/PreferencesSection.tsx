// Copyright (c) 2026 [han]. All rights reserved.
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore, ACCENT_COLORS, AccentColor } from '@store/theme';
import { useSettingsStore } from '@store/settings';
import { FiMoon, FiSun, FiActivity, FiBell } from 'react-icons/fi';
import { ControlModule, RockerSwitch } from './SettingsUI';
import { usePushNotifications } from '@hooks/usePushNotifications';
import { FiInfo } from 'react-icons/fi';

export default function PreferencesSection() {
  const { theme, toggleTheme, accent, setAccent } = useThemeStore(useShallow(s => ({
    theme: s.theme,
    toggleTheme: s.toggleTheme,
    accent: s.accent,
    setAccent: s.setAccent
  })));

  const { enableSmartReply, setEnableSmartReply } = useSettingsStore(useShallow(s => ({
    enableSmartReply: s.enableSmartReply,
    setEnableSmartReply: s.setEnableSmartReply
  })));

  const {
    isSubscribed,
    loading: pushLoading,
    subscribeToPush,
    unsubscribeFromPush
  } = usePushNotifications();

  const colorMap: Record<AccentColor, string> = {
    blue: 'hsl(217 91% 60%)',
    green: 'hsl(142 76% 42%)',
    purple: 'hsl(262 80% 64%)',
    orange: 'hsl(25 95% 53%)',
    red: 'hsl(0 92% 29%)',
  };

  return (
    <>
      {/* VISUAL INTERFACE (Theme) */}
      <div className="col-span-1 md:col-span-6 lg:col-span-4">
        <ControlModule title="Visual Interface" icon={theme === 'dark' ? FiMoon : FiSun}>
          <div className="space-y-6">
            <RockerSwitch
              label="Dark Mode"
              checked={theme === 'dark'}
              onChange={toggleTheme}
            />

            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary pl-1">Accent Emitter</span>
              <div className="grid grid-cols-4 gap-4 p-2 rounded-2xl shadow-neu-pressed-light dark:shadow-neu-pressed-dark bg-bg-main">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setAccent(color)}
                    style={{ backgroundColor: colorMap[color] }}
                    className={`
                      h-10 w-full rounded-lg transition-all duration-300 relative
                      ${accent === color ? 'scale-90 shadow-inner brightness-110' : 'shadow-md hover:scale-105'}
                    `}
                  >
                    {accent === color && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-lg animate-pulse" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ControlModule>
      </div>

      {/* SMART ASSISTANCE */}
      <div className="col-span-1 md:col-span-6 lg:col-span-4">
        <ControlModule title="Smart Assistance" icon={FiActivity}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">AI Smart Reply</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Auto-generate response suggestions.</p>
              </div>
              <RockerSwitch
                checked={enableSmartReply}
                onChange={() => setEnableSmartReply(!enableSmartReply)}
              />
            </div>

            {enableSmartReply && (
              <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  <strong className="text-accent">Privacy Note:</strong> Incoming messages are decrypted on-device and sent securely to Google Gemini for analysis. Messages are <strong className="text-text-primary">not stored</strong> by our servers.
                </p>
              </div>
            )}
          </div>
        </ControlModule>
      </div>

      {/* SUPPORT MODULE */}
      <div className="col-span-1 md:col-span-12 lg:col-span-12">
        <ControlModule title="Support & Feedback" className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <RockerSwitch
              label="Push Notifications"
              checked={isSubscribed}
              onChange={isSubscribed ? unsubscribeFromPush : subscribeToPush}
              disabled={pushLoading}
            />

            {/* Background Execution Guide */}
            {isSubscribed && (
              <div className="mt-3 p-4 bg-accent/10 border border-accent/20 rounded-2xl flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-2">
                <FiInfo className="text-accent shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-text-secondary leading-relaxed">
                  <p className="text-accent font-bold mb-1">Background Activity Required</p>
                  <p className="mb-2">
                    To receive notifications when NYX is closed, ensure your device allows this app to run in the background.
                  </p>
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-2 text-xs">
                    <p>
                      <strong className="text-text-primary">🤖 Android:</strong> Settings {'>'} Apps {'>'} NYX {'>'} Battery {'>'} <span className="text-emerald-400">Unrestricted</span>
                    </p>
                    <p>
                      <strong className="text-text-primary">🍎 iOS:</strong> Settings {'>'} NYX {'>'} <span className="text-emerald-400">Enable Background App Refresh</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ControlModule>
      </div>
    </>
  );
}
