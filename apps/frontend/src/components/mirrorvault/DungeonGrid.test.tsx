import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttackAction, PlayerState } from '../../types/player';
import type { RoomDefinition } from '../../types/rooms';
import { CURRENT_ROOM_LAYOUT } from '../../data/roomLayout';
import { evaluationRooms } from '../../data/rooms/evaluationRooms';
import {
  coordinateToGridPosition,
  createRectangularRoom,
  roomBounds,
} from '../../utils/roomGeometry';
import { DungeonGrid } from './DungeonGrid';
import { createRoomEnemyState } from '../../utils/enemySystem';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../../services/playerProfileStorage';
import { generateArchetypeRoomV3 } from '../../utils/generatedRoomGeneratorV3';

const bounds = { rows: 5, columns: 8 } as const;
const basePlayer: PlayerState = {
  position: { row: 2, column: 2 },
  facing: 'right',
  isShielding: false,
  shieldDirection: null,
};

function renderGrid(player: PlayerState = basePlayer, attack: AttackAction | null = null) {
  return render(
    <DungeonGrid
      bounds={bounds}
      hazards={CURRENT_ROOM_LAYOUT.hazards}
      player={player}
      status="active"
      isInvulnerable={false}
      blockedMove={null}
      lastAttack={attack}
      lastDamage={null}
      lastAvoidedDamage={null}
      announcement="Moved right."
      controlsDisabled={false}
      onMove={vi.fn()}
      onAttack={() => true}
      onShieldChange={vi.fn()}
    />,
  );
}

function dataDrivenGrid(room: RoomDefinition) {
  return (
    <DungeonGrid
      bounds={roomBounds(room)}
      hazards={(room.hazards ?? []).map(coordinateToGridPosition)}
      room={room}
      collapsedEntrance={{ x: 0, y: Math.floor(room.height / 2) }}
      player={{
        ...basePlayer,
        position: { row: Math.floor(room.height / 2), column: 1 },
      }}
      status="active"
      isInvulnerable={false}
      blockedMove={null}
      lastAttack={null}
      lastDamage={null}
      lastAvoidedDamage={null}
      announcement="Entered the next room."
      controlsDisabled={false}
      onMove={vi.fn()}
      onAttack={() => true}
      onShieldChange={vi.fn()}
    />
  );
}

describe('Resonant Ruins dungeon grid', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('provides Resonant Ruins instructions and a polite status announcement', () => {
    renderGrid();

    expect(
      screen.getByRole('application', { name: 'Resonant Ruins playable dungeon grid' }),
    ).toHaveAttribute('aria-describedby', 'resonant-ruins-grid-instructions');
    const help = screen.getByText('Controls').closest('details')!;
    expect(help).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Controls'));
    expect(screen.getByText(/Resonant Ruins controls/)).toBeVisible();
    expect(screen.getByText('Moved right.')).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the held shield at the player edge, follows facing, and renders no protected tile', () => {
    const shieldingRight: PlayerState = {
      ...basePlayer,
      isShielding: true,
      shieldDirection: 'right',
    };
    const { container, rerender } = renderGrid(shieldingRight);

    expect(container.querySelector('.player-token--shielding')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toBeNull();
    expect(container.querySelector('.player-token__sword')).not.toBeNull();
    expect(container.querySelector('.player-token')).toHaveAttribute(
      'data-equipment-handedness',
      'weapon-right-shield-left',
    );
    expect(container.querySelector('.player-token__sword')).toHaveAttribute(
      'data-equipment-hand',
      'right',
    );
    expect(container.querySelector('.player-token__shield--active')).toHaveAttribute(
      'data-shield-pose',
      'right-active',
    );
    expect(container.querySelector('.player-token__shield--active')).toHaveAttribute(
      'data-equipment-hand',
      'left',
    );
    expect(container.querySelector('.player-token__shield-guard')).not.toBeNull();
    expect(container.querySelector('.player-token--facing-right')).not.toBeNull();
    expect(container.querySelector('.tile--shield-protected')).toBeNull();
    expect(container.querySelector('.shield-tile-marker')).toBeNull();

    const shieldingDown: PlayerState = {
      ...shieldingRight,
      facing: 'down',
      shieldDirection: 'down',
    };
    rerender(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={shieldingDown}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Moved down."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--shielding')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toBeNull();
    expect(container.querySelector('.player-token__sword')).not.toBeNull();
    expect(container.querySelector('.player-token--facing-down')).not.toBeNull();
    expect(container.querySelector('.player-token__shield--active')).toHaveAttribute(
      'data-shield-pose',
      'down-active',
    );
    expect(container.querySelector('.player-token__shield-guard')).not.toBeNull();
    expect(container.querySelector('.tile--shield-protected')).toBeNull();
  });

  it('retains the shield treatment without rendering a protected tile outside the room', () => {
    const { container } = renderGrid({
      ...basePlayer,
      position: { row: 0, column: 2 },
      facing: 'up',
      isShielding: true,
      shieldDirection: 'up',
    });

    expect(container.querySelector('.player-token--shielding')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toBeNull();
    expect(container.querySelector('.tile--shield-protected')).toBeNull();
  });

  it.each(['up', 'right', 'down', 'left'] as const)(
    'exposes distinct idle and active %s shield poses',
    (facing) => {
      const { container, unmount } = renderGrid({
        ...basePlayer,
        facing,
        isShielding: false,
        shieldDirection: null,
      });
      expect(container.querySelector('.player-token__shield')).toHaveAttribute(
        'data-shield-pose',
        `${facing}-idle`,
      );
      expect(container.querySelector('.player-token__sword')).toHaveAttribute(
        'data-equipment-hand',
        'right',
      );
      expect(container.querySelector('.player-token__shield')).toHaveAttribute(
        'data-equipment-hand',
        'left',
      );
      expect(container.querySelector('.player-token__shield-guard')).toBeNull();
      unmount();

      const active = renderGrid({
        ...basePlayer,
        facing,
        isShielding: true,
        shieldDirection: facing,
      });
      expect(active.container.querySelector('.player-token__shield')).toHaveAttribute(
        'data-shield-pose',
        `${facing}-active`,
      );
      expect(active.container.querySelector('.player-token__sword')).toHaveAttribute(
        'data-equipment-hand',
        'right',
      );
      expect(active.container.querySelector('.player-token__shield')).toHaveAttribute(
        'data-equipment-hand',
        'left',
      );
      expect(active.container.querySelector('.player-token__shield-guard')).not.toBeNull();
    },
  );

  it('keeps the carried heater shield visible without showing active-block styling', () => {
    const { container } = renderGrid(basePlayer);
    expect(container.querySelector('.player-token__shield--carried')).toHaveAttribute(
      'data-shield-pose',
      'right-idle',
    );
    expect(container.querySelector('.player-token__shield--active')).toBeNull();
    expect(container.querySelector('.player-token__shield-guard')).toBeNull();
    expect(container.querySelector('.player-token__sword')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toBeNull();
  });

  it('renders a CSS Rat with cardinal facing and distinct combat-state hooks', () => {
    const room = createRectangularRoom({
      id: 'rat-visual-room',
      phase: 'dungeon',
      width: 9,
      height: 7,
      exitEnabled: true,
      enemySpawns: [
        {
          id: 'visual-rat',
          type: 'rat',
          tile: { x: 5, y: 3 },
          order: 1,
          source: 'generated',
          reason: 'Visual test',
        },
      ],
    });
    const enemies = createRoomEnemyState(room, 'seasoned-adventurer', 1_000);
    const { container, rerender } = render(
      <DungeonGrid
        bounds={roomBounds(room)}
        hazards={[]}
        room={room}
        player={{ ...basePlayer, position: { row: 3, column: 2 } }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Rat unaware."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
        enemies={enemies}
      />,
    );
    const rat = container.querySelector('[data-enemy-id="visual-rat"]');
    expect(rat).toHaveClass('rat-token--idle', 'rat-token--facing-left');
    expect(rat).toHaveAttribute('data-enemy-awareness', 'unaware');
    expect(rat?.querySelectorAll('.rat-token__ear')).toHaveLength(2);
    expect(rat?.querySelector('.rat-token__snout')).not.toBeNull();
    expect(rat?.querySelector('.rat-token__tail')).not.toBeNull();

    const telegraphing = {
      ...enemies,
      rats: [
        {
          ...enemies.rats[0]!,
          facing: 'down' as const,
          awareness: 'alerted' as const,
          state: 'telegraphing' as const,
          lockedTarget: { x: 5, y: 4 },
          telegraphEndsAt: 2_000,
        },
      ],
    };
    rerender(
      <DungeonGrid
        bounds={roomBounds(room)}
        hazards={[]}
        room={room}
        player={{ ...basePlayer, position: { row: 3, column: 2 } }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Rat telegraphing."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
        enemies={telegraphing}
      />,
    );
    expect(container.querySelector('[data-enemy-id="visual-rat"]')).toHaveClass(
      'rat-token--telegraphing',
      'rat-token--facing-down',
    );
    expect(container.querySelector('.rat-token__warning')).toBeNull();
  });

  it('anchors the brief slash to the sword hand without creating an out-of-room tile', () => {
    const attack: AttackAction = {
      id: 'attack-1',
      source: { row: 2, column: 2 },
      attemptedTarget: { row: 2, column: 3 },
      target: { row: 2, column: 3 },
      facing: 'right',
      damage: 1,
      timestamp: 1,
      blockedReason: null,
    };
    const { container, rerender } = renderGrid(basePlayer, attack);
    const playerTile = container.querySelector('.tile--player');
    const slash = playerTile?.querySelector('.attack-slash--right');
    const sword = playerTile?.querySelector('.player-token__sword');
    expect(container.querySelector('.tile--attack-target')).toBeNull();
    expect(slash?.querySelector('.attack-slash__arc')).not.toBeNull();
    expect(slash?.querySelector('.attack-slash__trail')).not.toBeNull();
    expect(slash).toHaveAttribute('data-attack-origin', '2,2');
    expect(slash).toHaveAttribute('data-attack-target', '3,2');
    expect(playerTile?.querySelector('.player-token--attacking-right')).not.toBeNull();
    expect(sword).toHaveClass('player-token__sword--attacking');
    expect(sword).toHaveAttribute('data-sword-pose', 'right-attack');
    expect(sword?.querySelector('.player-token__sword-hand')).not.toBeNull();
    expect(sword?.querySelector('.player-token__sword-pommel')).not.toBeNull();
    expect(sword?.querySelector('.player-token__sword-grip')).not.toBeNull();

    act(() => vi.advanceTimersByTime(180));
    expect(container.querySelector('.attack-slash')).toBeNull();
    expect(container.querySelector('.player-token--attacking')).toBeNull();
    expect(container.querySelector('.player-token__sword')).toHaveClass(
      'player-token__sword--idle',
    );
    expect(container.querySelector('.player-token__sword')).toHaveAttribute(
      'data-sword-pose',
      'right-idle',
    );

    rerender(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={{ ...basePlayer, position: { row: 0, column: 2 }, facing: 'up' }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={{
          ...attack,
          id: 'attack-edge',
          source: { row: 0, column: 2 },
          attemptedTarget: { row: -1, column: 2 },
          target: null,
          facing: 'up',
          blockedReason: 'bounds',
        }}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Attacked beyond the room boundary."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    const edgeSlash = container.querySelector('.tile--player .attack-slash--up');
    expect(container.querySelector('.tile--attack-target')).toBeNull();
    expect(edgeSlash).toHaveAttribute('data-attack-origin', '2,0');
    expect(edgeSlash).toHaveAttribute('data-attack-target', '2,-1');
    expect(container.querySelectorAll('.tile')).toHaveLength(bounds.rows * bounds.columns);
  });

  it.each(['up', 'right', 'down', 'left'] as const)(
    'uses a dedicated %s sword swing and slash presentation without changing the attack target',
    (facing) => {
      const attemptedTarget = {
        up: { row: 1, column: 2 },
        right: { row: 2, column: 3 },
        down: { row: 3, column: 2 },
        left: { row: 2, column: 1 },
      }[facing];
      const { container } = renderGrid(
        { ...basePlayer, facing },
        {
          id: `attack-${facing}`,
          source: basePlayer.position,
          attemptedTarget,
          target: attemptedTarget,
          facing,
          damage: 1,
          timestamp: 1,
          blockedReason: null,
        },
      );

      expect(container.querySelector(`.player-token--attacking-${facing}`)).not.toBeNull();
      expect(container.querySelector('.player-token__sword')).toHaveAttribute(
        'data-sword-pose',
        `${facing}-attack`,
      );
      expect(container.querySelector(`.attack-slash--${facing}`)).not.toBeNull();
      expect(container.querySelector(`.attack-slash--${facing}`)).toHaveAttribute(
        'data-attack-presentation',
        `forward-${facing}`,
      );
      expect(container.querySelector('.tile--attack-target')).toBeNull();
    },
  );

  it('renders blocked-movement feedback briefly', () => {
    const { container } = render(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={{ ...basePlayer, facing: 'left' }}
        status="active"
        isInvulnerable={false}
        blockedMove={{
          id: 'move-blocked',
          source: { row: 2, column: 2 },
          attemptedTarget: { row: 2, column: 1 },
          target: { row: 2, column: 2 },
          facing: 'left',
          moved: false,
          blockedReason: 'tile',
        }}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Blocked moving left."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--bump')).not.toBeNull();
    act(() => vi.advanceTimersByTime(160));
    expect(container.querySelector('.player-token--bump')).toBeNull();
  });

  it('renders both shared hazard coordinates and preserves the rune beneath the player', () => {
    const { container } = renderGrid({
      ...basePlayer,
      position: CURRENT_ROOM_LAYOUT.hazards[0]!,
    });
    const tiles = Array.from(container.querySelectorAll('.tile'));

    expect(container.querySelectorAll('.tile--hazard')).toHaveLength(2);
    expect(tiles[1 * bounds.columns + 5]).toHaveClass('tile--hazard', 'tile--player');
    expect(tiles[4 * bounds.columns + 2]).toHaveClass('tile--hazard');
    fireEvent.click(screen.getByText('Controls'));
    expect(screen.getByText(/Red rune floor markings are walkable hazards/)).toBeVisible();
  });

  it('shows nonfatal damage and invulnerability feedback', () => {
    const { container } = render(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={basePlayer}
        status="active"
        isInvulnerable
        blockedMove={null}
        lastAttack={null}
        lastDamage={{
          id: 'damage-1',
          source: 'rune',
          amount: 1,
          timestamp: 100,
          fatal: false,
        }}
        lastAvoidedDamage={null}
        announcement="Rune damaged you. 5 of 6 health remaining."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--damaged')).not.toBeNull();
    expect(container.querySelector('.player-token--invulnerable')).not.toBeNull();
    expect(container.querySelector('.player-token__invulnerable')).toHaveTextContent('◇');
  });

  it('renders a defeated player without active indicators and disables every control', () => {
    const { container } = render(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={{ ...basePlayer, isShielding: false, shieldDirection: null }}
        status="defeated"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={{
          id: 'fatal-1',
          source: 'rune',
          amount: 1,
          timestamp: 100,
          fatal: true,
        }}
        lastAvoidedDamage={null}
        announcement="You were defeated."
        controlsDisabled
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--defeated')).not.toBeNull();
    expect(container.querySelector('.player-token__dead-mark')).toHaveTextContent('×');
    expect(container.querySelector('.player-token--damaged')).toBeNull();
    expect(container.querySelector('.player-token__sword')).toBeNull();
    expect(container.querySelector('.player-token__shield')).toBeNull();
    expect(container.querySelector('.tile--shield-protected')).toBeNull();
    for (const control of screen.getAllByRole('button')) expect(control).toBeDisabled();
  });

  it('renders variable room geometry, visible walls, an open exit, and a collapsed entrance', () => {
    const room = evaluationRooms[1]!;
    const { container } = render(
      <DungeonGrid
        bounds={roomBounds(room)}
        hazards={[]}
        room={room}
        collapsedEntrance={{ x: 0, y: 5 }}
        player={{ ...basePlayer, position: { row: 5, column: 1 } }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Entered the next room."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('.tile')).toHaveLength(room.width * room.height);
    expect(container.querySelectorAll('.tile--wall')).toHaveLength(
      (room.wallTiles?.length ?? 0) - 1,
    );
    expect(container.querySelectorAll('.tile--exit-open')).toHaveLength(1);
    expect(container.querySelectorAll('.tile--collapsed-entrance')).toHaveLength(1);
    expect(screen.getByRole('application')).toHaveAttribute('data-room-columns', '17');
    expect(screen.getByRole('application')).toHaveAttribute('data-room-rows', '11');
    expect(screen.getByRole('application').getAttribute('style')).toContain('--room-columns: 17');
    expect(screen.getByRole('application').getAttribute('style')).toContain('--room-rows: 11');
    expect(container.querySelector('.dungeon-grid-viewport')).toHaveAttribute(
      'data-maximum-columns',
      '21',
    );
    expect(container.querySelector('.dungeon-grid-viewport')).toHaveAttribute(
      'data-maximum-rows',
      '15',
    );
  });

  it('switches the same upright doorway from closed to open without removing cave-in rubble', () => {
    const closedRoom = createRectangularRoom({
      id: 'door-state-room',
      phase: 'dungeon',
      width: 9,
      height: 7,
      exitEnabled: false,
    });
    const { container, rerender } = render(dataDrivenGrid(closedRoom));
    expect(container.querySelector('.tile--exit-closed')).not.toBeNull();
    expect(container.querySelector('.tile--exit-open')).toBeNull();
    expect(container.querySelector('.tile--collapsed-entrance')).not.toBeNull();

    const openRoom: RoomDefinition = {
      ...closedRoom,
      exits: closedRoom.exits.map((exit) => ({ ...exit, enabled: true })),
    };
    rerender(dataDrivenGrid(openRoom));
    expect(container.querySelector('.tile--exit-closed')).toBeNull();
    expect(container.querySelector('.tile--exit-open')).not.toBeNull();
    expect(container.querySelector('.tile--collapsed-entrance')).not.toBeNull();
  });

  it('marks Awakening surfaces and distinguishes the shortcut from its normal sibling door', () => {
    const room = evaluationRooms[0]!;
    const { container, rerender } = render(dataDrivenGrid(room));
    const normalExit = container.querySelector('[data-exit-kind="standard"]');
    const shortcut = container.querySelector('[data-exit-kind="shortcut"]');

    expect(screen.getByRole('application')).toHaveClass('dungeon-grid--awakening');
    expect(screen.getByRole('application')).toHaveAttribute('data-room-phase', 'evaluation');
    expect(container.querySelectorAll('.ruin-torch')).toHaveLength(2);
    expect(container.querySelectorAll('.ruin-prop')).toHaveLength(2);
    expect(container.querySelector('[data-prop-variant="iron-coffer"]')).not.toBeNull();
    expect(container.querySelector('[data-prop-variant="rubble-cluster"]')).not.toBeNull();
    expect(normalExit).not.toHaveClass('tile--exit-shortcut');
    expect(shortcut).toHaveClass('tile--exit-shortcut', 'tile--exit-sealed');
    expect(shortcut?.querySelector('[data-shortcut-exit]')).not.toBeNull();

    const unlocked: RoomDefinition = {
      ...room,
      exits: room.exits.map((exit) =>
        exit.kind === 'shortcut' ? { ...exit, enabled: true } : exit,
      ),
    };
    rerender(dataDrivenGrid(unlocked));
    expect(container.querySelector('[data-exit-kind="shortcut"]')).toHaveClass(
      'tile--exit-shortcut',
      'tile--exit-open',
    );
  });

  it('renders generator-3 void and internal structures as distinct solid tile layers', () => {
    const request = {
      runSeed: 'grid-topology',
      dungeonRoomNumber: 10,
      chosenExitId: 'grid-topology-exit',
      entranceDirection: 'west' as const,
      experiencePreset: 'dungeon-veteran' as const,
      effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
      mode: 'reinforce' as const,
      generatorVersion: 'generator-3' as const,
      adaptationVersion: 'rules-2' as const,
      gameVersion: 'mvp-0.3' as const,
    };
    const lRoom = generateArchetypeRoomV3(request, 'true-l-ruin').roomSnapshot;
    const { container, rerender } = render(dataDrivenGrid(lRoom));

    expect(container.querySelectorAll('[data-tile-kind="void"]')).not.toHaveLength(0);
    expect(container.querySelectorAll('[data-tile-kind="wall"]')).not.toHaveLength(0);

    const ringRoom = generateArchetypeRoomV3(request, 'ring-route').roomSnapshot;
    rerender(dataDrivenGrid(ringRoom));
    expect(container.querySelectorAll('[data-tile-kind="internal-wall"]')).toHaveLength(
      ringRoom.internalWallTiles?.length ?? 0,
    );
  });

  it('uses one shared responsive tile scale while room track counts change', () => {
    const smallRoom = evaluationRooms[0]!;
    const largeRoom = evaluationRooms[3]!;
    const { container, rerender } = render(dataDrivenGrid(smallRoom));
    const smallGrid = screen.getByRole('application');
    const smallViewport = container.querySelector('.dungeon-grid-viewport');

    expect(smallGrid).toHaveAttribute('data-room-columns', '15');
    expect(smallGrid).toHaveAttribute('data-room-rows', '11');
    expect(smallViewport).toHaveAttribute('data-maximum-columns', '21');
    expect(smallViewport).toHaveAttribute('data-maximum-rows', '15');
    expect(smallViewport).not.toHaveAttribute('style');
    expect(container.querySelectorAll('.tile')).toHaveLength(15 * 11);

    rerender(dataDrivenGrid(largeRoom));
    const largeGrid = screen.getByRole('application');
    const largeViewport = container.querySelector('.dungeon-grid-viewport');

    expect(largeGrid).toHaveAttribute('data-room-columns', '17');
    expect(largeGrid).toHaveAttribute('data-room-rows', '11');
    expect(largeViewport).not.toHaveAttribute('style');
    expect(container.querySelectorAll('.tile')).toHaveLength(17 * 11);
    expect(container.querySelector('.tile--wall')).not.toHaveAttribute('style');
    expect(container.querySelector('.tile--exit-open')).not.toHaveAttribute('style');
    expect(container.querySelector('.player-token')).not.toHaveAttribute('style');

    rerender(dataDrivenGrid(evaluationRooms[2]!));
    expect(container.querySelector('.tile--hazard')).not.toHaveAttribute('style');
    expect(container.querySelector('.tile--hazard')).toHaveClass('tile');
  });

  it('renders authored Fountain state and exposes the valid pointer Interact button', () => {
    const room = evaluationRooms[2]!;
    const fountainId = 'evaluation-room-03-restoration-fountain';
    const onInteract = vi.fn(() => true);
    const { container, rerender } = render(
      <DungeonGrid
        bounds={roomBounds(room)}
        hazards={(room.hazards ?? []).map(coordinateToGridPosition)}
        room={room}
        player={{
          ...basePlayer,
          position: { row: 2, column: 10 },
          facing: 'up',
        }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement=""
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
        availableInteraction={{
          id: fountainId,
          type: 'restoration-fountain',
          tile: { x: 10, y: 1 },
          range: 1,
          requiredFacing: 'up',
          available: true,
          accessibleLabel: 'Restore Health',
          prompt: 'E — Restore Health',
          channelDurationMs: 700,
        }}
        interactables={{
          [fountainId]: { depleted: false, encounteredAt: null, usedAt: null },
        }}
        onInteract={onInteract}
      />,
    );
    expect(container.querySelector('[data-fountain-state="unused"]')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Health' }));
    expect(onInteract).toHaveBeenCalledTimes(1);
    rerender(dataDrivenGrid(room));
    expect(container.querySelector('.ruin-torch')).toHaveAttribute('data-torch-mount', 'south');
    expect(container.querySelector('.ruin-torch__backplate')).not.toBeNull();
  });

  it('renders accessible unopened and opened ruined-stone Cache states with pointer interaction', () => {
    const baseRoom = createRectangularRoom({
      id: 'cache-grid-room',
      phase: 'dungeon',
      width: 9,
      height: 7,
      exitEnabled: true,
    });
    const cacheId = 'cache-grid-room-resonance-cache';
    const room: RoomDefinition = {
      ...baseRoom,
      features: [
        {
          id: cacheId,
          kind: 'resonance-cache',
          tile: { x: 4, y: 3 },
          blocking: true,
          rewardSystemVersion: 'rewards-1',
          placementCategory: 'optional-branch',
          spawnedReason: 'sandbox-forced',
          spawnRoll: 0.1,
          interactionTiles: [{ x: 3, y: 3 }],
          optionalRouteScore: 42,
          visualVariant: 'ruined-stone-coffer',
        },
      ],
    };
    const onInteract = vi.fn(() => true);
    const common = {
      bounds: roomBounds(room),
      hazards: [],
      room,
      player: { ...basePlayer, position: { row: 3, column: 3 } },
      status: 'active' as const,
      isInvulnerable: false,
      blockedMove: null,
      lastAttack: null,
      lastDamage: null,
      lastAvoidedDamage: null,
      announcement: '',
      controlsDisabled: false,
      onMove: vi.fn(),
      onAttack: () => true,
      onShieldChange: vi.fn(),
      onInteract,
    };
    const availableInteraction = {
      id: cacheId,
      type: 'resonance-cache' as const,
      tile: { x: 4, y: 3 },
      range: 1 as const,
      requiredFacing: 'right' as const,
      available: true,
      accessibleLabel: 'Resonance Cache, unopened, grants one Resonance',
      prompt: 'E â€” Open Resonance Cache',
      channelDurationMs: 400,
    };
    const { container, rerender } = render(
      <DungeonGrid
        {...common}
        availableInteraction={availableInteraction}
        interactables={{
          [cacheId]: {
            depleted: false,
            encounteredAt: 1_000,
            usedAt: null,
            resonanceAwarded: false,
          },
        }}
      />,
    );

    expect(container.querySelector('[data-cache-state="unopened"]')).toHaveClass(
      'resonance-cache--unopened',
    );
    expect(screen.getAllByText(/Resonance Cache, unopened, grants one Resonance/)).toHaveLength(2);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Resonance Cache, unopened, grants one Resonance',
      }),
    );
    expect(onInteract).toHaveBeenCalledTimes(1);

    rerender(
      <DungeonGrid
        {...common}
        availableInteraction={null}
        interactables={{
          [cacheId]: {
            depleted: true,
            encounteredAt: 1_000,
            usedAt: 1_400,
            resonanceAwarded: true,
          },
        }}
      />,
    );
    expect(container.querySelector('[data-cache-state="opened"]')).toHaveClass(
      'resonance-cache--opened',
    );
    expect(screen.getByText('Resonance Cache, opened')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Resonance Cache/ })).not.toBeInTheDocument();
  });
});
