import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FiGlobe, FiCheck } from 'react-icons/fi';

// Tambahkan props agar komponen ini fleksibel
interface LanguageSwitcherProps {
  isAbsolute?: boolean;
}

// Daftar bahasa ditaruh di array agar gampang ditambah/dikurangi nantinya
const LANGUAGES = [
  { code: 'en', short: 'EN', label: '🇺🇸 English' },
  { code: 'id', short: 'ID', label: '🇮🇩 Indonesia' },
  { code: 'es', short: 'ES', label: '🇪🇸 Español' },
  { code: 'pt-BR', short: 'PT', label: '🇧🇷 Português Brazil' },
];

export default function LanguageSwitcher({ isAbsolute = true }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // Logic untuk menentukan class berdasarkan posisi
  const containerClass = isAbsolute 
    ? "absolute top-4 right-4 z-50" 
    : "relative z-50";

  return (
    <div className={containerClass}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="inline-flex items-center justify-center rounded-xl bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all" style={{ boxShadow: 'var(--shadow-neu-icon)' }}>
            <FiGlobe className="w-4 h-4 mr-2 text-accent" />
            {currentLang?.short ?? ''}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[140px] bg-bg-surface rounded-xl p-1 z-[100] animate-in fade-in zoom-in-95 duration-200"
            style={{ boxShadow: 'var(--shadow-neu-flat)' }}
            sideOffset={5}
            align="end"
          >
            {LANGUAGES.map((lang) => {
              const isActive = i18n.language === lang.code;
              return (
                <DropdownMenu.Item
                  key={lang.code}
                  className={`group flex items-center px-2 py-2 text-sm rounded-md outline-none cursor-pointer transition-colors ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  onClick={() => changeLanguage(lang.code)}
                >
                  <span className="flex-1">{lang.label}</span>
                  {isActive && <FiCheck className="ml-2 w-4 h-4 text-accent" />}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}