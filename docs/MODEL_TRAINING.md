# Offline model training

TypeScript owns semantic preparation; the offline Python package under `tools/model_training`
owns grouped splitting, baselines, fitting, evaluation, and artifact export. It uses pinned NumPy
2.5.1, pandas 3.0.3, scikit-learn 1.9.0, and standard-library `unittest`. It has no notebook,
cloud SDK, hosted job, runtime download, analytics, or upload path.

Windows setup from the repository root:

```powershell
py -m venv .venv-model
.\.venv-model\Scripts\python.exe -m pip install -r tools\model_training\requirements.txt
.\.venv-model\Scripts\python.exe tools\model_training\train_model.py model-data\private\prepared.json --output model-artifacts\local\candidate.json --report model-reports\local\candidate.json --allow-development-artifact
```

The deterministic multinomial logistic configuration is L2, `lbfgs`, C=1.0, balanced class
weights, intercept enabled, 2,000 maximum iterations, and tolerance 1e-8. Training refuses a
below-threshold dataset unless `--allow-development-artifact` is explicit. Approval additionally
requires `--status approved --approve-artifact`; output is never silently promoted or overwritten.

Promotion remains: prepare → train → grouped evaluation → manual review → mark approved → add to
the registry → commit only the artifact and sanitized aggregate report. The committed fixture is
synthetic, development-only, and is not `model-1` or a research finding.
