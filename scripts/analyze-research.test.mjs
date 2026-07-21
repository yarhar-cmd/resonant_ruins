import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectories = [];
const cli = resolve('scripts/analyze-research.mjs');

function room(id) {
  return {
    roomDecisionId: id,
    condition: 'RULES_ADAPTIVE',
    archetype: 'open-arena',
    gameVersion: 'mvp-0.4',
    generatorVersion: 'generator-4',
    selectorVersion: 'rules-selector-1',
    feedbackSchemaVersion: 'feedback-1',
    outcome: { status: 'completed', durationMs: 1_000, damageTaken: 0 },
    feedback: { status: 'submitted', difficulty: 'about_right', fairness: 4, enjoyment: 5 },
  };
}

function exportFixture() {
  return {
    researchSchemaVersion: 'research-1',
    sessions: [
      {
        id: 'official-cli',
        pilot: false,
        participantCode: null,
        status: 'ended',
        runs: [{ rooms: [room('official-room')] }],
      },
      {
        id: 'pilot-cli',
        pilot: true,
        participantCode: null,
        status: 'ended',
        runs: [{ rooms: [room('pilot-room')] }],
      },
    ],
  };
}

async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), 'resonant-ruins-analysis-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('offline research analysis CLI', () => {
  it('prints readable output and excludes Pilot by default', async () => {
    const directory = await workspace();
    const input = join(directory, 'export.json');
    await writeFile(input, JSON.stringify(exportFixture()), 'utf8');

    const result = spawnSync(process.execPath, [cli, input], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Pilot data: excluded (default)');
    expect(result.stdout).toContain('generatedRoomRecords: 1');
    expect(result.stdout).toContain('Descriptive output only');
  });

  it('includes Pilot explicitly and writes JSON and CSV summaries', async () => {
    const directory = await workspace();
    const input = join(directory, 'export.json');
    const jsonOutput = join(directory, 'summary.json');
    const csvOutput = join(directory, 'summary.csv');
    await writeFile(input, JSON.stringify(exportFixture()), 'utf8');

    const result = spawnSync(
      process.execPath,
      [cli, input, '--include-pilot', '--json-output', jsonOutput, '--csv-output', csvOutput],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(await readFile(jsonOutput, 'utf8')).overall.generatedRoomRecords).toBe(2);
    expect(await readFile(csvOutput, 'utf8')).toContain('"condition"');
  });

  it('rejects malformed JSON input with a nonzero exit', async () => {
    const directory = await workspace();
    const input = join(directory, 'broken.json');
    await writeFile(input, '{not-json', 'utf8');

    const result = spawnSync(process.execPath, [cli, input], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toBeTruthy();
  });
});
