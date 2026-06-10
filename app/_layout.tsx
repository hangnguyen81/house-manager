import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import i18n from '@/i18n';
import { useStore } from '@/data/store';
import { ThemeContext, getColors } from '@/theme';
import { requestNotificationPermission } from '@/utils/notifications';
import { syncAll, USE_REST } from '@/api';

function useHydration() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}

export default function RootLayout() {
  const hydrated = useHydration();
  const themeMode = useStore((s) => s.settings.theme);
  const language = useStore((s) => s.settings.language);
  const activeMemberId = useStore((s) => s.activeMemberId);
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const isLoggedIn = !!(activeMemberId && activeHouseholdId);

  // Sync persisted language to i18next after hydration
  useEffect(() => {
    if (hydrated && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [hydrated, language]);

  // Request notification permission once on startup
  useEffect(() => {
    if (hydrated) requestNotificationPermission();
  }, [hydrated]);

  // Sync data from REST backend on startup
  useEffect(() => {
    if (hydrated && USE_REST) {
      syncAll();
    }
  }, [hydrated]);
  const colors = getColors(themeMode);

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1B6B4A" />
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={{ mode: themeMode, colors }}>
      <SafeAreaProvider>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" redirect={isLoggedIn} />
          <Stack.Screen name="(tabs)" redirect={!isLoggedIn} />
        </Stack>
        {/* Reactive redirect: when activeMemberId is cleared, go back to picker */}
        {hydrated && !isLoggedIn && <Redirect href="/" />}
        {hydrated && isLoggedIn && <Redirect href="/(tabs)" />}
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
