import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';
import { emit } from '@tauri-apps/api/event';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useNotificationStore();

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
    await emit('language-changed', newLang);
    addToast(t('settings.language') + ' updated', 'success');
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-light text-white mb-8">{t('settings.title')}</h2>

      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">
            {t('settings.language')}
          </label>
          <select
            value={i18n.language}
            onChange={handleLanguageChange}
            className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-md px-4 py-2 text-sm appearance-none focus:outline-none focus:border-neutral-600 transition-colors cursor-pointer"
          >
            <option value="en" className="bg-neutral-900 text-white">English</option>
            <option value="pt" className="bg-neutral-900 text-white">Português</option>
          </select>
        </div>
      </div>
    </div>
  );
}
