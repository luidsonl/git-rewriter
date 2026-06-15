import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositoryStore, Contributor } from '../stores/repositoryStore';
import { Search, GitCommit } from 'lucide-react';
import { TextInput, Avatar, PageTitle } from '../components/atoms';
import { EmptyState, ActivityBar, SortButton } from '../components/molecules';

type SortField = 'name' | 'commit_count';
type SortDir = 'asc' | 'desc';

function ContributorRow({ contributor, maxCommits }: { contributor: Contributor; maxCommits: number }) {
  return (
    <tr className="border-b border-neutral-900 hover:bg-neutral-900/40 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Avatar name={contributor.name} />
          <div>
            <div className="text-sm text-white">{contributor.name}</div>
            <div className="text-xs text-neutral-500 font-mono">{contributor.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 text-sm text-neutral-300">
          <GitCommit size={14} className="text-neutral-500" />
          {contributor.commit_count}
        </div>
      </td>
      <td className="py-3 px-4 w-40">
        <ActivityBar value={contributor.commit_count} max={maxCommits} />
      </td>
    </tr>
  );
}

export function ContributorsPage() {
  const { t } = useTranslation();
  const { scanResult } = useRepositoryStore();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('commit_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  return (
    <div className="p-8 flex flex-col h-full">
      <PageTitle>{t('nav.contributors')}</PageTitle>

      {!scanResult ? (
        <EmptyState
          title="No repository open."
          description="Open a repository from the Dashboard first."
        />
      ) : (
        <>
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
                    <ContributorRow key={c.id} contributor={c} maxCommits={maxCommits} />
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
