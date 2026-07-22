# Model artifact and registry

`model-artifact-1` is validated strictly by Zod in
`apps/frontend/src/model/artifactSchema.ts`. It records artifact/status/model identity, dataset
fingerprint, fixed class and feature orders, categorical vocabularies, missing policy,
normalization, coefficients, intercepts, training configuration, aggregate counts, grouped
evaluation, compatibility metadata, optional calibration metadata, and a creation timestamp.

Artifact identity hashes prediction-relevant canonical content; the creation timestamp does not
change identity. Artifacts must not contain participant/session/run identifiers, room records, raw
exports, file paths, private group mappings, or secrets. Inspect sanitized metadata offline with:

```powershell
pnpm inspect:model -- path\to\artifact.json
```

The registry supports no model installed, explicitly selected development artifacts, and future
reviewed approved artifacts. Exactly one compatible approved artifact may eventually be the
Official default. `mvp-0.5` installs no approved model. The only committed artifact is the
unmistakably named synthetic development fixture used by tests and the Model Lab.
