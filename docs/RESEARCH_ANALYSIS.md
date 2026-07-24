# Research analysis

## Browser Research Analysis Lab

The local-first researcher interface is available at `/research/analysis`. It is separate from the
participant Pilot flow, researcher verification, live research storage, normal History, and the
offline command described below.

The Lab accepts one or more canonical `research-1` JSON exports. Each file is parsed with the same
`ResearchExportSchema` used by the rest of the application; invalid evidence is rejected with its
filename and is never repaired. Imported copies stay in the current tab's memory, are never
uploaded, and never overwrite `resonant-ruins:research:v1` or an active run. The Clear action only
removes those memory-held copies.

Pure modules under `apps/frontend/src/research/analysis` own:

- JSON validation and hierarchy-preserving session/run/room import
- durable-ID deduplication and conflict exclusion with source-filename audit trails
- filters, participant-condition summaries, condition/run/order summaries, and paired comparison
- fixed-Pilot and general data-quality warnings
- stable, spreadsheet-safe participant, paired, quality, and summary exports

Official complete sessions are the default cohort; Pilot data is opt-in and visibly labeled. The
primary metric is calculated per participant and condition:

```text
About Right Rate = submitted about_right difficulty ratings / all valid submitted difficulty ratings
```

Explicit full-feedback skips and missing/legacy defeat-not-requested ratings are excluded from that
denominator. Submitted ratings from defeated rooms remain included. Cross-condition summaries use
participant-level rates, while pooled room counts are shown only as descriptive context. Paired
results report adaptive-minus-neutral participant differences, complete/incomplete pair counts,
means, and medians. The Lab performs no room-level significance test and makes no statistical-
significance or causal claim.

Charts use CSS and semantic HTML rather than a charting dependency. Each visualization has visible
labels, an accessible summary, and a tabular alternative. Paired rows are keyboard focusable. The
route uses the existing researcher-only guard: while an active fixed Pilot is running, direct
navigation redirects to `/research` before imported evidence or condition labels enter the
participant-facing DOM.

## Offline command

Export JSON from the Research page, then run from the repository root:

```powershell
pnpm analyze:research -- path\to\resonant-ruins-research-export.json
```

Pilot sessions are excluded by default. Include them deliberately:

```powershell
pnpm analyze:research -- path\to\export.json --include-pilot
```

Optional machine-readable outputs:

```powershell
pnpm analyze:research -- path\to\export.json --json-output summary.json --csv-output summary.csv
```

The tool runtime-validates a `research-1` JSON export and reports overall counts/rates, both conditions, archetypes, participant-code-or-session groups, and data-quality warnings. Quality checks cover duplicate decision IDs, malformed numeric values, missing versions/feedback, incomplete sessions, uneven condition counts, Pilot records, participant codes reused across sessions, candidates without outcomes, and outcomes without feedback.

The primary metric is:

```text
About Right Rate = submitted about_right difficulty ratings / all submitted difficulty ratings
```

Explicit skips and legacy defeat-not-requested records are excluded from that denominator, and
sample size is always reported. Submitted defeat feedback is included like submitted clear
feedback. Output is descriptive only: no p-values, significance tests, causal claims, or winner
declaration are produced.

Future model evaluation must split and aggregate by participant/session rather than randomly splitting rooms. Room-level random splits would leak within-player behavior and carryover between training and evaluation data.
