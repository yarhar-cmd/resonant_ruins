import type { AudioEvent } from '../types/audio';
import type { RatEnemy } from '../types/enemies';
import type { GameplayState } from './gameplayState';

export interface GameplayAudioSnapshot {
  gameplay: GameplayState;
  roomId: string;
}

function previousRatById(rats: readonly RatEnemy[]): Map<string, RatEnemy> {
  return new Map(rats.map((rat) => [rat.id, rat]));
}

/**
 * Converts already-authoritative gameplay transitions into presentational audio events.
 * This function is intentionally pure: it cannot dispatch actions or influence saved state.
 */
export function deriveGameplayAudioEvents(
  previous: GameplayAudioSnapshot | null,
  next: GameplayAudioSnapshot,
): AudioEvent[] {
  if (
    !previous ||
    !next.gameplay.runStats.runId ||
    previous.gameplay.runStats.runId !== next.gameplay.runStats.runId
  )
    return [];

  const events: AudioEvent[] = [];
  const before = previous.gameplay;
  const after = next.gameplay;

  if (after.lastMove?.id && after.lastMove.id !== before.lastMove?.id) {
    events.push({
      name: after.lastMove.moved ? 'player.step' : 'player.wall-bump',
      sourceId: after.lastMove.id,
      intensity: after.lastMove.moved ? 0.82 : 0.58,
    });
  }

  if (after.lastAttack?.id && after.lastAttack.id !== before.lastAttack?.id) {
    events.push({ name: 'player.attack-swing', sourceId: after.lastAttack.id });
    if (
      after.enemies.combatMetrics.playerHitsLanded > before.enemies.combatMetrics.playerHitsLanded
    )
      events.push({ name: 'player.attack-hit', sourceId: after.lastAttack.id });
  }

  if (!before.player.isShielding && after.player.isShielding) events.push({ name: 'shield.raise' });

  if (
    after.enemies.lastBlockAt !== null &&
    after.enemies.lastBlockAt !== before.enemies.lastBlockAt
  ) {
    events.push({
      name: after.enemies.lastBlockKind === 'perfect' ? 'shield.perfect-block' : 'shield.block',
      sourceId: `block-${after.enemies.lastBlockAt}`,
    });
  }

  const previousRats = previousRatById(before.enemies.rats);
  for (const rat of after.enemies.rats) {
    const prior = previousRats.get(rat.id);
    if (!prior) continue;
    if (prior.awareness !== 'alerted' && rat.awareness === 'alerted')
      events.push({ name: 'rat.alert', sourceId: rat.id, intensity: 0.65 });
    if (prior.state !== 'telegraphing' && rat.state === 'telegraphing')
      events.push({ name: 'rat.telegraph', sourceId: rat.id });
    if (prior.state !== 'lunging' && rat.state === 'lunging')
      events.push({ name: 'rat.attack', sourceId: rat.id });
    if (rat.health < prior.health && rat.health > 0)
      events.push({ name: 'rat.damage', sourceId: rat.id });
    if (prior.state !== 'corpse' && rat.state === 'corpse')
      events.push({ name: 'rat.defeat', sourceId: rat.id });
  }

  if (after.lastDamage?.id && after.lastDamage.id !== before.lastDamage?.id) {
    if (after.lastDamage.source === 'rune')
      events.push({ name: 'rune.trigger', sourceId: after.lastDamage.id });
    events.push({ name: 'player.damage', sourceId: after.lastDamage.id });
  }

  if (before.interaction.status !== 'channeling' && after.interaction.status === 'channeling') {
    events.push({
      name: after.interaction.type === 'resonance-cache' ? 'cache.open' : 'fountain.channel',
      sourceId: after.interaction.targetId ?? undefined,
    });
  }

  if (before.interaction.status !== 'completed' && after.interaction.status === 'completed') {
    if (after.interaction.result === 'restored-one-health')
      events.push({ name: 'fountain.heal', sourceId: after.interaction.targetId ?? undefined });
    if (after.interaction.result === 'awarded-resonance')
      events.push({ name: 'resonance.collect', sourceId: after.interaction.targetId ?? undefined });
  }

  if (previous.roomId !== next.roomId) {
    events.push({ name: 'exit.activate', sourceId: previous.roomId });
    events.push({ name: 'room.transition', sourceId: next.roomId });
  }

  if (before.status !== 'defeated' && after.status === 'defeated')
    events.push({ name: 'run.defeat', sourceId: after.runStats.runId ?? undefined });

  return events;
}
