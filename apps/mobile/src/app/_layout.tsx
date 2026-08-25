import { RegistryProvider } from '@effect/atom-react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { authClient } from '@/api/auth';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthScreen } from '@/components/auth-screen';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const session = authClient.useSession();
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

  useEffect(() => {
    if (!session.isPending) {
      setHasLoadedSession(true);
    }
  }, [session.isPending]);

  return (
    <RegistryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          {!hasLoadedSession && session.isPending ? null : session.data ? (
            <AppTabs />
          ) : (
            <AuthScreen onAuthenticated={session.refetch} />
          )}
        </ThemeProvider>
      </GestureHandlerRootView>
    </RegistryProvider>
  );
}
