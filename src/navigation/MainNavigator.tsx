import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from '../types/navigation';
import { MapScreen } from '../screens/main/MapScreen';
import { MissionScreen } from '../screens/main/MissionScreen';
import { AlertScreen } from '../screens/main/AlertScreen';
import { IncidentScreen } from '../screens/main/IncidentScreen';
import { ShiftScreen } from '../screens/main/ShiftScreen';
import { Colors, Shadows, BorderRadius, Spacing } from '../constants/theme';
import {
  Map as MapIcon,
  Plus,
  Bell,
  CalendarClock,
  AlertOctagon,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom Dock Navigation theo ngôn ngữ thiết kế viên thuốc đen nổi
function ModernPillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Tính toán khoảng cách đáy: nếu có safeArea (iPhone có home indicator) thì cách đáy vừa đủ, tránh bị đè
  const bottomMargin = Platform.OS === 'ios' ? Math.max(insets.bottom - 4, 12) : 16;

  return (
    <View style={[styles.dockContainer, { bottom: bottomMargin }]}>
      <View style={styles.dockSurface}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const labelString = typeof label === 'string' ? label : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const renderIcon = () => {
            const size = 20;
            const iconColor = isFocused ? Colors.hero : '#8E8E93';

            switch (route.name) {
              case 'Home':
                return <MapIcon size={size} color={iconColor} strokeWidth={isFocused ? 2.3 : 1.8} />;
              case 'Explore':
                return <Plus size={size} color={iconColor} strokeWidth={isFocused ? 2.5 : 1.8} />;
              case 'Favorites':
                return <Bell size={size} color={iconColor} strokeWidth={isFocused ? 2.3 : 1.8} />;
              case 'Shifts':
                return <CalendarClock size={size} color={iconColor} strokeWidth={isFocused ? 2.3 : 1.8} />;
              case 'Errors':
                return <AlertOctagon size={size} color={iconColor} strokeWidth={isFocused ? 2.3 : 1.8} />;
              default:
                return null;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel || labelString}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconCircle,
                  isFocused ? styles.iconCircleActive : styles.iconCircleInactive,
                ]}
              >
                {renderIcon()}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {labelString}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <ModernPillTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={MapScreen}
        options={{
          tabBarLabel: 'Bản đồ',
        }}
      />
      <Tab.Screen
        name="Explore"
        component={MissionScreen}
        options={{
          tabBarLabel: 'Nhiệm vụ',
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={AlertScreen}
        options={{
          tabBarLabel: 'Cảnh báo',
          // Bỏ hardcode tabBarBadge: 2 không có thật
        }}
      />
      <Tab.Screen
        name="Shifts"
        component={ShiftScreen}
        options={{
          tabBarLabel: 'Ca trực',
        }}
      />
      <Tab.Screen
        name="Errors"
        component={IncidentScreen}
        options={{
          tabBarLabel: 'Sự cố',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  dockSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.navigationDock,
    borderRadius: 36,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 500,
    ...Shadows.dock,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.button,
  },
  iconCircleInactive: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: '#8E8E93',
    fontWeight: '500',
  },
});
