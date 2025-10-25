import Settings from '../components/Settings';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-text-primary font-sans">
      <header className="p-4 border-b border-gray-800 flex items-center gap-4 flex-shrink-0">
        <Link to="/" className="p-2 -ml-2 text-text-secondary hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </Link>
        <h1 className="text-xl font-bold text-white">Settings</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Settings />
      </main>
    </div>
  );
}