// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCoffee, FiHeart, FiFlag, FiHelpCircle, FiShield, FiActivity } from 'react-icons/fi';
import { Spinner } from '../components/Spinner';
import ReportBugModal from '../components/ReportBugModal';
import ProfileSection from '../components/settings/ProfileSection';
import SecuritySection from '../components/settings/SecuritySection';
import PreferencesSection from '../components/settings/PreferencesSection';
import KeyManagementSection from '../components/settings/KeyManagementSection';
import DangerZoneSection from '../components/settings/DangerZoneSection';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleNavigate = (path: string) => {
    // Navigation handler for child components - uses React Router (no hard reload)
    navigate(path);
  };

  const showUpgradeModalHandler = () => {
    setShowUpgradeModal(true);
  };

  return (
    <div className="w-full bg-bg-main text-text-primary p-4 md:p-8 font-sans selection:bg-accent selection:text-white pb-32">

      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-10 flex items-center gap-6">
        <Link
          to="/chat"
          className="
            p-4 rounded-full bg-bg-main text-text-primary
            shadow-neu-flat-light dark:shadow-neu-flat-dark
            active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark
            transition-all hover:text-accent
          "
        >
          <FiArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter opacity-90">Control Deck</h1>
          <p className="text-sm font-mono text-text-secondary tracking-widest uppercase">System {__APP_VERSION__} </p>
        </div>
      </header>

      {/* BENTO GRID LAYOUT */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* 1. IDENTITY SLOT (Profile) */}
        <ProfileSection showUpgradeModal={showUpgradeModalHandler} />

        {/* 2. POWER CELL (Donation) */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 flex flex-col">
          <a
            href="https://sociabuzz.com/h4nzs/tribe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 group relative overflow-hidden rounded-3xl bg-bg-main shadow-neu-flat-light dark:shadow-neu-flat-dark border border-accent/20 transition-all hover:scale-[1.02]"
          >
            {/* Battery Level Indicator */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-50"></div>
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
              <FiActivity size={40} className="text-accent animate-pulse" />
            </div>

            <div className="relative z-10 p-8 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-accent">
                  <FiCoffee size={24} />
                  <span className="font-black tracking-widest uppercase text-xs">Power Cell</span>
                </div>
                <h3 className="text-2xl font-bold leading-tight mb-2">Refuel the <br/> Developer</h3>
                <p className="text-xs text-text-secondary font-mono leading-relaxed">
                  System operates on low-cost servers. Initiate donation sequence to upgrade infrastructure.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-widest text-text-secondary/50">Status: Need Coffee</span>
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent shadow-[0_0_15px_rgba(var(--accent),0.4)]">
                   <FiHeart className="fill-current" />
                </div>
              </div>
            </div>

            {/* Glowing Bottom Bar */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-accent shadow-[0_-2px_10px_rgba(var(--accent),1)]"></div>
          </a>
        </div>

        {/* 3. VISUAL INTERFACE & PREFERENCES */}
        <PreferencesSection />

        {/* 4. PRIVACY SHIELD (Security) */}
        <SecuritySection />

        {/* 5. DATA PORT (Sessions & Keys) */}
        <KeyManagementSection />

        {/* 6. SUPPORT & HELP */}
        <div className="col-span-1 md:col-span-12 lg:col-span-12 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleNavigate('/help')}
              className="
                w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200
                bg-bg-main
                shadow-neu-flat dark:shadow-neu-flat-dark
                hover:text-accent active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark active:scale-[0.98]
                text-text-primary
              "
            >
              <div className="flex items-center gap-3">
                <FiHelpCircle size={18} />
                <span className="font-medium text-sm">Help Center</span>
              </div>
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="
                w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200
                bg-bg-main
                shadow-neu-flat dark:shadow-neu-flat-dark
                hover:text-accent active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark active:scale-[0.98]
                text-text-primary
              "
            >
              <div className="flex items-center gap-3">
                <FiFlag size={18} />
                <span className="font-medium text-sm">Report Bug</span>
              </div>
            </button>
            <button
              onClick={() => handleNavigate('/privacy')}
              className="
                w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200
                bg-bg-main
                shadow-neu-flat dark:shadow-neu-flat-dark
                hover:text-accent active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark active:scale-[0.98]
                text-text-primary
              "
            >
              <div className="flex items-center gap-3">
                <FiShield size={18} />
                <span className="font-medium text-sm">Legal & Privacy</span>
              </div>
            </button>
          </div>
        </div>

        {/* 7. EMERGENCY EJECT & DELETE */}
        <DangerZoneSection />

      </div>

      {/* MODALS */}
      {showReportModal && <ReportBugModal onClose={() => setShowReportModal(false)} />}
    </div>
  );
}
