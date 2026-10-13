import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Favorites: undefined;
  Profile: undefined;
  Errors: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: { initialEmail?: string } | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};
