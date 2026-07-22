# Accessibility

Resonant Ruins preserves keyboard play, the skip link, visible focus, semantic headings,
high-contrast styling, screen-reader labels, and responsive layouts. Sound is supplementary: Rat
telegraphs, hazards, blocks, interaction readiness, health, defeat, and exits remain visually
identifiable with audio muted.

Audio controls are native range inputs with visible numeric values, keyboard operation, mute, and
reset. Visual Effects and Audio remain separate preferences. `prefers-reduced-motion` disables
decorative motion and shake; Reduced and Off effects modes remove progressively more decorative
animation while retaining essential state cues.

Progressive-disclosure areas use native `details`/`summary`, which are keyboard operable without a
custom focus model. The primary navigation remains concise, Labs is grouped in Preview/local
builds, and every existing route remains available. Layouts are designed for 375, 768, and 1440 px
viewports, with wide technical tables allowed to scroll without forcing primary gameplay to do so.
