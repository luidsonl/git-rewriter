import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './pages/DashboardPage';

// Placeholder pages for routing
const ContributorsPage = () => <div className="p-8 text-white">Contributors</div>;
const ExplorerPage = () => <div className="p-8 text-white">Commit Explorer</div>;
const PreviewPage = () => <div className="p-8 text-white">Rewrite Preview</div>;

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="contributors" element={<ContributorsPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="preview" element={<PreviewPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
