import { useNotificationStore } from '../../stores/notificationStore';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center justify-between p-4 min-w-[300px] bg-neutral-900 border rounded-md shadow-lg text-sm transition-all animate-in slide-in-from-right-5",
            toast.type === 'error' ? "border-red-900/50 text-red-200" : 
            toast.type === 'success' ? "border-green-900/50 text-green-200" : 
            "border-neutral-800 text-neutral-200"
          )}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
