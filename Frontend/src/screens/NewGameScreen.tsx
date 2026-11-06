import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { countriesApi, type CountryQuery } from '../api/catalog';
import { messageOf } from '../api/client';
import { gamesApi } from '../api/games';
import { Flag } from '../components/Flag';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, EmptyState, ErrorBanner, LoadingView, SearchField, TextField } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDebounced } from '../hooks/useDebounced';
import type { RootStackParamList } from '../navigation/types';
import { colors, font, radius, spacing } from '../theme';
import type { WorldCountry } from '../types';
import { formatPopulation } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'NewGame'>;

const STRENGTHS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any strength' },
  { label: 'Small (1-3)', min: 1, max: 3 },
  { label: 'Medium (4-6)', min: 4, max: 6 },
  { label: 'Large (7-9)', min: 7, max: 9 },
];

const SORTS: { label: string; value: NonNullable<CountryQuery['sort']> }[] = [
  { label: 'A-Z', value: 'name' },
  { label: 'Strongest', value: '-soldierValue' },
  { label: 'Most populous', value: '-population' },
];

export function NewGameScreen({ navigation }: Props) {
  const { status } = useAuth();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim());
  const [region, setRegion] = useState<string | undefined>();
  const [strength, setStrength] = useState(0);
  const [sort, setSort] = useState<NonNullable<CountryQuery['sort']>>('name');
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<WorldCountry[] | null>(null);
  const [selected, setSelected] = useState<WorldCountry | null>(null);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const { min, max } = STRENGTHS[strength];
    countriesApi
      .list({ search: debouncedSearch || undefined, region, minSoldiers: min, maxSoldiers: max, sort })
      .then((result) => {
        setCountries(result.items);
        setRegions(result.regions);
        setError(null);
      })
      .catch((err) => setError(messageOf(err)));
  }, [debouncedSearch, region, strength, sort]);

  if (status === 'signedOut') {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed"
          title="Log in to start a campaign"
          message="Anyone can watch, but you need an account to command a nation."
          action={<Button label="Log in" icon="log-in" onPress={() => navigation.navigate('Auth', { mode: 'login' })} />}
        />
      </Screen>
    );
  }

  const start = async () => {
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      const { game } = await gamesApi.create({ homeCountry: selected.code, title: title.trim() || undefined, visibility });
      navigation.replace('Game', { gameId: game.id });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setCreating(false);
    }
  };

  const columns = width >= 1000 ? 4 : width >= 700 ? 3 : 2;
  const tileWidth = `${100 / columns - 2}%` as const;

  return (
    <Screen>
      <Text style={styles.title}>Choose your nation</Text>
      <Text style={styles.copy}>
        Your soldiers come from your population (1 to 9). Nine rival nations are drawn at random and turn order is shuffled.
      </Text>

      {selected && (
        <Card style={styles.summary}>
          <Flag code={selected.code} size={56} />
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryName}>{selected.name}</Text>
            <Text style={styles.copy}>{selected.region} | population {formatPopulation(selected.population)} | {selected.soldierValue} starting soldiers</Text>
            <TextField label="Campaign name (optional)" value={title} onChangeText={setTitle} placeholder={`Campaign from ${selected.name}`} maxLength={80} />
            <View style={styles.row}>
              <Chip label="Public: anyone with the link can watch" selected={visibility === 'public'} onPress={() => setVisibility('public')} />
              <Chip label="Private" selected={visibility === 'private'} onPress={() => setVisibility('private')} />
            </View>
            <Button label={`Start campaign as ${selected.name}`} icon="flag" onPress={start} loading={creating} />
          </View>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <SearchField value={search} onChangeText={setSearch} placeholder="Search 120+ countries" />
      <View style={styles.row}>
        <Chip label="All regions" selected={!region} onPress={() => setRegion(undefined)} />
        {regions.map((r) => <Chip key={r} label={r} selected={region === r} onPress={() => setRegion(r)} />)}
      </View>
      <View style={styles.row}>
        {STRENGTHS.map((s, i) => <Chip key={s.label} label={s.label} selected={strength === i} onPress={() => setStrength(i)} />)}
        <View style={styles.divider} />
        {SORTS.map((s) => <Chip key={s.value} label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />)}
      </View>

      {!countries && !error && <LoadingView label="Loading countries..." />}
      {countries?.length === 0 && <EmptyState icon="search" title="No countries match" message="Try another search or filter." />}
      <View style={styles.grid}>
        {countries?.map((country) => {
          const active = selected?.code === country.code;
          return (
            <Pressable
              key={country.code}
              onPress={() => setSelected(country)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${country.name}, ${country.soldierValue} soldiers`}
              style={({ pressed }) => [styles.tile, { width: tileWidth }, active && styles.tileActive, pressed && { opacity: 0.85 }]}
            >
              <Flag code={country.code} size={24} />
              <Text style={styles.tileName} numberOfLines={1}>{country.name}</Text>
              <Text style={styles.tileMeta}>{formatPopulation(country.population)} | {country.soldierValue} soldiers</Text>
              <View style={styles.strength}>
                {Array.from({ length: 9 }, (_, i) => (
                  <View key={i} style={[styles.pip, i < country.soldierValue && styles.pipOn]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  copy: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, borderColor: colors.accent },
  summaryInfo: { flex: 1, minWidth: 240, gap: spacing.md },
  summaryName: { color: colors.text, fontSize: font.title, fontWeight: '900' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  divider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-start' },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  tileActive: { borderColor: colors.accent, borderWidth: 2 },
  tileName: { color: colors.text, fontWeight: '800', fontSize: font.body },
  tileMeta: { color: colors.textMuted, fontSize: font.tiny },
  strength: { flexDirection: 'row', gap: 2, marginTop: 2 },
  pip: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  pipOn: { backgroundColor: colors.accent },
});
