import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Lobby: undefined;
  Explore: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Auth: { mode?: 'login' | 'register' } | undefined;
  NewGame: undefined;
  Game: { gameId: string };
};

declare global {
  // Lets useNavigation() infer these routes everywhere without passing generics.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
