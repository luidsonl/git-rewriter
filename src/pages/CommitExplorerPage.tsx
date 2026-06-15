import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositoryStore, CommitInfo } from '../stores/repositoryStore';
import { Search, ChevronRight } from 'lucide-react';
import { TextInput, Avatar, Badge, PageTitle } from '../components/atoms';
import { EmptyState } from '../components/molecules';

function formatDate(raw: string): string {
  const seconds = parseInt(raw, 10);
  if (isNaN(seconds)) return raw;
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function CommitPanel({ commit, onClose }: { commit: CommitInfo; onClose: () => void }) {
  return (
    <aside className="w-80 border-l border-neutral-900 bg-neutral-950 p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">Commit Details</span>
        <button onClick={onClose} className="text-xs text-neutral-600 hover:text-white transition-colors">Close</button>
      </div>

      <div>
        <p className="text-xs text-neutral-500 mb-1">SHA</p>
        <Badge variant="mono">{commit.sha.slice(0, 12)}</Badge>
      </div>

      <div>
        <p className="text-xs text-neutral-500 mb-1">Message</p>
        <p className="text-sm text-white leading-relaxed">{commit.message}</p>
      </div>

      <div>
        <p className="text-xs text-neutral-500 mb-2">Author</p>
        <div className="flex items-center gap-2">
          <Avatar name={commit.author_name} size="sm" />
          <div>
            <p className="text-sm text-white">{commit.author_name}</p>
            <p className="text-xs text-neutral-500 font-mono">{commit.author_email}</p>
          </div>
        </div>
        <p className="text-xs text-neutral-600 mt-1">{formatDate(commit.author_date)}</p>
      </div>

      {commit.committer_name !== commit.author_name && (
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
  const { scanResult } = useRepositoryStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CommitInfo | null>(null);
  const [page, setPage] = useState(0);

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
      {/* Main list */}
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

            {/* Pagination */}
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

      {/* Details panel */}
      {selected && <CommitPanel commit={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
