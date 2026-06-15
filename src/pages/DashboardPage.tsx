import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';

export function DashboardPage() {
  const { t } = useTranslation();
  const { addToast } = useNotificationStore();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-light text-white mb-6">{t('nav.dashboard')}</h2>
      
      <button 
        onClick={() => addToast('Repository loaded successfully', 'success')}
        className="bg-neutral-900 border border-neutral-800 text-white font-medium rounded-md px-4 py-2 text-sm hover:bg-neutral-800 transition-colors"
      >
        Test Notification
      </button>
    </div>
  );
}
