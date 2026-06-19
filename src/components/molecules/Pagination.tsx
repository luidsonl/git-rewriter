interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, totalPages, totalItems, itemLabel, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between mt-4 text-xs text-neutral-600">
        <span>{totalItems} {itemLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mt-4 text-xs text-neutral-600">
      <span>{totalItems} {itemLabel}</span>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={page === 0} className="hover:text-white disabled:opacity-30 transition-colors">← Prev</button>
        <span>{page + 1} / {totalPages}</span>
        <button onClick={onNext} disabled={page === totalPages - 1} className="hover:text-white disabled:opacity-30 transition-colors">Next →</button>
      </div>
    </div>
  );
}
