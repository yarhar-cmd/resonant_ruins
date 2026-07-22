# TypeScript inference and parity

`apps/frontend/src/model/inference.ts` performs pure local inference: validate the artifact, build
the semantic row, apply fixed one-hot encoding and missing policy, normalize, calculate logits,
apply stable softmax, validate finite probabilities and their sum, then rank by descending
P(About Right) with candidate ID as a stable tie-break. Results are typed as success, unavailable,
incompatible, or failed; inference errors never escape into gameplay control.

Explanations calculate normalized encoded value × coefficient for each class. The UI shows raw and
normalized values, coefficient, contribution, intercept, and readable association wording. It does
not use causal language. Full contribution matrices are not persisted.

Python-generated parity fixtures cover class paths, missing prior ratings, categorical paths,
cold-start/extreme values, invalid values, and ranking. Encoded vectors, normalized vectors,
logits, probabilities, classes, and ranks must match TypeScript to approximately 1e-9, with no
class or rank disagreement:

```powershell
pnpm verify:model-parity
```
