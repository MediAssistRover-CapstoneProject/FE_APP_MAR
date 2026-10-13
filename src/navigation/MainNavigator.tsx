import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/navigation';
import { MapScreen } from '../screens/main/MapScreen';
import { MissionScreen } from '../screens/main/MissionScreen';
import { Colors } from '../constants/theme';
import { Map, ClipboardList, AlertTriangle, Monitor, AlertCircle } from 'lucide-react-native';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Placeholder screens for tabs not yet designed
const AlertScreen = () => (
  <View style={styles.placeholder}>
    <AlertTriangle size={40} color={Colors.warning} />
    <Text style={styles.placeholderText}>Cảnh báo</Text>
  </View>
);

const MonitorScreen = () => (
  <View style={styles.placeholder}>
    <Monitor size={40} color={Colors.primary} />
    <Text style={styles.placeholderText}>Màn độ</Text>
  </View>
);

const ErrorScreen = () => (
  <View style={styles.placeholder}>
    <AlertCircle size={40} color={Colors.error} />
    <Text style={styles.placeholderText}>Lỗi hệ thống</Text>
  </View>
);

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.teal,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={MapScreen}
        options={{
          tabBarLabel: 'Bản đồ',
          tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Explore"
        component={MissionScreen}
        options={{
          tabBarLabel: 'Nhiệm vụ',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
          tabBarBadge: 2,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={AlertScreen}
        options={{
          tabBarLabel: 'Cảnh báo',
          tabBarIcon: ({ color, size }) => <AlertTriangle size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={MonitorScreen}
        options={{
          tabBarLabel: 'Màn độ',
          tabBarIcon: ({ color, size }) => <Monitor size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Errors"
        component={ErrorScreen}
        options={{
          tabBarLabel: 'Lỗi',
          tabBarIcon: ({ color, size }) => <AlertCircle size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
