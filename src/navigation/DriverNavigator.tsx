import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screens para conductores
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import TripHistoryScreen from '../screens/shared/TripHistoryScreen';
import EarningsScreen from '../screens/driver/EarningsScreen';
import WalletScreen from '../screens/driver/WalletScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import ProfileMenuModal from '../components/ProfileMenuModal';

export type DriverTabParamList = {
  Home: undefined;
  History: undefined;
  Earnings: undefined;
  Wallet: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<DriverTabParamList>();

const DriverNavigator: React.FC = () => {
  const [menuVisible, setMenuVisible] = useState(false);

  const getTabBarIcon = (route: any, focused: boolean, color: string, size: number) => {
    let iconName: keyof typeof Ionicons.glyphMap = 'home';

    if (route.name === 'Home') {
      iconName = focused ? 'navigate' : 'navigate-outline';
    } else if (route.name === 'History') {
      iconName = focused ? 'list' : 'list-outline';
    } else if (route.name === 'Earnings') {
      iconName = focused ? 'bar-chart' : 'bar-chart-outline';
    } else if (route.name === 'Wallet') {
      iconName = focused ? 'wallet' : 'wallet-outline';
    } else if (route.name === 'Profile') {
      iconName = focused ? 'person' : 'person-outline';
    }

    return <Ionicons name={iconName} size={size} color={color} />;
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => getTabBarIcon(route, focused, color, size),
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Home"
          component={DriverHomeScreen}
          options={{ tabBarLabel: 'Solicitudes' }}
        />
        <Tab.Screen
          name="History"
          component={TripHistoryScreen}
          options={{ tabBarLabel: 'Historial' }}
        />
        <Tab.Screen
          name="Earnings"
          component={EarningsScreen}
          options={{ tabBarLabel: 'Estadísticas' }}
        />
        <Tab.Screen
          name="Wallet"
          component={WalletScreen}
          options={{ tabBarLabel: 'Billetera' }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarLabel: 'Perfil' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMenuVisible(true);
            },
          }}
        />
      </Tab.Navigator>

      <ProfileMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onViewProfile={() => setMenuVisible(false)}
      />
    </>
  );
};

export default DriverNavigator;
