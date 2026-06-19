import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, CommitInfo, RewritePlan, StagedOperation } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Search, ChevronRight, Pencil, X, Loader2, Plus, Eye, AlertTriangle } from 'lucide-react';
import { TextInput, Avatar, Badge, PageTitle, Button } from '../components/atoms';
import { EmptyState } from '../components/molecules';

function parseUnixTimestamp(raw: string): number {
  const parts = raw.split(' ');
  return parseInt(parts[0], 10);
}

function parseTimezoneOffset(raw: string): number {
  const parts = raw.split(' ');
  const off = parts[1] || '+0000';
  return parseTzOffset(off);
}

function parseTzOffset(tz: string): number {
  const sign = tz.startsWith('-') ? -1 : 1;
  const digits = tz.replace(/^[+-]/, '');
  return sign * ((parseInt(digits.slice(0, 2), 10) || 0) * 3600 + (parseInt(digits.slice(2, 4), 10) || 0) * 60);
}

function extractTz(raw: string): string {
  const parts = raw.split(' ');
  return parts[1] || '+0000';
}

function displayInTimezone(secs: number, tzOffsetSecs: number) {
  const d = new Date((secs + tzOffsetSecs) * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

function formatDate(raw: string): string {
  const secs = parseUnixTimestamp(raw);
  if (isNaN(secs)) return raw;
  const tzOffset = parseTimezoneOffset(raw);
  const d = new Date((secs + tzOffset) * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function parseDateFields(raw: string): { date: string; time: string; tz: string } {
  const secs = parseUnixTimestamp(raw);
  if (isNaN(secs)) return { date: '', time: '', tz: '+0000' };
  const tz = extractTz(raw);
  const tzOffset = parseTimezoneOffset(raw);
  const { date, time } = displayInTimezone(secs, tzOffset);
  return { date, time, tz };
}

function rawToUtcSecs(raw: string): number {
  return parseUnixTimestamp(raw);
}

function normalizeTz(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^[+-]\d{4}$/.test(s)) return s;
  if (/^[+-]\d{2}:\d{2}$/.test(s)) return s.slice(0, 3) + s.slice(4);
  if (/^\d{4}$/.test(s)) return `+${s}`;
  const m = s.match(/^([+-])?(\d{1,2})(?::(\d{2}))?$/);
  if (m) {
    const sign = m[1] || '+';
    const h = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3], 10) : 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${sign}${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}`;
    }
  }
  return null;
}

function combineDateFields(dateStr: string, timeStr: string, tzStr: string, originalRaw: string, origParsed: { date: string; time: string; tz: string }): string {
  if (!dateStr) return originalRaw;
  if (dateStr === origParsed.date && timeStr === origParsed.time && tzStr === origParsed.tz) {
    return originalRaw;
  }
  const norm = normalizeTz(tzStr);
  if (!norm) return originalRaw;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  if (isNaN(utcMs)) return originalRaw;
  const tzSecs = parseTzOffset(norm);
  const secs = Math.floor(utcMs / 1000) - tzSecs;
  return `${secs} ${norm}`;
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
  const [editAuthorTz, setEditAuthorTz] = useState(parseDateFields(commit.author_date).tz);
  const [editCommitterName, setEditCommitterName] = useState(commit.committer_name);
  const [editCommitterEmail, setEditCommitterEmail] = useState(commit.committer_email);
  const [editCommitDate, setEditCommitDate] = useState(parseDateFields(commit.commit_date).date);
  const [editCommitTime, setEditCommitTime] = useState(parseDateFields(commit.commit_date).time);
  const [editCommitTz, setEditCommitTz] = useState(parseDateFields(commit.commit_date).tz);
  const [preview, setPreview] = useState<RewritePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStaged, setIsStaged] = useState(false);
  const [chronoWarning, setChronoWarning] = useState<string | null>(null);
  const [syncCommitter, setSyncCommitter] = useState(true);

  useEffect(() => {
    if (syncCommitter) {
      setEditCommitterName(editAuthorName);
      setEditCommitterEmail(editAuthorEmail);
      setEditCommitDate(editAuthorDate);
      setEditCommitTime(editAuthorTime);
      setEditCommitTz(editAuthorTz);
    }
  }, [syncCommitter, editAuthorName, editAuthorEmail, editAuthorDate, editAuthorTime, editAuthorTz]);

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
    editAuthorTz !== origAuthorDate.tz ||
    editCommitDate !== origCommitDate.date ||
    editCommitTime !== origCommitDate.time ||
    editCommitTz !== origCommitDate.tz;

  const chronoCheck = (): string | null => {
    const newRaw = combineDateFields(editAuthorDate, editAuthorTime, editAuthorTz, commit.author_date, origAuthorDate);
    const newSecs = rawToUtcSecs(newRaw);
    if (commit.parent_shas.length === 0) return null;
    const scanResult = useRepositoryStore.getState().scanResult;
    if (!scanResult) return null;
    for (const parentSha of commit.parent_shas) {
      const parent = scanResult.commits.find((c) => c.sha === parentSha);
      if (parent) {
        const parentSecs = rawToUtcSecs(parent.author_date);
        if (parentSecs > newSecs) {
          return `Parent commit ${parentSha.slice(0, 8)} has a later date than this commit.`;
        }
      }
    }
    return null;
  };

  const resetEdit = () => {
    setEditMessage(commit.message);
    setEditAuthorName(commit.author_name);
    setEditAuthorEmail(commit.author_email);
    const ad = parseDateFields(commit.author_date);
    setEditAuthorDate(ad.date);
    setEditAuthorTime(ad.time);
    setEditAuthorTz(ad.tz);
    setEditCommitterName(commit.committer_name);
    setEditCommitterEmail(commit.committer_email);
    const cd = parseDateFields(commit.commit_date);
    setEditCommitDate(cd.date);
    setEditCommitTime(cd.time);
    setEditCommitTz(cd.tz);
    setPreview(null);
    setChronoWarning(null);
    setSyncCommitter(true);
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
        CommitAuthor: {
          target_sha: commit.sha,
          new_author_name: editAuthorName,
          new_author_email: editAuthorEmail,
          new_committer_name: editCommitterName,
          new_committer_email: editCommitterEmail,
        },
      });
    }

    if (editAuthorDate !== origAuthorDate.date || editAuthorTime !== origAuthorDate.time || editAuthorTz !== origAuthorDate.tz ||
        editCommitDate !== origCommitDate.date || editCommitTime !== origCommitDate.time || editCommitTz !== origCommitDate.tz) {
      const warn = chronoCheck();
      setChronoWarning(warn);
      if (warn) addToast(warn, 'info');
      const newAuthorDate = combineDateFields(editAuthorDate, editAuthorTime, editAuthorTz, commit.author_date, origAuthorDate);
      const newCommitDate = combineDateFields(editCommitDate, editCommitTime, editCommitTz, commit.commit_date, origCommitDate);
      operations.push({
        AuthorDate: {
          target_sha: commit.sha,
          new_author_date: newAuthorDate,
          new_commit_date: newCommitDate,
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
    const newAuthorDate = combineDateFields(editAuthorDate, editAuthorTime, editAuthorTz, commit.author_date, origAuthorDate);
    if (newAuthorDate !== commit.author_date) {
      details.push({ field: 'Author date', before: formatDate(commit.author_date), after: `${editAuthorDate} ${editAuthorTime} ${editAuthorTz}` });
    }
    const newCommitDate = combineDateFields(editCommitDate, editCommitTime, editCommitTz, commit.commit_date, origCommitDate);
    if (newCommitDate !== commit.commit_date) {
      details.push({ field: 'Commit date', before: formatDate(commit.commit_date), after: `${editCommitDate} ${editCommitTime} ${editCommitTz}` });
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
              <div className="w-24">
                <p className="text-xs text-neutral-600 mb-1">Time</p>
                <input
                  type="text"
                  value={editAuthorTime}
                  onChange={(e) => setEditAuthorTime(e.target.value)}
                  placeholder="HH:MM"
                  className={inputCls}
                />
              </div>
              <div className="w-20">
                <p className="text-xs text-neutral-600 mb-1">TZ</p>
                <input
                  type="text"
                  value={editAuthorTz}
                  onChange={(e) => setEditAuthorTz(e.target.value)}
                  placeholder="±HHMM"
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
        <>
          <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncCommitter}
              onChange={(e) => setSyncCommitter(e.target.checked)}
              className="accent-neutral-400"
            />
            Sync committer with author
          </label>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500 mb-2">Committer Date</p>
              {syncCommitter && <span className="text-[10px] text-neutral-600">synced</span>}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={editCommitDate}
                  onChange={(e) => setEditCommitDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                  disabled={syncCommitter}
                />
              </div>
              <div className="w-24">
                <input
                  type="text"
                  value={editCommitTime}
                  onChange={(e) => setEditCommitTime(e.target.value)}
                  placeholder="HH:MM"
                  className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                  disabled={syncCommitter}
                />
              </div>
              <div className="w-20">
                <input
                  type="text"
                  value={editCommitTz}
                  onChange={(e) => setEditCommitTz(e.target.value)}
                  placeholder="±HHMM"
                  className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                  disabled={syncCommitter}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-neutral-500 mb-2">Committer Identity</p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editCommitterName}
                onChange={(e) => setEditCommitterName(e.target.value)}
                placeholder="Committer name"
                className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                disabled={syncCommitter}
              />
              <input
                type="text"
                value={editCommitterEmail}
                onChange={(e) => setEditCommitterEmail(e.target.value)}
                placeholder="Committer email"
                className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                disabled={syncCommitter}
              />
            </div>
          </div>
        </>
      )}

      {!isEditing && commit.committer_name !== commit.author_name && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">Committer</p>
          <div className="flex items-center gap-2">
            <Avatar name={commit.committer_name} size="sm" />
            <div>
              <p className="text-sm text-white">{commit.committer_name}</p>
              <p className="text-xs text-neutral-500 font-mono">{commit.committer_email}</p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 mt-1">{formatDate(commit.commit_date)}</p>
        </div>
      )}

      {chronoWarning && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-md p-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{chronoWarning}</span>
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
