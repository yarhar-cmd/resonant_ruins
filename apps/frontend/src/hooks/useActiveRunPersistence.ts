import { useCallback, useEffect, useRef } from 'react';
import {
  createActiveRunRecord,
  saveActiveRun,
  type ActiveRunRecord,
  type ActiveRunStorageIssue,
} from '../services/activeRunStorage';
import type { CharacterId } from '../services/runArchive';
import type { GameplayState } from '../utils/gameplayState';

interface ActiveRunPersistenceOptions {
  gameplay: GameplayState;
  characterId: CharacterId;
  enabled?: boolean;
  saveRecord?: (record: ActiveRunRecord) => ActiveRunStorageIssue | null;
  onIssue: (issue: ActiveRunStorageIssue) => void;
  onSaved?: (savedAt: number) => void;
}

export function useActiveRunPersistence({
  gameplay,
  characterId,
  enabled = true,
  saveRecord,
  onIssue,
  onSaved,
}: ActiveRunPersistenceOptions): () => ActiveRunStorageIssue | null {
  const gameplayRef = useRef(gameplay);
  const characterIdRef = useRef(characterId);
  const onIssueRef = useRef(onIssue);
  const onSavedRef = useRef(onSaved);
  const saveRecordRef = useRef(saveRecord);
  const lastWarningAtRef = useRef(Number.NEGATIVE_INFINITY);

  gameplayRef.current = gameplay;
  characterIdRef.current = characterId;
  onIssueRef.current = onIssue;
  onSavedRef.current = onSaved;
  saveRecordRef.current = saveRecord;

  const saveNow = useCallback(() => {
    const record = createActiveRunRecord(gameplayRef.current, characterIdRef.current, Date.now());
    if (!record) return null;
    if (!enabled) return null;
    const issue = saveRecordRef.current ? saveRecordRef.current(record) : saveActiveRun(record);
    if (!issue) onSavedRef.current?.(Date.now());
    if (issue && Date.now() - lastWarningAtRef.current >= 3_000) {
      lastWarningAtRef.current = Date.now();
      onIssueRef.current(issue);
    }
    return issue;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || gameplay.status === 'idle') return;
    if (gameplay.status === 'defeated') {
      saveNow();
      return;
    }
    const timer = window.setTimeout(saveNow, 300);
    return () => window.clearTimeout(timer);
  }, [enabled, gameplay, saveNow]);

  useEffect(() => {
    if (!enabled || gameplay.status === 'idle') return;
    const interval = window.setInterval(saveNow, 2_000);
    function handleVisibilityOrUnload() {
      if (document.visibilityState === 'hidden') saveNow();
    }
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('pagehide', saveNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('pagehide', saveNow);
    };
  }, [enabled, gameplay.status, saveNow]);

  return saveNow;
}
