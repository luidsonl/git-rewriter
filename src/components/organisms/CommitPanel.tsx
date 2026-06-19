import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useRepositoryStore, CommitInfo, StagedOperation } from '../../stores/repositoryStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { TextInput, Avatar, Badge, Button } from '../atoms';
import { Pencil, X, AlertTriangle } from 'lucide-react';
import {
  parseDateFields, combineDateFields, rawToUtcSecs, formatDate,
} from '../../utils/date';

const inputCls = "w-full bg-neutral-900 border border-neutral-800 rounded-md p-2 text-sm text-white focus:outline-none focus:border-neutral-600 transition-colors";

interface CommitPanelProps {
  commit: CommitInfo;
  onClose: () => void;
}

export function CommitPanel({ commit, onClose }: CommitPanelProps) {
  const { t } = useTranslation();
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
          return t('error.chrono_warning', { sha: parentSha.slice(0, 8) });
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
      details.push({ field: t('commit.message'), before: commit.message, after: editMessage });
    }
    if (editAuthorName !== commit.author_name) {
      details.push({ field: t('commit.author_name'), before: commit.author_name, after: editAuthorName });
    }
    if (editAuthorEmail !== commit.author_email) {
      details.push({ field: t('commit.author_email'), before: commit.author_email, after: editAuthorEmail });
    }
    if (editCommitterName !== commit.committer_name) {
      details.push({ field: t('commit.committer_name'), before: commit.committer_name, after: editCommitterName });
    }
    if (editCommitterEmail !== commit.committer_email) {
      details.push({ field: t('commit.committer_email'), before: commit.committer_email, after: editCommitterEmail });
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

  const handleStage = () => {
    const operations = buildOperations();
    if (operations.length === 0) {
      addToast(t('commit.no_changes'), 'info');
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
    addToast(t('commit.staged_success'), 'success');
  };

  return (
    <aside className="w-80 border-l border-neutral-900 bg-neutral-950 p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">{t('commit.details')}</span>
        <div className="flex items-center gap-2">
          {!isEditing && !isStaged && (
            <button onClick={() => setIsEditing(true)} className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1">
              <Pencil size={12} /> {t('commit.edit')}
            </button>
          )}
          <button onClick={onClose} className="text-xs text-neutral-600 hover:text-white transition-colors">{t('commit.close')}</button>
        </div>
      </div>

      {isStaged && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-md p-3">
          <p className="text-xs text-emerald-400 font-medium">{t('commit.staged')}</p>
          <p className="text-xs text-neutral-500 mt-1">
            <Trans i18nKey="commit.go_to_preview" components={{ previewLink: <button onClick={() => navigate('/preview')} className="text-emerald-400 hover:underline" /> }} />
          </p>
        </div>
      )}

      <div>
        <p className="text-xs text-neutral-500 mb-1">{t('commit.sha')}</p>
        <Badge variant="mono">{commit.sha.slice(0, 12)}</Badge>
      </div>

      <div>
        <p className="text-xs text-neutral-500 mb-1">{t('commit.message')}</p>
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
        <p className="text-xs text-neutral-500 mb-2">{t('commit.author')}</p>
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <TextInput value={editAuthorName} onChange={(e) => setEditAuthorName(e.target.value)} placeholder={t('commit.author_name')} />
            <TextInput value={editAuthorEmail} onChange={(e) => setEditAuthorEmail(e.target.value)} placeholder={t('commit.author_email')} />
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-neutral-600 mb-1">{t('commit.date')}</p>
                <input
                  type="text"
                  value={editAuthorDate}
                  onChange={(e) => setEditAuthorDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className={inputCls}
                />
              </div>
              <div className="w-24">
                <p className="text-xs text-neutral-600 mb-1">{t('commit.time')}</p>
                <input
                  type="text"
                  value={editAuthorTime}
                  onChange={(e) => setEditAuthorTime(e.target.value)}
                  placeholder="HH:MM"
                  className={inputCls}
                />
              </div>
              <div className="w-20">
                <p className="text-xs text-neutral-600 mb-1">{t('commit.tz')}</p>
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
            {t('commit.sync_committer')}
          </label>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500 mb-2">{t('commit.committer_date')}</p>
              {syncCommitter && <span className="text-[10px] text-neutral-600">{t('commit.synced')}</span>}
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
            <p className="text-xs text-neutral-500 mb-2">{t('commit.committer_identity')}</p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editCommitterName}
                onChange={(e) => setEditCommitterName(e.target.value)}
                placeholder={t('commit.committer_name')}
                className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                disabled={syncCommitter}
              />
              <input
                type="text"
                value={editCommitterEmail}
                onChange={(e) => setEditCommitterEmail(e.target.value)}
                placeholder={t('commit.committer_email')}
                className={`${inputCls} ${syncCommitter ? 'opacity-40' : ''}`}
                disabled={syncCommitter}
              />
            </div>
          </div>
        </>
      )}

      {!isEditing && commit.committer_name !== commit.author_name && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">{t('commit.committer_identity')}</p>
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
          <Button size="sm" variant="primary" onClick={handleStage} disabled={!hasChanges}>
            {t('commit.stage')}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetEdit}>
            <X size={12} /> {t('actions.cancel')}
          </Button>
        </div>
      )}

      {commit.parent_shas.length > 0 && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">{t('commit.parents', { count: commit.parent_shas.length })}</p>
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
