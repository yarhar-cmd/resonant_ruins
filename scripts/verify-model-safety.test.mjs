import assert from 'node:assert/strict';
import test from 'node:test';
import { scanModelSafetyEntries } from './model-safety-lib.mjs';

test('rejects raw participant-linked research data outside synthetic fixture paths', () => {
  const issues = scanModelSafetyEntries([
    {
      path: 'research-exports/participant-07.json',
      source: JSON.stringify({
        researchSchemaVersion: 'research-1',
        sessions: [{ participantCode: 'PRIVATE', id: 'session-private' }],
      }),
    },
  ]);
  assert.ok(issues.some((issue) => issue.reason.includes('ResearchExport')));
  assert.ok(issues.some((issue) => issue.reason.includes('participant-code')));
  assert.ok(issues.some((issue) => issue.reason.includes('filename')));
});

test('accepts reviewed synthetic fixture and aggregate artifact structures', () => {
  assert.deepEqual(
    scanModelSafetyEntries([
      {
        path: 'apps/frontend/src/model/__fixtures__/development-artifact-1.json',
        source: JSON.stringify({
          artifactSchemaVersion: 'model-artifact-1',
          aggregateDatasetCounts: { ratedRows: 12 },
        }),
      },
    ]),
    [],
  );
});

test('rejects high-confidence credentials without returning their values', () => {
  const issues = scanModelSafetyEntries([
    { path: 'unsafe.txt', source: ['ghp', '_', 'A'.repeat(40)].join('') },
  ]);
  assert.equal(issues[0]?.reason, 'high-confidence secret pattern');
  assert.equal(JSON.stringify(issues).includes('A'.repeat(40)), false);
});
