export const VERSION_INFO = {
  gameVersion: 'mvp-0.4',
  generatorVersion: 'generator-4',
  adaptationVersion: 'rules-2',
  telemetrySchemaVersion: 1,
} as const;

export type VersionInfo = typeof VERSION_INFO;
export type GameVersion = VersionInfo['gameVersion'];
export type GeneratorVersion =
  'generator-1' | 'generator-2' | 'generator-3' | VersionInfo['generatorVersion'];
export type AdaptationVersion = 'rules-1' | VersionInfo['adaptationVersion'];
export type TelemetrySchemaVersion = VersionInfo['telemetrySchemaVersion'];
