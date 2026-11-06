import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { Backdrop } from './Brand';

// Standard page shell: war-room backdrop, safe-area aware, scrollable, centred with a readable
// max width on desktop.
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  maxWidth = 1100,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  maxWidth?: number;
}) {
  const content = <View style={[styles.content, { maxWidth }]}>{children}</View>;
  return (
    <View style={styles.root}>
      <Backdrop />
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
              ) : undefined
            }
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  content: { width: '100%', alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
});
