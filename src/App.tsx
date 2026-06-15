import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ContributorsPage } from './pages/ContributorsPage';
import { CommitExplorerPage } from './pages/CommitExplorerPage';

// Placeholder pages for routing
const PreviewPage = () => <div className="p-8 text-white">Rewrite Preview</div>;

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="contributors" element={<ContributorsPage />} />
          <Route path="explorer" element={<CommitExplorerPage />} />
          <Route path="preview" element={<PreviewPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
