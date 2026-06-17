import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, CommitInfo, RewritePlan, StagedOperation } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Search, ChevronRight, Pencil, X, Loader2, Plus, Eye } from 'lucide-react';
import { TextInput, Avatar, Badge, PageTitle, Button } from '../components/atoms';
import { EmptyState } from '../components/molecules';

function parseUnixTimestamp(raw: string): number {
  const parts = raw.split(' ');
  return parseInt(parts[0], 10);
}

function formatDate(raw: string): string {
  const secs = parseUnixTimestamp(raw);
  if (isNaN(secs)) return raw;
  return new Date(secs * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function parseDateFields(raw: string): { date: string; time: string } {
  const secs = parseUnixTimestamp(raw);
  if (isNaN(secs)) return { date: '', time: '' };
  const d = new Date(secs * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineDateFields(dateStr: string, timeStr: string, originalRaw: string): string {
  if (!dateStr) return originalRaw;
  const d = new Date(`${dateStr}T${timeStr || '00:00'}`);
  if (isNaN(d.getTime())) return originalRaw;
  const secs = Math.floor(d.getTime() / 1000);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const mins = absOffset % 60;
  const tz = `${sign}${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
  return `${secs} ${tz}`;
}

interface CommitPanelProps {
  commit: CommitInfo;
  repoPath: string;
  onClose: () => void;
}

const inputCls = "w-full bg-neutral-900 border border-neutral-800 rounded-md p-2 text-sm text-white focus:outline-none focus:border-neutral-600 transition-colors";

function CommitPanel({ commit, repoPath, onClose }: CommitPanelProps) {
  const navigate = useNavigate();
  const { addToast } = useNotificationStore();
  const { stageOp } = useRepositoryStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(commit.message);
  const [editAuthorName, setEditAuthorName] = useState(commit.author_name);
  const [editAuthorEmail, setEditAuthorEmail] = useState(commit.author_email);
  const [editAuthorDate, setEditAuthorDate] = useState(parseDateFields(commit.author_date).date);
  const [editAuthorTime, setEditAuthorTime] = useState(parseDateFields(commit.author_date).time);
  const [editCommitterName, setEditCommitterName] = useState(commit.committer_name);
  const [editCommitterEmail, setEditCommitterEmail] = useState(commit.committer_email);
  const [editCommitDate, setEditCommitDate] = useState(parseDateFields(commit.commit_date).date);
  const [editCommitTime, setEditCommitTime] = useState(parseDateFields(commit.commit_date).time);
  const [preview, setPreview] = useState<RewritePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStaged, setIsStaged] = useState(false);

  const origAuthorDate = parseDateFields(commit.author_date);
  const origCommitDate = parseDateFields(commit.commit_date);

  const hasChanges =
    editMessage !== commit.message ||
    editAuthorName !== commit.author_name ||
    editAuthorEmail !== commit.author_email ||
    editCommitterName !== commit.committer_name ||
    editCommitterEmail !== commit.committer_email ||
    editAuthorDate !== origAuthorDate.date ||
    editAuthorTime !== origAuthorDate.time ||
    editCommitDate !== origCommitDate.date ||
    editCommitTime !== origCommitDate.time;

  const resetEdit = () => {
    setEditMessage(commit.message);
    setEditAuthorName(commit.author_name);
    setEditAuthorEmail(commit.author_email);
    const ad = parseDateFields(commit.author_date);
    setEditAuthorDate(ad.date);
    setEditAuthorTime(ad.time);
    setEditCommitterName(commit.committer_name);
    setEditCommitterEmail(commit.committer_email);
    const cd = parseDateFields(commit.commit_date);
    setEditCommitDate(cd.date);
    setEditCommitTime(cd.time);
    setPreview(null);
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
      const rewriteCommitter = editCommitterName !== commit.committer_name || editCommitterEmail !== commit.committer_email;
      if (editAuthorName !== commit.author_name || editAuthorEmail !== commit.author_email) {
        operations.push({
          Identity: {
            old_name: commit.author_name,
            old_email: commit.author_email,
            new_name: editAuthorName,
            new_email: editAuthorEmail,
            rewrite_committer: rewriteCommitter,
          },
        });
      } else if (rewriteCommitter) {
        operations.push({
          Identity: {
            old_name: commit.committer_name,
            old_email: commit.committer_email,
            new_name: editCommitterName,
            new_email: editCommitterEmail,
            rewrite_committer: true,
          },
        });
      }
    }

    if (editAuthorDate !== origAuthorDate.date || editAuthorTime !== origAuthorDate.time ||
        editCommitDate !== origCommitDate.date || editCommitTime !== origCommitDate.time) {
      operations.push({
        AuthorDate: {
          target_sha: commit.sha,
          new_author_date: combineDateFields(editAuthorDate, editAuthorTime, commit.author_date),
          new_commit_date: combineDateFields(editCommitDate, editCommitTime, commit.commit_date),
        },
      });
    }

    return operations;
  };

  const buildDetails = () => {
    const details: { field: string; before: string; after: string }[] = [];
    if (editMessage !== commit.message) {
      details.push({ field: 'Message', before: commit.message, after: editMessage });
    }
    if (editAuthorName !== commit.author_name) {
      details.push({ field: 'Author name', before: commit.author_name, after: editAuthorName });
    }
    if (editAuthorEmail !== commit.author_email) {
      details.push({ field: 'Author email', before: commit.author_email, after: editAuthorEmail });
    }
    if (editCommitterName !== commit.committer_name) {
      details.push({ field: 'Committer name', before: commit.committer_name, after: editCommitterName });
    }
    if (editCommitterEmail !== commit.committer_email) {
      details.push({ field: 'Committer email', before: commit.committer_email, after: editCommitterEmail });
    }
    const newAuthorDate = combineDateFields(editAuthorDate, editAuthorTime, commit.author_date);
    if (newAuthorDate !== commit.author_date) {
      details.push({ field: 'Author date', before: formatDate(commit.author_date), after: editAuthorDate });
    }
    const newCommitDate = combineDateFields(editCommitDate, editCommitTime, commit.commit_date);
    if (newCommitDate !== commit.commit_date) {
      details.push({ field: 'Commit date', before: formatDate(commit.commit_date), after: editCommitDate });
    }
    return details;
  };

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const operations = buildOperations();
      if (operations.length === 0) {
        addToast('No changes to preview', 'info');
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
      setIsLoading(false);
    }
  };

  const handleStage = () => {
    const operations = buildOperations();
    if (operations.length === 0) {
      addToast('No changes to stage', 'info');
      return;
    }
    const op: StagedOperation = {
      id: `${commit.sha}-${Date.now()}`,
      summary: commit.message.slice(0, 60),
      oldSha: commit.sha,
      details: buildDetails(),
      operations,
    };
    stageOp(op);
    setIsStaged(true);
    addToast('Changes staged. Review & apply from Preview.', 'success');
  };

  return (
    <aside className="w-80 border-l border-neutral-900 bg-neutral-950 p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">Commit Details</span>
        <div className="flex items-center gap-2">
          {!isEditing && !isStaged && (
            <button onClick={() => setIsEditing(true)} className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1">
              <Pencil size={12} /> Edit
            </button>
          )}
          <button onClick={onClose} className="text-xs text-neutral-600 hover:text-white transition-colors">Close</button>
        </div>
      </div>

      {isStaged && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-md p-3">
          <p className="text-xs text-emerald-400 font-medium">Staged ✓</p>
          <p className="text-xs text-neutral-500 mt-1">Go to <button onClick={() => navigate('/preview')} className="text-emerald-400 hover:underline">Preview</button> to apply.</p>
        </div>
      )}

      {!isStaged && preview && (
        <div className="border border-neutral-800 rounded-md p-3 bg-neutral-900/50">
          <p className="text-xs font-medium text-neutral-300 mb-1">Rewrite Preview</p>
          <p className="text-xs text-neutral-500 mb-2">{preview.total_affected} commit(s) will change</p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleStage} disabled={isLoading}>
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Stage
            </Button>
            <Button size="sm" variant="ghost" onClick={resetEdit}>
              <X size={12} /> Cancel
            </Button>
          </div>
        </div>
      )}

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
            className={inputCls}
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
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-neutral-600 mb-1">Date</p>
                <input
                  type="text"
                  value={editAuthorDate}
                  onChange={(e) => setEditAuthorDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className={inputCls}
                />
              </div>
              <div className="w-28">
                <p className="text-xs text-neutral-600 mb-1">Time</p>
                <input
                  type="text"
                  value={editAuthorTime}
                  onChange={(e) => setEditAuthorTime(e.target.value)}
                  placeholder="HH:MM"
                  className={inputCls}
                />
              </div>
            </div>
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

      {isEditing && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">Committer Date</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={editCommitDate}
                onChange={(e) => setEditCommitDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className={inputCls}
              />
            </div>
            <div className="w-28">
              <input
                type="text"
                value={editCommitTime}
                onChange={(e) => setEditCommitTime(e.target.value)}
                placeholder="HH:MM"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      )}

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

      {isEditing && !isStaged && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="primary" onClick={handlePreview} disabled={isLoading || !hasChanges}>
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            Preview
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
  const { currentRepo, stagedOps, scanResult } = useRepositoryStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CommitInfo | null>(null);
  const [page, setPage] = useState(0);

  const navigate = useNavigate();

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

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden p-8">
        <div className="flex items-center justify-between mb-4">
          <PageTitle>{t('nav.explorer')}</PageTitle>
          {stagedOps.length > 0 && (
            <Button size="sm" variant="primary" onClick={() => navigate('/preview')}>
              Review {stagedOps.length} staged change{stagedOps.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>

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

      {selected && (
        <CommitPanel
          commit={selected}
          repoPath={currentRepo?.path ?? ''}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
