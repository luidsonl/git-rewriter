import { create } from 'zustand';

export interface RepoSummary {
  path: string;
  name: string;
}

interface RepositoryState {
  currentRepo: RepoSummary | null;
  setRepo: (repo: RepoSummary | null) => void;
}

export const useRepositoryStore = create<RepositoryState>((set) => ({
  currentRepo: null,
  setRepo: (repo) => set({ currentRepo: repo }),
}));
