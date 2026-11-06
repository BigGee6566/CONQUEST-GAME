import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { messageOf } from '../api/client';
import { gamesApi } from '../api/games';
import { colors, font, radius, spacing } from '../theme';
import type { Battle, BattleSummary } from '../types';
import { DiceTray } from './Dice';
import { Flag } from './Flag';
import { Badge, Button, EmptyState, ErrorBanner, LoadingView } from './ui';

const OUTCOME_COLOR: Record<string, string> = {
  conquered: colors.success,
  repelled: colors.defender,
  stopped: colors.textMuted,
  in_progress: colors.accent,
};

// Battle history for the game, with a step-by-step replay of every dice exchange.
export function BattleHistoryModal({ gameId, visible, onClose }: { gameId: string; visible: boolean; onClose: () => void }) {
  const [battles, setBattles] = useState<BattleSummary[] | null>(null);
  const [replay, setReplay] = useState<Battle | null>(null);
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReplay(null);
    setError(null);
    gamesApi.battles(gameId).then((page) => setBattles(page.items)).catch((err) => setError(messageOf(err)));
  }, [visible, gameId]);

  useEffect(() => {
    if (!autoPlay || !replay) return undefined;
    if (step >= replay.exchanges.length - 1) {
      setAutoPlay(false);
      return undefined;
    }
    const timer = setTimeout(() => setStep((s) => s + 1), 1600);
    return () => clearTimeout(timer);
  }, [autoPlay, step, replay]);

  const open = async (id: string) => {
    try {
      setReplay(await gamesApi.battle(gameId, id));
      setStep(0);
      setAutoPlay(true);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const exchange = replay?.exchanges[step];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {replay ? (
              <Pressable onPress={() => { setReplay(null); setAutoPlay(false); }} accessibilityLabel="Back to battle list" hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
            ) : null}
            <Text style={styles.title}>{replay ? 'Battle replay' : 'Battle history'}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <ScrollView contentContainerStyle={styles.body}>
            {!replay && !battles && !error && <LoadingView label="Loading battles..." />}
            {!replay && battles?.length === 0 && (
              <EmptyState icon="flash-off" title="No battles yet" message="Every attack in this war will be recorded here for replay." />
            )}
            {!replay && battles?.map((b) => (
              <Pressable key={b.id} onPress={() => open(b.id)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
                <View style={styles.flags}>
                  <Flag code={b.attacker.country} size={18} />
                  <Text style={styles.rowMeta}>vs</Text>
                  <Flag code={b.defender.country} size={18} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{b.attacker.countryName} attacks {b.defender.countryName}</Text>
                  <Text style={styles.rowMeta}>Round {b.round} | {b.exchangeCount} exchanges | {b.attacker.name}</Text>
                </View>
                <Badge label={b.outcome.replace('_', ' ')} color={OUTCOME_COLOR[b.outcome]} />
              </Pressable>
            ))}

            {replay && (
              <View style={styles.replay}>
                <View style={styles.flags}>
                  <Flag code={replay.attacker.country} size={22} />
                  <Text style={styles.rowTitle}>
                    {replay.attacker.countryName} ({replay.attacker.startingSoldiers}) vs {replay.defender.countryName} ({replay.defender.startingSoldiers})
                  </Text>
                  <Flag code={replay.defender.country} size={22} />
                </View>
                {exchange ? (
                  <>
                    <Text style={styles.rowMeta}>Exchange {step + 1} of {replay.exchanges.length}</Text>
                    <DiceTray
                      attackerDice={exchange.attackerDice}
                      defenderDice={exchange.defenderDice}
                      rollKey={`${replay.id}:${step}`}
                      attackerLabel={`${replay.attacker.countryName}: ${exchange.attackerRemaining} left`}
                      defenderLabel={`${replay.defender.countryName}: ${exchange.defenderRemaining} left`}
                    />
                    {exchange.commentary && <Text style={styles.commentary}>"{exchange.commentary.text}"</Text>}
                  </>
                ) : (
                  <Text style={styles.rowMeta}>The attack was called off before any dice were rolled.</Text>
                )}
                {step === replay.exchanges.length - 1 && replay.summary && replay.outcome === 'stopped' && (
                  <Text style={styles.commentary}>"{replay.summary}"</Text>
                )}
                <Badge label={replay.outcome.replace('_', ' ')} color={OUTCOME_COLOR[replay.outcome]} />
                <View style={styles.controls}>
                  <Button label="Prev" icon="play-back" variant="secondary" compact disabled={step === 0} onPress={() => { setAutoPlay(false); setStep((s) => s - 1); }} />
                  <Button label={autoPlay ? 'Pause' : 'Play'} icon={autoPlay ? 'pause' : 'play'} compact onPress={() => setAutoPlay((a) => !a)} disabled={replay.exchanges.length < 2} />
                  <Button label="Next" icon="play-forward" variant="secondary" compact disabled={step >= replay.exchanges.length - 1} onPress={() => { setAutoPlay(false); setStep((s) => s + 1); }} />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800', flex: 1 },
  body: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceRaised, borderRadius: radius.md },
  flags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontWeight: '700', fontSize: font.body },
  rowMeta: { color: colors.textMuted, fontSize: font.small },
  replay: { gap: spacing.md },
  commentary: { color: colors.text, fontStyle: 'italic', fontSize: font.body, lineHeight: 22 },
  controls: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
