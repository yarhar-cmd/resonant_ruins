import { describe, expect, it } from 'vitest';
import { getRunExecutionPolicy, RUN_EXECUTION_POLICIES } from './runMode';

describe('run execution policies', () => {
  it('keeps every write boundary centralized and mutually isolated', () => {
    expect(RUN_EXECUTION_POLICIES.normal).toMatchObject({
      writeNormalActiveRun: true,
      writeResearchActiveRun: false,
      writePermanentProfile: true,
      writeNormalHistory: true,
      writeNormalBestRecords: true,
      writeResearchDataset: false,
    });
    expect(RUN_EXECUTION_POLICIES.research).toMatchObject({
      writeNormalActiveRun: false,
      writeResearchActiveRun: true,
      writePermanentProfile: false,
      writeResearchSessionProfile: true,
      writeNormalHistory: false,
      writeNormalBestRecords: false,
      writeResearchDataset: true,
    });
    expect(RUN_EXECUTION_POLICIES.sandbox).toEqual({
      mode: 'sandbox',
      writeNormalActiveRun: false,
      writeResearchActiveRun: false,
      writePermanentProfile: false,
      writeResearchSessionProfile: false,
      writeNormalHistory: false,
      writeNormalBestRecords: false,
      writeResearchDataset: false,
      writeSandboxState: false,
    });
    expect(getRunExecutionPolicy('research')).toBe(RUN_EXECUTION_POLICIES.research);
  });
});
