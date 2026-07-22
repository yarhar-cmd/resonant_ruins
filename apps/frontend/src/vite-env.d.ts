/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_PLAYTEST_DIAGNOSTICS?: string;
  readonly VITE_ENABLE_TOPOLOGY_LAB?: string;
  readonly VITE_ENABLE_MODEL_LAB?: string;
  readonly VITE_PLAYTEST_DIAGNOSTICS_INCLUDED?: 'true' | 'false';
  readonly VITE_TOPOLOGY_LAB_INCLUDED?: 'true' | 'false';
  readonly VITE_MODEL_LAB_INCLUDED?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
