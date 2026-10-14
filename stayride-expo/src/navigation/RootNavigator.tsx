import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../theme/colors';

// Primary Screens
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { RoomsScreen } from '../screens/RoomsScreen';
import { GuestsScreen } from '../screens/GuestsScreen';
import { CabsScreen } from '../screens/CabsScreen';
import { MoreScreen } from '../screens/MoreScreen';

// Secondary / Activity Screens
import { BookingDetailScreen } from '../screens/BookingDetailScreen';
import { CabRequestDetailScreen } from '../screens/CabRequestDetailScreen';
import { GuestDetailScreen } from '../screens/GuestDetailScreen';
import { NewBookingScreen } from '../screens/NewBookingScreen';
import { NewGuestScreen } from '../screens/NewGuestScreen';
import { FindDriverScreen } from '../screens/FindDriverScreen';
import { MyDriversScreen } from '../screens/MyDriversScreen';
import { CampaignScreen } from '../screens/CampaignScreen';
import { CommissionScreen } from '../screens/CommissionScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { HomestayProfileScreen } from '../screens/HomestayProfileScreen';
import { GuestPageScreen } from '../screens/GuestPageScreen';
import { UpdatesScreen } from '../screens/UpdatesScreen';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  MainTabs: undefined;
  BookingDetail: { bookingId: number };
  CabRequestDetail: { tripId: number };
  GuestDetail: { guestId: number };
  NewBooking: { guestId?: number };
  NewGuest: { guestId?: number };
  FindDriver: undefined;
  MyDrivers: undefined;
  Campaign: { create?: boolean } | undefined;
  Commission: undefined;
  Analytics: undefined;
  HomestayProfile: undefined;
  GuestPage: undefined;
  Updates: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Rooms: undefined;
  Guests: undefined;
  Cabs: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);
  const tabHeight = 54 + bottomPad;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.brandPrimary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: Colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingBottom: bottomPad,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Rooms') {
            iconName = focused ? 'bed' : 'bed-outline';
          } else if (route.name === 'Guests') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Cabs') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'More') {
            iconName = focused ? 'grid' : 'grid-outline';
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Rooms" component={RoomsScreen} />
      <Tab.Screen name="Guests" component={GuestsScreen} />
      <Tab.Screen name="Cabs" component={CabsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="MainTabs" component={MainTabs} />

      {/* Detail / Action Screens */}
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <Stack.Screen name="CabRequestDetail" component={CabRequestDetailScreen} />
      <Stack.Screen name="GuestDetail" component={GuestDetailScreen} />
      <Stack.Screen name="NewBooking" component={NewBookingScreen} />
      <Stack.Screen name="NewGuest" component={NewGuestScreen} />
      <Stack.Screen name="FindDriver" component={FindDriverScreen} />
      <Stack.Screen name="MyDrivers" component={MyDriversScreen} />
      <Stack.Screen name="Campaign" component={CampaignScreen} />
      <Stack.Screen name="Commission" component={CommissionScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="HomestayProfile" component={HomestayProfileScreen} />
      <Stack.Screen name="GuestPage" component={GuestPageScreen} />
      <Stack.Screen name="Updates" component={UpdatesScreen} />
    </Stack.Navigator>
  );
};
