import { LinearGradient } from 'expo-linear-gradient';
import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradients } from '../theme';

const LOGO = require('../../assets/logo.png');
const MARK = require('../../assets/logo-mark.png');
const GRID = require('../../assets/grid.png');

// Full lockup (emblem + CONQUEST wordmark); the source art is 1024x1040.
export function Logo({ width = 280 }: { width?: number }) {
  return <Image source={LOGO} style={{ width, height: width * (1040 / 1024) }} resizeMode="contain" accessibilityLabel="CONQUEST" />;
}

// The shield emblem on its own, for headers, loading states and small spaces.
export function LogoMark({ size = 48 }: { size?: number }) {
  return <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="CONQUEST emblem" />;
}

// The war-room backdrop shared by every screen: deep navy gradient, a faint tactical grid
// and a warm glow from the top.
export function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={gradients.backdrop} style={StyleSheet.absoluteFill} />
      <ImageBackground source={GRID} resizeMode="repeat" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={gradients.topGlow} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function HeaderBrand({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <LogoMark size={30} />
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' },
});
