import { create } from 'zustand';

export interface RepoSummary {
  path: string;
  name: string;
}

export interface CommitInfo {
  sha: string;
  author_name: string;
  author_email: string;
  author_date: string;
  committer_name: string;
  committer_email: string;
  commit_date: string;
  message: string;
  parent_shas: string[];
}

export interface Contributor {
  id: string;
  name: string;
  email: string;
  commit_count: number;
  commit_shas: string[];
}

export interface ScanResult {
  repo_name: string;
  total_commits: number;
  total_branches: number;
  contributors: Contributor[];
  commits: CommitInfo[];
}

export interface IdentityRewrite {
  old_name: string;
  old_email: string;
  new_name: string;
  new_email: string;
  rewrite_committer: boolean;
}

export interface MessageEdit {
  target_sha: string;
  new_message: string;
}

export interface AuthorDateEdit {
  target_sha: string;
  new_author_date: string;
  new_commit_date: string;
}

export type RewriteOperation =
  | { Identity: IdentityRewrite }
  | { Message: MessageEdit }
  | { AuthorDate: AuthorDateEdit };

export interface CommitRewrite {
  old_sha: string;
  new_sha: string;
  author_name: string;
  author_email: string;
  author_date: string;
  committer_name: string;
  committer_email: string;
  commit_date: string;
  message: string;
  parent_shas: string[];
  is_modified: boolean;
}

export interface RewritePlan {
  rewrites: CommitRewrite[];
  total_affected: number;
  branches_affected: string[];
}

export interface ApplyResult {
  rewrites: CommitRewrite[];
}

export interface StagedOperation {
  id: string;
  summary: string;
  oldSha: string;
  details: { field: string; before: string; after: string }[];
  operations: RewriteOperation[];
}

const RECENT_REPOS_KEY = 'git-rewriter:recentRepos';
const STAGED_OPS_KEY = 'git-rewriter:stagedOps';

function loadRecentRepos(): RepoSummary[] {
  try {
    const raw = localStorage.getItem(RECENT_REPOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentRepos(repos: RepoSummary[]) {
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
}

function loadStagedOps(): StagedOperation[] {
  try {
    const raw = localStorage.getItem(STAGED_OPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStagedOps(ops: StagedOperation[]) {
  localStorage.setItem(STAGED_OPS_KEY, JSON.stringify(ops));
}

interface RepositoryState {
  currentRepo: RepoSummary | null;
  scanResult: ScanResult | null;
  isScanning: boolean;
  recentRepos: RepoSummary[];
  stagedOps: StagedOperation[];
  setRepo: (repo: RepoSummary | null) => void;
  setScanResult: (result: ScanResult | null) => void;
  setIsScanning: (scanning: boolean) => void;
  addRecentRepo: (repo: RepoSummary) => void;
  clearRecentRepos: () => void;
  stageOp: (op: StagedOperation) => void;
  unstageOp: (id: string) => void;
  clearStaged: () => void;
}

export const useRepositoryStore = create<RepositoryState>((set) => ({
  currentRepo: null,
  scanResult: null,
  isScanning: false,
  recentRepos: loadRecentRepos(),
  stagedOps: loadStagedOps(),
  setRepo: (repo) => {
    saveStagedOps([]);
    return set({ currentRepo: repo, scanResult: null, stagedOps: [] });
  },
  setScanResult: (result) => set({ scanResult: result }),
  setIsScanning: (isScanning) => set({ isScanning }),
  addRecentRepo: (repo) => set((state) => {
    const filtered = state.recentRepos.filter((r) => r.path !== repo.path);
    const updated = [repo, ...filtered].slice(0, 10);
    saveRecentRepos(updated);
    return { recentRepos: updated };
  }),
  clearRecentRepos: () => {
    saveRecentRepos([]);
    return set({ recentRepos: [] });
  },
  stageOp: (op) => set((state) => {
    const updated = [...state.stagedOps, op];
    saveStagedOps(updated);
    return { stagedOps: updated };
  }),
  unstageOp: (id) => set((state) => {
    const updated = state.stagedOps.filter((o) => o.id !== id);
    saveStagedOps(updated);
    return { stagedOps: updated };
  }),
  clearStaged: () => {
    saveStagedOps([]);
    return set({ stagedOps: [] });
  },
}));
