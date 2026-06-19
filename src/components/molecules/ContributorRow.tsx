import { Contributor } from '../../stores/repositoryStore';
import { Avatar } from '../atoms';
import { ActivityBar } from './ActivityBar';
import { GitCommit } from 'lucide-react';

interface ContributorRowProps {
  contributor: Contributor;
  maxCommits: number;
  rewriteMode: boolean;
  edit?: { name: string; email: string };
  onEdit?: (edit: { name: string; email: string }) => void;
}

export function ContributorRow({
  contributor, maxCommits, rewriteMode, edit, onEdit,
}: ContributorRowProps) {
  if (rewriteMode && edit && onEdit) {
    const modified = edit.name !== contributor.name || edit.email !== contributor.email;
    return (
      <tr className="border-b border-neutral-900 hover:bg-neutral-900/40 transition-colors">
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            <Avatar name={contributor.name} />
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={edit.name}
                onChange={(e) => onEdit({ ...edit, name: e.target.value })}
                className="w-32 bg-neutral-800 rounded px-2 py-1 text-sm text-white"
              />
              <input
                type="text"
                value={edit.email}
                onChange={(e) => onEdit({ ...edit, email: e.target.value })}
                className="w-48 bg-neutral-800 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            {modified && <span className="text-[10px] text-amber-400">edited</span>}
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
