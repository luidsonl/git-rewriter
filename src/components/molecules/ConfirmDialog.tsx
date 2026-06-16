import { ReactNode, useEffect } from 'react';
import { Button } from '../atoms';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-neutral-950 border border-neutral-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
        <p className="text-sm text-neutral-400 mb-4">{description}</p>

        {children && <div className="mb-4">{children}</div>}

        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              destructive
                ? 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50'
                : 'bg-white text-black hover:bg-neutral-200 disabled:opacity-50'
            }`}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
