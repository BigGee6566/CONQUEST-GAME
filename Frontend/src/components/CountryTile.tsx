import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TileRole } from '../hooks/useMovePlanner';
import { colors, font, fonts, radius, spacing } from '../theme';
import type { Country, PlayerView } from '../types';
import { formatPopulation } from '../utils/format';
import { Flag } from './Flag';

const ROLE_BORDER: Record<TileRole, string | null> = {
  source: colors.accent,
  target: colors.danger,
  candidate: 'rgba(245, 184, 61, 0.45)',
  idle: null,
};

export function CountryTile({
  country,
  owner,
  role,
  width,
  pending = 0,
  combat = null,
  isCurrentTurn,
  onPress,
}: {
  country: Country;
  owner: PlayerView | undefined;
  role: TileRole;
  width: number;
  pending?: number;
  combat?: 'attacker' | 'defender' | null;
  isCurrentTurn: boolean;
  onPress: () => void;
}) {
  const ownerColor = owner?.color ?? colors.border;
  const highlight = ROLE_BORDER[role] ?? (combat === 'attacker' ? colors.attacker : combat === 'defender' ? colors.defender : null);
  const isHome = owner?.homeCountry === country.code;

  return (
    <Pressable
      onPress={onPress}
      disabled={role === 'idle' && pending === 0}
      accessibilityRole="button"
      accessibilityLabel={`${country.name}, ${country.soldiers} soldiers, held by ${owner?.name ?? 'nobody'}`}
      style={({ pressed }) => [
        styles.tile,
        { width, borderColor: highlight ?? colors.border, borderWidth: highlight ? 2 : 1 },
        highlight ? { boxShadow: `0 0 18px ${highlight}66` } : null,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={[`${ownerColor}55`, `${ownerColor}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.75 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.ownerBar, { backgroundColor: ownerColor }]} />
      <View style={styles.top}>
        <Flag code={country.code} size={22} />
        <View style={styles.badges}>
          {isHome && <Ionicons name="home" size={12} color={colors.textMuted} />}
          {isCurrentTurn && <Ionicons name="radio-button-on" size={12} color={colors.accent} />}
          {combat && <Ionicons name={combat === 'attacker' ? 'flash' : 'shield-half'} size={14} color={combat === 'attacker' ? colors.attacker : colors.defender} />}
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1}>{country.name}</Text>
      <View style={styles.bottom}>
        <View style={styles.soldiers}>
          <Ionicons name="people" size={14} color={colors.textMuted} />
          <Text style={styles.count}>{country.soldiers}</Text>
          {pending > 0 && <Text style={styles.pending}>+{pending}</Text>}
        </View>
        <Text style={styles.population}>{formatPopulation(country.population)}</Text>
      </View>
      <Text style={[styles.owner, { color: ownerColor }]} numberOfLines={1}>{owner?.name ?? 'Unclaimed'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: 'rgba(14, 21, 38, 0.92)',
    borderRadius: radius.md,
    padding: spacing.md,
    paddingTop: spacing.md + 4,
    gap: 4,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  ownerBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  name: { color: colors.text, fontSize: font.body, fontFamily: fonts.display },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  soldiers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { color: colors.text, fontSize: font.title, fontFamily: fonts.display },
  pending: { color: colors.success, fontSize: font.body, fontFamily: fonts.display },
  population: { color: colors.textMuted, fontSize: font.tiny },
  owner: { fontSize: font.tiny, fontWeight: '700' },
});
