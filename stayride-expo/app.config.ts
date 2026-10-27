import { ExpoConfig, ConfigContext } from 'expo/config';

// Extends app.json (still the main config). Adds the map plugin with the Android Google Maps key from
// the environment, and tells the app whether a key is set: without one, Android release builds would
// crash on a map, so the location picker falls back to GPS + address only.
// iOS uses Apple Maps and needs no key. Expo Go has its own key.
//   GOOGLE_MAPS_ANDROID_API_KEY=...  (Google Cloud → Maps SDK for Android, restricted to Android package)
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || '';
  return {
    ...(config as ExpoConfig),
    plugins: [...(config.plugins || []), ['react-native-maps', androidKey ? { androidGoogleMapsApiKey: androidKey } : {}]],
    extra: { ...(config.extra || {}), androidMapsKeySet: Boolean(androidKey) },
  };
};
