/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLAYTEST_DIAGNOSTICS_INCLUDED?: string;
  readonly VITE_TOPOLOGY_LAB_INCLUDED?: string;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_PLAYTEST_DIAGNOSTICS?: string;
  readonly VITE_PLAYTEST_DIAGNOSTICS_INCLUDED?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
