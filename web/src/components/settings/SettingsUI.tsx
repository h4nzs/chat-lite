// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { FiChevronRight } from 'react-icons/fi';

/**
 * RockerSwitch - Toggle switch component for settings
 */
export const RockerSwitch = ({ 
  checked, 
  onChange, 
  disabled, 
  label 
}: { 
  checked: boolean; 
  onChange: () => void; 
  disabled?: boolean; 
  label?: string;
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onChange}
    disabled={disabled}
    className={`
      group flex items-center justify-between w-full p-3 rounded-lg transition-all
      hover:bg-accent/5 active:scale-[0.99]
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
    role="switch"
    aria-checked={checked}
  >
    <span className="font-bold text-sm tracking-wide text-text-primary uppercase">{label}</span>

    {/* The Track */}
    <div className={`
      w-12 h-6 rounded-full transition-colors duration-300 flex items-center px-1
      shadow-neu-pressed dark:shadow-neu-pressed-dark
      ${checked ? 'bg-accent/10' : 'bg-transparent'}
    `}>
      {/* The Knob */}
      <div className={`
        w-4 h-4 rounded-full shadow-neu-flat dark:shadow-neu-flat-dark bg-bg-main
        transform transition-transform duration-300
        ${checked ? 'translate-x-6 bg-accent' : 'translate-x-0'}
      `} />
    </div>
  </button>
);

/**
 * ControlModule - Container for setting sections with visual anchors
 */
export const ControlModule = ({ 
  title, 
  children, 
  className = '', 
  icon: Icon 
}: { 
  title: string; 
  children: React.ReactNode; 
  className?: string; 
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
}) => (
  <div className={`
    relative bg-bg-main rounded-xl p-6 overflow-hidden
    shadow-neu-flat dark:shadow-neu-flat-dark
    border-t border-white/40 dark:border-white/5
    ${className}
  `}>
    {/* VISUAL ANCHORS (The "Rivets") */}
    <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-text-secondary/20 shadow-neu-pressed dark:shadow-neu-pressed-dark" />
    <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-text-secondary/20 shadow-neu-pressed dark:shadow-neu-pressed-dark" />
    <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-text-secondary/20 shadow-neu-pressed dark:shadow-neu-pressed-dark" />
    <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-text-secondary/20 shadow-neu-pressed dark:shadow-neu-pressed-dark" />

    {/* Header with "Groove" line */}
    <div className="flex items-center gap-4 mb-6 pl-2">
      <div className="p-2 rounded-lg bg-bg-main shadow-neu-icon dark:shadow-neu-icon-dark text-accent">
        {Icon && <Icon size={16} />}
      </div>
      <h3 className="text-xs font-black tracking-[0.2em] uppercase text-text-secondary">{title}</h3>
      <div className="h-[2px] flex-1 bg-bg-main shadow-neu-pressed dark:shadow-neu-pressed-dark rounded-full"></div>
    </div>

    <div className="relative z-10 pl-2 pr-2">
      {children}
    </div>
  </div>
);

/**
 * ActionButton - Button for navigation actions in settings
 */
export const ActionButton = ({ 
  onClick, 
  label, 
  icon: Icon, 
  danger = false 
}: { 
  onClick?: () => void; 
  label: string; 
  icon?: React.ComponentType<{ size?: number | string; className?: string }>; 
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200
      bg-bg-main
      shadow-neu-flat dark:shadow-neu-flat-dark
      hover:text-accent active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark active:scale-[0.98]
      ${danger ? 'text-red-500 hover:text-red-600' : 'text-text-primary'}
    `}
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon size={18} />}
      <span className="font-medium text-sm">{label}</span>
    </div>
    <FiChevronRight className="opacity-50" />
  </button>
);
