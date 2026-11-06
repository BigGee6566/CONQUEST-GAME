import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, fonts, radius, spacing } from '../theme';
import type { Battle } from '../types';
import { DiceTray } from './Dice';
import { Flag } from './Flag';
import { Badge, Button } from './ui';

const OUTCOME_COPY: Record<Battle['outcome'], { label: string; color: string; icon: 'trophy' | 'shield-checkmark' | 'flag' | 'flash' }> = {
  in_progress: { label: 'Battle raging', color: colors.accent, icon: 'flash' },
  conquered: { label: 'Conquered', color: colors.success, icon: 'trophy' },
  repelled: { label: 'Attack repelled', color: colors.defender, icon: 'shield-checkmark' },
  stopped: { label: 'Retreat', color: colors.textMuted, icon: 'flag' },
};

export function BattlePanel({
  battle,
  canControl,
  busy,
  onRoll,
  onStop,
  onDismiss,
}: {
  battle: Battle;
  canControl: boolean;
  busy: boolean;
  onRoll: () => void;
  onStop: () => void;
  onDismiss?: () => void;
}) {
  const latest = battle.exchanges.at(-1);
  const attackers = latest?.attackerRemaining ?? battle.attacker.startingSoldiers;
  const defenders = latest?.defenderRemaining ?? battle.defender.startingSoldiers;
  const nextDice = Math.max(0, Math.min(attackers - 1, defenders));
  const outcome = OUTCOME_COPY[battle.outcome];
  const commentary = battle.outcome === 'stopped' && battle.summary
    ? { text: battle.summary, source: battle.summarySource ?? 'fallback' }
    : latest?.commentary;
  const live = battle.outcome === 'in_progress';

  return (
    <View style={[styles.panel, { borderColor: outcome.color }]}>
      <View style={styles.header}>
        <Badge label={outcome.label} color={outcome.color} icon={outcome.icon} />
        <Text style={styles.round}>Exchange {battle.exchanges.length}</Text>
        {!live && onDismiss && (
          <Pressable onPress={onDismiss} accessibilityLabel="Close battle report" hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.versus}>
        <Side code={battle.attacker.country} name={battle.attacker.countryName} commander={battle.attacker.name} soldiers={attackers} color={colors.attacker} />
        <Text style={styles.vs}>VS</Text>
        <Side code={battle.defender.country} name={battle.defender.countryName} commander={battle.defender.name} soldiers={defenders} color={colors.defender} alignEnd />
      </View>

      {latest ? (
        <DiceTray
          attackerDice={latest.attackerDice}
          defenderDice={latest.defenderDice}
          rollKey={`${battle.id}:${battle.exchanges.length}`}
          attackerLabel={`${battle.attacker.countryName} -${latest.attackerLosses}`}
          defenderLabel={`${battle.defender.countryName} -${latest.defenderLosses}`}
        />
      ) : (
        <Text style={styles.waiting}>Troops are massing at the border. {nextDice} dice per side on the first roll.</Text>
      )}

      {commentary && (
        <View style={styles.commentary} accessibilityLiveRegion="polite">
          <View style={styles.commentaryHeader}>
            <Ionicons name="mic" size={14} color={colors.accent} />
            <Text style={styles.commentaryTitle}>War correspondent</Text>
            <Badge label={commentary.source === 'llm' ? 'AI live' : 'Dispatch'} color={commentary.source === 'llm' ? colors.success : colors.textMuted} />
          </View>
          <Text style={styles.commentaryText}>{commentary.text}</Text>
        </View>
      )}

      {battle.outcome === 'conquered' && (
        <Text style={styles.gained}>+{battle.soldiersGained} soldiers garrison {battle.defender.countryName}</Text>
      )}

      {canControl && live && (
        <View style={styles.controls}>
          <Button label={`Roll ${nextDice} dice`} icon="dice" onPress={onRoll} loading={busy} disabled={nextDice < 1} style={styles.grow} />
          <Button label="Retreat" icon="flag" variant="danger" onPress={onStop} disabled={busy} />
        </View>
      )}
    </View>
  );
}

function Side({ code, name, commander, soldiers, color, alignEnd = false }: {
  code: string;
  name: string;
  commander: string;
  soldiers: number;
  color: string;
  alignEnd?: boolean;
}) {
  return (
    <View style={[styles.side, alignEnd && styles.sideEnd]}>
      <Flag code={code} size={26} />
      <Text style={[styles.sideName, { color }]} numberOfLines={1}>{name}</Text>
      <Text style={styles.commander} numberOfLines={1}>{commander}</Text>
      <Text style={styles.sideCount}>{soldiers}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(14, 21, 38, 0.94)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  round: { color: colors.textMuted, fontSize: font.small, flex: 1 },
  versus: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vs: { color: colors.accent, fontFamily: fonts.display, fontSize: font.title, letterSpacing: 2 },
  side: { flex: 1, gap: 2 },
  sideEnd: { alignItems: 'flex-end' },
  sideName: { fontSize: font.body, fontFamily: fonts.display },
  commander: { color: colors.textMuted, fontSize: font.tiny },
  sideCount: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  waiting: { color: colors.textMuted, fontSize: font.small, textAlign: 'center' },
  commentary: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  commentaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  commentaryTitle: { color: colors.accent, fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', flex: 1 },
  commentaryText: { color: colors.text, fontSize: font.body, lineHeight: 22, fontStyle: 'italic' },
  gained: { color: colors.success, fontWeight: '700', textAlign: 'center' },
  controls: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});
