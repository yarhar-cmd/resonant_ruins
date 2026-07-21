import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [name, ...value] = argument.replace(/^--/, '').split('=');
    return [name, value.join('=')];
  }),
);
const scanMode = options.mode ?? 'production';
if (scanMode !== 'production' && scanMode !== 'preview') {
  throw new Error(`Unknown production-safety scan mode: ${scanMode}`);
}
const outputDirectory = options.dir ?? 'apps/frontend/dist';
const assetsDirectory = resolve(process.cwd(), outputDirectory, 'assets');
const forbiddenDevelopmentText = [
  'Debug Tools',
  'Awakening Chamber Editor',
  'mirrorvault:awakening-editor-drafts:v1',
  'Spawn Rat',
  'Defeat All Enemies',
  'Freeze Enemy AI',
  'Enemy framework',
  'Version metadata',
  'Combat Debug',
  'Reset Combat Debug counters',
  'Body-lock prevention activations',
];
const diagnosticText = ['Playtest Diagnostics', 'PLAYTEST DIAGNOSTICS', 'Copy Diagnostic Summary'];
const topologyLabText = ['Topology Lab', 'SANDBOX · persistence guards active'];
const forbiddenText =
  scanMode === 'preview'
    ? forbiddenDevelopmentText
    : [...forbiddenDevelopmentText, ...diagnosticText, ...topologyLabText];

const files = (await readdir(assetsDirectory)).filter(
  (file) => file.endsWith('.js') || file.endsWith('.css'),
);
const bundles = await Promise.all(
  files.map(async (file) => ({
    file,
    source: await readFile(resolve(assetsDirectory, file), 'utf8'),
  })),
);
const exposed = forbiddenText.flatMap((text) =>
  bundles.filter(({ source }) => source.includes(text)).map(({ file }) => `${text} (${file})`),
);
if (exposed.length > 0) {
  throw new Error(`Unsafe UI leaked into the ${scanMode} bundle: ${exposed.join(', ')}`);
}
if (scanMode === 'preview') {
  const missing = diagnosticText.filter(
    (text) => !bundles.some(({ source }) => source.includes(text)),
  );
  if (missing.length > 0) {
    throw new Error(`Preview diagnostics are missing required text: ${missing.join(', ')}`);
  }
}
console.log(
  `${scanMode === 'preview' ? 'Preview' : 'Production'} safety check passed across ${files.length} JavaScript/CSS bundle(s).`,
);
