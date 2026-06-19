interface FieldDiffProps {
  field: string;
  before: string;
  after: string;
}

export function FieldDiff({ field, before, after }: FieldDiffProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-neutral-500 w-24 shrink-0">{field}</span>
      <span className="text-neutral-500 line-through truncate">{before}</span>
      <span className="text-neutral-700">→</span>
      <span className="text-emerald-400 truncate">{after}</span>
    </div>
  );
}
