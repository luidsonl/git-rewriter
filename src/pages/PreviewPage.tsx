import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, Contributor, ApplyResult, RewritePlan, CommitInfo } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { GitCommit, Users, Shuffle, Loader2, Trash2, Play, FileText } from 'lucide-react';
import { Button, Avatar, Badge, PageTitle } from '../components/atoms';
import { ConfirmDialog, FieldDiff } from '../components/molecules';

interface Suggestion {
  targetName: string;
  targetEmail: string;
  contributors: Contributor[];
  commitCount: number;
}

function getMergeSuggestions(contributors: Contributor[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const used = new Set<string>();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (let i = 0; i < contributors.length; i++) {
    if (used.has(contributors[i].id)) continue;
    const merged: Contributor[] = [contributors[i]];
    const baseNormal = normalize(contributors[i].name);

    for (let j = i + 1; j < contributors.length; j++) {
      if (used.has(contributors[j].id)) continue;
      const otherNormal = normalize(contributors[j].name);

      if (baseNormal === otherNormal || baseNormal.includes(otherNormal) || otherNormal.includes(baseNormal)) {
        merged.push(contributors[j]);
        used.add(contributors[j].id);
      }
    }

    used.add(contributors[i].id);

    if (merged.length > 1) {
      const totalCommits = merged.reduce((sum, c) => sum + c.commit_count, 0);
      suggestions.push({
        targetName: merged[0].name,
        targetEmail: merged[0].email,
        contributors: merged,
        commitCount: totalCommits,
      });
    }
  }

  return suggestions;
}

function planDiffs(
  rewrite: import('../stores/repositoryStore').CommitRewrite,
  original: CommitInfo | undefined,
): { field: string; before: string; after: string }[] {
  if (!original) return [];
  const diffs: { field: string; before: string; after: string }[] = [];
  if (rewrite.author_name !== original.author_name)
    diffs.push({ field: 'Author', before: original.author_name, after: rewrite.author_name });
  if (rewrite.author_email !== original.author_email)
    diffs.push({ field: 'Author email', before: original.author_email, after: rewrite.author_email });
  if (rewrite.author_date !== original.author_date)
    diffs.push({ field: 'Author date', before: original.author_date, after: rewrite.author_date });
  if (rewrite.committer_name !== original.committer_name)
    diffs.push({ field: 'Committer', before: original.committer_name, after: rewrite.committer_name });
  if (rewrite.committer_email !== original.committer_email)
    diffs.push({ field: 'Committer email', before: original.committer_email, after: rewrite.committer_email });
  if (rewrite.commit_date !== original.commit_date)
    diffs.push({ field: 'Commit date', before: original.commit_date, after: rewrite.commit_date });
  if (rewrite.message !== original.message)
    diffs.push({ field: 'Message', before: original.message.slice(0, 60), after: rewrite.message.slice(0, 60) });
  return diffs;
}

export function PreviewPage() {
  const navigate = useNavigate();
  const { currentRepo, scanResult, stagedOps, unstageOp } = useRepositoryStore();
  const { addToast } = useNotificationStore();
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedMerges, setSelectedMerges] = useState<Set<number>>(new Set());
  const [plan, setPlan] = useState<RewritePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    if (!currentRepo || stagedOps.length === 0) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setPlanLoading(true);
    const allOps = stagedOps.flatMap((s) => s.operations);
    invoke<RewritePlan>('preview_rewrite', { path: currentRepo.path, operations: allOps })
      .then((result) => { if (!cancelled) setPlan(result); })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setPlanLoading(false); });
    return () => { cancelled = true; };
  }, [currentRepo?.path, stagedOps]);

  const suggestions = useMemo(() => {
    if (!scanResult) return [];
    return getMergeSuggestions(scanResult.contributors);
  }, [scanResult]);

  const toggleMerge = (idx: number) => {
    setSelectedMerges((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const stageMerges = () => {
    if (selectedMerges.size === 0) return;
    const { stageOp } = useRepositoryStore.getState();
    for (const idx of selectedMerges) {
      const s = suggestions[idx];
      for (const c of s.contributors) {
        if (c.name === s.targetName && c.email === s.targetEmail) continue;
        stageOp({
          id: `merge-${c.id}-${Date.now()}`,
          summary: `Merge ${c.name} <${c.email}> → ${s.targetName} <${s.targetEmail}>`,
          oldSha: c.commit_shas[0] || '',
          details: [
            { field: 'Identity', before: `${c.name} <${c.email}>`, after: `${s.targetName} <${s.targetEmail}>` },
          ],
          operations: [{
            Identity: {
              old_name: c.name,
              old_email: c.email,
              new_name: s.targetName,
              new_email: s.targetEmail,
              rewrite_committer: true,
            },
          }],
        });
      }
    }
    setSelectedMerges(new Set());
    addToast(`${selectedMerges.size} merge(s) staged.`, 'success');
  };

  const handleApplyAll = async () => {
    if (!currentRepo || stagedOps.length === 0) return;
    setShowConfirm(false);
    setIsApplying(true);
    try {
      const allOps = stagedOps.flatMap((s) => s.operations);
      const result = await invoke<ApplyResult>('apply_rewrite', {
        path: currentRepo.path,
        operations: allOps,
      });
      const modified = result.rewrites.filter((r) => r.is_modified).length;
      addToast(`Rewrite applied: ${modified} commits rewritten.`, 'success');

      const freshScan = await invoke<any>('scan_repository', { path: currentRepo.path });
      const store = useRepositoryStore.getState();
      store.clearStaged();
      store.setScanResult(freshScan);
      navigate('/');
    } catch (e) {
      addToast(`Rewrite failed: ${String(e)}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <PageTitle>Review & Apply</PageTitle>
        {stagedOps.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">{stagedOps.length} staged</span>
            <Button onClick={() => setShowConfirm(true)} variant="primary" disabled={isApplying}>
              {isApplying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Apply All
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Apply All Staged Changes"
        description={`This will rewrite ${stagedOps.flatMap(s => s.operations).length} operation(s). This cannot be undone.`}
        confirmLabel="Apply All"
        destructive
        loading={isApplying}
        onConfirm={handleApplyAll}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Staged changes section */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <GitCommit size={16} /> Staged Changes
          {stagedOps.length > 0 && (
            <Badge variant="mono">{stagedOps.length}</Badge>
          )}
        </h2>

        {stagedOps.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-lg p-8 text-center">
            <p className="text-sm text-neutral-600 mb-2">No changes staged yet.</p>
            <p className="text-xs text-neutral-700">
              Edit commits in <button onClick={() => navigate('/explorer')} className="text-neutral-500 hover:text-white underline">Explorer</button> and stage your changes, then come here to apply.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {stagedOps.map((op) => (
              <div key={op.id} className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="mono">{op.oldSha.slice(0, 8)}</Badge>
                      <span className="text-sm text-neutral-300 truncate">{op.summary}</span>
                    </div>
                    <div className="space-y-0.5 mt-2">
                      {op.details.map((d, i) => (
                        <FieldDiff key={i} field={d.field} before={d.before} after={d.after} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => unstageOp(op.id)}
                    className="p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-neutral-800 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rewrite Plan */}
      {plan && plan.rewrites.filter((r) => r.is_modified).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <FileText size={16} /> Rewrite Plan
            <Badge variant="mono">{plan.total_affected}</Badge>
          </h2>

          {planLoading && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
              <Loader2 size={12} className="animate-spin" /> Computing plan…
            </div>
          )}

          <div className="space-y-2">
            {plan.rewrites.filter((r) => r.is_modified).map((r) => {
              const original = scanResult?.commits.find((c) => c.sha === r.old_sha);
              const diffs = planDiffs(r, original);
              return (
                <div key={r.old_sha} className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="mono">{r.old_sha.slice(0, 8)}</Badge>
                    <span className="text-neutral-600">→</span>
                    <Badge variant="mono">{r.new_sha.slice(0, 8)}</Badge>
                    <span className="text-xs text-neutral-500 ml-auto">{diffs.length} change(s)</span>
                  </div>
                  <div className="space-y-0.5">
                    {diffs.map((d, i) => (
                      <FieldDiff key={i} field={d.field} before={d.before} after={d.after} />
                    ))}
                  </div>
                  {original && (
                    <p className="text-xs text-neutral-600 mt-2 truncate">{original.message}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Identity merge suggestions */}
      {scanResult && suggestions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <Users size={16} /> Identity Merge Suggestions
              <Badge variant="mono">{suggestions.length}</Badge>
            </h2>
            {selectedMerges.size > 0 && (
              <Button size="sm" variant="ghost" onClick={stageMerges}>
                <Shuffle size={14} /> Stage Selected ({selectedMerges.size})
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => toggleMerge(idx)}
                className={`w-full text-left transition-all rounded-lg ${
                  selectedMerges.has(idx)
                    ? 'ring-1 ring-neutral-400'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
                  <div className="flex items-center gap-3 mb-3">
                    <Shuffle size={16} className="text-neutral-500" />
                    <div className="text-sm text-neutral-400">
                      Merge <span className="text-white font-mono">{s.contributors.length}</span> identities into
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Avatar name={s.targetName} />
                    <div>
                      <div className="text-sm text-white">{s.targetName}</div>
                      <div className="text-xs text-neutral-500 font-mono">{s.targetEmail}</div>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-600 mb-2">Contributors to merge:</div>
                  <div className="flex flex-col gap-2">
                    {s.contributors.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs text-neutral-400">
                        <Badge variant="mono">{c.commit_count} commits</Badge>
                        <span>{c.name}</span>
                        <span className="font-mono text-neutral-600">&lt;{c.email}&gt;</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-2 text-xs text-neutral-500">
                    <GitCommit size={14} />
                    {s.commitCount} commits will be rewritten
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
