import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, CommitInfo, RewritePlan, ApplyResult } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Search, ChevronRight, Pencil, X, RotateCcw, Check, Loader2 } from 'lucide-react';
import { TextInput, Avatar, Badge, PageTitle, Button } from '../components/atoms';
import { EmptyState, ConfirmDialog } from '../components/molecules';

function formatDate(raw: string): string {
  const seconds = parseInt(raw, 10);
  if (isNaN(seconds)) return raw;
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

interface CommitPanelProps {
  commit: CommitInfo;
  repoPath: string;
  onClose: () => void;
  onApplied: (backupRef: string) => void;
}

function CommitPanel({ commit, repoPath, onClose, onApplied }: CommitPanelProps) {
  const { addToast } = useNotificationStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(commit.message);
  const [editAuthorName, setEditAuthorName] = useState(commit.author_name);
  const [editAuthorEmail, setEditAuthorEmail] = useState(commit.author_email);
  const [editCommitterName, setEditCommitterName] = useState(commit.committer_name);
  const [editCommitterEmail, setEditCommitterEmail] = useState(commit.committer_email);
  const [preview, setPreview] = useState<RewritePlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const hasChanges =
    editMessage !== commit.message ||
    editAuthorName !== commit.author_name ||
    editAuthorEmail !== commit.author_email ||
    editCommitterName !== commit.committer_name ||
    editCommitterEmail !== commit.committer_email;

  const resetEdit = () => {
    setEditMessage(commit.message);
    setEditAuthorName(commit.author_name);
    setEditAuthorEmail(commit.author_email);
    setEditCommitterName(commit.committer_name);
    setEditCommitterEmail(commit.committer_email);
    setPreview(null);
    setShowConfirm(false);
    setIsEditing(false);
  };

  const buildOperations = () => {
    const operations: any[] = [];

    if (editMessage !== commit.message) {
      operations.push({ Message: { target_sha: commit.sha, new_message: editMessage } });
    }

    if (
      editAuthorName !== commit.author_name ||
      editAuthorEmail !== commit.author_email ||
      editCommitterName !== commit.committer_name ||
      editCommitterEmail !== commit.committer_email
    ) {
      operations.push({
        Identity: {
          old_name: commit.author_name,
          old_email: commit.author_email,
          new_name: editAuthorName,
          new_email: editAuthorEmail,
          rewrite_committer: editCommitterName !== commit.committer_name || editCommitterEmail !== commit.committer_email,
        },
      });
    }

    return operations;
  };

  const handlePreview = async () => {
    setIsSaving(true);
    try {
      const operations = buildOperations();
      if (operations.length === 0) {
        addToast('No changes to apply', 'info');
        return;
      }
      const result = await invoke<RewritePlan>('preview_rewrite', {
        path: repoPath,
        operations,
      });
      setPreview(result);
    } catch (e) {
      addToast(`Preview failed: ${String(e)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async () => {
    setShowConfirm(false);
    setIsSaving(true);
    try {
      const operations = buildOperations();
      const result = await invoke<ApplyResult>('apply_rewrite', {
        path: repoPath,
        operations,
      });
      const newSha = result.rewrites.find((r) => r.is_modified)?.new_sha ?? result.rewrites[0]?.new_sha;
      addToast(`Commit rewritten: ${commit.sha.slice(0, 8)} → ${newSha?.slice(0, 8) ?? '?'}`, 'success');
      onApplied(result.backup_ref);
      resetEdit();
    } catch (e) {
      addToast(`Rewrite failed: ${String(e)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="w-80 border-l border-neutral-900 bg-neutral-950 p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">Commit Details</span>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1">
              <Pencil size={12} /> Edit
            </button>
          )}
          <button onClick={onClose} className="text-xs text-neutral-600 hover:text-white transition-colors">Close</button>
        </div>
      </div>

      {preview && (
        <div className="border border-neutral-800 rounded-md p-3 bg-neutral-900/50">
          <p className="text-xs font-medium text-neutral-300 mb-1">Rewrite Preview</p>
          <p className="text-xs text-neutral-500 mb-2">{preview.total_affected} commit(s) will change</p>
          {preview.backup_ref && (
            <p className="text-xs text-neutral-600 mb-2">
              Backup: <span className="font-mono text-neutral-500">{preview.backup_ref}</span>
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => setShowConfirm(true)} disabled={isSaving}>
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={resetEdit}>Cancel</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Apply Commit Rewrite"
        description={`This will rewrite commit ${commit.sha.slice(0, 12)} with your changes. A backup ref will be saved.`}
        confirmLabel="Apply"
        destructive
        loading={isSaving}
        onConfirm={handleApply}
        onCancel={() => setShowConfirm(false)}
      >
        {preview?.backup_ref && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 text-xs">
            <span className="text-neutral-500">Backup ref: </span>
            <span className="text-neutral-300 font-mono">{preview.backup_ref}</span>
          </div>
        )}
      </ConfirmDialog>

      <div>
        <p className="text-xs text-neutral-500 mb-1">SHA</p>
        <Badge variant="mono">{commit.sha.slice(0, 12)}</Badge>
      </div>

      <div>
        <p className="text-xs text-neutral-500 mb-1">Message</p>
        {isEditing ? (
          <textarea
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md p-2 text-sm text-white resize-none focus:outline-none focus:border-neutral-600 transition-colors"
            rows={3}
          />
        ) : (
          <p className="text-sm text-white leading-relaxed">{commit.message}</p>
        )}
      </div>

      <div>
        <p className="text-xs text-neutral-500 mb-2">Author</p>
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <TextInput value={editAuthorName} onChange={(e) => setEditAuthorName(e.target.value)} placeholder="Author name" />
            <TextInput value={editAuthorEmail} onChange={(e) => setEditAuthorEmail(e.target.value)} placeholder="Author email" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Avatar name={commit.author_name} size="sm" />
              <div>
                <p className="text-sm text-white">{commit.author_name}</p>
                <p className="text-xs text-neutral-500 font-mono">{commit.author_email}</p>
              </div>
            </div>
            <p className="text-xs text-neutral-600 mt-1">{formatDate(commit.author_date)}</p>
          </>
        )}
      </div>

      {commit.committer_name !== commit.author_name && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">Committer</p>
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <TextInput value={editCommitterName} onChange={(e) => setEditCommitterName(e.target.value)} placeholder="Committer name" />
              <TextInput value={editCommitterEmail} onChange={(e) => setEditCommitterEmail(e.target.value)} placeholder="Committer email" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Avatar name={commit.committer_name} size="sm" />
                <div>
                  <p className="text-sm text-white">{commit.committer_name}</p>
                  <p className="text-xs text-neutral-500 font-mono">{commit.committer_email}</p>
                </div>
              </div>
              <p className="text-xs text-neutral-600 mt-1">{formatDate(commit.commit_date)}</p>
            </>
          )}
        </div>
      )}

      {isEditing && !preview && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="primary" onClick={handlePreview} disabled={isSaving || !hasChanges}>
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
            Preview Changes
          </Button>
          <Button size="sm" variant="ghost" onClick={resetEdit}>
            <X size={12} /> Cancel
          </Button>
        </div>
      )}

      {commit.parent_shas.length > 0 && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">Parents ({commit.parent_shas.length})</p>
          <div className="flex flex-col gap-1">
            {commit.parent_shas.map((sha) => (
              <Badge key={sha} variant="mono">{sha.slice(0, 12)}</Badge>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function CommitRow({ commit, isSelected, onClick }: { commit: CommitInfo; isSelected: boolean; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-neutral-900 cursor-pointer transition-colors ${
        isSelected ? 'bg-neutral-900' : 'hover:bg-neutral-900/40'
      }`}
    >
      <td className="py-3 px-4">
        <Badge variant="mono">{commit.sha.slice(0, 8)}</Badge>
      </td>
      <td className="py-3 px-4 max-w-xs">
        <p className="text-sm text-neutral-200 truncate">{commit.message}</p>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Avatar name={commit.author_name} size="sm" />
          <span className="text-xs text-neutral-400">{commit.author_name}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-neutral-500 whitespace-nowrap">
        {formatDate(commit.author_date)}
      </td>
      <td className="py-3 px-4">
        <ChevronRight size={14} className="text-neutral-600" />
      </td>
    </tr>
  );
}

const PAGE_SIZE = 50;

export function CommitExplorerPage() {
  const { t } = useTranslation();
  const { currentRepo, scanResult, setScanResult } = useRepositoryStore();
  const { addToast } = useNotificationStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CommitInfo | null>(null);
  const [page, setPage] = useState(0);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [recentRewrites, setRecentRewrites] = useState<{ backupRef: string; timestamp: number; sha: string }[]>([]);

  const filtered = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.commits.filter(
      (c) =>
        c.message.toLowerCase().includes(search.toLowerCase()) ||
        c.sha.toLowerCase().startsWith(search.toLowerCase()) ||
        c.author_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [scanResult, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSearch = (val: string) => { setSearch(val); setPage(0); };

  const handleApplied = async (backupRef: string) => {
    setRecentRewrites((prev) => [
      { backupRef, timestamp: Date.now(), sha: selected?.sha ?? '' },
      ...prev,
    ]);
    addToast('Commit rewritten. You can rollback using the "Recent Rewrites" section.', 'success');
    setSelected(null);

    if (currentRepo) {
      try {
        const freshScan = await invoke<any>('scan_repository', { path: currentRepo.path });
        setScanResult(freshScan);
      } catch (e) {
        addToast(`Rescan failed: ${String(e)}`, 'error');
      }
    }
  };

  const handleRollback = async () => {
    if (!currentRepo || !rollbackTarget) return;
    setIsRollingBack(true);
    try {
      await invoke('rollback_rewrite', {
        path: currentRepo.path,
        backupRef: rollbackTarget,
      });
      addToast('Rollback successful. Branches restored from backup.', 'success');
      setRecentRewrites((prev) => prev.filter((r) => r.backupRef !== rollbackTarget));
      setRollbackTarget(null);

      const freshScan = await invoke<any>('scan_repository', { path: currentRepo.path });
      setScanResult(freshScan);
    } catch (e) {
      addToast(`Rollback failed: ${String(e)}`, 'error');
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleClear = async (backupRef: string) => {
    if (!currentRepo) return;
    try {
      await invoke('clear_backups', { path: currentRepo.path, backupPrefix: backupRef });
      addToast('Backup cleaned up. Rewrite persisted.', 'success');
      setRecentRewrites((prev) => prev.filter((r) => r.backupRef !== backupRef));
    } catch (e) {
      addToast(`Failed to clear backups: ${String(e)}`, 'error');
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden p-8">
        <PageTitle>{t('nav.explorer')}</PageTitle>

        {!scanResult ? (
          <EmptyState title="No repository open." description="Open a repository from the Dashboard first." />
        ) : (
          <>
            <div className="mb-4 max-w-sm">
              <TextInput
                icon={<Search size={16} />}
                placeholder="Search by SHA, message or author…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {recentRewrites.length > 0 && (
              <div className="mb-4 border border-amber-500/30 bg-amber-500/5 rounded-lg px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-amber-300">
                    <RotateCcw size={12} />
                    <span className="font-medium">Backup available</span>
                  </div>
                  <button
                    onClick={() => handleClear(recentRewrites[0].backupRef)}
                    className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Check size={12} /> Keep
                  </button>
                  <button
                    onClick={() => setRollbackTarget(recentRewrites[0].backupRef)}
                    className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors"
                  >
                    Rollback
                  </button>
                </div>
                <div className="mt-1 text-xs text-neutral-500 font-mono">
                  {recentRewrites.length} recent rewrite(s) — {recentRewrites[0].backupRef}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-lg border border-neutral-900">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-800 sticky top-0 bg-neutral-950">
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">SHA</th>
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">Message</th>
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">Author</th>
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">Date</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm text-neutral-600">
                        No commits match your search.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((c) => (
                      <CommitRow
                        key={c.sha}
                        commit={c}
                        isSelected={selected?.sha === c.sha}
                        onClick={() => setSelected(selected?.sha === c.sha ? null : c)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs text-neutral-600">
              <span>{filtered.length} commits</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="hover:text-white disabled:opacity-30 transition-colors">← Prev</button>
                  <span>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="hover:text-white disabled:opacity-30 transition-colors">Next →</button>
                </div>
              )}
            </div>

          </>
        )}
      </div>

      <ConfirmDialog
        open={rollbackTarget !== null}
        title="Rollback Rewrite"
        description="This will restore branches to their state before the commit rewrite. Current changes will be lost."
        confirmLabel="Rollback"
        destructive
        loading={isRollingBack}
        onConfirm={handleRollback}
        onCancel={() => setRollbackTarget(null)}
      >
        {rollbackTarget && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 text-xs">
            <span className="text-neutral-500">Restoring from: </span>
            <span className="text-neutral-300 font-mono">{rollbackTarget}</span>
          </div>
        )}
      </ConfirmDialog>

      {selected && (
        <CommitPanel
          commit={selected}
          repoPath={currentRepo?.path ?? ''}
          onClose={() => setSelected(null)}
          onApplied={handleApplied}
        />
      )}
    </div>
  );
}
