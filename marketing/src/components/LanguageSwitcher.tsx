// marketing/src/components/LanguageSwitcher.tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FiGlobe, FiCheck } from 'react-icons/fi';

interface LanguageSwitcherProps {
  isAbsolute?: boolean;
  currentLangCode?: string; // 👈 Astro akan mengirim data ini!
}

const LANGUAGES = [
  { code: 'en', short: 'EN', label: '🇺🇸 English' },
  { code: 'id', short: 'ID', label: '🇮🇩 Indonesia' },
  { code: 'es', short: 'ES', label: '🇪🇸 Español' },
  { code: 'pt-BR', short: 'PT', label: '🇧🇷 Português' },
];

export default function LanguageSwitcher({ isAbsolute = true, currentLangCode = 'en' }: LanguageSwitcherProps) {

  const changeLanguage = (lng: string) => {
    const currentPath = window.location.pathname;
    
    // Hapus kode bahasa lama dari URL jika ada
    let newPath = currentPath.replace(/^\/(id|es|pt-BR)(\/|$)/, '/');
    
    // Pasang kode bahasa baru
    if (lng !== 'en') {
      newPath = `/${lng}${newPath === '/' ? '' : newPath}`;
    }
    
    window.location.assign(newPath || '/');
  };

  // Cari bahasa berdasarkan properti dari Astro
  const currentLang = LANGUAGES.find(l => l.code === currentLangCode) || LANGUAGES[0];
  
  const containerClass = isAbsolute ? "absolute top-4 right-4 z-50" : "relative z-50";

  return (
    <div className={containerClass}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-bg-surface text-text-primary transition-all font-bold text-sm cursor-pointer focus:outline-none" style={{ boxShadow: 'var(--shadow-neu-icon)' }}>
            <FiGlobe className="text-accent" />
            <span>{currentLang.short}</span>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-[100] min-w-[150px] bg-bg-surface rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-200 mt-2"
            style={{ boxShadow: 'var(--shadow-neu-flat)' }}
            align="end"
          >
            {LANGUAGES.map((l) => (
              <DropdownMenu.Item 
                key={l.code}
                onClick={() => changeLanguage(l.code)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
              >
                <span className={`font-medium ${currentLang.code === l.code ? 'text-accent' : 'text-text-primary group-hover:text-accent'}`}>
                  {l.label}
                </span>
                {currentLang.code === l.code && <FiCheck className="text-accent" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}