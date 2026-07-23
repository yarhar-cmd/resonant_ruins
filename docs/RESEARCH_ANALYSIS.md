# Offline research analysis

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
