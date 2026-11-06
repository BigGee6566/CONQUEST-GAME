import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthScreen } from '../screens/AuthScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { GameScreen } from '../screens/GameScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { NewGameScreen } from '../screens/NewGameScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { HeaderBrand } from '../components/Brand';
import { colors, fonts } from '../theme';
import type { IconName } from '../components/ui';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

// Real URLs on web, so a game link such as /game/<id> can be shared and opened directly.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['conquest://'],
  config: {
    screens: {
      Main: { screens: { Lobby: '', Explore: 'explore', Profile: 'profile' } },
      Auth: 'login',
      NewGame: 'new',
      Game: 'game/:gameId',
    },
  },
};

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Lobby: 'flag',
  Explore: 'globe',
  Profile: 'stats-chart',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitle: ({ children }) => <HeaderBrand title={children} />,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: 'rgba(245, 184, 61, 0.25)', height: 62, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 0.6 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
      })}
    >
      <Tabs.Screen name="Lobby" component={LobbyScreen} options={{ title: 'My Campaigns' }} />
      <Tabs.Screen name="Explore" component={ExploreScreen} options={{ title: 'Live Wars' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Stats' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer
      linking={linking}
      theme={theme}
      documentTitle={{ formatter: (options, route) => `CONQUEST | ${options?.title ?? route?.name ?? 'War Room'}` }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.display },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Sign in', presentation: 'modal' }} />
        <Stack.Screen name="NewGame" component={NewGameScreen} options={{ title: 'New Campaign' }} />
        <Stack.Screen name="Game" component={GameScreen} options={{ title: 'War Room' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
