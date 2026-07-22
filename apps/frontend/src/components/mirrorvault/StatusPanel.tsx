export function StatusPanel({
  room,
  roomLabel,
  mode,
  character,
  currentHealth,
  maximumHealth,
  isInvulnerable,
  isDefeated,
  dungeonRoomsCleared,
  enemiesRemaining,
  resonance = 0,
  sandboxResonance = false,
  isHealing = false,
  fullHealthFeedback = false,
}: {
  room?: number;
  roomLabel?: string;
  mode: string;
  character: string;
  currentHealth: number;
  maximumHealth: number;
  isInvulnerable: boolean;
  isDefeated: boolean;
  dungeonRoomsCleared?: number;
  enemiesRemaining?: number;
  resonance?: number;
  sandboxResonance?: boolean;
  isHealing?: boolean;
  fullHealthFeedback?: boolean;
}) {
  const healthStatus = isDefeated ? ' You were defeated.' : isInvulnerable ? ' Invulnerable.' : '';

  return (
    <aside className="run-status" aria-label="Current run status">
      <div data-status-field="room">
        <span>Room</span>
        <strong>{roomLabel ?? `${String(room ?? 1).padStart(2, '0')} / 06`}</strong>
      </div>
      <div
        className={`health ${isHealing ? 'health--healing' : ''} ${fullHealthFeedback ? 'health--full-feedback' : ''}`}
        data-status-field="health"
        aria-label={`${currentHealth} of ${maximumHealth} health remaining.${healthStatus}`}
      >
        <span>Health</span>
        <strong className="health__indicators" aria-hidden="true">
          {Array.from({ length: maximumHealth }, (_, index) => (
            <span
              key={index}
              className={index < currentHealth ? 'health__remaining' : 'health__missing'}
            >
              {index < currentHealth ? '◆' : '◇'}
            </span>
          ))}
        </strong>
        <small className="health__text">
          {currentHealth} / {maximumHealth}
        </small>
        {isInvulnerable && !isDefeated && (
          <small className="health__condition">◇ Invulnerable</small>
        )}
        {isDefeated && (
          <small className="health__condition health__condition--defeated">× Defeated</small>
        )}
      </div>
      <div data-status-field="mode">
        <span>Mode</span>
        <strong>{mode}</strong>
      </div>
      {dungeonRoomsCleared !== undefined && (
        <div data-status-field="cleared">
          <span>Cleared</span>
          <strong>{dungeonRoomsCleared}</strong>
        </div>
      )}
      {enemiesRemaining !== undefined && (
        <div data-status-field="enemies" aria-label={`${enemiesRemaining} enemies remaining`}>
          <span>Enemies Remaining</span>
          <strong>{enemiesRemaining}</strong>
        </div>
      )}
      <div
        data-status-field="resonance"
        aria-label={`${sandboxResonance ? 'Sandbox ' : ''}Resonance ${resonance}`}
      >
        <span>{sandboxResonance ? 'Sandbox Resonance' : 'Resonance'}</span>
        <strong>◇ {resonance}</strong>
      </div>
      <div data-status-field="delver">
        <span>Delver</span>
        <strong>{character}</strong>
      </div>
    </aside>
  );
}
