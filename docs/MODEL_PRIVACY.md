# Model privacy and Git safety

All preparation, training, evaluation, inference, and inspection are offline. There is no network
upload, analytics, cloud training, automatic model download, or configured localhost request. Raw
research exports, prepared private datasets, local reports/artifacts, experiment outputs, Python
environments, and caches are ignored by Git.

Only privacy-reduced prepared data may cross into Python. Participant/session identities become
temporary opaque group labels and their mapping is discarded. Committable artifacts and reports
contain aggregate counts/metrics, schemas, coefficients, fingerprints, and compatibility metadata—
never participant codes, session/run IDs, room records, raw exports, file paths, secrets, or private
group mappings.

Run `pnpm verify:model-safety:staged` before committing model outputs and
`pnpm verify:model-safety` for all tracked files. The scanner rejects raw ResearchExport structures,
participant-linked data filenames/values, private model paths, and high-confidence credentials
without printing secret values. Synthetic fixture paths are explicit and must never be represented
as real research data.

Research remains browser-local unless a user explicitly exports it. Future retention, consent,
deletion, and approval procedures must be reviewed before collecting or centrally storing data.
