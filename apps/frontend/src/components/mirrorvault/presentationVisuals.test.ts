import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const polishCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/polish.css'),
  'utf8',
);

describe('Resonant Ruins corrective presentation styling', () => {
  it('defines explicit idle and active shield poses plus shield-centered directional guard arcs', () => {
    for (const direction of ['up', 'right', 'down', 'left']) {
      expect(polishCss).toContain(
        `.player-token--shield-facing-${direction} .player-token__shield--carried`,
      );
      expect(polishCss).toContain(
        `.player-token--shield-facing-${direction} .player-token__shield--active`,
      );
      expect(polishCss).toContain(
        `.player-token--shield-facing-${direction} .player-token__shield-guard`,
      );
    }
    expect(polishCss).not.toMatch(
      /player-token--facing-(?:up|right|down|left) \.player-token__shield \{/,
    );
  });

  it('keeps doors upright in screen space and distinguishes open arches from cave-in rubble', () => {
    expect(polishCss).not.toContain(".tile--exit-open[data-exit-direction='east']::before");
    expect(polishCss).not.toContain(".tile--exit-open[data-exit-direction='south']::before");
    expect(polishCss).toContain('.tile--exit-open::before');
    expect(polishCss).toContain('.tile--exit-closed::before');
    expect(polishCss).toContain('.tile--collapsed-entrance::after');
  });

  it('uses an angular multi-point Rune sigil with a smooth alternate pulse and static fallbacks', () => {
    expect(polishCss).toMatch(/\.tile--hazard::after[\s\S]*clip-path: polygon\(/);
    expect(polishCss).toContain('rune-danger-pulse 2.4s ease-in-out infinite alternate');
    expect(polishCss).toMatch(/\.effects-reduced \.tile--hazard::after,[\s\S]*animation: none;/);
  });

  it('assembles the sword and gives every facing its own swing and slash geometry', () => {
    for (const direction of ['up', 'right', 'down', 'left']) {
      expect(polishCss).toContain(`@keyframes sword-swing-${direction}`);
      expect(polishCss).toContain(`@keyframes slash-sweep-${direction}`);
      expect(polishCss).toContain(`.attack-slash--${direction} .attack-slash__arc`);
      expect(polishCss).toContain(
        `.player-token--attacking-${direction} .player-token__sword--attacking`,
      );
    }
    expect(polishCss).toContain('.player-token__sword-hand');
    expect(polishCss).toContain('.player-token__sword-pommel');
    expect(polishCss).toContain('.player-token__sword-grip');
    expect(polishCss).toMatch(/\.attack-slash\s*\{[^}]*inset: auto;[^}]*animation: none;/);
    expect(polishCss).not.toMatch(/\.attack-slash--(?:up|right|down|left)\s*\{[^}]*rotate\(/);
    expect(polishCss).toMatch(/\.attack-slash--right\s*\{[^}]*left: 82%;/);
    expect(polishCss).toMatch(/\.attack-slash--left\s*\{[^}]*right: 82%;/);
    expect(polishCss).toMatch(/\.attack-slash--up\s*\{[^}]*bottom: 82%;/);
    expect(polishCss).toMatch(/\.attack-slash--down\s*\{[^}]*top: 82%;/);
  });

  it('keeps the right-hand weapon and left-hand shield in mirrored facing lanes', () => {
    expect(polishCss).toMatch(
      /\.player-token--shield-facing-right \.player-token__shield--carried\s*\{[^}]*top: 8%;[^}]*left: -12%;/,
    );
    expect(polishCss).toMatch(
      /\.player-token--shield-facing-left \.player-token__shield--carried\s*\{[^}]*top: 48%;[^}]*right: -12%;/,
    );
    expect(polishCss).toMatch(
      /\.player-token--shield-facing-up \.player-token__shield--carried\s*\{[^}]*left: -10%;/,
    );
    expect(polishCss).toMatch(
      /\.player-token--shield-facing-down \.player-token__shield--carried\s*\{[^}]*right: -10%;/,
    );
    expect(polishCss).toMatch(
      /\.player-token--weapon-facing-right \.player-token__sword\s*\{[^}]*top: 56%;[^}]*left: 48%;[^}]*rotate\(-8deg\);/,
    );
    expect(polishCss).toMatch(
      /\.player-token--weapon-facing-left \.player-token__sword\s*\{[^}]*top: 24%;[^}]*left: 52%;[^}]*rotate\(188deg\);/,
    );
    expect(polishCss).toMatch(
      /\.player-token--weapon-facing-up \.player-token__sword\s*\{[^}]*top: 50%;[^}]*left: 58%;[^}]*rotate\(-98deg\);/,
    );
    expect(polishCss).toMatch(
      /\.player-token--weapon-facing-down \.player-token__sword\s*\{[^}]*top: 48%;[^}]*left: 28%;[^}]*rotate\(82deg\);/,
    );
  });

  it('uses modern Awakening surfaces and a distinct in-family shortcut treatment', () => {
    expect(polishCss).toContain('.dungeon-grid--awakening .tile--floor');
    expect(polishCss).toContain('.dungeon-grid--awakening .tile--wall');
    expect(polishCss).toContain('.tile--exit-shortcut');
    expect(polishCss).toContain('.shortcut-exit-sigil');
    expect(polishCss).toContain('.tile--exit-shortcut.tile--exit-open::before');
    expect(polishCss).toContain('.ruin-prop--iron-coffer');
    expect(polishCss).toContain('.ruin-prop--rubble-cluster');
    expect(polishCss).toContain('.ruin-prop--broken-column');
    expect(polishCss).toContain('.ruin-prop--urn-cluster');
  });
});
