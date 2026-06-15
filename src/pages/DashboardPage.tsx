import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';
import { useRepositoryStore, ScanResult } from '../stores/repositoryStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { FolderOpen, UploadCloud, GitCommit, Users, GitBranch } from 'lucide-react';
import { Button, PageTitle } from '../components/atoms';
import { StatCard, ScanningIndicator, RepoHeader } from '../components/molecules';

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
      if (selectedPath && typeof selectedPath === 'string') handleOpenRepo(selectedPath);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const window = getCurrentWebviewWindow();
    let unlisten: () => void;

    window.onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') setIsDragging(true);
      else if (event.payload.type === 'leave') setIsDragging(false);
      else if (event.payload.type === 'drop') {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths?.length > 0) handleOpenRepo(paths[0]);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { if (unlisten) unlisten(); };
  }, []);

  return (
    <div className="p-8 h-full flex flex-col">
      <PageTitle>{t('nav.dashboard')}</PageTitle>

      {!currentRepo ? (
        <div
          className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
            isDragging ? 'border-neutral-400 bg-neutral-900/50' : 'border-neutral-800 bg-neutral-950/50'
          }`}
        >
          <UploadCloud size={48} className={`mb-4 ${isDragging ? 'text-white' : 'text-neutral-600'}`} />
          <p className="text-neutral-400 mb-6">Drag and drop a repository folder here</p>
          <Button onClick={selectFolder}>
            <FolderOpen size={18} />
            {t('actions.open_repo')}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <RepoHeader name={currentRepo.name} path={currentRepo.path} onClose={() => setRepo(null)} />

          {isScanning ? (
            <ScanningIndicator />
          ) : scanResult && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard icon={<GitCommit size={20} />} value={scanResult.total_commits} label="Commits" />
              <StatCard icon={<Users size={20} />} value={scanResult.contributors.length} label="Contributors" />
              <StatCard icon={<GitBranch size={20} />} value={scanResult.total_branches} label="Branches" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
