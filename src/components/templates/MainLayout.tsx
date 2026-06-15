import { Outlet } from 'react-router-dom';
import { Sidebar } from '../organisms/Sidebar';
import { ToastContainer } from '../molecules/ToastContainer';

export function MainLayout() {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
