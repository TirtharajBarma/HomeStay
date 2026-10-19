import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from './src/services/tokenCache';
import { StayRideProvider, useStayRide } from './src/data/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { checkAndAutoApplyUpdates } from './src/services/updates/updateManager';
import { onPushTap } from './src/services/push';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const navigationRef = createNavigationContainerRef<any>();

// Send the user to Login whenever the session goes away (logout or expired refresh token).
// While the server reports ACCOUNT_BLOCKED, cover the app with a suspended screen.
const SessionWatcher: React.FC = () => {
  const { session, accountBlock, logout, sync, syncing } = useStayRide();
  const prev = useRef(session);
  const sessionRef = useRef(session);
  const syncRef = useRef(sync);
  useEffect(() => {
    sessionRef.current = session;
    syncRef.current = sync;
  });

  // Notification tap: refresh, then open the trip when the payload names one
  useEffect(
    () =>
      onPushTap((data) => {
        const s = sessionRef.current;
        if (!s) return;
        syncRef.current().catch(() => {});
        if (!navigationRef.isReady()) return;
        if (s.role === 'driver') {
          navigationRef.navigate('Main', { screen: 'DriverTrips' });
        } else if (typeof data.tripId === 'number') {
          navigationRef.navigate('CabRequestDetail', { tripId: data.tripId });
        }
      }),
    []
  );

  useEffect(() => {
    if (prev.current && !session && navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    prev.current = session;
  }, [session]);
  if (!session || !accountBlock) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0F172A' }]}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }}>
        Account suspended by StayRide
      </Text>
      <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 }}>
        {accountBlock}
      </Text>
      <TouchableOpacity
        onPress={() => sync().catch(() => {})}
        disabled={syncing}
        style={{ marginTop: 24, backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{syncing ? 'Checking…' : 'Try again'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => logout().catch(() => {})}
        style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 12 }}
      >
        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function App() {
  useEffect(() => {
    // Non-blocking OTA check on app startup (fire-and-forget)
    checkAndAutoApplyUpdates().catch(() => {});
  }, []);

  if (!publishableKey) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
          App configuration missing
        </Text>
        <Text style={{ fontSize: 14, color: '#555555', textAlign: 'center' }}>
          This build is missing its sign-in configuration (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY). Please install an
          updated version of StayRide.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <StayRideProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="light" />
            <RootNavigator />
            <SessionWatcher />
          </NavigationContainer>
        </StayRideProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
