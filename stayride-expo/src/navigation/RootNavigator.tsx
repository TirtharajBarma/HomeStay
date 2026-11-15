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
import { HowItWorksScreen } from '../screens/HowItWorksScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { AccountScreen } from '../screens/AccountScreen';

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
  NewBooking: { guestId?: number; roomId?: number; checkIn?: number } | undefined;
  NewGuest: { guestId?: number };
  FindDriver: undefined;
  MyDrivers: undefined;
  Campaign: { create?: boolean } | undefined;
  Commission: undefined;
  Analytics: undefined;
  HomestayProfile: undefined;
  Updates: undefined;
  HowItWorks: undefined;
  Legal: { doc: 'privacy' | 'terms' | 'refunds' };
  Account: undefined;
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
  const bottomPad = insets.bottom > 0
    ? insets.bottom + (Platform.OS === 'ios' ? 2 : 4)
    : (Platform.OS === 'android' ? 12 : 8);
  const tabHeight = 52 + bottomPad;

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
          elevation: 4,
          shadowColor: '#1C1B18',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => {
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
  const bottomPad = insets.bottom > 0
    ? insets.bottom + (Platform.OS === 'ios' ? 2 : 4)
    : (Platform.OS === 'android' ? 12 : 8);
  const tabHeight = 52 + bottomPad;

  return (
    <DriverTab.Navigator
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
          elevation: 4,
          shadowColor: '#1C1B18',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
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
  const { session, logout, sync, syncing } = useStayRide();
  if (session?.role === 'driver') {
    if (session.driver?.status === 'PENDING_APPROVAL') {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0F2B1D' }}>
          <Ionicons name="time-outline" size={42} color="#D4E3D9" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#FAF8F5', textAlign: 'center', marginTop: 14 }}>
            Awaiting StayCabs Approval
          </Text>
          <Text style={{ fontSize: 14, color: '#C5D6CC', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 }}>
            StayCabs is reviewing your driver credentials. Assigned trips and ride requests will appear here once approved.
          </Text>
          <TouchableOpacity
            onPress={() => sync().catch(() => {})}
            disabled={syncing}
            style={{ marginTop: 24, backgroundColor: Colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2E5D42' }}
          >
            <Text style={{ color: '#FAF8F5', fontWeight: '600', fontSize: 14 }}>{syncing ? 'Checking…' : 'Check status'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: '#E8A393', fontWeight: '600', fontSize: 14 }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <DriverTabs />;
  }
  if (session?.role === 'admin') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0F2B1D' }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="shield-outline" size={30} color="#FAF8F5" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#FAF8F5', textAlign: 'center' }}>
          Administrator Control Tower
        </Text>
        <Text style={{ fontSize: 14, color: '#C5D6CC', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 }}>
          Super Admin controls are available via the Web Control Tower. This mobile companion is tailored for Homestay Hosts and Cab Drivers.
        </Text>
        <TouchableOpacity
          onPress={logout}
          style={{ marginTop: 24, backgroundColor: Colors.brandAccent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Sign out</Text>
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
      {/* Shared by owners, drivers and (Legal) the login screen */}
      <Stack.Screen name="HowItWorks" component={HowItWorksScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
    </Stack.Navigator>
  );
};
