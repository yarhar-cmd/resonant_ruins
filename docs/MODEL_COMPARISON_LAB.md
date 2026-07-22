# Model Comparison Lab

`/model-lab` is a local and opt-in Vercel Preview instrument. It is included in Preview only when
`VERCEL_ENV=preview` and `VITE_ENABLE_MODEL_LAB=true`; production excludes its route, navigation,
imports, fixture selector, artifact data, and mutation controls.

The Lab displays registry state, validates artifact and ResearchExport JSON in memory, shows model
metadata/evaluation, explores coefficients, generates an unchanged generator-4 shared pool,
compares Rules/Neutral/Model ranks and probabilities, renders candidate explanations and ASCII
geometry, inspects compact shadow records, and reports local timing. Participant-linked imports are
never persisted or displayed. Imported research records normally lack all candidate geometry, so
replay is disabled rather than approximated.

Exact candidates generated in memory may launch `/model-lab/sandbox`. The persistent warning states
that the room was not originally played and is not official research evidence. Sandbox execution
cannot write normal/research active saves, History, best records, permanent profiles, Official
session profiles, research records, or recovery state. Reloading loses both imported data and the
selected development artifact.
