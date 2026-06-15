import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useNotificationStore();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
    addToast('Language updated', 'success');
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
            className="bg-neutral-900 border border-neutral-800 text-white rounded-md px-4 py-2 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
          >
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
        </div>
      </div>
    </div>
  );
}
