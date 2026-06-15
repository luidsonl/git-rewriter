import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';
import { useRepositoryStore } from '../stores/repositoryStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { FolderOpen, UploadCloud } from 'lucide-react';

export function DashboardPage() {
  const { t } = useTranslation();
  const { addToast } = useNotificationStore();
  const { currentRepo, setRepo } = useRepositoryStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenRepo = async (path: string) => {
    try {
      const repo = await invoke<any>('open_repository', { path });
      setRepo(repo);
      addToast(`Repository ${repo.name} loaded successfully`, 'success');
    } catch (e) {
      addToast(String(e), 'error');
    }
  };

  const selectFolder = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
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
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
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
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h3 className="text-lg text-white font-medium mb-2">{currentRepo.name}</h3>
          <p className="text-sm text-neutral-400 mb-4">{currentRepo.path}</p>
          
          <button 
            onClick={() => setRepo(null)}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Close Repository
          </button>
        </div>
      )}
    </div>
  );
}
