export interface PlaytestBuildEnvironment {
  VERCEL_ENV?: string;
  VITE_ENABLE_PLAYTEST_DIAGNOSTICS?: string;
  VITE_ENABLE_TOPOLOGY_LAB?: string;
}

export function shouldIncludeTopologyLab(
  environment: PlaytestBuildEnvironment,
  localDevelopment = false,
): boolean {
  return (
    localDevelopment ||
    (environment.VERCEL_ENV === 'preview' && environment.VITE_ENABLE_TOPOLOGY_LAB === 'true')
  );
}

export function shouldIncludePlaytestDiagnostics(environment: PlaytestBuildEnvironment): boolean {
  return (
    environment.VERCEL_ENV === 'preview' && environment.VITE_ENABLE_PLAYTEST_DIAGNOSTICS === 'true'
  );
}
