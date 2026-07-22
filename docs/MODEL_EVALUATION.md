# Model evaluation

Evaluation groups first by participant code when present and otherwise by research session. It uses
a deterministic grouped holdout plus GroupKFold on training groups, with the same partitions for
every baseline. It never performs a random room split or tunes on the final holdout. Folds missing
classes are reported; invalid grouped evaluation is an Official-readiness failure.

Run an aggregate offline report with:

```powershell
pnpm evaluate:model -- model-data\private\prepared.json --output model-reports\local\evaluation.json
```

Comparisons include global majority, training class priors, previous-rating persistence,
session-history majority, room-only logistic regression, player-plus-room logistic regression, and
player-plus-room-plus-rating-history logistic regression. Reports include accuracy, balanced
accuracy, macro precision/recall/F1, per-class metrics, confusion matrix, log loss, multiclass Brier
score, About Right precision/recall, fixed-bin reliability/calibration, and aggregate variation by
condition, preset, archetype, and sanitized group.

Review must ask whether player or history features help, previous ratings or archetype dominate,
the model collapses toward About Right, or performance varies sharply between groups. Calibration
is descriptive and sample-limited. No p-values, causal claims, superiority claims, or fixture
metrics should be presented as evidence about real players. Selection bias, missing defeat labels,
and feedback loops from previous ratings remain material limitations.
