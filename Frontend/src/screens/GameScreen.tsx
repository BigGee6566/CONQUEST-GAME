import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AbandonDialog } from '../components/AbandonDialog';
import { ActionPanel } from '../components/ActionPanel';
import { BattleHistoryModal } from '../components/BattleHistoryModal';
import { BattlePanel } from '../components/BattlePanel';
import { CountryTile } from '../components/CountryTile';
import { EventFeed } from '../components/EventFeed';
import { PlayersPanel } from '../components/PlayersPanel';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, ErrorBanner, LoadingView, SectionHeader } from '../components/ui';
import { gameShareUrl } from '../config';
import { useAuth } from '../context/AuthContext';
import { useGameSession } from '../hooks/useGameSession';
import { useMovePlanner } from '../hooks/useMovePlanner';
import type { RootStackParamList } from '../navigation/types';
import { colors, font, fonts, spacing } from '../theme';
import type { GameView } from '../types';
import { PHASE_LABEL } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const BOARD_GAP = spacing.md;

function boardColumns(boardWidth: number) {
  if (boardWidth >= 1000) return 5;
  if (boardWidth >= 720) return 4;
  if (boardWidth >= 480) return 3;
  return 2;
}

export function GameScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const { status: authStatus } = useAuth();
  const [abandonDialog, setAbandonDialog] = useState<'closed' | 'open' | 'abandoning'>('closed');
  const session = useGameSession(gameId, abandonDialog !== 'closed');
  const { game, battle, events } = session;
  const planner = useMovePlanner(game);
  const { width } = useWindowDimensions();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    await Clipboard.setStringAsync(gameShareUrl(gameId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [gameId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: game?.title ?? 'War Room',
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={() => setHistoryOpen(true)} accessibilityLabel="Battle history and replays" hitSlop={8}>
            <Ionicons name="film" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={share} accessibilityLabel="Copy shareable game link" hitSlop={8}>
            <Ionicons name={copied ? 'checkmark-done' : 'share-social'} size={22} color={copied ? colors.success : colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, game?.title, share, copied]);

  const latestDecision = useMemo(() => {
    if (session.decision) return session.decision.reasoning;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].type === 'npc_decision') return events[i].reasoning;
      if (events[i].type === 'turn_started') break;
    }
    return null;
  }, [session.decision, events]);

  if (session.loading) return <LoadingView label="Entering the war room..." />;
  if (!game) {
    return (
      <Screen>
        <ErrorBanner message={session.error ?? 'This game could not be found.'} onRetry={session.reload} />
      </Screen>
    );
  }

  const wide = width >= 1024;
  const contentWidth = Math.min(width, 1400) - spacing.lg * 2;
  const boardWidth = wide ? contentWidth * 0.63 : contentWidth;
  const columns = boardColumns(boardWidth);
  const tileWidth = Math.floor((boardWidth - BOARD_GAP * (columns - 1)) / columns) - 1;
  const playersById = new Map(game.players.map((p) => [p.id, p]));
  const current = playersById.get(game.currentPlayerId);

  const abandon = async () => {
    setAbandonDialog('abandoning');
    await session.abandon();
    setAbandonDialog('closed');
  };

  const onTilePress = (code: string) => {
    if (game.phase === 'reinforce' && planner.roleOf(code) === 'idle' && (planner.allocation[code] ?? 0) > 0) {
      planner.removeAllocation(code);
    } else {
      planner.tap(code);
    }
  };

  const battleView = battle && (
    <BattlePanel
      battle={battle}
      canControl={game.viewer.canAct && game.phase === 'attacking' && game.activeAttack?.battleId === battle.id}
      busy={session.busy}
      onRoll={() => session.act({ type: 'roll' })}
      onStop={() => session.act({ type: 'stop' })}
      onDismiss={session.dismissBattle}
    />
  );

  const board = (
    <View style={styles.board}>
      {game.countries.map((country) => (
        <CountryTile
          key={country.code}
          country={country}
          owner={playersById.get(country.ownerId)}
          role={planner.roleOf(country.code)}
          width={tileWidth}
          pending={planner.allocation[country.code] ?? 0}
          combat={game.activeAttack?.from === country.code ? 'attacker' : game.activeAttack?.to === country.code ? 'defender' : null}
          isCurrentTurn={game.status === 'active' && country.ownerId === game.currentPlayerId}
          onPress={() => onTilePress(country.code)}
        />
      ))}
    </View>
  );

  const actions = game.viewer.canAct && (
    <ActionPanel game={game} planner={planner} busy={session.busy} lastBattle={battle} onAct={session.act} />
  );

  const sidebar = (
    <>
      <Card>
        <SectionHeader title="Commanders" />
        <PlayersPanel game={game} />
      </Card>
      <Card>
        <SectionHeader title="War log" />
        <EventFeed events={events} players={game.players} />
      </Card>
    </>
  );

  return (
    <Screen maxWidth={1400}>
      {session.error && (
        <ErrorBanner
          message={session.error}
          onRetry={session.npcPaused ? session.resumeNpc : undefined}
          onDismiss={session.dismissError}
        />
      )}

      <TurnBanner
        game={game}
        currentName={current?.name ?? '-'}
        currentColor={current?.color ?? colors.border}
        currentIsNpc={Boolean(current?.isNPC)}
        decision={current?.isNPC ? latestDecision : null}
        busy={session.busy}
        fastForward={session.fastForward}
        npcPaused={session.npcPaused}
        signedOut={authStatus === 'signedOut'}
        onToggleFastForward={() => session.setFastForward(!session.fastForward)}
        onPause={session.pauseNpc}
        onResume={session.resumeNpc}
        onAbandon={() => setAbandonDialog('open')}
        onSignUp={() => navigation.navigate('Auth', { mode: 'register' })}
      />

      {game.status !== 'active' && (
        <GameOverCard game={game} onNewGame={() => navigation.navigate('NewGame')} onHistory={() => setHistoryOpen(true)} />
      )}

      {wide ? (
        <View style={styles.columns}>
          <View style={[styles.column, { width: boardWidth }]}>
            {battleView}
            {actions}
            {board}
          </View>
          <View style={[styles.column, styles.sidebar]}>{sidebar}</View>
        </View>
      ) : (
        <>
          {battleView}
          {actions}
          {board}
          {sidebar}
        </>
      )}

      <BattleHistoryModal gameId={gameId} visible={historyOpen} onClose={() => setHistoryOpen(false)} />
      <AbandonDialog
        game={game}
        visible={abandonDialog !== 'closed' && game.status === 'active'}
        busy={session.busy}
        abandoning={abandonDialog === 'abandoning'}
        onConfirm={abandon}
        onCancel={() => setAbandonDialog('closed')}
      />
    </Screen>
  );
}

function TurnBanner(props: {
  game: GameView;
  currentName: string;
  currentColor: string;
  currentIsNpc: boolean;
  decision: string | null;
  busy: boolean;
  fastForward: boolean;
  npcPaused: boolean;
  signedOut: boolean;
  onToggleFastForward: () => void;
  onPause: () => void;
  onResume: () => void;
  onAbandon: () => void;
  onSignUp: () => void;
}) {
  const { game } = props;
  const active = game.status === 'active';
  const headline = !active
    ? 'The war is over'
    : game.viewer.canAct
      ? 'Your move, commander'
      : `${props.currentName}: ${PHASE_LABEL[game.phase]}`;

  return (
    <Card style={styles.banner}>
      <View style={styles.bannerRow}>
        <Text style={styles.round}>ROUND {game.round}</Text>
        <View style={[styles.dot, { backgroundColor: props.currentColor }]} />
        <Text style={styles.headline} numberOfLines={2}>{headline}</Text>
        {active && props.currentIsNpc && props.busy && <ActivityIndicator color={colors.accent} size="small" />}
      </View>

      {active && props.decision && (
        <View style={styles.decision}>
          <Ionicons name="hardware-chip" size={16} color={colors.accent} />
          <Text style={styles.decisionText}>{props.decision}</Text>
        </View>
      )}

      {active && game.viewer.isOwner && (
        <View style={styles.bannerRow}>
          <Chip
            label={props.fastForward ? 'Fast-forward on' : 'Fast-forward NPCs'}
            selected={props.fastForward}
            onPress={props.onToggleFastForward}
          />
          {props.npcPaused ? (
            <Button label="Resume NPCs" icon="play" compact onPress={props.onResume} />
          ) : (
            props.currentIsNpc && <Button label="Pause" icon="pause" variant="ghost" compact onPress={props.onPause} />
          )}
          <View style={styles.grow} />
          <Button label="Abandon" variant="ghost" compact onPress={props.onAbandon} />
        </View>
      )}

      {game.viewer.isSpectator && (
        <View style={styles.bannerRow}>
          <Ionicons name="eye" size={16} color={colors.info} />
          <Text style={styles.spectator}>
            Watching {game.owner.username ?? 'a commander'}'s campaign {active ? 'live' : ''}. Only they can make moves.
          </Text>
          {props.signedOut && <Button label="Start your own" compact onPress={props.onSignUp} />}
        </View>
      )}
    </Card>
  );
}

function GameOverCard({ game, onNewGame, onHistory }: { game: GameView; onNewGame: () => void; onHistory: () => void }) {
  const human = game.players.find((p) => !p.isNPC);
  const winner = game.players.find((p) => p.id === game.winnerId);
  const won = Boolean(human && game.winnerId === human.id);
  const title = won ? 'Victory! The world is yours.' : game.endReason === 'abandoned' ? 'Campaign abandoned' : 'Defeat';
  const message = won
    ? `You conquered all 10 nations in ${game.round} rounds.`
    : game.endReason === 'abandoned'
      ? 'This campaign was abandoned by its commander.'
      : winner
        ? `${winner.name} conquered the world in round ${game.round}.`
        : `${human?.name ?? 'The player'} was eliminated in round ${human?.eliminatedInRound ?? game.round}.`;

  return (
    <Card style={[styles.gameOver, { borderColor: won ? colors.accent : colors.danger }]}>
      <Ionicons name={won ? 'trophy' : 'skull'} size={40} color={won ? colors.accent : colors.danger} />
      <Text style={styles.gameOverTitle}>{title}</Text>
      <Text style={styles.spectator}>{message}</Text>
      <View style={styles.bannerRow}>
        <Button label="Replay battles" icon="film" variant="secondary" onPress={onHistory} />
        {game.viewer.isOwner && <Button label="New campaign" icon="add" onPress={onNewGame} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.lg, paddingRight: spacing.md },
  columns: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  column: { gap: spacing.lg },
  sidebar: { flex: 1 },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: BOARD_GAP },
  banner: { gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.accent },
  bannerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  round: {
    color: colors.accentText,
    backgroundColor: colors.accent,
    fontFamily: fonts.display,
    letterSpacing: 1.5,
    fontSize: font.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  headline: { color: colors.text, fontFamily: fonts.display, fontSize: font.heading, flexShrink: 1 },
  decision: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 184, 61, 0.08)',
  },
  decisionText: { color: colors.text, fontSize: font.small, lineHeight: 20, flex: 1 },
  spectator: { color: colors.textMuted, fontSize: font.body, flexShrink: 1 },
  grow: { flexGrow: 1 },
  gameOver: { alignItems: 'center', borderWidth: 2 },
  gameOverTitle: { color: colors.text, fontSize: font.title, fontFamily: fonts.display, textAlign: 'center' },
});
