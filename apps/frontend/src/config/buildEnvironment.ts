export interface PlaytestBuildEnvironment {
  VERCEL_ENV?: string;
  VITE_ENABLE_PLAYTEST_DIAGNOSTICS?: string;
}

export function shouldIncludePlaytestDiagnostics(environment: PlaytestBuildEnvironment): boolean {
  return (
    environment.VERCEL_ENV === 'preview' && environment.VITE_ENABLE_PLAYTEST_DIAGNOSTICS === 'true'
  );
}
