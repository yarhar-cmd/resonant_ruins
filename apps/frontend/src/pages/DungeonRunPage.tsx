import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DebugDrawer } from '../components/mirrorvault/DebugDrawer';
import { DungeonGrid } from '../components/mirrorvault/DungeonGrid';
import { AwakeningCompleteText } from '../components/mirrorvault/AwakeningCompleteText';
import { AwakeningTutorialTip } from '../components/mirrorvault/AwakeningTutorialTip';
import { GameOverResults } from '../components/mirrorvault/GameOverResults';
import { GameShell } from '../components/mirrorvault/GameShell';
import { PauseMenu } from '../components/mirrorvault/PauseMenu';
import { StatusPanel } from '../components/mirrorvault/StatusPanel';
import { StorageWarning } from '../components/mirrorvault/StorageWarning';
import { RoomFeedbackDialog } from '../components/mirrorvault/RoomFeedbackDialog';
import { useRunController } from '../hooks/useRunController';
import { loadActiveRun, type ActiveRunRecord } from '../services/activeRunStorage';
import { roomBounds } from '../utils/roomGeometry';
import { PLAYTEST_DIAGNOSTICS_ENABLED } from '../config/environment';
import type { RunControllerOptions } from '../hooks/useRunController';

const PreviewPlaytestDiagnostics = PLAYTEST_DIAGNOSTICS_ENABLED
  ? lazy(async () => {
      const module = await import('../components/mirrorvault/PlaytestDiagnostics');
      return { default: module.PlaytestDiagnostics };
    })
  : null;

export function DungeonRunPage() {
  const [initialRun] = useState(loadActiveRun);
  if (!initialRun.record) return <Navigate to="/dungeon" replace />;
  return <DungeonRunSession initialRecord={initialRun.record} />;
}

export function DungeonRunSession({
  initialRecord,
  controllerOptions,
}: {
  initialRecord: ActiveRunRecord;
  controllerOptions?: RunControllerOptions;
}) {
  const run = useRunController(initialRecord, controllerOptions);
  const [debugOpen, setDebugOpen] = useState(false);
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const debugButtonRef = useRef<HTMLButtonElement>(null);
  const paused = run.gameplay.pause.isPaused;
  const { defeated, pauseRun, setDebugInterfaceOpen } = run;

  useEffect(() => {
    if (paused || defeated) setDebugOpen(false);
  }, [defeated, paused]);

  useEffect(() => {
    setDebugInterfaceOpen(debugOpen);
  }, [debugOpen, setDebugInterfaceOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (
        event.code !== 'Escape' ||
        event.repeat ||
        event.defaultPrevented ||
        paused ||
        defeated ||
        run.pendingResearchFeedback
      )
        return;
      event.preventDefault();
      if (debugOpen) setDebugOpen(false);
      else pauseRun();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [debugOpen, defeated, paused, pauseRun, run.pendingResearchFeedback]);

  const isInvulnerable =
    run.roomTransition.isTransitioning || run.gameplay.invulnerability.expiresAt !== null;
  const controlsDisabled =
    run.gameplay.status !== 'active' ||
    paused ||
    run.roomTransition.isTransitioning ||
    debugOpen ||
    Boolean(run.pendingResearchFeedback);
  const enemiesRemaining = run.gameplay.enemies.rats.filter(
    (rat) => rat.health > 0 && rat.state !== 'corpse',
  ).length;
  const fountain = run.currentRoom.features?.find(
    (feature) => feature.kind === 'restoration-fountain',
  );
  const fountainUsed = Boolean(fountain && run.gameplay.interactables[fountain.id]?.depleted);
  const ratTelegraphing = run.gameplay.enemies.rats.some(
    (rat) => rat.health > 0 && rat.state === 'telegraphing',
  );

  return (
    <GameShell
      showDebug={Boolean(import.meta.env.DEV && run.debug)}
      debugOpen={debugOpen}
      debugButtonRef={debugButtonRef}
      onDebug={() => setDebugOpen((current) => !current)}
      utilityAction={
        PreviewPlaytestDiagnostics ? (
          <Suspense fallback={null}>
            <PreviewPlaytestDiagnostics
              gameplay={run.gameplay}
              room={run.currentRoom}
              isInvulnerable={isInvulnerable}
              effectsSetting={run.visualEffects}
              reducedMotion={run.reducedMotion}
              research={run.researchDiagnostics}
            />
          </Suspense>
        ) : null
      }
      pauseDisabled={run.defeated || paused || run.roomTransition.isTransitioning}
      pauseButtonRef={pauseButtonRef}
      onPause={run.pauseRun}
    >
      <StatusPanel
        roomLabel={run.roomLabel}
        mode={run.runMode === 'research' ? 'Research session' : 'Exploring'}
        character={run.character.name}
        currentHealth={run.gameplay.currentHealth}
        maximumHealth={run.gameplay.maximumHealth}
        isInvulnerable={isInvulnerable}
        isDefeated={run.defeated}
        isHealing={
          run.gameplay.interaction.status === 'completed' &&
          run.gameplay.interaction.result === 'restored-one-health'
        }
        fullHealthFeedback={
          run.gameplay.interaction.status === 'cancelled' &&
          run.gameplay.interaction.cancellationReason === 'unavailable' &&
          run.gameplay.currentHealth === run.gameplay.maximumHealth
        }
        dungeonRoomsCleared={
          run.inGeneratedDungeon ? run.gameplay.runStats.dungeonRoomsCleared : undefined
        }
        enemiesRemaining={
          run.gameplay.enemies.rats.length > 0 || run.currentRoom.enemySpawns?.length
            ? enemiesRemaining
            : undefined
        }
        resonance={run.gameplay.resonance}
        elapsedTime={run.frozenTime}
        sandboxResonance={run.runMode === 'sandbox'}
      />
      {run.storageWarning && (
        <StorageWarning message={run.storageWarning} onDismiss={run.clearStorageWarning} />
      )}
      <div className="game-run-region game-over-region" ref={run.gameRegionRef}>
        {run.defeated && !run.resultsVisible && (
          <GameOverResults visible={false} {...run.gameOverProps} />
        )}
        <section
          className="game-board-panel"
          data-game-status={run.gameplay.status}
          data-paused={paused}
          data-room-id={run.currentRoom.id}
          data-survival-time={run.frozenTime}
        >
          {run.runMode !== 'normal' && (
            <div className="chamber-label">
              <span>{run.roomLabel}</span>
              <span>{run.runMode === 'research' ? 'Research run active' : 'Sandbox active'}</span>
            </div>
          )}
          <AwakeningTutorialTip
            key={run.currentRoom.id}
            roomId={run.currentRoom.id}
            runMode={run.runMode}
            inGeneratedDungeon={run.inGeneratedDungeon}
            playerPosition={run.gameplay.player.position}
            fountainUsed={fountainUsed}
            ratTelegraphing={ratTelegraphing}
          />
          <DungeonGrid
            bounds={roomBounds(run.renderedRoom)}
            hazards={run.renderedHazards}
            room={run.renderedRoom}
            collapsedEntrance={run.collapsedEntrance}
            hidePlayer={run.roomTransition.phase === 'fading-out'}
            player={run.gameplay.player}
            status={run.gameplay.status}
            isInvulnerable={isInvulnerable}
            blockedMove={run.gameplay.blockedMove}
            lastAttack={run.gameplay.lastAttack}
            lastDamage={run.gameplay.lastDamage}
            lastAvoidedDamage={run.gameplay.lastAvoidedDamage}
            announcement={run.gameplay.announcement}
            controlsDisabled={controlsDisabled}
            onMove={run.controls.move}
            onAttack={run.controls.attack}
            onShieldChange={run.controls.setPointerShielding}
            enemies={run.gameplay.enemies}
            exitsSealed={enemiesRemaining > 0}
            availableInteraction={run.availableInteraction}
            interaction={run.gameplay.interaction}
            interactables={run.gameplay.interactables}
            onInteract={run.controls.interact}
          />
          {run.gameplay.currentHealth === 1 && !run.defeated && (
            <div className="low-health-vignette" aria-hidden="true" />
          )}
          {run.roomTransition.phase !== 'idle' && (
            <div
              className={`room-transition room-transition--${run.roomTransition.phase}`}
              aria-hidden="true"
            >
              <span className="room-transition__vignette" />
              <span className="room-transition__dust" />
            </div>
          )}
          {run.showAwakeningComplete && (
            <AwakeningCompleteText onFinished={run.hideAwakeningComplete} />
          )}
          {run.defeated && run.resultsVisible && !run.pendingResearchFeedback && (
            <GameOverResults visible {...run.gameOverProps} />
          )}
        </section>
      </div>
      <PauseMenu
        open={paused}
        pauseButtonRef={pauseButtonRef}
        savedMessage={run.lastSavedMessage}
        resonance={run.gameplay.resonance}
        onResume={run.resumeRun}
        onSettings={run.openSettings}
        onRestart={run.restartRun}
        onMainMenu={run.returnToMainMenuPreservingRun}
      />
      {run.pendingResearchFeedback && (
        <RoomFeedbackDialog
          pending={run.pendingResearchFeedback}
          onChange={run.updateResearchFeedback}
          onFinalize={run.finalizeResearchFeedback}
        />
      )}
      {import.meta.env.DEV && run.debug && (
        <DebugDrawer
          open={debugOpen}
          triggerRef={debugButtonRef}
          onClose={() => setDebugOpen(false)}
          debugToolsProps={{ gameplay: run.gameplay, ...run.debug }}
        />
      )}
    </GameShell>
  );
}
