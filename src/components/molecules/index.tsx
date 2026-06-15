import { ReactNode } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';

// ─── StatCard ────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: ReactNode;
  value: number | string;
  label: string;
}

export function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
      <div className="text-neutral-400 mb-3">{icon}</div>
      <div className="text-2xl font-light text-white">{value}</div>
      <div className="text-xs text-neutral-500 mt-1">{label}</div>
    </div>
  );
}

// ─── ScanningIndicator ───────────────────────────────────────────────────────
export function ScanningIndicator() {
  return (
    <div className="flex items-center gap-3 text-neutral-400 text-sm">
      <Loader2 size={16} className="animate-spin" />
      Scanning repository...
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <FolderOpen size={40} className="text-neutral-700 mb-4" />
      <p className="text-neutral-500 text-sm">{title}</p>
      {description && <p className="text-neutral-600 text-xs mt-1">{description}</p>}
    </div>
  );
}

// ─── ActivityBar ─────────────────────────────────────────────────────────────
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

// ─── SortButton ──────────────────────────────────────────────────────────────
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SortButtonProps {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}

export function SortButton({ label, active, dir, onClick }: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-white transition-colors"
    >
      {label}
      {active ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} /> : null}
    </button>
  );
}

// ─── RepoHeader ──────────────────────────────────────────────────────────────
interface RepoHeaderProps {
  name: string;
  path: string;
  onClose: () => void;
}

export function RepoHeader({ name, path, onClose }: RepoHeaderProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg text-white font-medium mb-1">{name}</h3>
          <p className="text-xs text-neutral-500 font-mono">{path}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-neutral-500 hover:text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
