import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { PLAYBACK } from '../config';
import { colors, font, radius, spacing } from '../theme';

const NATIVE_DRIVER = Platform.OS !== 'web';
const MAX_PAIRS_SHOWN = 8;

// Pip positions on a 3x3 grid for each face.
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

const randomFace = () => 1 + Math.floor(Math.random() * 6);

// A single die that tumbles through random faces before landing on its real value.
export function Die({
  value,
  color,
  size = 40,
  rollKey,
  delay = 0,
  dimmed = false,
}: {
  value: number;
  color: string;
  size?: number;
  rollKey?: string;
  delay?: number;
  dimmed?: boolean;
}) {
  const spin = useRef(new Animated.Value(1)).current;
  const [face, setFace] = useState(value);

  useEffect(() => {
    if (!rollKey) {
      setFace(value);
      return undefined;
    }
    spin.setValue(0);
    setFace(randomFace());
    const shuffle = setInterval(() => setFace(randomFace()), 70);
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(spin, {
        toValue: 1,
        duration: PLAYBACK.diceRollMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]);
    animation.start(() => {
      clearInterval(shuffle);
      setFace(value);
    });
    return () => {
      clearInterval(shuffle);
      animation.stop();
      setFace(value);
    };
  }, [rollKey, value, delay, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-540deg', '0deg'] });
  const scale = spin.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 1.15, 1] });
  const pip = size * 0.18;
  const cell = size / 3;

  return (
    <Animated.View
      accessibilityLabel={`Die showing ${value}`}
      style={[
        styles.die,
        {
          width: size,
          height: size,
          backgroundColor: color,
          opacity: dimmed ? 0.4 : 1,
          transform: [{ rotate }, { scale }],
        },
      ]}
    >
      {PIPS[face].map(([row, col]) => (
        <View
          key={`${row}-${col}`}
          style={[
            styles.pip,
            {
              width: pip,
              height: pip,
              borderRadius: pip / 2,
              top: row * cell + (cell - pip) / 2,
              left: col * cell + (cell - pip) / 2,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

// Attacker and defender dice paired highest-vs-highest, with the result of each pair.
export function DiceTray({
  attackerDice,
  defenderDice,
  rollKey,
  attackerLabel,
  defenderLabel,
}: {
  attackerDice: number[];
  defenderDice: number[];
  rollKey?: string;
  attackerLabel: string;
  defenderLabel: string;
}) {
  const [revealed, setRevealed] = useState(!rollKey);
  useEffect(() => {
    if (!rollKey) {
      setRevealed(true);
      return undefined;
    }
    setRevealed(false);
    const timer = setTimeout(() => setRevealed(true), PLAYBACK.diceRollMs + 150);
    return () => clearTimeout(timer);
  }, [rollKey]);

  const shown = Math.min(attackerDice.length, MAX_PAIRS_SHOWN);
  const hidden = attackerDice.length - shown;

  return (
    <View style={styles.tray}>
      <View style={styles.labels}>
        <Text style={[styles.sideLabel, { color: colors.attacker }]} numberOfLines={1}>{attackerLabel}</Text>
        <Text style={[styles.sideLabel, { color: colors.defender }]} numberOfLines={1}>{defenderLabel}</Text>
      </View>
      <View style={styles.pairs}>
        {attackerDice.slice(0, shown).map((attack, i) => {
          const defend = defenderDice[i];
          const verdict = attack > defend ? 'attacker' : defend > attack ? 'defender' : 'tie';
          return (
            <View key={i} style={styles.pair}>
              <Die value={attack} color={colors.attacker} rollKey={rollKey} delay={i * 60} dimmed={revealed && verdict === 'defender'} />
              <View style={styles.verdict}>
                {revealed && (
                  <Ionicons
                    name={verdict === 'tie' ? 'remove' : verdict === 'attacker' ? 'caret-up' : 'caret-down'}
                    size={16}
                    color={verdict === 'tie' ? colors.textMuted : verdict === 'attacker' ? colors.attacker : colors.defender}
                  />
                )}
              </View>
              <Die value={defend} color={colors.defender} rollKey={rollKey} delay={i * 60 + 30} dimmed={revealed && verdict === 'attacker'} />
            </View>
          );
        })}
      </View>
      {hidden > 0 && <Text style={styles.more}>+{hidden} more pairs rolled</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  die: {
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pip: { position: 'absolute', backgroundColor: '#FFFFFF' },
  tray: { gap: spacing.sm },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  sideLabel: { fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, maxWidth: '48%' },
  pairs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  pair: {
    alignItems: 'center',
    gap: 2,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  verdict: { height: 18, justifyContent: 'center' },
  more: { color: colors.textMuted, fontSize: font.small, textAlign: 'center' },
});
