import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Sidebar } from '../organisms/Sidebar';
import { ToastContainer } from '../molecules/ToastContainer';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { Menu, FolderOpen, RefreshCw, History, Trash2 } from 'lucide-react';

export function MainLayout() {
  const { currentRepo, recentRepos, setRepo, setScanResult, setIsScanning, addRecentRepo, clearRecentRepos } = useRepositoryStore();
  const { addToast } = useNotificationStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpenRepo = async (path: string) => {
    try {
      const repo = await invoke<any>('open_repository', { path });
      setRepo(repo);
      addRecentRepo(repo);
      addToast(`${repo.name} opened`, 'success');
      setIsScanning(true);
      try {
        const result = await invoke<any>('scan_repository', { path });
        setScanResult(result);
      } catch (e) {
        addToast(`Scan failed: ${String(e)}`, 'error');
      } finally {
        setIsScanning(false);
      }
      navigate('/');
      setMenuOpen(false);
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const selectFolder = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false });
      if (selectedPath && typeof selectedPath === 'string') {
        handleOpenRepo(selectedPath);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshRepo = async () => {
    if (!currentRepo) return;
    setIsScanning(true);
    try {
      const result = await invoke<any>('scan_repository', { path: currentRepo.path });
      setScanResult(result);
      addToast('Repository refreshed.', 'success');
    } catch (e) {
      addToast(`Refresh failed: ${String(e)}`, 'error');
    } finally {
      setIsScanning(false);
    }
    setMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-10 border-b border-neutral-900 flex items-center px-4 gap-3 shrink-0 relative">
          <div ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors"
            >
              <Menu size={18} />
            </button>

            {menuOpen && (
              <div className="absolute top-full left-2 mt-1 w-72 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 py-2">
                <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 flex items-center gap-2">
                  <FolderOpen size={14} /> Repository
                </div>
                <button
                  onClick={selectFolder}
                  className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors flex items-center gap-2"
                >
                  <FolderOpen size={14} />
                  Open Repository…
                </button>

                {currentRepo && (
                  <button
                    onClick={refreshRepo}
                    className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Refresh Current Repo
                  </button>
                )}

                {recentRepos.length > 0 && (
                  <>
                    <div className="border-t border-neutral-800 mt-1" />
                    <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 flex items-center gap-2 mt-1">
                      <History size={14} /> Recent Repositories
                    </div>
                    {recentRepos.map((repo) => (
                      <button
                        key={repo.path}
                        onClick={() => handleOpenRepo(repo.path)}
                        className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors truncate flex items-center gap-2"
                      >
                        <FolderOpen size={14} className="shrink-0" />
                        <span className="truncate">{repo.name}</span>
                        <span className="text-xs text-neutral-600 truncate ml-auto">{repo.path}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => { clearRecentRepos(); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-800 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Clear Recent Repos
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {currentRepo && (
            <span className="text-xs text-neutral-500 truncate">
              {currentRepo.name} <span className="text-neutral-700">· {currentRepo.path}</span>
            </span>
          )}
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
