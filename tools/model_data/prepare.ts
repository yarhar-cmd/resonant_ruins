import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import {
  DEFAULT_MODEL_PREPARATION_CONFIG,
  prepareResearchExports,
} from '../../apps/frontend/src/model/dataPreparation.ts';

interface PrepareArguments {
  inputs: string[];
  output: string;
  includePilot: boolean;
}

function parseArguments(arguments_: string[]): PrepareArguments {
  const inputs: string[] = [];
  let output = '';
  let includePilot = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === '--include-pilot') includePilot = true;
    else if (argument === '--output') output = arguments_[++index] ?? '';
    else if (argument.startsWith('--output=')) output = argument.slice('--output='.length);
    else if (argument.startsWith('--')) throw new Error(`Unknown option: ${argument}`);
    else inputs.push(argument);
  }
  if (inputs.length === 0 || !output) {
    throw new Error(
      'Usage: pnpm prepare:model-data -- <export-or-directory> [...] --output <prepared.json> [--include-pilot]',
    );
  }
  return { inputs, output, includePilot };
}

async function discoverJson(path: string): Promise<string[]> {
  const absolute = resolve(path);
  const entry = await import('node:fs/promises').then(({ stat }) => stat(absolute));
  if (entry.isFile()) {
    if (extname(absolute).toLowerCase() !== '.json')
      throw new Error(`Model-data input is not JSON: ${absolute}`);
    return [absolute];
  }
  if (!entry.isDirectory()) throw new Error(`Unsupported model-data input: ${absolute}`);
  const files: string[] = [];
  for (const child of await readdir(absolute, { withFileTypes: true })) {
    if (child.name.startsWith('.')) continue;
    files.push(...(await discoverJson(resolve(absolute, child.name))));
  }
  return files.sort();
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const files = (await Promise.all(options.inputs.map(discoverJson))).flat().sort();
  const values = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(file, 'utf8')) as unknown),
  );
  const dataset = await prepareResearchExports(values, {
    ...DEFAULT_MODEL_PREPARATION_CONFIG,
    includePilot: options.includePilot,
  });
  await writeFile(resolve(options.output), `${JSON.stringify(dataset, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`Prepared ${dataset.quality.ratedRows} rated rows as ${dataset.datasetId}.`);
  console.log(
    dataset.readiness.readyForOfficialTraining
      ? 'Official training thresholds passed.'
      : `Development only: ${dataset.readiness.reasons.join(' ')}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Model-data preparation failed.');
  process.exitCode = 1;
});
