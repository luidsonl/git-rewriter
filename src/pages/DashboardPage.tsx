import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';
import { useRepositoryStore, ScanResult } from '../stores/repositoryStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { FolderOpen, UploadCloud, GitCommit, Users, GitBranch, Loader2 } from 'lucide-react';

export function DashboardPage() {
  const { t } = useTranslation();
  const { addToast } = useNotificationStore();
  const { currentRepo, scanResult, isScanning, setRepo, setScanResult, setIsScanning } = useRepositoryStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenRepo = async (path: string) => {
    try {
      const repo = await invoke<any>('open_repository', { path });
      setRepo(repo);
      addToast(`${repo.name} opened`, 'success');
      // Immediately scan
      scanRepo(path);
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const scanRepo = async (path: string) => {
    setIsScanning(true);
    try {
      const result = await invoke<ScanResult>('scan_repository', { path });
      setScanResult(result);
    } catch (e) {
      addToast(`Scan failed: ${String(e)}`, 'error');
    } finally {
      setIsScanning(false);
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

  useEffect(() => {
    const window = getCurrentWebviewWindow();
    let unlisten: () => void;

    window.onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragging(true);
      } else if (event.payload.type === 'leave') {
        setIsDragging(false);
      } else if (event.payload.type === 'drop') {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          handleOpenRepo(paths[0]);
        }
      }
    }).then((fn) => { unlisten = fn; });

    return () => { if (unlisten) unlisten(); };
  }, []);

  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-2xl font-light text-white mb-6">{t('nav.dashboard')}</h2>

      {!currentRepo ? (
        <div
          className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
            isDragging ? 'border-neutral-400 bg-neutral-900/50' : 'border-neutral-800 bg-neutral-950/50'
          }`}
        >
          <UploadCloud size={48} className={`mb-4 ${isDragging ? 'text-white' : 'text-neutral-600'}`} />
          <p className="text-neutral-400 mb-6">Drag and drop a repository folder here</p>
          <button
            onClick={selectFolder}
            className="flex items-center gap-2 bg-white text-black font-medium rounded-md px-4 py-2 text-sm hover:bg-neutral-200 transition-colors"
          >
            <FolderOpen size={18} />
            {t('actions.open_repo')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Repo header */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg text-white font-medium mb-1">{currentRepo.name}</h3>
                <p className="text-xs text-neutral-500 font-mono">{currentRepo.path}</p>
              </div>
              <button
                onClick={() => setRepo(null)}
                className="text-xs text-neutral-500 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Stats */}
          {isScanning ? (
            <div className="flex items-center gap-3 text-neutral-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Scanning repository...
            </div>
          ) : scanResult && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                <GitCommit size={20} className="text-neutral-400 mb-3" />
                <div className="text-2xl font-light text-white">{scanResult.total_commits}</div>
                <div className="text-xs text-neutral-500 mt-1">Commits</div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                <Users size={20} className="text-neutral-400 mb-3" />
                <div className="text-2xl font-light text-white">{scanResult.contributors.length}</div>
                <div className="text-xs text-neutral-500 mt-1">Contributors</div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                <GitBranch size={20} className="text-neutral-400 mb-3" />
                <div className="text-2xl font-light text-white">{scanResult.total_branches}</div>
                <div className="text-xs text-neutral-500 mt-1">Branches</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
