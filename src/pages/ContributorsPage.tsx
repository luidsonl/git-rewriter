import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useRepositoryStore, RewritePlan } from '../stores/repositoryStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Search, Eye, Plus, Pencil } from 'lucide-react';
import { TextInput, PageTitle, Button, Spinner } from '../components/atoms';
import { EmptyState, SortButton, ContributorRow } from '../components/molecules';

type SortField = 'name' | 'commit_count';
type SortDir = 'asc' | 'desc';

export function ContributorsPage() {
  const { t } = useTranslation();
  const { currentRepo, scanResult } = useRepositoryStore();
  const { addToast } = useNotificationStore();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('commit_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [rewriteMode, setRewriteMode] = useState(false);
  const [rewriteEdits, setRewriteEdits] = useState<Record<string, { name: string; email: string }>>({});
  const [rewritePreview, setRewritePreview] = useState<RewritePlan | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);

  const maxCommits = useMemo(
    () => (scanResult ? Math.max(1, ...scanResult.contributors.map((c) => c.commit_count)) : 1),
    [scanResult]
  );

  const filtered = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.contributors
      .filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const valA = sortField === 'name' ? a.name : a.commit_count;
        const valB = sortField === 'name' ? b.name : b.commit_count;
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [scanResult, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleRewriteMode = () => {
    const next = !rewriteMode;
    setRewriteMode(next);
    if (next && scanResult) {
      const edits: Record<string, { name: string; email: string }> = {};
      for (const c of scanResult.contributors) {
        edits[c.id] = { name: c.name, email: c.email };
      }
      setRewriteEdits(edits);
      setRewritePreview(null);
    }
  };

  const getRewriteOps = () => {
    if (!scanResult) return [];
    const ops: any[] = [];
    for (const c of scanResult.contributors) {
      const edit = rewriteEdits[c.id];
      if (!edit) continue;
      if (edit.name !== c.name || edit.email !== c.email) {
        ops.push({
          Identity: {
            old_name: c.name,
            old_email: c.email,
            new_name: edit.name,
            new_email: edit.email,
            rewrite_committer: true,
          },
        });
      }
    }
    return ops;
  };

  const handlePreview = async () => {
    if (!currentRepo) return;
    const ops = getRewriteOps();
    if (ops.length === 0) {
      addToast('No changes to preview', 'info');
      return;
    }
    setRewriteLoading(true);
    try {
      const result = await invoke<RewritePlan>('preview_rewrite', { path: currentRepo.path, operations: ops });
      setRewritePreview(result);
    } catch (e) {
      addToast(`Preview failed: ${String(e)}`, 'error');
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleStage = () => {
    const ops = getRewriteOps();
    if (ops.length === 0) {
      addToast('No changes to stage', 'info');
      return;
    }
    const { stageOp } = useRepositoryStore.getState();
    for (const op of ops) {
      const identity = op.Identity;
      stageOp({
        id: `author-${identity.old_name}-${Date.now()}`,
        summary: `Author: ${identity.old_name} <${identity.old_email}> → ${identity.new_name} <${identity.new_email}>`,
        oldSha: '00000000',
        details: [{
          field: 'Identity',
          before: `${identity.old_name} <${identity.old_email}>`,
          after: `${identity.new_name} <${identity.new_email}>`,
        }],
        operations: [op],
      });
    }
    addToast(`${ops.length} author rewrite(s) staged.`, 'success');
    setRewriteMode(false);
  };

  return (
    <div className="p-8 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <PageTitle>{t('nav.contributors')}</PageTitle>
        {scanResult && (
          <Button size="sm" variant="ghost" onClick={toggleRewriteMode}>
            {rewriteMode ? <Pencil size={14} className="text-emerald-400" /> : <Pencil size={14} />}
            {rewriteMode ? 'Exit Rewrite' : 'Author Rewrite'}
          </Button>
        )}
      </div>

      {!scanResult ? (
        <EmptyState
          title="No repository open."
          description="Open a repository from the Dashboard first."
        />
      ) : (
        <>
          {rewriteMode && (
            <div className="mb-4 border border-neutral-800 rounded-lg p-4 bg-neutral-900/30">
              <p className="text-xs text-neutral-400 mb-3">
                Edit name and email fields below, then preview and stage changes.
              </p>
              {rewritePreview && (
                <p className="text-xs text-neutral-500 mb-2">
                  {rewritePreview.total_affected} commit(s) will be rewritten
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={handlePreview} disabled={rewriteLoading}>
                  {rewriteLoading ? <Spinner /> : <Eye size={12} />}
                  Preview
                </Button>
                <Button size="sm" variant="primary" onClick={handleStage}>
                  <Plus size={12} /> Stage All
                </Button>
              </div>
            </div>
          )}

          <div className="mb-6 max-w-sm">
            <TextInput
              icon={<Search size={16} />}
              placeholder="Filter by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-auto rounded-lg border border-neutral-900">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="py-3 px-4">
                    <SortButton label="Contributor" active={sortField === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                  </th>
                  <th className="py-3 px-4">
                    <SortButton label="Commits" active={sortField === 'commit_count'} dir={sortDir} onClick={() => toggleSort('commit_count')} />
                  </th>
                  <th className="py-3 px-4 text-xs font-medium text-neutral-500">Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-sm text-neutral-600">
                      No contributors match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <ContributorRow
                      key={c.id}
                      contributor={c}
                      maxCommits={maxCommits}
                      rewriteMode={rewriteMode}
                      edit={rewriteEdits[c.id]}
                      onEdit={
                        rewriteMode
                          ? (edit) => setRewriteEdits((prev) => ({ ...prev, [c.id]: edit }))
                          : undefined
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-neutral-600 mt-4">
            {filtered.length} of {scanResult.contributors.length} contributors
          </p>
        </>
      )}
    </div>
  );
}
