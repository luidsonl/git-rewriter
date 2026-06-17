import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, BackupInfo } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { RotateCcw, RefreshCw, Clock, GitBranch, Loader2, Check } from 'lucide-react';
import { Button, PageTitle } from '../components/atoms';
import { EmptyState, ConfirmDialog } from '../components/molecules';

function formatTimestamp(ts: string): string {
  const secs = parseInt(ts, 10);
  if (isNaN(secs)) return ts;
  return new Date(secs * 1000).toLocaleString();
}

function BackupCard({
  backup,
  onRollback,
  onClear,
  disabled,
}: {
  backup: BackupInfo;
  onRollback: () => void;
  onClear: () => void;
  disabled: boolean;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <Clock size={14} />
          {formatTimestamp(backup.timestamp)}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onClear} disabled={disabled}>
            <Check size={12} /> Keep
          </Button>
          <Button size="sm" variant="ghost" onClick={onRollback} disabled={disabled}>
            <RotateCcw size={12} /> Rollback
          </Button>
        </div>
      </div>
      <div className="text-xs text-neutral-600 font-mono mb-2">{backup.prefix}</div>
      <div className="space-y-1">
        {backup.branches.map((b) => (
          <div key={b.name} className="flex items-center gap-2 text-xs text-neutral-400">
            <GitBranch size={12} />
            <span className="text-neutral-300">{b.name}</span>
            <span className="font-mono text-neutral-600">{b.sha.slice(0, 12)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BackupsPage() {
  const { currentRepo, setScanResult } = useRepositoryStore();
  const { addToast } = useNotificationStore();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ prefix: string; action: 'rollback' | 'clear' } | null>(null);
  const [isActing, setIsActing] = useState(false);

  const fetchBackups = useCallback(async () => {
    if (!currentRepo) return;
    setLoading(true);
    try {
      const result = await invoke<BackupInfo[]>('list_backups', { path: currentRepo.path });
      setBackups(result);
    } catch (e) {
      addToast(`Failed to list backups: ${String(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentRepo, addToast]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleRollback = async () => {
    if (!currentRepo || !actionTarget || actionTarget.action !== 'rollback') return;
    setIsActing(true);
    try {
      await invoke('rollback_rewrite', { path: currentRepo.path, backupRef: actionTarget.prefix });
      addToast('Rollback successful. Branches restored from backup.', 'success');
      setActionTarget(null);
      const freshScan = await invoke<any>('scan_repository', { path: currentRepo.path });
      setScanResult(freshScan);
      fetchBackups();
    } catch (e) {
      addToast(`Rollback failed: ${String(e)}`, 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleClear = async () => {
    if (!currentRepo || !actionTarget || actionTarget.action !== 'clear') return;
    setIsActing(true);
    try {
      await invoke('clear_backups', { path: currentRepo.path, backupPrefix: actionTarget.prefix });
      addToast('Backup cleaned up. Rewrite persisted.', 'success');
      setActionTarget(null);
      fetchBackups();
    } catch (e) {
      addToast(`Failed to clear backups: ${String(e)}`, 'error');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <PageTitle>Backups</PageTitle>
        <Button onClick={fetchBackups} variant="ghost" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Refresh
        </Button>
      </div>

      <ConfirmDialog
        open={actionTarget?.action === 'rollback'}
        title="Rollback Rewrite"
        description="This will restore branches to their state before the rewrite. Current changes will be lost."
        confirmLabel="Rollback"
        destructive
        loading={isActing}
        onConfirm={handleRollback}
        onCancel={() => setActionTarget(null)}
      >
        {actionTarget && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 text-xs">
            <span className="text-neutral-500">Restoring from: </span>
            <span className="text-neutral-300 font-mono">{actionTarget.prefix}</span>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={actionTarget?.action === 'clear'}
        title="Keep Rewrite"
        description="This will remove the backup and permanently persist the rewrite. This cannot be undone."
        confirmLabel="Keep"
        destructive
        loading={isActing}
        onConfirm={handleClear}
        onCancel={() => setActionTarget(null)}
      >
        {actionTarget && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 text-xs">
            <span className="text-neutral-500">Removing: </span>
            <span className="text-neutral-300 font-mono">{actionTarget.prefix}</span>
          </div>
        )}
      </ConfirmDialog>

      {!currentRepo ? (
        <EmptyState
          title="No repository open."
          description="Open a repository from the Dashboard first."
        />
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-12 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading backups...
        </div>
      ) : backups.length === 0 ? (
        <EmptyState
          title="No backups found."
          description="Backups are created automatically when you rewrite history."
        />
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-neutral-500 mb-1">
            {backups.length} backup group(s) found
          </div>
          {backups.map((b) => (
            <BackupCard
              key={b.prefix}
              backup={b}
              disabled={isActing}
              onRollback={() => setActionTarget({ prefix: b.prefix, action: 'rollback' })}
              onClear={() => setActionTarget({ prefix: b.prefix, action: 'clear' })}
            />
          ))}
        </div>
      )}
    </div>
  );
}