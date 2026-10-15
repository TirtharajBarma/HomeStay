import React from 'react';
import { Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
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
import { UpdatesScreen } from '../screens/UpdatesScreen';

// Driver Screens
import { DriverTripsScreen } from '../screens/DriverTripsScreen';
import { DriverActiveRideScreen } from '../screens/DriverActiveRideScreen';
import { DriverEarningsScreen } from '../screens/DriverEarningsScreen';
import { DriverProfileScreen } from '../screens/DriverProfileScreen';
import { useStayRide } from '../data/store';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  MainTabs: undefined;
  DriverTabs: undefined;
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
  Updates: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Rooms: undefined;
  Guests: undefined;
  Cabs: undefined;
  More: undefined;
};

export type DriverTabParamList = {
  DriverTrips: undefined;
  DriverActive: undefined;
  DriverEarnings: undefined;
  DriverProfile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const DriverTab = createBottomTabNavigator<DriverTabParamList>();
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

const DriverTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);
  const tabHeight = 54 + bottomPad;

  return (
    <DriverTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
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
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'car';

          if (route.name === 'DriverTrips') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'DriverActive') {
            iconName = focused ? 'navigate' : 'navigate-outline';
          } else if (route.name === 'DriverEarnings') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'DriverProfile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <DriverTab.Screen
        name="DriverTrips"
        component={DriverTripsScreen}
        options={{ tabBarLabel: 'My Rides' }}
      />
      <DriverTab.Screen
        name="DriverActive"
        component={DriverActiveRideScreen}
        options={{ tabBarLabel: 'Active Ride' }}
      />
      <DriverTab.Screen
        name="DriverEarnings"
        component={DriverEarningsScreen}
        options={{ tabBarLabel: 'Earnings' }}
      />
      <DriverTab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </DriverTab.Navigator>
  );
};

const UnifiedAppTabs: React.FC = () => {
  const { session, logout } = useStayRide();
  if (session?.role === 'driver') {
    return <DriverTabs />;
  }
  if (session?.role === 'admin') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0F172A' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="shield-outline" size={32} color="#FFFFFF" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }}>Administrator Access</Text>
        <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 }}>
          Super Admin controls are strictly accessible via the Web Control Tower at platform admin portal. This mobile app is reserved for Homestay Hosts and Cab Drivers.
        </Text>
        <TouchableOpacity
          onPress={logout}
          style={{ marginTop: 24, backgroundColor: '#EF4444', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <MainTabs />;
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
      <Stack.Screen name="Main" component={UnifiedAppTabs} />
      <Stack.Screen name="MainTabs" component={UnifiedAppTabs} />
      <Stack.Screen name="DriverTabs" component={DriverTabs} />

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
      <Stack.Screen name="Updates" component={UpdatesScreen} />
    </Stack.Navigator>
  );
};
