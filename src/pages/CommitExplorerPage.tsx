import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRepositoryStore, CommitInfo } from '../stores/repositoryStore';
import { Search } from 'lucide-react';
import { TextInput, PageTitle, Button } from '../components/atoms';
import { EmptyState, CommitRow, Pagination } from '../components/molecules';
import { CommitPanel } from '../components/organisms';

const PAGE_SIZE = 50;

export function CommitExplorerPage() {
  const { t } = useTranslation();
  const { stagedOps, scanResult } = useRepositoryStore();
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
              {t('explorer.review_staged', { count: stagedOps.length })}
            </Button>
          )}
        </div>

        {!scanResult ? (
          <EmptyState title={t('explorer.no_repo')} description={t('explorer.no_repo_desc')} />
        ) : (
          <>
            <div className="mb-4 max-w-sm">
              <TextInput
                icon={<Search size={16} />}
                placeholder={t('explorer.search_placeholder')}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-auto rounded-lg border border-neutral-900">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-800 sticky top-0 bg-neutral-950">
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">{t('explorer.sha')}</th>
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">{t('explorer.message')}</th>
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">{t('explorer.author')}</th>
                    <th className="py-3 px-4 text-xs font-medium text-neutral-500">{t('explorer.date')}</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm text-neutral-600">
                        {t('explorer.no_results')}
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

            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemLabel={t('explorer.commit_count', { count: filtered.length })}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </>
        )}
      </div>

      {selected && (
        <CommitPanel
          commit={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
