import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { scanModelSafetyEntries } from './model-safety-lib.mjs';

const allTracked = process.argv.includes('--all-tracked');

function git(args, encoding = 'utf8') {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('Model safety scan could not inspect Git state.');
  return result.stdout;
}

const paths = (
  allTracked
    ? git(['ls-files', '-z'])
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
)
  .split('\0')
  .filter(Boolean);

const entries = [];
for (const path of paths) {
  try {
    entries.push({
      path,
      source: allTracked ? await readFile(path, 'utf8') : git(['show', `:${path}`]),
    });
  } catch {
    // Binary and unreadable entries are ignored here; filenames are still inspected below.
    entries.push({ path, source: '' });
  }
}

const issues = scanModelSafetyEntries(entries);
if (issues.length > 0) {
  const summary = issues.map((issue) => `${issue.path}: ${issue.reason}`).join('\n');
  throw new Error(`MODEL SAFETY SCAN FAILED\n${summary}`);
}

console.log(
  `Model safety scan passed for ${paths.length} ${allTracked ? 'tracked' : 'staged'} file(s); no participant values or secret values were printed.`,
);
