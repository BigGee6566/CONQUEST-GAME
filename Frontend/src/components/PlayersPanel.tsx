import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import type { GameView } from '../types';
import { PROFILE_META } from '../utils/format';
import { Flag } from './Flag';
import type { IconName } from './ui';

// Every commander in turn order, with their territory and army size, so targets are always visible.
export function PlayersPanel({ game }: { game: GameView }) {
  const byId = new Map(game.players.map((p) => [p.id, p]));
  return (
    <View style={styles.list}>
      {game.turnOrder.map((id, index) => {
        const player = byId.get(id);
        if (!player) return null;
        const current = id === game.currentPlayerId && game.status === 'active';
        const profile = player.npcProfile ? PROFILE_META[player.npcProfile] : null;
        return (
          <View key={id} style={[styles.row, current && styles.current, player.isEliminated && styles.out]}>
            <Text style={styles.order}>{index + 1}</Text>
            <View style={[styles.dot, { backgroundColor: player.color }]} />
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Flag code={player.homeCountry} size={12} />
                <Text style={[styles.name, player.isEliminated && styles.struck]} numberOfLines={1}>{player.name}</Text>
              </View>
              <View style={styles.meta}>
                {profile ? (
                  <>
                    <Ionicons name={profile.icon as IconName} size={11} color={colors.textMuted} />
                    <Text style={styles.metaText}>{profile.label}</Text>
                  </>
                ) : (
                  <Text style={[styles.metaText, { color: colors.accent }]}>You</Text>
                )}
                {player.isEliminated && <Text style={[styles.metaText, { color: colors.danger }]}>Eliminated R{player.eliminatedInRound}</Text>}
              </View>
            </View>
            <View style={styles.numbers}>
              <Text style={styles.number}>{player.countryCount}<Text style={styles.unit}> ctry</Text></Text>
              <Text style={styles.number}>{player.soldierCount}<Text style={styles.unit}> sol</Text></Text>
            </View>
            {current && <Ionicons name="caret-back" size={14} color={colors.accent} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: 8 },
  current: { backgroundColor: 'rgba(245, 184, 61, 0.1)' },
  out: { opacity: 0.45 },
  order: { color: colors.textMuted, width: 16, fontSize: font.tiny, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: font.small, fontWeight: '700', flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, fontSize: font.tiny },
  numbers: { alignItems: 'flex-end' },
  number: { color: colors.text, fontSize: font.small, fontWeight: '800' },
  unit: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '400' },
});
