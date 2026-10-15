import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from './src/services/tokenCache';
import { StayRideProvider, useStayRide } from './src/data/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { checkAndAutoApplyUpdates } from './src/services/updates/updateManager';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const navigationRef = createNavigationContainerRef<any>();

// Send the user to Login whenever the session goes away (logout or expired refresh token)
const SessionWatcher: React.FC = () => {
  const { session } = useStayRide();
  const prev = useRef(session);
  useEffect(() => {
    if (prev.current && !session && navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    prev.current = session;
  }, [session]);
  return null;
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
