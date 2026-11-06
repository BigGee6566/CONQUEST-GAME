import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// Flag images rather than emoji: Windows has no flag emoji font and would show letter pairs instead.
// Falls back to the ISO code if the image cannot be loaded (e.g. offline).
export function Flag({ code, size = 24 }: { code: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const width = Math.round(size * 1.4);

  if (failed) {
    return (
      <View style={[styles.fallback, { width, height: size }]}>
        <Text style={[styles.code, { fontSize: size * 0.45 }]}>{code}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `https://flagcdn.com/w160/${code.toLowerCase()}.png` }}
      onError={() => setFailed(true)}
      resizeMode="cover"
      accessibilityLabel={`Flag of ${code}`}
      style={[styles.image, { width, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)' },
  fallback: { borderRadius: 3, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.textMuted, fontWeight: '800' },
});
