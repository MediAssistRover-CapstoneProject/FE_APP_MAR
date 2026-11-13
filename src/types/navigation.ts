import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Favorites: undefined;
  Errors: undefined;
  Shifts: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: { initialEmail?: string } | undefined;
  FirstLoginPasswordChange: { username?: string; currentPassword?: string; staffCode?: string } | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};
