import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, GitCommit, Search, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export function Sidebar() {
  const { t } = useTranslation();

  const openSettings = async () => {
    // We will spawn the settings window via Tauri command
    try {
      await invoke('open_settings_window');
    } catch (e) {
      console.error('Failed to open settings:', e);
    }
  };

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: t('nav.dashboard') },
    { to: '/contributors', icon: <Users size={18} />, label: t('nav.contributors') },
    { to: '/explorer', icon: <GitCommit size={18} />, label: t('nav.explorer') },
    { to: '/preview', icon: <Search size={18} />, label: t('nav.preview') },
  ];

  return (
    <aside className="w-64 bg-neutral-950 border-r border-neutral-900 h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-lg font-light tracking-tight text-white">{t('app.title')}</h1>
        <p className="text-xs text-neutral-500 mt-1">{t('app.subtitle')}</p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-900">
        <button
          onClick={openSettings}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
        >
          <Settings size={18} />
          {t('nav.settings')}
        </button>
      </div>
    </aside>
  );
}
