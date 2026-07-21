import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  analyzeResearchExport,
  formatResearchAnalysis,
  researchAnalysisCsv,
} from './research-analysis-core.mjs';

function optionValue(args, name) {
  const equals = args.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const valueOptions = new Set(['--json-output', '--csv-output']);
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (valueOptions.has(argument)) {
    index += 1;
    continue;
  }
  if (!argument.startsWith('--')) positional.push(argument);
}
const inputPath = positional[0];
if (!inputPath) {
  console.error(
    'Usage: pnpm analyze:research -- path/to/export.json [--include-pilot] [--json-output path] [--csv-output path]',
  );
  process.exitCode = 1;
} else {
  try {
    const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
    const summary = analyzeResearchExport(input, {
      includePilot: args.includes('--include-pilot'),
    });
    console.log(formatResearchAnalysis(summary));
    const jsonOutput = optionValue(args, '--json-output');
    const csvOutput = optionValue(args, '--csv-output');
    if (jsonOutput)
      await writeFile(resolve(jsonOutput), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    if (csvOutput) await writeFile(resolve(csvOutput), `${researchAnalysisCsv(summary)}\n`, 'utf8');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
