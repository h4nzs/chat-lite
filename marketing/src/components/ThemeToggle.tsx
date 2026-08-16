// marketing/src/components/ThemeToggle.tsx
import { useEffect, useState } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('nyx_theme');
      const current = stored === 'dark' || stored === 'light' ? stored : 'light';
      setTheme(current);
      document.documentElement.setAttribute('data-theme', current);
    } catch (e) {
      setTheme('light');
    }
  }, []);

  const toggle = () => {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('nyx_theme', next);
    } catch (e) {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-bg-surface text-text-primary transition-all font-bold text-sm cursor-pointer"
      style={{ boxShadow: 'var(--shadow-neu-icon)' }}
      onMouseDown={(e) => {
        const el = e.currentTarget;
        el.style.boxShadow = 'var(--shadow-neu-icon-pressed)';
      }}
      onMouseUp={(e) => {
        const el = e.currentTarget;
        el.style.boxShadow = 'var(--shadow-neu-icon)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.boxShadow = 'var(--shadow-neu-icon)';
      }}
    >
      {theme === 'light' ? <FiMoon className="text-accent" /> : <FiSun className="text-accent" />}
      <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
