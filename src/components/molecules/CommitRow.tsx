import { CommitInfo } from '../../stores/repositoryStore';
import { Avatar, Badge } from '../atoms';
import { ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/date';

interface CommitRowProps {
  commit: CommitInfo;
  isSelected: boolean;
  onClick: () => void;
}

export function CommitRow({ commit, isSelected, onClick }: CommitRowProps) {
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
