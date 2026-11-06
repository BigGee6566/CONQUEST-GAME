import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { messageOf } from '../api/client';
import { gamesApi } from '../api/games';
import { useDebounced } from '../hooks/useDebounced';
import { spacing } from '../theme';
import type { GameStatus, GameSummary } from '../types';
import { GameCard } from './GameCard';
import { Button, Chip, EmptyState, ErrorBanner, LoadingView, SearchField } from './ui';

const STATUS_FILTERS: { label: string; value: GameStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Abandoned', value: 'abandoned' },
];

// Searchable, filterable, paginated list of games (the player's own or all public ones).
export function GameList({ scope, emptyAction }: { scope: 'mine' | 'public'; emptyAction?: ReactNode }) {
  const navigation = useNavigation();
  const [status, setStatus] = useState<GameStatus | undefined>();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim());
  const [items, setItems] = useState<GameSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const result = await gamesApi.list({ scope, status, search: debouncedSearch || undefined, page: nextPage, limit: 12 });
      setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
      setPage(result.page);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [scope, status, debouncedSearch]);

  // Refresh whenever the screen regains focus (e.g. after finishing a game).
  useFocusEffect(useCallback(() => {
    void fetchPage(1);
  }, [fetchPage]));

  return (
    <View style={styles.list}>
      <SearchField value={search} onChangeText={setSearch} placeholder={scope === 'mine' ? 'Search your campaigns' : 'Search by title or commander'} />
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} selected={status === f.value} onPress={() => setStatus(f.value)} />
        ))}
      </View>

      {error && <ErrorBanner message={error} onRetry={() => fetchPage(1)} />}
      {loading && items.length === 0 && <LoadingView label="Loading campaigns..." />}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="map"
          title={debouncedSearch || status ? 'No matching games' : scope === 'mine' ? 'No campaigns yet' : 'No public wars yet'}
          message={debouncedSearch || status ? 'Try a different search or filter.' : 'Start a campaign and it will show up here.'}
          action={emptyAction}
        />
      )}

      {items.map((game) => (
        <GameCard key={game.id} game={game} onPress={() => navigation.navigate('Game', { gameId: game.id })} />
      ))}

      {page < totalPages && (
        <Button label="Load more" variant="secondary" loading={loading} onPress={() => fetchPage(page + 1)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
