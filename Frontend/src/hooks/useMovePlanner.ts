import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameView } from '../types';

export type PlanMode = 'attack' | 'transfer';
export type TileRole = 'source' | 'target' | 'candidate' | 'idle';

const MIN_TO_MOVE = 2;

// The human's in-progress move: which tiles are selected and what tapping a tile does next.
// Mirrors the server rules for instant feedback; the server still validates every action.
export function useMovePlanner(game: GameView | null) {
  const humanId = game?.players.find((p) => !p.isNPC)?.id ?? null;
  const [mode, setModeState] = useState<PlanMode>('attack');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [allocation, setAllocation] = useState<Record<string, number>>({});

  const turnKey = `${game?.turnNumber}:${game?.phase}:${game?.hasAttackedThisTurn}:${game?.pendingReinforcements}`;
  useEffect(() => {
    setFrom(null);
    setTo(null);
    setAmount(1);
    setAllocation({});
  }, [turnKey]);

  const byCode = useMemo(() => new Map((game?.countries ?? []).map((c) => [c.code, c])), [game]);
  const allocated = Object.values(allocation).reduce((sum, n) => sum + n, 0);
  const interactive = Boolean(game?.viewer.canAct);
  const attackLocked = mode === 'attack' && Boolean(game?.hasAttackedThisTurn);
  const isOwn = useCallback((code: string) => byCode.get(code)?.ownerId === humanId, [byCode, humanId]);
  const canSend = useCallback((code: string) => isOwn(code) && (byCode.get(code)?.soldiers ?? 0) >= MIN_TO_MOVE, [isOwn, byCode]);

  const tap = useCallback((code: string) => {
    if (!game || !interactive) return;
    if (game.phase === 'reinforce') {
      if (isOwn(code) && allocated < game.pendingReinforcements) {
        setAllocation((current) => ({ ...current, [code]: (current[code] ?? 0) + 1 }));
      }
      return;
    }
    if (game.phase !== 'action' || attackLocked) return;

    if (code === from) {
      setFrom(null);
      setTo(null);
      return;
    }
    if (!from) {
      if (canSend(code)) setFrom(code);
      return;
    }
    if (mode === 'attack') {
      if (!isOwn(code)) setTo(code);
      else if (canSend(code)) {
        setFrom(code);
        setTo(null);
      }
      return;
    }
    if (isOwn(code)) {
      setTo(code);
      setAmount(1);
    }
  }, [game, interactive, isOwn, canSend, allocated, attackLocked, from, mode]);

  const roleOf = useCallback((code: string): TileRole => {
    if (!game || !interactive) return 'idle';
    if (code === from) return 'source';
    if (code === to) return 'target';
    if (game.phase === 'reinforce') return isOwn(code) && allocated < game.pendingReinforcements ? 'candidate' : 'idle';
    if (game.phase !== 'action' || attackLocked) return 'idle';
    if (!from) return canSend(code) ? 'candidate' : 'idle';
    if (mode === 'attack') return isOwn(code) ? 'idle' : 'candidate';
    return isOwn(code) ? 'candidate' : 'idle';
  }, [game, interactive, from, to, isOwn, canSend, allocated, attackLocked, mode]);

  return {
    humanId,
    mode,
    from,
    to,
    amount,
    allocation,
    allocated,
    attackLocked,
    setAmount,
    tap,
    roleOf,
    setMode(next: PlanMode) {
      setModeState(next);
      setFrom(null);
      setTo(null);
    },
    clearSelection() {
      setFrom(null);
      setTo(null);
    },
    removeAllocation(code: string) {
      setAllocation((current) => {
        const next = { ...current };
        if ((next[code] ?? 0) <= 1) delete next[code];
        else next[code] -= 1;
        return next;
      });
    },
    resetAllocation: () => setAllocation({}),
    prefillTransfer(fromCode: string, toCode: string) {
      setModeState('transfer');
      setFrom(fromCode);
      setTo(toCode);
      setAmount(1);
    },
  };
}

export type MovePlanner = ReturnType<typeof useMovePlanner>;
