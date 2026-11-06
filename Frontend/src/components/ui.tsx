import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, fonts, gradients, radius, spacing, surfaces } from '../theme';
import { Backdrop, LogoMark } from './Brand';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const palette = BUTTON_PALETTE[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        variant === 'primary' && !inactive && styles.primaryGlow,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' && (
        <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        icon && <Ionicons name={icon} size={compact ? 16 : 18} color={palette.fg} />
      )}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const BUTTON_PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
  danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
};

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, error ? styles.inputError : null]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (text: string) => void; placeholder: string }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.searchInput}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear search" hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { backgroundColor: color ?? colors.accent, borderColor: color ?? colors.accent }]}
    >
      <Text style={[styles.chipLabel, selected && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color = colors.textMuted, icon }: { label: string; color?: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      {icon && <Ionicons name={icon} size={11} color={color} />}
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action}
    </View>
  );
}

// Loading state: the CONQUEST emblem breathing over the war-room backdrop.
export function LoadingView({ label = 'Loading...' }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Backdrop />
      <Animated.View
        style={{
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) }],
        }}
      >
        <LogoMark size={110} />
      </Animated.View>
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorBanner({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Ionicons name="warning" size={18} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button label="Retry" onPress={onRetry} variant="ghost" compact />}
      {onDismiss && (
        <Pressable onPress={onDismiss} accessibilityLabel="Dismiss error" hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function StatTile({ label, value, hint, style }: { label: string; value: string | number; hint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, style]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 46,
    overflow: 'hidden',
  },
  primaryGlow: { boxShadow: surfaces.goldGlow },
  buttonCompact: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 36 },
  buttonLabel: { fontSize: font.body, fontFamily: fonts.display, letterSpacing: 0.8, textTransform: 'uppercase' },
  buttonLabelCompact: { fontSize: font.small },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
  card: {
    backgroundColor: surfaces.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surfaces.cardBorder,
    boxShadow: surfaces.shadow,
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: font.small },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: spacing.sm, fontSize: font.body },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipLabel: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: font.heading, fontFamily: fonts.display, letterSpacing: 1, textTransform: 'uppercase' },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTitle: { color: colors.text, fontSize: font.heading, fontFamily: fonts.display, textAlign: 'center' },
  emptyMessage: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', maxWidth: 420 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl, backgroundColor: colors.background },
  loadingLabel: { color: colors.accent, fontFamily: fonts.display, fontSize: font.small, letterSpacing: 3, textTransform: 'uppercase' },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.text, flex: 1, fontSize: font.small },
  stat: {
    flexGrow: 1,
    flexBasis: 120,
    backgroundColor: 'rgba(26, 35, 53, 0.75)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: surfaces.cardBorder,
    borderTopColor: 'rgba(245, 184, 61, 0.45)',
    padding: spacing.md,
    gap: 2,
  },
  statValue: { color: colors.text, fontSize: font.title, fontFamily: fonts.display },
  statLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  statHint: { color: colors.textMuted, fontSize: font.tiny },
});
