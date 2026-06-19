interface ActivityBarProps {
  value: number;
  max: number;
}

export function ActivityBar({ value, max }: ActivityBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-neutral-900 rounded-full h-1">
      <div className="bg-neutral-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}
