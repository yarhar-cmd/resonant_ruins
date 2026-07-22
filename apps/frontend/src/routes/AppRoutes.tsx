import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AboutPage } from '../pages/AboutPage';
import { CharactersPage } from '../pages/CharactersPage';
import { ContactPage } from '../pages/ContactPage';
import { DungeonEntryPage } from '../pages/DungeonEntryPage';
import { DungeonRunPage } from '../pages/DungeonRunPage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ResearchPage } from '../pages/ResearchPage';
import { ResearchRunPage } from '../pages/ResearchRunPage';
import { MODEL_LAB_ENABLED, TOPOLOGY_LAB_ENABLED } from '../config/environment';

const TopologyLabPage = TOPOLOGY_LAB_ENABLED
  ? lazy(async () => {
      const module = await import('../pages/TopologyLabPage');
      return { default: module.TopologyLabPage };
    })
  : null;

const ModelLabPage = MODEL_LAB_ENABLED
  ? lazy(async () => {
      const module = await import('../pages/ModelLabPage');
      return { default: module.ModelLabPage };
    })
  : null;

const ModelSandboxPage = MODEL_LAB_ENABLED
  ? lazy(async () => {
      const module = await import('../pages/ModelSandboxPage');
      return { default: module.ModelSandboxPage };
    })
  : null;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="dungeon/run" element={<DungeonRunPage />} />
      <Route path="research/run" element={<ResearchRunPage />} />
      {ModelSandboxPage && (
        <Route
          path="model-lab/sandbox"
          element={
            <Suspense fallback={null}>
              <ModelSandboxPage />
            </Suspense>
          }
        />
      )}
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="dungeon" element={<DungeonEntryPage />} />
        <Route path="characters" element={<CharactersPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="research" element={<ResearchPage />} />
        {TopologyLabPage && (
          <Route
            path="topology-lab"
            element={
              <Suspense fallback={null}>
                <TopologyLabPage />
              </Suspense>
            }
          />
        )}
        {ModelLabPage && (
          <Route
            path="model-lab"
            element={
              <Suspense fallback={null}>
                <ModelLabPage />
              </Suspense>
            }
          />
        )}
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
