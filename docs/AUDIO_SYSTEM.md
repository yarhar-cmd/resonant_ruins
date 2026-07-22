# Resonant Ruins audio system

## Architecture

`AudioProvider` owns one `AudioEngine` instance and exposes the typed `useAudio` interface.
Gameplay components do not construct oscillators or noise nodes. `useGameplayAudio` compares
authoritative snapshots through the pure `deriveGameplayAudioEvents` function and submits typed
events only after state has changed; audio can never mutate gameplay.

The engine lazily creates an `AudioContext` after a pointer or keyboard gesture. A blocked or
unavailable context is treated as a silent capability state, never a gameplay failure. Concurrent
activation is shared, transient voices are limited by category, cooldowns prevent rapid stacking,
and reset/room changes stop old transient sources.

## Channels and defaults

- Master: 70%
- Effects: 65%
- Ambience: 30%
- Muted: false

Settings are stored with the existing user settings and migrate the legacy sound toggle. Effects
and ambience feed separate gain buses under the master bus. Mute and volume changes apply without
changing input, timers, research records, model features, selectors, or room generation.

## Event taxonomy

The typed event catalog includes player movement and wall bumps; sword swing/hit; damage; shield
raise, block, and perfect block; Rat alert, telegraph, attack, damage, and defeat; Rune activation;
Fountain channel/heal; Cache opening; Resonance collection; exit activation; room transition; run
defeat; and UI confirm/cancel.

Footsteps use controlled pitch (0.94-1.06), volume (0.88-1.00), filtering, cooldown, and voice
limits. Perfect blocks use a brighter metallic transient than normal blocks. Rat categories use
cooldowns and low concurrency to prevent loud chorusing.

## Ambience and lifecycle

The only ambience is a quiet, four-second filtered-noise room tone with a restrained low hum. It is
enabled only on active dungeon-like routes, never on general pages, and the engine prevents
duplicate loops. Visibility changes stop or restart ambience safely; hidden documents suppress new
effects. There are no runtime network requests or external files.

Development builds may expose a capped event log for deterministic browser tests. That adapter is
loaded only behind `import.meta.env.DEV` and must not appear in Production bundles.

## Performance and isolation

The implementation avoids React animation loops, large assets, per-tile audio nodes, and unlimited
source overlap. Procedural audio is presentation-only: muted and unmuted runs have the same room,
input, persistence, reward, research, and model behavior.
