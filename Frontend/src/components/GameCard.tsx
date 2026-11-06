import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import type { GameSummary } from '../types';
import { timeAgo } from '../utils/format';
import { Flag } from './Flag';
import { Badge } from './ui';

const STATUS_COLOR = { active: colors.success, completed: colors.accent, abandoned: colors.textMuted } as const;

export function GameCard({ game, onPress }: { game: GameSummary; onPress: () => void }) {
  const result = game.status === 'completed'
    ? game.endReason === 'conquest' && game.winnerName === game.human?.name ? 'Victory' : `Won by ${game.winnerName ?? 'the NPCs'}`
    : game.status === 'abandoned' ? 'Abandoned' : `Now: ${game.currentPlayerName ?? '-'}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${game.title}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {game.human ? <Flag code={game.human.homeCountry} size={30} /> : null}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{game.title}</Text>
          <Badge label={game.status} color={STATUS_COLOR[game.status]} />
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {game.owner.username ?? 'Unknown'} | Round {game.round} | {game.playersRemaining} nations standing | {game.battleCount} battles
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {game.human ? `${game.human.countryCount} countries, ${game.human.soldierCount} soldiers` : ''} | {result} | {timeAgo(game.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: font.body, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: font.small },
});
