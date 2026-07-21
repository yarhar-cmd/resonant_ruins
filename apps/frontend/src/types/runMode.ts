export type RunMode = 'normal' | 'research' | 'sandbox';

export interface RunExecutionPolicy {
  mode: RunMode;
  writeNormalActiveRun: boolean;
  writeResearchActiveRun: boolean;
  writePermanentProfile: boolean;
  writeResearchSessionProfile: boolean;
  writeNormalHistory: boolean;
  writeNormalBestRecords: boolean;
  writeResearchDataset: boolean;
  writeSandboxState: boolean;
}

export const RUN_EXECUTION_POLICIES: Readonly<Record<RunMode, RunExecutionPolicy>> = Object.freeze({
  normal: Object.freeze({
    mode: 'normal',
    writeNormalActiveRun: true,
    writeResearchActiveRun: false,
    writePermanentProfile: true,
    writeResearchSessionProfile: false,
    writeNormalHistory: true,
    writeNormalBestRecords: true,
    writeResearchDataset: false,
    writeSandboxState: false,
  }),
  research: Object.freeze({
    mode: 'research',
    writeNormalActiveRun: false,
    writeResearchActiveRun: true,
    writePermanentProfile: false,
    writeResearchSessionProfile: true,
    writeNormalHistory: false,
    writeNormalBestRecords: false,
    writeResearchDataset: true,
    writeSandboxState: false,
  }),
  sandbox: Object.freeze({
    mode: 'sandbox',
    writeNormalActiveRun: false,
    writeResearchActiveRun: false,
    writePermanentProfile: false,
    writeResearchSessionProfile: false,
    writeNormalHistory: false,
    writeNormalBestRecords: false,
    writeResearchDataset: false,
    writeSandboxState: false,
  }),
});

export function getRunExecutionPolicy(mode: RunMode): RunExecutionPolicy {
  return RUN_EXECUTION_POLICIES[mode];
}
