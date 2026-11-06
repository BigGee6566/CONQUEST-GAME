import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import type { GameEvent, PlayerView } from '../types';
import { Button, Chip, type IconName } from './ui';

type Filter = 'all' | 'battles' | 'npc' | 'turns';

const FILTERS: { key: Filter; label: string; types: string[] | null }[] = [
  { key: 'all', label: 'All', types: null },
  { key: 'battles', label: 'Battles', types: ['attack_started', 'dice_rolled', 'country_conquered', 'attack_repelled', 'attack_stopped', 'player_eliminated'] },
  { key: 'npc', label: 'NPC thinking', types: ['npc_decision'] },
  { key: 'turns', label: 'Turns & troops', types: ['turn_started', 'reinforcements_received', 'reinforcements_placed', 'transfer', 'turn_skipped', 'turn_ended'] },
];

const ICONS: Record<string, { icon: IconName; color: string }> = {
  game_created: { icon: 'planet', color: colors.accent },
  turn_started: { icon: 'time', color: colors.textMuted },
  reinforcements_received: { icon: 'add-circle', color: colors.success },
  reinforcements_placed: { icon: 'people', color: colors.success },
  transfer: { icon: 'swap-horizontal', color: colors.info },
  attack_started: { icon: 'flash', color: colors.attacker },
  dice_rolled: { icon: 'dice', color: colors.attacker },
  country_conquered: { icon: 'trophy', color: colors.success },
  attack_repelled: { icon: 'shield-checkmark', color: colors.defender },
  attack_stopped: { icon: 'flag', color: colors.textMuted },
  turn_skipped: { icon: 'play-skip-forward', color: colors.textMuted },
  turn_ended: { icon: 'checkmark-done', color: colors.textMuted },
  npc_decision: { icon: 'hardware-chip', color: colors.accent },
  player_eliminated: { icon: 'skull', color: colors.danger },
  game_won: { icon: 'ribbon', color: colors.accent },
  game_over: { icon: 'close-circle', color: colors.danger },
};

const PAGE = 40;

export function EventFeed({ events, players }: { events: GameEvent[]; players: PlayerView[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);
  const colorOf = useMemo(() => new Map(players.map((p) => [p.id, p.color])), [players]);

  const filtered = useMemo(() => {
    const types = FILTERS.find((f) => f.key === filter)?.types;
    const matching = types ? events.filter((e) => types.includes(e.type)) : events;
    return [...matching].reverse();
  }, [events, filter]);

  return (
    <View style={styles.feed}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => { setFilter(f.key); setVisible(PAGE); }} />
        ))}
      </View>
      {filtered.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}
      {filtered.slice(0, visible).map((event) => {
        const meta = ICONS[event.type] ?? { icon: 'ellipse' as IconName, color: colors.textMuted };
        const commentary = event.data.commentary;
        return (
          <View key={event.seq} style={[styles.row, event.type === 'npc_decision' && styles.decision]}>
            <Ionicons name={meta.icon} size={16} color={meta.color} style={styles.icon} />
            <View style={styles.body}>
              <Text style={styles.message}>
                {event.actorName && event.actorId ? (
                  <Text style={{ color: colorOf.get(event.actorId) ?? colors.text, fontWeight: '800' }}>| </Text>
                ) : null}
                {event.message}
              </Text>
              {event.reasoning && <Text style={styles.reasoning}>Why: {event.reasoning}</Text>}
              {commentary?.text && <Text style={styles.commentary}>"{commentary.text}"</Text>}
            </View>
            <Text style={styles.round}>R{event.round}</Text>
          </View>
        );
      })}
      {filtered.length > visible && (
        <Button label="Show older events" variant="ghost" compact onPress={() => setVisible((v) => v + PAGE)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { gap: spacing.xs },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: font.small },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  decision: { backgroundColor: 'rgba(245, 184, 61, 0.07)' },
  icon: { marginTop: 2 },
  body: { flex: 1, gap: 2 },
  message: { color: colors.text, fontSize: font.small, lineHeight: 19 },
  reasoning: { color: colors.accent, fontSize: font.small, lineHeight: 19 },
  commentary: { color: colors.textMuted, fontSize: font.small, fontStyle: 'italic', lineHeight: 19 },
  round: { color: colors.textMuted, fontSize: font.tiny, marginTop: 2 },
});
