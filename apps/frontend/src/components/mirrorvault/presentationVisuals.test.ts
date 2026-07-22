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
        `.player-token--facing-${direction} .player-token__shield--carried`,
      );
      expect(polishCss).toContain(
        `.player-token--facing-${direction} .player-token__shield--active`,
      );
      expect(polishCss).toContain(`.player-token--facing-${direction} .player-token__shield-guard`);
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
});
