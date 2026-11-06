import { Ionicons } from '@expo/vector-icons';
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrandSplash } from './src/components/BrandSplash';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

// Keep the native splash (logo on navy, see app.json) up until the display font is ready,
// then hand over to the animated in-app splash.
void SplashScreen.preventAutoHideAsync();

export default function App() {
  // The icon font is loaded here, once and behind the splash, instead of separately by every
  // icon on screen (which spammed timeouts when a slow dev server could not serve it in time).
  const [fontsLoaded, fontError] = useFonts({ RussoOne_400Regular, ...Ionicons.font });
  const [showSplash, setShowSplash] = useState(true);
  const fontsReady = fontsLoaded || Boolean(fontError);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  // Dark placeholder rather than nothing, so the web build never flashes white while fonts load.
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        {showSplash && <BrandSplash onFinish={finishSplash} />}
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
