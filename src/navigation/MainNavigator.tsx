import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/navigation';
import { MapScreen } from '../screens/main/MapScreen';
import { MissionScreen } from '../screens/main/MissionScreen';
import { AlertScreen } from '../screens/main/AlertScreen';
import { Colors } from '../constants/theme';
import { Map, Plus, Bell, Users, AlertOctagon } from 'lucide-react-native';

const Tab = createBottomTabNavigator<MainTabParamList>();

const DensityScreen = () => (
  <View style={styles.placeholder}>
    <Users size={40} color={Colors.primary} />
    <Text style={styles.placeholderText}>Mật độ</Text>
  </View>
);

const IncidentScreen = () => (
  <View style={styles.placeholder}>
    <AlertOctagon size={40} color={Colors.error} />
    <Text style={styles.placeholderText}>Sự cố</Text>
  </View>
);

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
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
          tabBarIcon: ({ color, size }) => <Plus size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={AlertScreen}
        options={{
          tabBarLabel: 'Cảnh báo',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
          tabBarBadge: 2,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={DensityScreen}
        options={{
          tabBarLabel: 'Mật độ',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Errors"
        component={IncidentScreen}
        options={{
          tabBarLabel: 'Sự cố',
          tabBarIcon: ({ color, size }) => <AlertOctagon size={size} color={color} />,
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
