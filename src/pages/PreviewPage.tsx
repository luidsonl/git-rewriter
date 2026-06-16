import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, Contributor, RewritePlan, RewriteOperation, CommitRewrite } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { GitCommit, Users, Shuffle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button, Avatar, Badge, PageTitle } from '../components/atoms';
import { EmptyState } from '../components/molecules';

interface Suggestion {
  targetName: string;
  targetEmail: string;
  contributors: Contributor[];
  commitCount: number;
}

function SuggestionRow({ suggestion }: { suggestion: Suggestion }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
      <div className="flex items-center gap-3 mb-3">
        <Shuffle size={16} className="text-neutral-500" />
        <div className="text-sm text-neutral-400">
          Merge <span className="text-white font-mono">{suggestion.contributors.length}</span> identities into
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Avatar name={suggestion.targetName} />
        <div>
          <div className="text-sm text-white">{suggestion.targetName}</div>
          <div className="text-xs text-neutral-500 font-mono">{suggestion.targetEmail}</div>
        </div>
      </div>

      <div className="text-xs text-neutral-600 mb-2">Contributors to merge:</div>
      <div className="flex flex-col gap-2">
        {suggestion.contributors.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs text-neutral-400">
            <Badge variant="mono">{c.commit_count} commits</Badge>
            <span>{c.name}</span>
            <span className="font-mono text-neutral-600">&lt;{c.email}&gt;</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-2 text-xs text-neutral-500">
        <GitCommit size={14} />
        {suggestion.commitCount} commits will be rewritten
      </div>
    </div>
  );
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

function toOperations(suggestions: Suggestion[], selected: Set<number>): RewriteOperation[] {
  const ops: RewriteOperation[] = [];
  for (const idx of selected) {
    const s = suggestions[idx];
    for (const c of s.contributors) {
      if (c.name !== s.targetName || c.email !== s.targetEmail) {
        ops.push({
          Identity: {
            old_name: c.name,
            old_email: c.email,
            new_name: s.targetName,
            new_email: s.targetEmail,
            rewrite_committer: true,
          },
        });
      }
    }
  }
  return ops;
}

function CommitDiff({ rewrites }: { rewrites: CommitRewrite[] }) {
  const modified = rewrites.filter((r) => r.is_modified);
  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50 mt-6">
      <h3 className="text-sm font-medium text-neutral-300 mb-3">
        Rewrite Plan — {modified.length} commits affected
      </h3>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {modified.map((r) => (
          <div key={r.old_sha} className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <Badge variant="mono">{r.old_sha.slice(0, 8)}</Badge>
            <span className="text-neutral-600">→</span>
            <Badge variant="mono">{r.new_sha.slice(0, 8)}</Badge>
            <span className="text-neutral-500 ml-1 truncate">{r.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewPage() {
  const { t } = useTranslation();
  const { currentRepo, scanResult, setScanResult } = useRepositoryStore();
  const { addToast } = useNotificationStore();
  const [selectedRewrites, setSelectedRewrites] = useState<Set<number>>(new Set());
  const [plan, setPlan] = useState<RewritePlan | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const suggestions = useMemo(() => {
    if (!scanResult) return [];
    return getMergeSuggestions(scanResult.contributors);
  }, [scanResult]);

  const toggleRewrite = (idx: number) => {
    setSelectedRewrites((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
    setPlan(null);
  };

  const computePreview = async () => {
    if (!currentRepo || selectedRewrites.size === 0) return;
    setIsComputing(true);
    try {
      const operations = toOperations(suggestions, selectedRewrites);
      const result = await invoke<RewritePlan>('preview_rewrite', {
        path: currentRepo.path,
        operations,
      });
      setPlan(result);
      addToast(`Preview: ${result.total_affected} commits will be rewritten`, 'info');
    } catch (e) {
      addToast(`Preview failed: ${String(e)}`, 'error');
    } finally {
      setIsComputing(false);
    }
  };

  const handleApply = async () => {
    if (!currentRepo || selectedRewrites.size === 0) return;
    setIsApplying(true);
    try {
      const operations = toOperations(suggestions, selectedRewrites);
      const result = await invoke<CommitRewrite[]>('apply_rewrite', {
        path: currentRepo.path,
        operations,
      });
      const modified = result.filter((r) => r.is_modified).length;
      addToast(`Rewrite applied: ${modified} commits rewritten`, 'success');
      setPlan(null);
      setSelectedRewrites(new Set());

      const freshScan = await invoke<any>('scan_repository', { path: currentRepo.path });
      setScanResult(freshScan);
    } catch (e) {
      addToast(`Rewrite failed: ${String(e)}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <PageTitle>{t('nav.preview')}</PageTitle>

        {selectedRewrites.size > 0 && (
          <div className="flex items-center gap-3">
            <Button onClick={computePreview} variant="ghost" disabled={isComputing}>
              {isComputing ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
              Preview
            </Button>
            {plan && (
              <>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <AlertTriangle size={14} className="text-amber-500" />
                  {plan.total_affected} commits affected
                </div>
                <Button onClick={handleApply} variant="primary" disabled={isApplying}>
                  {isApplying ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
                  Apply Rewrite
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {!currentRepo || !scanResult ? (
        <EmptyState
          title="No repository open."
          description="Open a repository from the Dashboard first."
        />
      ) : suggestions.length === 0 ? (
        <EmptyState
          title="No merge suggestions"
          description="All contributor identities appear to be consistent."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Users size={16} />
            Found {suggestions.length} possible identity {suggestions.length === 1 ? 'merge' : 'merges'}
          </div>

          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => toggleRewrite(idx)}
              className={`w-full text-left transition-all ${
                selectedRewrites.has(idx)
                  ? 'ring-1 ring-neutral-400 rounded-lg'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <SuggestionRow suggestion={s} />
            </button>
          ))}

          {plan && <CommitDiff rewrites={plan.rewrites} />}
        </div>
      )}
    </div>
  );
}
