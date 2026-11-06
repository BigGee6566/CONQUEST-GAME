import { StyleSheet, Text, View } from 'react-native';
import { GameList } from '../components/GameList';
import { Screen } from '../components/Screen';
import { colors, font, spacing } from '../theme';

export function ExploreScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Live wars around the world</Text>
        <Text style={styles.copy}>
          Every public campaign can be watched in real time, with no account needed. Only its commander can make moves.
        </Text>
      </View>
      <GameList scope="public" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  copy: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
});
