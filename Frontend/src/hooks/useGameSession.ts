import { useCallback, useEffect, useRef, useState } from 'react';
import { isConflict, messageOf } from '../api/client';
import { gamesApi } from '../api/games';
import { PLAYBACK } from '../config';
import { useAuth } from '../context/AuthContext';
import type { ActionResponse, Battle, GameAction, GameEvent, GameView, NpcDecision } from '../types';

const MAX_EVENTS = 300;

function latestBattleId(events: GameEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].battleId) return events[i].battleId;
  }
  return null;
}

// Owns everything the game screen shows: board state, the event feed and the current battle.
// - The owner drives NPC turns by calling /npc-step one move at a time (faster when fast-forwarding).
// - Spectators poll the event feed and refresh the board when something new happens.
export function useGameSession(gameId: string, holdNpc = false) {
  const { user } = useAuth();
  const [game, setGame] = useState<GameView | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [decision, setDecision] = useState<NpcDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fastForward, setFastForward] = useState(false);
  const [npcPaused, setNpcPaused] = useState(false);
  const lastSeq = useRef(0);

  const mergeEvents = useCallback((incoming: GameEvent[]) => {
    if (incoming.length === 0) return;
    lastSeq.current = Math.max(lastSeq.current, ...incoming.map((e) => e.seq));
    setEvents((previous) => {
      const seen = new Set(previous.map((e) => e.seq));
      const merged = [...previous, ...incoming.filter((e) => !seen.has(e.seq))].sort((a, b) => a.seq - b.seq);
      return merged.slice(-MAX_EVENTS);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [fresh, feed] = await Promise.all([gamesApi.get(gameId), gamesApi.events(gameId, { tail: 80 })]);
      setGame(fresh);
      mergeEvents(feed.items);
      const battleId = fresh.activeAttack?.battleId ?? latestBattleId(feed.items);
      if (battleId) setBattle(await gamesApi.battle(gameId, battleId));
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [gameId, mergeEvents]);

  // Reload when the signed-in user changes, since that decides spectator vs player.
  useEffect(() => {
    void load();
  }, [load, user?.id]);

  const apply = useCallback((response: ActionResponse) => {
    setGame(response.game);
    mergeEvents(response.events);
    if (response.battle) setBattle(response.battle);
    setDecision(response.decision ?? null);
  }, [mergeEvents]);

  const run = useCallback(async (request: () => Promise<ActionResponse>) => {
    setBusy(true);
    setError(null);
    try {
      apply(await request());
      return true;
    } catch (err) {
      setError(messageOf(err));
      if (isConflict(err)) await load();
      return false;
    } finally {
      setBusy(false);
    }
  }, [apply, load]);

  const act = useCallback((action: GameAction) => run(() => gamesApi.act(gameId, action)), [run, gameId]);
  const abandon = useCallback(() => run(() => gamesApi.abandon(gameId)), [run, gameId]);

  // NPC playback loop: one visible move per request.
  useEffect(() => {
    if (!game?.viewer.canAdvanceNpc || busy || npcPaused || holdNpc) return undefined;
    const delay = fastForward
      ? PLAYBACK.fastForwardMs
      : game.phase === 'attacking' ? PLAYBACK.npcRollMs : PLAYBACK.npcStepMs;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        apply(await gamesApi.npcStep(gameId, fastForward));
      } catch (err) {
        if (isConflict(err)) {
          await load();
        } else {
          setError(messageOf(err));
          setNpcPaused(true);
        }
      } finally {
        setBusy(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [game, busy, npcPaused, holdNpc, fastForward, gameId, apply, load]);

  // Spectator live view.
  const spectating = Boolean(game && !game.viewer.isOwner && game.status === 'active');
  useEffect(() => {
    if (!spectating) return undefined;
    const timer = setInterval(async () => {
      try {
        const feed = await gamesApi.events(gameId, { after: lastSeq.current });
        if (feed.items.length === 0) return;
        mergeEvents(feed.items);
        setGame(await gamesApi.get(gameId));
        const battleId = latestBattleId(feed.items);
        if (battleId) setBattle(await gamesApi.battle(gameId, battleId));
      } catch {
        // Transient network errors: keep polling.
      }
    }, PLAYBACK.spectatorPollMs);
    return () => clearInterval(timer);
  }, [spectating, gameId, mergeEvents]);

  return {
    game,
    events,
    battle,
    decision,
    loading,
    busy,
    error,
    fastForward,
    npcPaused,
    spectating,
    setFastForward,
    resumeNpc: () => {
      setError(null);
      setNpcPaused(false);
    },
    pauseNpc: () => setNpcPaused(true),
    dismissError: () => setError(null),
    dismissBattle: () => setBattle(null),
    reload: load,
    act,
    abandon,
  };
}
