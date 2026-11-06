import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, spacing } from '../theme';
import { Backdrop, Logo } from './Brand';

const NATIVE_DRIVER = Platform.OS !== 'web';
const MIN_SHOW_MS = 1800;
const BAR_WIDTH = 220;

// Animated launch screen: the logo rises in with a glow pulse while a progress bar fills,
// then the whole overlay fades away once the saved session has been restored.
export function BrandSplash({ onFinish }: { onFinish: () => void }) {
  const { status } = useAuth();
  const { width } = useWindowDimensions();
  const intro = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const [minimumShown, setMinimumShown] = useState(false);
  const ready = status !== 'loading';

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.3)), useNativeDriver: NATIVE_DRIVER }).start();
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
    ]));
    glow.start();
    Animated.timing(progress, { toValue: 1, duration: MIN_SHOW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    // Timers rather than animation callbacks: browsers pause animations in background tabs,
    // which must never leave the player stuck behind the splash.
    const timer = setTimeout(() => setMinimumShown(true), MIN_SHOW_MS);
    return () => {
      glow.stop();
      clearTimeout(timer);
    };
  }, [intro, pulse, progress]);

  useEffect(() => {
    if (!ready || !minimumShown) return undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onFinish();
    };
    Animated.timing(exit, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE_DRIVER }).start(finish);
    const fallback = setTimeout(finish, 700);
    return () => clearTimeout(fallback);
  }, [ready, minimumShown, exit, onFinish]);

  const logoWidth = Math.min(340, width * 0.72);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]} accessibilityLabel="Loading CONQUEST">
      <Backdrop />
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.glow,
            {
              width: logoWidth * 1.1,
              height: logoWidth * 1.1,
              borderRadius: logoWidth,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }],
            },
          ]}
        />
        <Animated.View
          style={{
            opacity: intro,
            transform: [
              { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
              { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) },
            ],
          }}
        >
          <Logo width={logoWidth} />
        </Animated.View>
        <Animated.Text style={[styles.tagline, { opacity: intro }]}>Ten nations. One world. Roll for it.</Animated.Text>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_WIDTH] }) }]}
          />
        </View>
        <Text style={styles.status}>{ready && minimumShown ? 'Ready for war' : 'Mobilising armies...'}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(245, 184, 61, 0.18)',
    boxShadow: '0 0 120px 40px rgba(245, 184, 61, 0.25)',
  },
  tagline: { color: colors.textMuted, fontSize: 16, letterSpacing: 0.5, textAlign: 'center' },
  track: { width: BAR_WIDTH, height: 6, borderRadius: 3, backgroundColor: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  status: { color: colors.accent, fontFamily: fonts.display, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' },
});
