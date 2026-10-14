import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { tokenCache } from './src/services/tokenCache';
import { StayRideProvider } from './src/data/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { checkAndAutoApplyUpdates } from './src/services/updates/updateManager';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

export default function App() {
  useEffect(() => {
    // Non-blocking OTA check on app startup (fire-and-forget)
    checkAndAutoApplyUpdates().catch(() => {});
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <StayRideProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </StayRideProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
