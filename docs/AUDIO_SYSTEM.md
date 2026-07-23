# Resonant Ruins audio system

## Architecture

`AudioProvider` owns one `AudioEngine` instance and exposes the typed `useAudio` interface.
Gameplay components do not construct oscillators or noise nodes. `useGameplayAudio` compares
authoritative snapshots through the pure `deriveGameplayAudioEvents` function and submits typed
events only after state has changed; audio can never mutate gameplay.

The engine lazily creates an `AudioContext` after a pointer or keyboard gesture. It then starts a
controlled preload/decode of the small local CC0 OGG library without delaying gameplay. A blocked,
unavailable, or failed sample is treated as a silent capability state, never a gameplay failure.
Concurrent activation is shared, transient voices are limited by category, cooldowns prevent rapid
stacking, and reset/room changes stop old transient sources.

## Channels and defaults

- Master: 70%
- Effects: 65%
- Ambience: 20%
- Muted: false

Settings are stored with the existing user settings and migrate the legacy sound toggle. Effects
and ambience feed separate gain buses under the master bus. Mute and volume changes apply without
changing input, timers, research records, model features, selectors, or room generation.

## Event taxonomy

The typed event catalog includes player movement and wall bumps; sword swing/hit; damage; shield
raise, block, and perfect block; Rat alert, telegraph, attack, damage, and defeat; Rune activation;
Fountain channel/heal; Cache opening; Resonance collection; exit activation; room transition; run
defeat; and UI confirm/cancel.

Footsteps rotate through four natural stone-step recordings with controlled pitch (0.94-1.06),
volume (0.94-1.08), cooldown, and voice limits. Perfect blocks use a brighter recorded metal clash
than normal blocks. Rat categories use separate recorded alert, urgent telegraph, and defeat cues
with a deliberately subdued per-event mix, cooldowns, and low concurrency so Rat presence remains
audible without overpowering footsteps, torch crackle, or room tone. Full provenance is maintained
in `docs/AUDIO_ASSETS.md`.

## Ambience and lifecycle

The only procedural audio is a quiet, four-second filtered-noise room tone with a restrained low
hum and torch-like crackle. It is enabled only on active dungeon-like routes, never on general
pages, and the engine prevents duplicate loops. Visibility changes stop or restart ambience safely;
hidden documents suppress new effects. All recorded effects ship locally and no external audio URL
or API is used at runtime.

Development builds may expose a capped event log for deterministic browser tests. That adapter is
loaded only behind `import.meta.env.DEV` and must not appear in Production bundles.

## Performance and isolation

The implementation avoids React animation loops, large assets, per-tile audio nodes, and unlimited
source overlap. Audio is presentation-only: muted and unmuted runs have the same room, input,
persistence, reward, research, and model behavior.
