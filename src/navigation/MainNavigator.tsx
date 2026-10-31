import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/navigation';
import { MapScreen } from '../screens/main/MapScreen';
import { MissionScreen } from '../screens/main/MissionScreen';
import { AlertScreen } from '../screens/main/AlertScreen';
import { IncidentScreen } from '../screens/main/IncidentScreen';
import { Colors } from '../constants/theme';
import { Map, Plus, Bell, AlertOctagon } from 'lucide-react-native';

const Tab = createBottomTabNavigator<MainTabParamList>();

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
