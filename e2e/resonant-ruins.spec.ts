import { expect, test, type Page } from '@playwright/test';
import {
  createActiveRunRecord,
  type ActiveRunRecord,
} from '../apps/frontend/src/services/activeRunStorage';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../apps/frontend/src/services/playerProfileStorage';
import { gameplayReducer } from '../apps/frontend/src/utils/gameplayState';
import { generateDungeonRoom } from '../apps/frontend/src/utils/generatedRoomGenerator';
import { generateArchetypeRoomV3 } from '../apps/frontend/src/utils/generatedRoomGeneratorV3';
import type { RoomArchetype } from '../apps/frontend/src/types/topology';
import { createRatFromSpawn, createRoomEnemyState } from '../apps/frontend/src/utils/enemySystem';
import { emptyEnemyRoomState } from '../apps/frontend/src/utils/enemySystem';
import { coordinateToGridPosition, findSafeSpawn } from '../apps/frontend/src/utils/roomGeometry';
import { createFreshRun } from '../apps/frontend/src/utils/runLifecycle';
import { evaluationRooms } from '../apps/frontend/src/data/rooms/evaluationRooms';
import { createCombatMetrics, type EnemyRoomState } from '../apps/frontend/src/types/enemies';
import { RAT_COMBAT_CONFIG } from '../apps/frontend/src/config/combat';
import type { TileCoordinate } from '../apps/frontend/src/types/rooms';
import { researchFixture } from '../apps/frontend/src/test/researchFixtures';
import {
  applyRewardLayer,
  findRewardPlacementCandidates,
} from '../apps/frontend/src/utils/rewardGeneration';
import {
  directionBetweenAdjacent,
  getResonanceCaches,
} from '../apps/frontend/src/utils/interactions';

const ACTIVE_RUN_KEY = 'mirrorvault:active-run:v1';
const RESEARCH_STORAGE_KEY = 'resonant-ruins:research:v1';
const RESEARCH_ACTIVE_RUN_KEY = 'resonant-ruins:research-active-run:v1';

function freshRecord(): ActiveRunRecord {
  const now = Date.now();
  const gameplay = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    startedAt: now,
    runId: `e2e-run-${now}`,
    runSeed: `e2e-seed-${now}`,
  });
  return createActiveRunRecord(gameplay, 'warden', now)!;
}

function combatRecord({
  player = { x: 3, y: 5 },
  rats = [{ x: 4, y: 5 }],
  telegraph = false,
  corpse = false,
  paused = false,
}: {
  player?: TileCoordinate;
  rats?: TileCoordinate[];
  telegraph?: boolean;
  corpse?: boolean;
  paused?: boolean;
} = {}): ActiveRunRecord {
  const now = Date.now();
  const room = evaluationRooms[3]!;
  const enemies: EnemyRoomState = {
    roomId: room.id,
    rats: rats.map((tile, index) =>
      createRatFromSpawn(
        {
          id: `e2e-rat-${index + 1}`,
          type: 'rat',
          tile,
          order: index + 1,
          source: 'authored',
          reason: 'Controlled Chromium fixture',
        },
        now,
      ),
    ),
    aiFrozen: false,
    countPlan: null,
    lastBlockAt: null,
    lastBlockKind: null,
    lastTickAt: now,
    awarenessGraceEndsAt: now + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs,
    combatMetrics: createCombatMetrics(),
  };
  let gameplay = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: now,
      runId: `combat-run-${now}`,
      runSeed: `combat-seed-${now}`,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: room.id,
      destinationRoomIndex: 3,
      destinationSpawn: coordinateToGridPosition(player),
      enteredFrom: 'west',
      exitedAtMs: 0,
      exitChoice: null,
      evaluationComplete: false,
      enemies,
    },
  );
  if (telegraph)
    gameplay = gameplayReducer(gameplay, {
      type: 'enemy-tick',
      timestamp: now + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs,
      room,
    });
  if (corpse) {
    gameplay = gameplayReducer(gameplay, {
      type: 'attack',
      id: 'e2e-sword-1',
      timestamp: now + 10,
      room,
    });
    gameplay = gameplayReducer(gameplay, {
      type: 'attack',
      id: 'e2e-sword-2',
      timestamp: now + 410,
      room,
    });
  }
  const recordTime = corpse
    ? now + 420
    : telegraph
      ? now + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs + 100
      : now;
  if (paused)
    gameplay = gameplayReducer(gameplay, {
      type: 'pause-run',
      timestamp: recordTime,
      reason: 'pause-menu',
    });
  return createActiveRunRecord(gameplay, 'warden', recordTime)!;
}

function maximumRoomRecord(): ActiveRunRecord {
  const initial = freshRecord();
  const maximumProfile = { ...NEUTRAL_ADAPTIVE_PROFILE, pace: 1, exploration: 1 };
  let generated = generateDungeonRoom({
    runSeed: 'maximum-room-fixture',
    dungeonRoomNumber: 1,
    chosenExitId: 'maximum-exit-0',
    entranceDirection: 'west',
    experiencePreset: 'seasoned-adventurer',
    effectiveProfile: maximumProfile,
    mode: 'reinforce',
    generatorVersion: 'generator-2',
  });
  for (
    let index = 1;
    index < 10_000 && (generated.roomSnapshot.width !== 21 || generated.roomSnapshot.height !== 15);
    index += 1
  ) {
    generated = generateDungeonRoom({
      runSeed: `maximum-room-fixture-${index}`,
      dungeonRoomNumber: 1,
      chosenExitId: `maximum-exit-${index}`,
      entranceDirection: 'west',
      experiencePreset: 'seasoned-adventurer',
      effectiveProfile: maximumProfile,
      mode: index % 2 ? 'poke' : 'reinforce',
      generatorVersion: 'generator-2',
    });
  }
  if (generated.roomSnapshot.width !== 21 || generated.roomSnapshot.height !== 15)
    throw new Error('Unable to create deterministic 21x15 room fixture.');
  const restored = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: 1_000,
      runId: initial.runId,
      runSeed: generated.runSeed,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: generated.roomSnapshot.id,
      destinationRoomIndex: 5,
      destinationSpawn: coordinateToGridPosition(findSafeSpawn(generated.roomSnapshot, 'west')),
      enteredFrom: 'west',
      exitedAtMs: 1_000,
      exitChoice: null,
      evaluationComplete: true,
      generatedRoom: generated,
      chosenExitId: 'maximum-room-entry',
    },
  );
  return createActiveRunRecord(restored, 'warden', 2_000)!;
}

function topologyRecord(archetype: Exclude<RoomArchetype, 'safe-fallback'>): ActiveRunRecord {
  const now = Date.now();
  const generated = generateArchetypeRoomV3(
    {
      runSeed: `topology-${archetype}`,
      dungeonRoomNumber: 10,
      chosenExitId: 'topology-entry',
      entranceDirection: 'west',
      experiencePreset: 'dungeon-veteran',
      effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
      mode: 'reinforce',
      generatorVersion: 'generator-3',
      adaptationVersion: 'rules-2',
      gameVersion: 'mvp-0.3',
    },
    archetype,
  );
  const gameplay = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'dungeon-veteran',
      startedAt: now,
      runId: `topology-run-${archetype}`,
      runSeed: generated.runSeed,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: generated.roomSnapshot.id,
      destinationRoomIndex: 5,
      destinationSpawn: coordinateToGridPosition(findSafeSpawn(generated.roomSnapshot, 'west')),
      enteredFrom: 'west',
      exitedAtMs: 0,
      exitChoice: null,
      evaluationComplete: true,
      generatedRoom: generated,
      chosenExitId: 'topology-entry',
      exitDirection: 'east',
    },
  );
  return createActiveRunRecord(gameplay, 'warden', now)!;
}

function fountainRecord({
  currentHealth = 5,
  alertedRat = false,
}: {
  currentHealth?: number;
  alertedRat?: boolean;
} = {}): ActiveRunRecord {
  const now = Date.now();
  const room = evaluationRooms[2]!;
  const enemies = emptyEnemyRoomState(room.id);
  if (alertedRat) {
    enemies.aiFrozen = true;
    enemies.rats = [
      {
        ...createRatFromSpawn(
          {
            id: 'e2e-fountain-rat',
            type: 'rat',
            tile: { x: 3, y: 3 },
            order: 1,
            source: 'debug',
            reason: 'Controlled Fountain combat-lock fixture',
          },
          now,
        ),
        awareness: 'alerted',
        state: 'chasing',
      },
    ];
  }
  let gameplay = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: now,
      runId: `fountain-run-${now}`,
      runSeed: `fountain-seed-${now}`,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: room.id,
      destinationRoomIndex: 2,
      destinationSpawn: coordinateToGridPosition({ x: 10, y: 2 }),
      enteredFrom: 'west',
      exitedAtMs: 0,
      exitChoice: null,
      evaluationComplete: false,
      destinationRoom: room,
      enemies,
    },
  );
  gameplay = gameplayReducer(gameplay, {
    type: 'turn',
    direction: 'up',
    trigger: 'press',
    timestamp: now,
  });
  return createActiveRunRecord({ ...gameplay, currentHealth }, 'warden', now)!;
}

let generatedCacheFixture: ReturnType<typeof applyRewardLayer> | null = null;
function cacheGeneratedRoom() {
  if (generatedCacheFixture) return structuredClone(generatedCacheFixture);
  for (let index = 0; index < 40; index += 1) {
    const selected = generateDungeonRoom({
      runSeed: `e2e-cache-${index}`,
      dungeonRoomNumber: 10,
      chosenExitId: 'e2e-cache-entry',
      entranceDirection: 'west',
      experiencePreset: 'seasoned-adventurer',
      effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
      mode: 'reinforce',
      generatorVersion: 'generator-4',
      adaptationVersion: 'rules-2',
      gameVersion: 'mvp-0.5',
    });
    if (
      findRewardPlacementCandidates(selected).candidates.length > 0 &&
      (selected.roomSnapshot.enemySpawns?.length ?? 0) > 0
    ) {
      generatedCacheFixture = applyRewardLayer(selected, { override: 'force' });
      return structuredClone(generatedCacheFixture);
    }
  }
  throw new Error('Unable to create deterministic Resonance Cache browser fixture.');
}

function cacheRecord({
  alertedRat = false,
  unawareRat = false,
  opened = false,
  defeated = false,
}: {
  alertedRat?: boolean;
  unawareRat?: boolean;
  opened?: boolean;
  defeated?: boolean;
} = {}): ActiveRunRecord {
  const now = Date.now();
  const generated = cacheGeneratedRoom();
  const cache = getResonanceCaches(generated.roomSnapshot)[0]!;
  const approach = cache.interactionTiles[0]!;
  const facing = directionBetweenAdjacent(approach, cache.tile)!;
  const enemies = createRoomEnemyState(
    generated.roomSnapshot,
    'seasoned-adventurer',
    now,
    generated.details.enemyCountPlan ?? null,
  );
  if (alertedRat) {
    const rat = enemies.rats[0];
    if (!rat) throw new Error('Cache browser fixture needs a Rat for combat-lock coverage.');
    enemies.aiFrozen = true;
    enemies.rats[0] = { ...rat, awareness: 'alerted', state: 'chasing' };
  } else if (unawareRat) {
    enemies.aiFrozen = true;
  } else if (!unawareRat) {
    enemies.rats = [];
  }
  let gameplay = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: now,
      runId: `cache-run-${now}`,
      runSeed: generated.runSeed,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: generated.roomSnapshot.id,
      destinationRoomIndex: 5,
      destinationSpawn: coordinateToGridPosition(approach),
      enteredFrom: 'west',
      exitedAtMs: 0,
      exitChoice: null,
      evaluationComplete: true,
      generatedRoom: generated,
      chosenExitId: 'e2e-cache-entry',
      exitDirection: 'east',
      enemies,
    },
  );
  gameplay = gameplayReducer(gameplay, {
    type: 'turn',
    direction: facing,
    trigger: 'press',
    timestamp: now,
  });
  if (opened) {
    gameplay = {
      ...gameplay,
      resonance: 1,
      interactables: {
        ...gameplay.interactables,
        [cache.id]: {
          ...gameplay.interactables[cache.id]!,
          depleted: true,
          encounteredAt: now,
          usedAt: now,
          healthWhenUsed: 6,
          resonanceAwarded: true,
        },
      },
    };
  }
  const record = createActiveRunRecord(gameplay, 'warden', now)!;
  return defeated ? { ...record, status: 'defeated', currentHealth: 0 } : record;
}

async function seedActiveRun(page: Page, record: ActiveRunRecord = freshRecord()) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: ACTIVE_RUN_KEY,
    value: record,
  });
}

async function developmentAudioEvents(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __RESONANT_RUINS_AUDIO_DEBUG__?: Array<{
            name: string;
            played: boolean;
            pitch: number;
          }>;
        }
      ).__RESONANT_RUINS_AUDIO_DEBUG__ ?? [],
  );
}

function pendingResearchBrowserFixture() {
  const fixture = researchFixture();
  return {
    storage: {
      researchSchemaVersion: 'research-1',
      activeSessionId: fixture.session.id,
      sessions: [fixture.session],
    },
    active: {
      researchSchemaVersion: 'research-1',
      researchSessionId: fixture.session.id,
      researchRunId: fixture.run.id,
      gameplay: createActiveRunRecord(fixture.gameplay, 'warden', Date.now())!,
      pendingFeedback: fixture.pending,
      roomStart: fixture.roomStart,
    },
  };
}

function defeatedResearchBrowserFixture() {
  const fixture = pendingResearchBrowserFixture();
  return {
    ...fixture,
    active: {
      ...fixture.active,
      gameplay: {
        ...fixture.active.gameplay,
        status: 'defeated' as const,
        currentHealth: 0,
      },
      pendingFeedback: null,
    },
  };
}

function completedResearchBrowserFixture() {
  const fixture = researchFixture();
  const feedback = {
    ...fixture.record.feedback,
    status: 'submitted' as const,
    difficulty: 'about_right' as const,
    fairness: 4 as const,
    enjoyment: 5 as const,
    submittedAt: '2026-01-01T00:00:20.000Z',
    responseDurationMs: 10_000,
  };
  const official = structuredClone(fixture.session);
  official.status = 'ended';
  official.endedAt = '2026-01-01T00:00:20.000Z';
  official.runs[0]!.status = 'completed';
  official.runs[0]!.endedAt = official.endedAt;
  official.runs[0]!.rooms = [{ ...fixture.record, feedback }];
  const pilot = structuredClone(official);
  pilot.id = 'pilot-session-fixture';
  pilot.pilot = true;
  pilot.participantCode = 'PILOT_01';
  pilot.runs[0]!.id = 'pilot-run-fixture';
  pilot.runs[0]!.pilot = true;
  pilot.runs[0]!.rooms = [
    {
      ...pilot.runs[0]!.rooms[0]!,
      pilot: true,
      participantCode: pilot.participantCode,
      researchSessionId: pilot.id,
      runId: pilot.runs[0]!.id,
      roomDecisionId: 'pilot-room-decision-fixture',
    },
  ];
  return {
    researchSchemaVersion: 'research-1',
    activeSessionId: null,
    sessions: [official, pilot],
  };
}

test.beforeEach(async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('http://localhost:3001/api/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  (page as Page & { consoleErrors?: string[] }).consoleErrors = consoleErrors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { consoleErrors?: string[] }).consoleErrors).toEqual([]);
});

test('Awakening tips stay above the grid on mobile, dismiss contextually, and skip generated rooms', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedActiveRun(page);
  await page.goto('/dungeon/run');

  const tip = page.getByLabel('Awakening Chamber tutorial');
  await expect(tip).toContainText(
    'Move with WASD or the arrow keys. Step into the glowing exit to continue.',
  );
  const tipBounds = await tip.boundingBox();
  const gridBounds = await page.locator('.dungeon-grid').boundingBox();
  expect(tipBounds).not.toBeNull();
  expect(gridBounds).not.toBeNull();
  expect(tipBounds!.y + tipBounds!.height).toBeLessThanOrEqual(gridBounds!.y);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(tip).toHaveCount(0);

  await page.goto('/');
  await seedActiveRun(page, topologyRecord('open-arena'));
  await page.goto('/dungeon/run');
  await expect(page.getByLabel('Awakening Chamber tutorial')).toHaveCount(0);
});

test('Research page requires opt-in and starts labeled Pilot and Official sessions locally', async ({
  page,
}) => {
  await seedActiveRun(page);
  const normalBefore = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_RUN_KEY);
  await page.goto('/research');
  await expect(page.getByRole('heading', { name: 'Research Mode' })).toBeVisible();
  await expect(page.getByText(/Nothing is automatically uploaded/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Pilot Session' })).toBeDisabled();
  await page.getByLabel('Optional participant code').fill('PILOT_BROWSER_01');
  await page.getByLabel(/I have read this notice and choose to start/i).check();
  await page.getByRole('button', { name: 'Start Pilot Session' }).click();
  await expect(page).toHaveURL(/\/research\/run$/);
  const pilot = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    RESEARCH_STORAGE_KEY,
  );
  expect(pilot.sessions[0]).toMatchObject({ pilot: true, participantCode: 'PILOT_BROWSER_01' });
  expect(await page.evaluate((key) => localStorage.getItem(key), ACTIVE_RUN_KEY)).toBe(
    normalBefore,
  );
  await expect(page.locator('body')).not.toContainText('RULES_ADAPTIVE');
  await expect(page.locator('body')).not.toContainText('NEUTRAL_PROCEDURAL');

  await page.evaluate(
    ({ storageKey, activeKey }) => {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(activeKey);
    },
    { storageKey: RESEARCH_STORAGE_KEY, activeKey: RESEARCH_ACTIVE_RUN_KEY },
  );
  await page.goto('/research');
  await page.getByLabel(/I have read this notice and choose to start/i).check();
  await page.getByRole('button', { name: 'Start Research Session' }).click();
  await expect(page).toHaveURL(/\/research\/run$/);
  const official = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    RESEARCH_STORAGE_KEY,
  );
  expect(official.sessions[0].pilot).toBe(false);
});

test('pending room feedback survives refresh and finalizes exactly once before the next room', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = pendingResearchBrowserFixture();
  await page.evaluate(
    ({ storageKey, activeKey, storage, active }) => {
      localStorage.setItem(storageKey, JSON.stringify(storage));
      localStorage.setItem(activeKey, JSON.stringify(active));
    },
    {
      storageKey: RESEARCH_STORAGE_KEY,
      activeKey: RESEARCH_ACTIVE_RUN_KEY,
      storage: fixture.storage,
      active: fixture.active,
    },
  );
  await page.goto('/research/run');
  await expect(page.getByRole('dialog', { name: 'A quick room rating' })).toBeVisible();
  const originalRoom = await page.locator('[data-room-id]').getAttribute('data-room-id');
  await page.getByLabel('About Right').check();
  await page.getByLabel('4 — Fair').check();
  await page.getByLabel('5 — Very Enjoyable').check();
  await page.reload();
  await expect(page.getByLabel('About Right')).toBeChecked();
  await expect(page.getByLabel('4 — Fair')).toBeChecked();
  await expect(page.getByLabel('5 — Very Enjoyable')).toBeChecked();
  await page.getByRole('button', { name: 'Submit and continue' }).click();
  await expect(page.getByRole('dialog', { name: 'A quick room rating' })).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect
    .poll(async () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).sessions[0].runs[0].rooms.length,
        RESEARCH_STORAGE_KEY,
      ),
    )
    .toBe(1);
  await expect
    .poll(() => page.locator('[data-room-id]').getAttribute('data-room-id'))
    .not.toBe(originalRoom);
  await page.reload();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).sessions[0].runs[0].rooms.length,
      RESEARCH_STORAGE_KEY,
    ),
  ).toBe(1);
});

test('feedback Escape opens deliberate skip confirmation and explicit skip records once', async ({
  page,
}) => {
  const fixture = pendingResearchBrowserFixture();
  await page.evaluate(
    ({ storageKey, activeKey, storage, active }) => {
      localStorage.setItem(storageKey, JSON.stringify(storage));
      localStorage.setItem(activeKey, JSON.stringify(active));
    },
    {
      storageKey: RESEARCH_STORAGE_KEY,
      activeKey: RESEARCH_ACTIVE_RUN_KEY,
      storage: fixture.storage,
      active: fixture.active,
    },
  );
  await page.goto('/research/run');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog', { name: /Skip this room/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'A quick room rating' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip feedback' }).click();
  await page.getByRole('button', { name: 'Confirm skip' }).click();
  await expect
    .poll(async () =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).sessions[0].runs[0].rooms[0]?.feedback.status,
        RESEARCH_STORAGE_KEY,
      ),
    )
    .toBe('skipped');
});

test('defeat feedback survives refresh, finalizes once, and then reveals results', async ({
  page,
}) => {
  const fixture = defeatedResearchBrowserFixture();
  await page.evaluate(
    ({ storageKey, activeKey, storage, active }) => {
      localStorage.setItem(storageKey, JSON.stringify(storage));
      localStorage.setItem(activeKey, JSON.stringify(active));
    },
    {
      storageKey: RESEARCH_STORAGE_KEY,
      activeKey: RESEARCH_ACTIVE_RUN_KEY,
      storage: fixture.storage,
      active: fixture.active,
    },
  );
  await page.goto('/research/run');

  await expect(page.getByRole('dialog', { name: 'A quick room rating' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit and view results' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toHaveCount(0);
  await page.getByLabel('Too Hard').check();
  await page.getByLabel('2 — Unfair').check();
  await page.reload();
  await expect(page.getByLabel('Too Hard')).toBeChecked();
  await expect(page.getByLabel('2 — Unfair')).toBeChecked();
  await page.getByRole('button', { name: 'Submit and view results' }).click();

  await expect(page.getByRole('dialog', { name: 'A quick room rating' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toBeVisible();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).sessions[0].runs[0].rooms,
    RESEARCH_STORAGE_KEY,
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    outcome: {
      status: 'defeated',
      chosenExitId: null,
      outgoingDirection: null,
    },
    feedback: {
      status: 'submitted',
      difficulty: 'too_hard',
      fairness: 2,
    },
  });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'A quick room rating' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toBeVisible();
});

test('Research Summary excludes Pilot by default and export/delete controls preserve normal data', async ({
  page,
}) => {
  await seedActiveRun(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: RESEARCH_STORAGE_KEY,
    value: completedResearchBrowserFixture(),
  });
  const normalBefore = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_RUN_KEY);
  await page.goto('/research');
  await page.locator('.research-data-disclosure > summary').click();
  await expect(page.locator('.research-summary-grid').getByText('1 / 1 (100%)')).toBeVisible();
  await page.getByLabel('Include Pilot Data').check();
  await expect(page.locator('.research-summary-grid').getByText('2 / 2 (100%)')).toBeVisible();

  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export all JSON' }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toMatch(
    /^resonant-ruins-research-.*-all-sessions\.json$/,
  );
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export all CSV' }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^resonant-ruins-research-.*-all-sessions\.csv$/);

  await page.getByRole('button', { name: /Delete Pilot Data/ }).click();
  await page.getByRole('button', { name: 'Delete research data' }).click();
  const afterPilotDelete = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    RESEARCH_STORAGE_KEY,
  );
  expect(afterPilotDelete.sessions).toHaveLength(1);
  expect(afterPilotDelete.sessions[0].pilot).toBe(false);
  await page.getByRole('button', { name: 'Clear all research data' }).click();
  await page.getByRole('button', { name: 'Delete research data' }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), RESEARCH_STORAGE_KEY)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), ACTIVE_RUN_KEY)).toBe(
    normalBefore,
  );
});

test('an unconfigured API sends no localhost health request', async ({ page }) => {
  const healthRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/health')) healthRequests.push(request.url());
  });
  await page.reload();
  await expect(page.getByText('Local only · API not configured')).toBeVisible();
  expect(healthRequests).toEqual([]);
});

test('Model Lab stays in memory and launches a visibly non-evidence sandbox', async ({ page }) => {
  await seedActiveRun(page);
  const protectedKeys = [
    ACTIVE_RUN_KEY,
    RESEARCH_STORAGE_KEY,
    RESEARCH_ACTIVE_RUN_KEY,
    'mirrorvault:player-profile:v1',
    'mirrorvault:run-archive:v1',
  ];
  const before = await page.evaluate(
    (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    protectedKeys,
  );
  await page.goto('/model-lab');
  await expect(page.getByRole('heading', { name: 'Model Comparison Lab' })).toBeVisible();
  await expect(page.getByText(/imports and experiments stay in memory/i)).toBeVisible();
  await page.getByRole('button', { name: 'Select synthetic fixture' }).click();
  await expect(page.getByText(/Synthetic development fixture selected explicitly/i)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'About Right' })).toBeVisible();
  await page.getByRole('button', { name: 'Launch Counterfactual Sandbox' }).click();
  await expect(page).toHaveURL(/\/model-lab\/sandbox\?token=/);
  await expect(page.getByText('Counterfactual Sandbox')).toBeVisible();
  await expect(page.getByText(/not official research evidence/i)).toBeVisible();
  expect(
    await page.evaluate(
      (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      protectedKeys,
    ),
  ).toEqual(before);
});

test('clean first descent reaches Awakening Chamber 1', async ({ page }) => {
  await page.goto('/dungeon');
  await page.getByLabel('Seasoned Adventurer').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Delve' }).click();
  await expect(page).toHaveURL(/\/dungeon\/run$/);
  await expect(page.getByText('Awakening Chamber 1 / 5').first()).toBeVisible();
});

test('paused run remains paused across refresh', async ({ page }) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ACTIVE_RUN_KEY),
    )
    .toMatchObject({ pauseState: { isPaused: true } });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
});

test('Main Menu preserves the run and Home resumes it directly', async ({ page }) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('button', { name: 'Return to Main Menu' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: /Resume Run/ }).click();
  await expect(page).toHaveURL(/\/dungeon\/run$/);
});

test('Restart Run requires confirmation and creates a fresh attempt', async ({ page }) => {
  const original = freshRecord();
  await seedActiveRun(page, original);
  await page.goto('/dungeon/run');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Restart Run' }).click();
  await expect(page.getByRole('dialog', { name: 'Restart Run?' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart Run' }).click();
  await expect(page.getByText('Awakening Chamber 1 / 5').first()).toBeVisible();
  const restarted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(restarted.runId).not.toBe(original.runId);
  expect(restarted.experiencePreset).toBe(original.experiencePreset);
});

test('defeat archives the attempt and Runs displays it', async ({ page }) => {
  await seedActiveRun(page, { ...freshRecord(), status: 'defeated', currentHealth: 0 });
  await page.goto('/dungeon/run');
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('mirrorvault:run-archive:v1')))
    .not.toBeNull();
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Recent Runs' })).toBeVisible();
  await expect(page.locator('.history-card')).toHaveCount(1);
});

test('maximum supported room fits inside the gameplay viewport', async ({ page }) => {
  await seedActiveRun(page, maximumRoomRecord());
  await page.goto('/dungeon/run');
  const grid = page.getByRole('application', { name: 'Resonant Ruins playable dungeon grid' });
  await expect(grid).toHaveAttribute('data-room-columns', '21');
  await expect(grid).toHaveAttribute('data-room-rows', '15');
  const viewport = page.locator('.dungeon-grid-viewport');
  await expect(viewport).toHaveJSProperty(
    'scrollWidth',
    await viewport.evaluate((node) => node.clientWidth),
  );
});

test('generator-3 renders true L void and topology structures as solid tiles', async ({ page }) => {
  await seedActiveRun(page, topologyRecord('true-l-ruin'));
  await page.goto('/dungeon/run');
  await expect(page.locator('[data-room-id="generated-dungeon-room-10"]')).toBeVisible();
  await expect(page.locator('[data-tile-kind="void"]').first()).toBeVisible();
  await expect(page.locator('[data-tile-kind="wall"]').first()).toBeVisible();

  await page.goto('/history');
  await seedActiveRun(page, topologyRecord('ring-route'));
  await page.goto('/dungeon/run');
  await expect(page.locator('[data-tile-kind="internal-wall"]').first()).toBeVisible();
  const internalCoordinates = await page
    .locator('[data-tile-kind="internal-wall"]')
    .evaluateAll((tiles) =>
      tiles.map(
        (tile) => `${tile.getAttribute('data-tile-x')}:${tile.getAttribute('data-tile-y')}`,
      ),
    );
  const ratCoordinates = await page
    .locator('[data-enemy-id]')
    .evaluateAll((rats) =>
      rats.map((rat) => `${rat.getAttribute('data-enemy-x')}:${rat.getAttribute('data-enemy-y')}`),
    );
  expect(ratCoordinates.some((coordinate) => internalCoordinates.includes(coordinate))).toBe(false);
});

test('all six generator-3 archetypes render through active-run restoration', async ({ page }) => {
  const archetypes: Exclude<RoomArchetype, 'safe-fallback'>[] = [
    'open-arena',
    'true-l-ruin',
    'split-chamber',
    'pillar-hall',
    'ring-route',
    'twin-chambers',
  ];
  for (const archetype of archetypes) {
    await seedActiveRun(page, topologyRecord(archetype));
    await page.goto('/dungeon/run');
    await expect(page.locator('[data-room-id="generated-dungeon-room-10"]')).toBeVisible();
    await expect(page.getByRole('application')).toHaveAttribute('data-room-columns', /\d+/);
    await expect(page.locator('[data-tile-kind="exit-open"]')).not.toHaveCount(0);
  }
});

test('authored Fountain supports KeyE, pointer use, cancellation, and depleted persistence', async ({
  page,
}) => {
  await seedActiveRun(page, fountainRecord());
  await page.goto('/dungeon/run');
  const fountain = page.locator('[data-feature-id$="restoration-fountain"]');
  await expect(fountain).toHaveAttribute('data-fountain-variant', 'wall-integrated');
  await expect(fountain).toHaveAttribute('data-fountain-state', 'unused');
  await expect(page.getByRole('button', { name: 'Restore Health' })).toBeVisible();

  await page.keyboard.press('KeyE');
  await expect(page.getByRole('progressbar', { name: 'Restoration progress' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('progressbar', { name: 'Restoration progress' })).toHaveCount(0);
  await expect(page.getByLabel('5 of 6 health remaining.')).toBeVisible();

  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Restore Health' }).click();
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible({ timeout: 2_000 });
  await expect(fountain).toHaveAttribute('data-fountain-state', 'depleted');
  await page.reload();
  await expect(page.locator('[data-feature-id$="restoration-fountain"]')).toHaveAttribute(
    'data-fountain-state',
    'depleted',
  );
});

test('full health and alerted combat leave the authored Fountain unused', async ({ page }) => {
  await seedActiveRun(page, fountainRecord({ currentHealth: 6 }));
  await page.goto('/dungeon/run');
  await page.keyboard.press('KeyE');
  await expect(page.locator('[data-status-field="health"]')).toHaveClass(/health--full-feedback/);
  await expect(page.locator('[data-feature-id$="restoration-fountain"]')).toHaveAttribute(
    'data-fountain-state',
    'unused',
  );

  await seedActiveRun(page, fountainRecord({ alertedRat: true }));
  await page.goto('/dungeon/run');
  await expect(page.getByRole('button', { name: 'Restore Health' })).toHaveCount(0);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('progressbar', { name: 'Restoration progress' })).toHaveCount(0);
  await expect(page.locator('[data-feature-id$="restoration-fountain"]')).toHaveAttribute(
    'data-fountain-state',
    'unused',
  );
});

test('Fountain channel pauses and restores across refresh without healing twice', async ({
  page,
}) => {
  await seedActiveRun(page, fountainRecord());
  await page.goto('/dungeon/run');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('progressbar', { name: 'Restoration progress' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(before.interaction.status).toBe('channeling');
  expect(before.interaction.remainingMs).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(after.interaction.remainingMs).toBe(before.interaction.remainingMs);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible({ timeout: 2_000 });
  await page.waitForTimeout(800);
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible();
  await expect(page.locator('[data-feature-id$="restoration-fountain"]')).toHaveAttribute(
    'data-fountain-state',
    'depleted',
  );
});

test('Resonance Cache channels once, cancels, restores, remains solid, and persists', async ({
  page,
}) => {
  const initial = cacheRecord();
  await seedActiveRun(page, initial);
  await page.goto('/dungeon/run');
  const cache = page.locator('[data-feature-id$="resonance-cache"]');
  await expect(cache).toHaveAttribute('data-cache-state', 'unopened');
  await expect(
    page.getByRole('button', {
      name: 'Resonance Cache, unopened, grants one Resonance',
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Resonance 0')).toBeVisible();

  await page.keyboard.press('KeyE');
  await expect(
    page.getByRole('progressbar', { name: 'Resonance Cache opening progress' }),
  ).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('progressbar', { name: 'Resonance Cache opening progress' }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Resonance 0')).toBeVisible();

  await page.goto('/about');
  await seedActiveRun(page, cacheRecord());
  await page.goto('/dungeon/run');
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toContainText('Resonance: 0');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByLabel('Resonance 1')).toBeVisible({ timeout: 2_000 });
  await expect(cache).toHaveAttribute('data-cache-state', 'opened');
  await expect(page.getByRole('button', { name: /Resonance Cache/ })).toHaveCount(0);

  const playerBefore = await page.locator('.tile--player').evaluate((tile) => ({
    x: tile.getAttribute('data-tile-x'),
    y: tile.getAttribute('data-tile-y'),
  }));
  const towardCache: Record<string, string> = {
    up: 'ArrowUp',
    right: 'ArrowRight',
    down: 'ArrowDown',
    left: 'ArrowLeft',
  };
  await page.keyboard.press(towardCache[initial.facing]!);
  expect(
    await page.locator('.tile--player').evaluate((tile) => ({
      x: tile.getAttribute('data-tile-x'),
      y: tile.getAttribute('data-tile-y'),
    })),
  ).toEqual(playerBefore);

  await page.reload();
  await expect(page.locator('[data-cache-state="opened"]')).toBeVisible();
  await expect(page.getByLabel('Resonance 1')).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(saved.resonance).toBe(1);
  const awardedRuntime = (
    Object.values(saved.interactables) as { resonanceAwarded?: boolean }[]
  ).find((runtime) => runtime.resonanceAwarded);
  expect(awardedRuntime).toMatchObject({
    depleted: true,
    resonanceAwarded: true,
  });
});

test('an alerted Rat blocks Cache opening while an unaware Rat does not', async ({ page }) => {
  await seedActiveRun(page, cacheRecord({ alertedRat: true }));
  await page.goto('/dungeon/run');
  await expect(page.locator('[data-cache-state="unopened"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Resonance Cache/ })).toHaveCount(0);
  await page.keyboard.press('KeyE');
  await expect(
    page.getByRole('progressbar', { name: 'Resonance Cache opening progress' }),
  ).toHaveCount(0);

  await page.goto('/about');
  await seedActiveRun(page, cacheRecord({ unawareRat: true }));
  await page.goto('/dungeon/run');
  await expect(page.getByRole('button', { name: /Resonance Cache, unopened/ })).toBeVisible();
});

test('Game Over and Runs preserve exact Resonance and normal Best Resonance', async ({ page }) => {
  await seedActiveRun(page, cacheRecord({ opened: true, defeated: true }));
  await page.goto('/dungeon/run');
  const dialog = page.getByRole('dialog', { name: 'Game Over' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Resonance')).toBeVisible();
  await expect(dialog.getByText('1')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('mirrorvault:run-archive:v1')))
    .not.toBeNull();

  await page.goto('/history');
  await expect(page.locator('.history-card').first()).toContainText('Resonance');
  await expect(page.locator('.history-card').first()).toContainText('1');
  await expect(page.locator('.best-runs')).toContainText('Best Resonance');
  await expect(page.locator('.best-runs')).toContainText('1');
});

test('Visual Effects choice persists and leaves essential gameplay feedback enabled', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByLabel('Visual Effects').selectOption('off');
  await expect(page.locator('.app-shell')).toHaveClass(/effects-off/);
  await page.reload();
  await expect(page.getByLabel('Visual Effects')).toHaveValue('off');
  await seedActiveRun(page, combatRecord({ telegraph: true }));
  await page.goto('/dungeon/run');
  await expect(page.locator('[data-enemy-state="telegraphing"]')).toBeVisible();
  await page.keyboard.down('ShiftLeft');
  const shield = page.locator('.player-token__shield--active');
  await expect(shield).toBeVisible();
  await expect(shield).toHaveAttribute('data-shield-pose', 'right-active');
  await expect(page.locator('.player-token__shield-guard')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(shield).toHaveAttribute('data-shield-pose', 'down-active');
  await page.keyboard.up('ShiftLeft');
  await expect(page.locator('.player-token__shield-guard')).toHaveCount(0);
});

test('player navigation and dense tools use responsive progressive disclosure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/');
  const mobile = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobile.getByRole('link')).toHaveCount(5);
  await expect(mobile.getByRole('link', { name: 'Play' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('/research');
  const researchData = page.locator('.research-data-disclosure');
  await expect(researchData).not.toHaveAttribute('open', '');
  await researchData.locator('summary').click();
  await expect(page.getByRole('heading', { name: 'Browser-local records' })).toBeVisible();

  await page.goto('/model-lab');
  await expect(page.getByRole('navigation', { name: 'Model Lab sections' })).toBeVisible();
  await expect(
    page.locator('details').filter({ hasText: 'Registry and artifact metadata' }),
  ).not.toHaveAttribute('open', '');

  await page.goto('/topology-lab');
  await expect(page.locator('.topology-advanced')).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('audio controls persist Master, Effects, Ambience, and mute without console errors', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByLabel('Master volume').fill('42');
  await page.getByLabel('Effects volume').fill('53');
  await page.getByLabel('Ambience volume').fill('14');
  await page.getByRole('button', { name: 'Mute' }).click();
  await page.reload();
  await expect(page.getByLabel('Master volume')).toHaveValue('42');
  await expect(page.getByLabel('Effects volume')).toHaveValue('53');
  await expect(page.getByLabel('Ambience volume')).toHaveValue('14');
  await expect(page.getByRole('button', { name: 'Unmute' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reset Audio Settings' }).click();
  await expect(page.getByLabel('Master volume')).toHaveValue('70');
  await expect(page.getByLabel('Effects volume')).toHaveValue('65');
  await expect(page.getByLabel('Ambience volume')).toHaveValue('20');
});

test('sample audio ships from local OGG paths without a runtime source-site dependency', async ({
  page,
}) => {
  for (const path of [
    '/audio/rat-alert-soft.ogg',
    '/audio/rat-scuffle.ogg',
    '/audio/rat-damage-soft.ogg',
    '/audio/rat-defeat-rustle.ogg',
    '/audio/sword-swing-01.ogg',
    '/audio/shield-perfect-block.ogg',
    '/audio/fountain-water.ogg',
    '/audio/stone-collapse.ogg',
  ]) {
    const response = await page.request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('audio/ogg');
    expect((await response.body()).byteLength).toBeGreaterThan(1_000);
  }
});

test('development audio counters distinguish movement, turns, bumps, attacks, and Rat cues', async ({
  page,
}) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  await page.getByRole('application').click();
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(
      async () =>
        (await developmentAudioEvents(page)).filter(({ name }) => name === 'player.step').length,
    )
    .toBeGreaterThan(0);

  const stepsBeforeTurn = (await developmentAudioEvents(page)).filter(
    ({ name }) => name === 'player.step',
  ).length;
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.up('ShiftLeft');
  expect(
    (await developmentAudioEvents(page)).filter(({ name }) => name === 'player.step').length,
  ).toBe(stepsBeforeTurn);
  await page.keyboard.press('Space');
  await expect
    .poll(async () =>
      (await developmentAudioEvents(page)).some(({ name }) => name === 'player.attack-swing'),
    )
    .toBe(true);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(80);
  }
  await expect
    .poll(async () =>
      (await developmentAudioEvents(page)).some(({ name }) => name === 'player.wall-bump'),
    )
    .toBe(true);

  await page.goto('/');
  await seedActiveRun(page, combatRecord({ player: { x: 2, y: 5 }, rats: [{ x: 5, y: 5 }] }));
  await page.goto('/dungeon/run');
  await page.getByRole('application').click();
  await expect
    .poll(
      async () => (await developmentAudioEvents(page)).some(({ name }) => name === 'rat.alert'),
      {
        timeout: 3_000,
      },
    )
    .toBe(true);
  await expect
    .poll(
      async () => (await developmentAudioEvents(page)).some(({ name }) => name === 'rat.telegraph'),
      { timeout: 3_000 },
    )
    .toBe(true);
});

test('development audio counters expose Fountain, Cache, and Resonance interaction events', async ({
  page,
}) => {
  await seedActiveRun(page, fountainRecord());
  await page.goto('/dungeon/run');
  await page.getByRole('application').click();
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await developmentAudioEvents(page)).some(({ name }) => name === 'fountain.channel'),
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await developmentAudioEvents(page)).some(({ name }) => name === 'fountain.heal'),
    )
    .toBe(true);

  await page.goto('/');
  await seedActiveRun(page, cacheRecord());
  await page.goto('/dungeon/run');
  await page.getByRole('application').click();
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await developmentAudioEvents(page)).some(({ name }) => name === 'cache.open'),
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await developmentAudioEvents(page)).some(({ name }) => name === 'resonance.collect'),
    )
    .toBe(true);
});

test('Clear Run History requires confirmation and preserves best records', async ({ page }) => {
  await seedActiveRun(page, { ...freshRecord(), status: 'defeated', currentHealth: 0 });
  await page.goto('/dungeon/run');
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('mirrorvault:run-archive:v1')))
    .not.toBeNull();
  const bestBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mirrorvault:run-archive:v1')!).bestStats,
  );
  await page.goto('/history');
  await page.getByRole('button', { name: 'Clear Run History' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Clear Run History?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.history-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear Run History' }).click();
  await page.getByRole('button', { name: 'Clear recent runs' }).click();
  await expect(page.locator('.history-card')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Best records were preserved');
  const archiveAfter = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mirrorvault:run-archive:v1')!),
  );
  expect(archiveAfter.bestStats).toEqual(bestBefore);
});

test('development Topology Lab is visibly sandboxed and does not write normal data', async ({
  page,
}) => {
  await seedActiveRun(page);
  const protectedKeys = [
    ACTIVE_RUN_KEY,
    'mirrorvault:player-profile:v1',
    'mirrorvault:run-archive:v1',
  ];
  const before = await page.evaluate(
    (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    protectedKeys,
  );
  await page.goto('/topology-lab');
  await expect(page.getByRole('heading', { name: 'Topology Lab' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('SANDBOX');
  await page.getByLabel('Archetype').selectOption('twin-chambers');
  await page.getByLabel('Placement').selectOption('risky');
  await page.getByRole('button', { name: 'Generate new seed' }).click();
  await expect(page.getByLabel('Generated room ASCII map')).toContainText('F');
  expect(
    await page.evaluate(
      (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      protectedKeys,
    ),
  ).toEqual(before);
});

test('invalid stored position is repaired and resaved safely', async ({ page }) => {
  await seedActiveRun(page, { ...freshRecord(), playerPosition: { x: -50, y: 99 } });
  await page.goto('/dungeon/run');
  await expect(page.getByText(/saved position was invalid/i)).toBeVisible();
  await expect(page.locator('.player-token')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ACTIVE_RUN_KEY),
    )
    .not.toMatchObject({
      playerPosition: { x: -50, y: 99 },
    });
});

test('new runs use fixed Awakening order and authored Rat counts', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/dungeon');
  await page.getByLabel('Seasoned Adventurer').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Delve' }).click();
  await page.getByRole('button', { name: 'Debug' }).click();
  for (const chamber of [2, 3, 4]) {
    await page.getByRole('button', { name: 'Advance to Next Room' }).click();
    await expect(page.getByText(`Awakening Chamber ${chamber} / 5`).first()).toBeVisible();
    await page.waitForTimeout(350);
  }
  await expect(page.locator('.rat-token')).toHaveCount(1);
  await page.getByRole('button', { name: 'Defeat All Enemies' }).click();
  await page.getByRole('button', { name: 'Advance to Next Room' }).click();
  await expect(page.getByText('Awakening Chamber 5 / 5').first()).toBeVisible();
  await expect(page.locator('.rat-token')).toHaveCount(2);
  await expect(page.locator('.tile--hazard')).toHaveCount(2);
  await expect(page.getByRole('application')).toHaveAttribute('data-room-columns', '21');
  await expect(page.getByRole('application')).toHaveAttribute('data-room-rows', '15');
});

test('Rat chases, telegraphs, locks its target, and misses a dodge', async ({ page }) => {
  await seedActiveRun(page, combatRecord({ player: { x: 2, y: 5 }, rats: [{ x: 5, y: 5 }] }));
  await page.goto('/dungeon/run');
  const rat = page.locator('[data-enemy-id="e2e-rat-1"]');
  await expect(rat).toHaveAttribute('data-enemy-x', '5');
  await expect
    .poll(async () => Number(await rat.getAttribute('data-enemy-x')), { timeout: 3_000 })
    .toBeLessThan(5);
  await expect(rat).toHaveAttribute('data-enemy-state', 'telegraphing', { timeout: 3_000 });
  await page.keyboard.press('ArrowLeft');
  await expect(rat).toHaveAttribute('data-enemy-state', 'recovering', { timeout: 1_000 });
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible();
});

test('directional shield blocks, two sword hits defeat, and the exit opens immediately', async ({
  page,
}) => {
  await seedActiveRun(page, combatRecord({ telegraph: true }));
  await page.goto('/dungeon/run');
  const rat = page.locator('[data-enemy-id="e2e-rat-1"]');
  await page.keyboard.down('ShiftLeft');
  await expect(rat).toHaveAttribute('data-enemy-state', 'recovering', { timeout: 1_500 });
  await page.keyboard.up('ShiftLeft');
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible();

  await page.goto('/');
  await seedActiveRun(page, combatRecord());
  await page.goto('/dungeon/run');
  await page.keyboard.press('Space');
  await expect(page.locator('[data-enemy-id="e2e-rat-1"]')).toHaveAttribute(
    'data-enemy-health',
    '1',
  );
  await page.waitForTimeout(410);
  await page.keyboard.press('Space');
  await expect(page.locator('[data-enemy-state="corpse"]')).toHaveCount(1);
  await expect(page.locator('.tile--exit-open')).toHaveCount(1);
});

test('simultaneous Rat attacks respect one universal invulnerability window', async ({ page }) => {
  await seedActiveRun(
    page,
    combatRecord({
      player: { x: 3, y: 5 },
      rats: [
        { x: 4, y: 5 },
        { x: 2, y: 5 },
      ],
    }),
  );
  await page.goto('/dungeon/run');
  await expect(page.getByLabel('5 of 6 health remaining.')).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('.player-token--invulnerable')).toBeVisible();
});

test('paused telegraph and corpse state survive refresh without recounting defeat', async ({
  page,
}) => {
  await seedActiveRun(page, combatRecord({ telegraph: true, paused: true }));
  await page.goto('/dungeon/run');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(before.enemies.rats[0].telegraphRemainingMs).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(after.enemies.rats[0].telegraphRemainingMs).toBe(
    before.enemies.rats[0].telegraphRemainingMs,
  );

  await page.goto('/');
  await seedActiveRun(page, combatRecord({ corpse: true, paused: true }));
  await page.goto('/dungeon/run');
  await expect(page.locator('[data-enemy-state="corpse"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-enemy-state="corpse"]')).toBeVisible();
  const corpseRecord = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(corpseRecord.enemiesDefeated).toBe(1);
});

test('development editor preview leaves active/profile/archive storage isolated', async ({
  page,
}) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  const beforeProfile = await page.evaluate(() =>
    localStorage.getItem('mirrorvault:player-profile:v1'),
  );
  const beforeArchive = await page.evaluate(() =>
    localStorage.getItem('mirrorvault:run-archive:v1'),
  );
  await page.getByRole('button', { name: 'Debug' }).click();
  await page
    .getByRole('combobox', { name: 'Awakening Chamber' })
    .selectOption('evaluation-room-04');
  await page.getByRole('button', { name: 'Validate Room' }).click();
  await expect(page.getByText('Room is valid.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preview Room' }).click();
  await expect(page.getByRole('region', { name: 'Preview Mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Preview' }).click();
  expect(await page.evaluate(() => localStorage.getItem('mirrorvault:run-archive:v1'))).toBe(
    beforeArchive,
  );
  expect(await page.evaluate(() => localStorage.getItem('mirrorvault:player-profile:v1'))).toBe(
    beforeProfile,
  );
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect({ ...after, elapsedMs: before.elapsedMs }).toEqual(before);
});
