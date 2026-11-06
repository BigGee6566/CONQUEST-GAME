import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, fonts, radius, spacing, surfaces } from '../theme';
import type { GameView } from '../types';
import { Button, StatTile } from './ui';

// In-game surrender prompt. Shows what the commander is giving up before they decide.
export function AbandonDialog({
  game,
  visible,
  busy,
  abandoning,
  onConfirm,
  onCancel,
}: {
  game: GameView;
  visible: boolean;
  busy: boolean;
  abandoning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    Animated.spring(entrance, { toValue: 1, friction: 7, tension: 90, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, entrance]);

  const commander = game.players.find((p) => !p.isNPC);
  const rivals = game.players.filter((p) => p.isNPC && !p.isEliminated).length;
  const cancel = () => {
    if (!abandoning) onCancel();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} focusable={false} accessibilityLabel="Close" />
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
          ]}
        >
          <View style={styles.emblem}>
            <Ionicons name="flag" size={28} color={colors.danger} />
          </View>
          <Text style={styles.kicker}>Round {game.round} | Command decision</Text>
          <Text style={styles.title}>Abandon this campaign?</Text>
          <Text style={styles.message}>
            {commander?.name ?? 'Commander'}, if you stand down the war ends at once and this campaign counts as a defeat.
          </Text>

          <View style={styles.stakes}>
            <StatTile label="Nations" value={`${commander?.countryCount ?? 0}/${game.countries.length}`} style={styles.stake} />
            <StatTile label="Soldiers" value={commander?.soldierCount ?? 0} style={styles.stake} />
            <StatTile label="Rivals" value={rivals} style={styles.stake} />
          </View>

          <View style={styles.hold}>
            <Ionicons name="pause-circle" size={16} color={colors.accent} />
            <Text style={styles.holdText}>The war is on hold until you decide.</Text>
          </View>

          <View style={styles.actions}>
            <Button label="Keep fighting" icon="shield" onPress={cancel} disabled={abandoning} style={styles.action} />
            <Button label="Abandon" icon="flag" variant="danger" onPress={onConfirm} loading={busy} style={styles.action} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surfaces.cardBorder,
    borderTopWidth: 3,
    borderTopColor: colors.danger,
    boxShadow: surfaces.shadow,
  },
  emblem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  kicker: { color: colors.accent, fontFamily: fonts.display, fontSize: font.small, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: font.title, textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: 'center' },
  stakes: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  stake: { flexBasis: 0, flexGrow: 1 },
  hold: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  holdText: { color: colors.text, fontSize: font.small },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignSelf: 'stretch' },
  action: { flexGrow: 1, flexBasis: 150 },
});
