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

interface RepositoryState {
  currentRepo: RepoSummary | null;
  scanResult: ScanResult | null;
  isScanning: boolean;
  setRepo: (repo: RepoSummary | null) => void;
  setScanResult: (result: ScanResult | null) => void;
  setIsScanning: (scanning: boolean) => void;
}

export const useRepositoryStore = create<RepositoryState>((set) => ({
  currentRepo: null,
  scanResult: null,
  isScanning: false,
  setRepo: (repo) => set({ currentRepo: repo, scanResult: null }),
  setScanResult: (result) => set({ scanResult: result }),
  setIsScanning: (isScanning) => set({ isScanning }),
}));
