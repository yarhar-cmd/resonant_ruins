import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { shouldIncludePlaytestDiagnostics } from './src/config/buildEnvironment';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', '');
  const includePlaytestDiagnostics = shouldIncludePlaytestDiagnostics(environment);

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_PLAYTEST_DIAGNOSTICS_INCLUDED': JSON.stringify(
        String(includePlaytestDiagnostics),
      ),
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
