import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MovePlanner } from '../hooks/useMovePlanner';
import { colors, font, radius, spacing } from '../theme';
import type { Battle, Country, GameAction, GameView } from '../types';
import { Button, Card, Chip } from './ui';

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (next: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(1, value - 1))} accessibilityLabel="Fewer soldiers" style={styles.stepButton}>
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel="More soldiers" style={styles.stepButton}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
      <Chip label={`Max ${max}`} selected={value === max} onPress={() => onChange(max)} />
    </View>
  );
}

const label = (c: Country) => `${c.name} (${c.soldiers})`;

// The human player's controls for the current phase. Board taps feed the planner; this panel
// explains the next step and sends the finished move to the server.
export function ActionPanel({
  game,
  planner,
  busy,
  lastBattle,
  onAct,
}: {
  game: GameView;
  planner: MovePlanner;
  busy: boolean;
  lastBattle: Battle | null;
  onAct: (action: GameAction) => Promise<boolean>;
}) {
  const byCode = new Map(game.countries.map((c) => [c.code, c]));
  const mine = game.countries.filter((c) => c.ownerId === planner.humanId);

  if (game.phase === 'reinforce') {
    const remaining = game.pendingReinforcements - planner.allocated;
    const placements = Object.entries(planner.allocation);
    const strongest = [...mine].sort((a, b) => b.soldiers - a.soldiers)[0];
    return (
      <Card style={styles.panel}>
        <Text style={styles.heading}>Deploy {game.pendingReinforcements} reinforcements</Text>
        <Text style={styles.copy}>
          You receive 2 soldiers for each of your {mine.length} countr{mine.length === 1 ? 'y' : 'ies'}. Tap your countries to place them ({remaining} left); tap a full country again to take one back.
        </Text>
        {placements.length > 0 && (
          <View style={styles.row}>
            {placements.map(([code, n]) => (
              <Chip key={code} label={`${byCode.get(code)?.name} +${n}  x`} selected onPress={() => planner.removeAllocation(code)} />
            ))}
          </View>
        )}
        <View style={styles.row}>
          {strongest && (
            <Button
              label={`All to ${strongest.name}`}
              variant="secondary"
              compact
              onPress={() => onAct({ type: 'reinforce', allocation: [{ country: strongest.code, soldiers: game.pendingReinforcements }] })}
              disabled={busy}
            />
          )}
          <Button label="Reset" variant="ghost" compact onPress={planner.resetAllocation} disabled={placements.length === 0 || busy} />
          <Button
            label={`Deploy ${planner.allocated}${remaining > 0 ? ` of ${game.pendingReinforcements}` : ''}`}
            icon="checkmark"
            onPress={() => onAct({ type: 'reinforce', allocation: placements.map(([country, soldiers]) => ({ country, soldiers })) })}
            disabled={planner.allocated === 0}
            loading={busy}
            style={styles.grow}
          />
        </View>
      </Card>
    );
  }

  if (game.phase === 'attacking') {
    return (
      <Card style={styles.panel}>
        <Text style={styles.copy}>Battle in progress. Roll again or retreat from the battle panel. Retreating ends your turn.</Text>
      </Card>
    );
  }

  const from = planner.from ? byCode.get(planner.from) : undefined;
  const to = planner.to ? byCode.get(planner.to) : undefined;
  const conquered = lastBattle?.outcome === 'conquered'
    && lastBattle.attacker.player === planner.humanId
    && lastBattle.turnNumber === game.turnNumber
    ? { origin: byCode.get(lastBattle.attacker.country), target: byCode.get(lastBattle.defender.country) }
    : null;
  const canReinforceConquest = conquered?.origin && conquered.target
    && conquered.origin.ownerId === planner.humanId && conquered.origin.soldiers >= 2
    && !(planner.mode === 'transfer' && planner.from === conquered.origin.code && planner.to === conquered.target.code);

  let instruction: string;
  let confirm: React.ReactNode = null;
  if (planner.mode === 'attack') {
    if (planner.attackLocked) instruction = 'You have already attacked this turn. Move troops between your countries or end your turn.';
    else if (!from) instruction = 'Pick one of your countries with at least 2 soldiers to attack from.';
    else if (!to) instruction = `Attacking from ${label(from)}. Now pick any enemy country: distance does not matter.`;
    else {
      const dice = Math.min(from.soldiers - 1, to.soldiers);
      instruction = `${label(from)} attacks ${label(to)}. Each roll pits ${dice} dice against ${dice}; ties kill nobody.`;
      confirm = (
        <Button label={`Launch attack on ${to.name}`} icon="flash" onPress={() => onAct({ type: 'attack', from: from.code, to: to.code })} loading={busy} style={styles.grow} />
      );
    }
  } else if (!from) {
    instruction = 'Pick a country to move soldiers from. It must keep at least 1 soldier.';
  } else if (!to) {
    instruction = `Moving from ${label(from)}. Now pick another of your countries to receive them.`;
  } else {
    instruction = `Move soldiers from ${label(from)} to ${label(to)}.`;
    confirm = (
      <View style={[styles.row, styles.grow]}>
        <Stepper value={Math.min(planner.amount, from.soldiers - 1)} max={from.soldiers - 1} onChange={planner.setAmount} />
        <Button
          label={`Move ${Math.min(planner.amount, from.soldiers - 1)}`}
          icon="swap-horizontal"
          onPress={async () => {
            if (await onAct({ type: 'transfer', from: from.code, to: to.code, soldiers: Math.min(planner.amount, from.soldiers - 1) })) planner.clearSelection();
          }}
          loading={busy}
        />
      </View>
    );
  }

  return (
    <Card style={styles.panel}>
      <View style={styles.row}>
        <Chip label="Attack" selected={planner.mode === 'attack'} onPress={() => planner.setMode('attack')} color={colors.attacker} />
        <Chip label="Transfer troops" selected={planner.mode === 'transfer'} onPress={() => planner.setMode('transfer')} color={colors.info} />
        <View style={styles.grow} />
        <Button
          label={game.hasAttackedThisTurn ? 'End turn' : 'Skip turn'}
          icon="play-skip-forward"
          variant="secondary"
          compact
          onPress={() => onAct({ type: 'endTurn' })}
          disabled={busy}
        />
      </View>

      {canReinforceConquest && conquered?.origin && conquered.target && (
        <View style={styles.conquest}>
          <Ionicons name="trophy" size={18} color={colors.success} />
          <Text style={[styles.copy, styles.grow]}>
            {conquered.target.name} is yours. Send extra troops from {conquered.origin.name} to hold it?
          </Text>
          <Button label="Choose troops" compact variant="secondary" onPress={() => planner.prefillTransfer(conquered.origin!.code, conquered.target!.code)} />
        </View>
      )}

      <Text style={styles.copy}>{instruction}</Text>
      {(confirm || from) && (
        <View style={styles.row}>
          {confirm}
          {from && <Button label="Clear" variant="ghost" compact onPress={planner.clearSelection} />}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { borderColor: colors.accent },
  heading: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  copy: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  grow: { flexGrow: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { color: colors.text, fontSize: font.heading, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  conquest: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
});
