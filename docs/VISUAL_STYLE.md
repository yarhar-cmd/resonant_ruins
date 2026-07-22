# Resonant Ruins visual style

## Direction

The interface and dungeon use a restrained ancient-ruins language: near-black vault green, worn
stone, parchment text, oxidized rune red, muted brass, and warm torchlight. Decoration supports
hierarchy and gameplay readability; it does not conceal playable tiles or authoritative states.

The polish layer is centralized in `apps/frontend/src/styles/polish.css` and is loaded after the
existing styles. It refines the established component classes without replacing the React/CSS
architecture or changing tile geometry.

## Core rules

- Floor remains readable against heavier outer walls, solid internal structures, and flat void.
- Entrances and exits use shape, labels, and cardinal direction in addition to color.
- The Warden, shield, sword, Rats, Runes, Fountain, and Cache retain distinct silhouettes at tile
  scale.
- Torches are decorative CSS elements and never participate in collision, pathfinding, awareness,
  generation, or selection.
- Player pages favor one clear action and progressive disclosure. Dense Preview/local tools live
  under Labs and remain excluded from Production.
- Primary navigation is Home, Play, Research, History, and Settings. About and Characters remain
  available through secondary navigation; no route was removed.

## Effects modes

- **Full:** restrained torch flicker, embers, room dust, transition vignette, and brief impact
  motion.
- **Reduced:** static or nearly static lighting, shorter transitions, and no decorative drift.
- **Off:** no decorative animation or particles; essential state shapes remain visible.
- **Reduced motion:** the operating-system preference overrides decorative animation and shake,
  regardless of the selected effects mode.

Screen movement is reserved for brief player-damage and perfect-block feedback. Animation never
extends collision, attack range, timing, or authoritative gameplay state.

## Progressive disclosure

Home, the dungeon HUD, Research, Settings, Topology Lab, and Model Lab now prioritize the task a
player is performing. Instructions, storage/export actions, coefficient tables, raw metadata,
ASCII layouts, and diagnostics are collapsed by default with semantic `details`/`summary`
controls. Those controls remain keyboard operable and expose their labels to assistive technology.
