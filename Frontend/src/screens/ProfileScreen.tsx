import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { statsApi } from '../api/catalog';
import { messageOf } from '../api/client';
import { Screen } from '../components/Screen';
import { Button, Card, ErrorBanner, LoadingView, SectionHeader, StatTile } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, font, spacing } from '../theme';
import type { LeaderboardEntry, MyStats, NpcProfile, PlatformStats } from '../types';
import { PROFILE_META } from '../utils/format';
import { Flag } from '../components/Flag';

export function ProfileScreen() {
  const navigation = useNavigation();
  const { status, logout, refreshUser } = useAuth();
  const [mine, setMine] = useState<MyStats | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[] | null>(null);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [board, world, me] = await Promise.all([
        statsApi.leaderboard(),
        statsApi.platform(),
        status === 'signedIn' ? statsApi.me() : Promise.resolve(null),
      ]);
      setLeaders(board);
      setPlatform(world);
      setMine(me);
      if (me) void refreshUser();
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setRefreshing(false);
    }
  }, [status, refreshUser]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (status === 'loading' || (!platform && !error)) return <LoadingView label="Crunching the numbers..." />;

  const profile = mine?.profile;
  const maxProfileWins = Math.max(1, ...Object.values(platform?.winsByProfile ?? {}));

  return (
    <Screen refreshing={refreshing} onRefresh={load}>
      {error && <ErrorBanner message={error} onRetry={load} />}

      {profile ? (
        <Card>
          <SectionHeader title={profile.username} action={<Button label="Log out" variant="ghost" icon="log-out" compact onPress={logout} />} />
          <Text style={styles.muted}>Commander since {new Date(profile.createdAt).toLocaleDateString()}</Text>
          <View style={styles.tiles}>
            <StatTile label="Campaigns" value={profile.stats.gamesPlayed} />
            <StatTile label="Victories" value={profile.stats.gamesWon} hint={`${profile.winRate}% win rate`} />
            <StatTile label="Defeats" value={profile.stats.gamesLost} />
            <StatTile label="Battles won" value={profile.stats.battlesWon} hint={`of ${profile.stats.battlesFought} launched`} />
            <StatTile label="Countries conquered" value={profile.stats.countriesConquered} />
            <StatTile label="Enemy soldiers defeated" value={mine?.totals.soldiersKilled ?? 0} hint={`${mine?.totals.soldiersLost ?? 0} of yours lost`} />
            <StatTile label="Average game length" value={`${Math.round(mine?.totals.averageRounds ?? 0)} rounds`} hint={`Longest: ${mine?.totals.longestGame ?? 0}`} />
          </View>
          {mine && mine.favouriteCountries.length > 0 && (
            <Text style={styles.muted}>
              Favourite nations: {mine.favouriteCountries.map((c) => `${c.name ?? c.code} (${c.games} played, ${c.wins} won)`).join(' | ')}
            </Text>
          )}
        </Card>
      ) : (
        <Card>
          <SectionHeader title="Your record" />
          <Text style={styles.muted}>Log in to track your campaigns, victories and conquests.</Text>
          <Button label="Log in" icon="log-in" onPress={() => navigation.navigate('Auth', { mode: 'login' })} />
        </Card>
      )}

      <Card>
        <SectionHeader title="Leaderboard" />
        {leaders?.length === 0 && <Text style={styles.muted}>No finished campaigns yet. Be the first.</Text>}
        {leaders?.map((entry, i) => (
          <View key={entry.id} style={styles.leader}>
            <Text style={[styles.rank, i < 3 && { color: colors.accent }]}>#{i + 1}</Text>
            <Text style={styles.leaderName} numberOfLines={1}>{entry.username}</Text>
            <Text style={styles.muted}>{entry.stats.gamesWon} wins | {entry.stats.countriesConquered} conquests | {entry.winRate}%</Text>
          </View>
        ))}
      </Card>

      {platform && (
        <Card>
          <SectionHeader title="World analytics" />
          <View style={styles.tiles}>
            <StatTile label="Commanders" value={platform.users} />
            <StatTile label="Campaigns" value={platform.games} hint={`${platform.gamesByStatus.active ?? 0} active now`} />
            <StatTile label="Battles fought" value={platform.battles} hint={`${platform.battleOutcomes.conquered ?? 0} conquests`} />
          </View>

          <Text style={styles.subhead}>Who wins the world?</Text>
          {Object.keys(platform.winsByProfile).length === 0 && <Text style={styles.muted}>No completed games yet.</Text>}
          {Object.entries(platform.winsByProfile).map(([profileKey, wins]) => (
            <View key={profileKey} style={styles.barRow}>
              <Text style={styles.barLabel}>{profileKey === 'human' ? 'Human players' : PROFILE_META[profileKey as NpcProfile]?.label ?? profileKey}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(wins / maxProfileWins) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{wins}</Text>
            </View>
          ))}

          <Text style={styles.subhead}>Most popular starting nations</Text>
          {platform.popularStartingCountries.map((c) => (
            <View key={c.code} style={styles.leader}>
              <Flag code={c.code} size={16} />
              <Text style={styles.muted}>{c.name ?? c.code}: {c.games} campaigns, {c.wins} won</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  leader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  rank: { color: colors.textMuted, fontWeight: '900', width: 32 },
  leaderName: { color: colors.text, fontWeight: '800', flex: 1 },
  subhead: { color: colors.text, fontWeight: '800', marginTop: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { color: colors.textMuted, width: 110, fontSize: font.small },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.surfaceRaised, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 5 },
  barValue: { color: colors.text, width: 28, textAlign: 'right', fontWeight: '700' },
});
