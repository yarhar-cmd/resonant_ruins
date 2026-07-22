import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {
  shouldIncludePlaytestDiagnostics,
  shouldIncludeTopologyLab,
  shouldIncludeModelLab,
} from './src/config/buildEnvironment';

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, '.', '');
  const includePlaytestDiagnostics = shouldIncludePlaytestDiagnostics(environment);
  const includeTopologyLab = shouldIncludeTopologyLab(environment, command === 'serve');
  const includeModelLab = shouldIncludeModelLab(environment, command === 'serve');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_PLAYTEST_DIAGNOSTICS_INCLUDED': JSON.stringify(
        String(includePlaytestDiagnostics),
      ),
      'import.meta.env.VITE_TOPOLOGY_LAB_INCLUDED': JSON.stringify(String(includeTopologyLab)),
      'import.meta.env.VITE_MODEL_LAB_INCLUDED': JSON.stringify(String(includeModelLab)),
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
