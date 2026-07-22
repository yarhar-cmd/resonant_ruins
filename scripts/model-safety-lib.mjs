import { extname, basename } from 'node:path';

const dataExtensions = new Set(['.csv', '.json', '.jsonl', '.ndjson', '.parquet', '.tsv']);
const syntheticFixturePath = /(?:^|\/)(?:__fixtures__|fixtures\/synthetic)(?:\/|$)/i;
const privateFilename = /(?:participant|respondent|subject|session[-_]?\d)/i;
const rawResearchExport = /"researchSchemaVersion"\s*:\s*"research-1"[\s\S]*"sessions"\s*:/;
const participantValue = /"participantCode"\s*:\s*"[^"\r\n]+"/;
const privateRecordValue = /"(?:researchSessionId|runId)"\s*:\s*"[^"\r\n]+"/;
const highConfidenceSecrets = [
  new RegExp(['ghp', '_', '[A-Za-z0-9]{36,}'].join('')),
  new RegExp(['sk', '-', '(?:proj-)?', '[A-Za-z0-9_-]{20,}'].join('')),
  new RegExp(['AKIA', '[A-Z0-9]{16}'].join('')),
  new RegExp(['-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY-----'].join('')),
];

export function scanModelSafetyEntries(entries) {
  const issues = [];
  for (const entry of entries) {
    const path = entry.path.replaceAll('\\', '/');
    const extension = extname(path).toLowerCase();
    const isData = dataExtensions.has(extension);
    const isSyntheticFixture = syntheticFixturePath.test(path);
    const source = entry.source;

    if (isData && privateFilename.test(basename(path)) && !isSyntheticFixture) {
      issues.push({ path, reason: 'participant-linked identifier in data filename' });
    }
    if (isData && !isSyntheticFixture && rawResearchExport.test(source)) {
      issues.push({ path, reason: 'raw ResearchExport structure outside synthetic fixtures' });
    }
    if (isData && !isSyntheticFixture && participantValue.test(source)) {
      issues.push({ path, reason: 'participant-code value in staged data' });
    }
    if (isData && !isSyntheticFixture && privateRecordValue.test(source)) {
      issues.push({ path, reason: 'private session or run identifier in staged data' });
    }
    if (/^model-reports\/local\//i.test(path) || /^model-data\/private\//i.test(path)) {
      issues.push({ path, reason: 'private model input or local report path' });
    }
    if (highConfidenceSecrets.some((pattern) => pattern.test(source))) {
      issues.push({ path, reason: 'high-confidence secret pattern' });
    }
  }
  return issues;
}
