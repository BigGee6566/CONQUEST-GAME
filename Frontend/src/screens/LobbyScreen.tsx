import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Logo, LogoMark } from '../components/Brand';
import { GameList } from '../components/GameList';
import { Screen } from '../components/Screen';
import { Button, Card, LoadingView, type IconName } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, font, fonts, gradients, radius, spacing } from '../theme';

const FEATURES: { icon: IconName; title: string; copy: string }[] = [
  { icon: 'earth', title: '10 Nations', copy: 'Real countries, armies sized by population' },
  { icon: 'hardware-chip', title: '9 AI Commanders', copy: 'Aggressive, defensive, balanced, opportunist' },
  { icon: 'dice', title: 'Dice Battles', copy: 'Every roll animated, paired die against die' },
  { icon: 'mic', title: 'Live War Report', copy: 'An AI correspondent narrates each clash' },
];

export function LobbyScreen() {
  const navigation = useNavigation();
  const { status, user } = useAuth();
  const { width } = useWindowDimensions();

  if (status === 'loading') return <LoadingView label="Restoring your session..." />;

  if (status === 'signedOut') {
    return (
      <Screen>
        <View style={styles.hero}>
          <Logo width={Math.min(320, width * 0.7)} />
          <Text style={styles.heroTitle}>Conquer all ten nations to rule the world.</Text>
          <Text style={styles.heroCopy}>
            Choose your homeland, outwit nine AI warlords and roll your way to world domination.
          </Text>
          <View style={styles.actions}>
            <Button label="Enlist now" icon="person-add" onPress={() => navigation.navigate('Auth', { mode: 'register' })} />
            <Button label="Log in" variant="secondary" icon="log-in" onPress={() => navigation.navigate('Auth', { mode: 'login' })} />
          </View>
          <Button label="Watch live wars" variant="ghost" icon="globe" onPress={() => navigation.navigate('Main', { screen: 'Explore' })} />
        </View>
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={22} color={colors.accent} />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureCopy}>{feature.copy}</Text>
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  const stats = user?.stats;
  const newGame = <Button label="New campaign" icon="flag" onPress={() => navigation.navigate('NewGame')} />;

  return (
    <Screen>
      <Card style={styles.command}>
        <LinearGradient colors={gradients.panel} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.commandRow}>
          <LogoMark size={72} />
          <View style={styles.commandInfo}>
            <Text style={styles.kicker}>Commander</Text>
            <Text style={styles.commander} numberOfLines={1}>{user?.username}</Text>
            <View style={styles.record}>
              <RecordPill label="Campaigns" value={stats?.gamesPlayed ?? 0} />
              <RecordPill label="Victories" value={stats?.gamesWon ?? 0} />
              <RecordPill label="Conquests" value={stats?.countriesConquered ?? 0} />
            </View>
          </View>
        </View>
        {newGame}
      </Card>
      <Text style={styles.section}>Your campaigns</Text>
      <GameList scope="mine" emptyAction={newGame} />
    </Screen>
  );
}

function RecordPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.lg },
  heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: font.title, textAlign: 'center', maxWidth: 560 },
  heroCopy: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: 'center', maxWidth: 520 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  feature: {
    flexBasis: 220,
    flexGrow: 1,
    maxWidth: 260,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(14, 21, 38, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 61, 0.22)',
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 184, 61, 0.12)',
    marginBottom: spacing.xs,
  },
  featureTitle: { color: colors.text, fontFamily: fonts.display, fontSize: font.body, letterSpacing: 0.5 },
  featureCopy: { color: colors.textMuted, fontSize: font.small, lineHeight: 19 },
  command: { overflow: 'hidden', borderColor: 'rgba(245, 184, 61, 0.35)' },
  commandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  commandInfo: { flex: 1, gap: 4 },
  kicker: { color: colors.accent, fontFamily: fonts.display, fontSize: font.tiny, letterSpacing: 3, textTransform: 'uppercase' },
  commander: { color: colors.text, fontFamily: fonts.display, fontSize: font.title },
  record: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 15, 28, 0.7)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillValue: { color: colors.accent, fontFamily: fonts.display, fontSize: font.body },
  pillLabel: { color: colors.textMuted, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 1 },
  section: { color: colors.text, fontFamily: fonts.display, fontSize: font.heading, letterSpacing: 1, textTransform: 'uppercase' },
});
