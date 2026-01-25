import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screens para pasajeros
import PassengerHomeScreen from '../screens/passenger/PassengerHomeScreen';
import TripHistoryScreen from '../screens/shared/TripHistoryScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

export type PassengerTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<PassengerTabParamList>();

const PassengerNavigator: React.FC = () => {
  const getTabBarIcon = (route: any, focused: boolean, color: string, size: number) => {
    let iconName: keyof typeof Ionicons.glyphMap = 'home';

    if (route.name === 'Home') {
      iconName = focused ? 'home' : 'home-outline';
    } else if (route.name === 'History') {
      iconName = focused ? 'list' : 'list-outline';
    } else if (route.name === 'Profile') {
      iconName = focused ? 'person' : 'person-outline';
    }

    return <Ionicons name={iconName} size={size} color={color} />;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => getTabBarIcon(route, focused, color, size),
        tabBarActiveTintColor: '#FF6B6B',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={PassengerHomeScreen}
        options={{ tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="History"
        component={TripHistoryScreen}
        options={{ tabBarLabel: 'Historial' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
};

export default PassengerNavigator;
