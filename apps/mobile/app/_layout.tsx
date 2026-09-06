import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, Platform, LogBox } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../lib/AuthProvider';
import '../global.css';

// I-suppress ang mga paulit-ulit na Firebase/FCM errors sa terminal habang nagde-develop
LogBox.ignoreLogs([
  'Default FirebaseApp is not initialized',
  'Error getting push token',
  'Push Notification Skipped',
  'Make sure to complete the guide at https://docs.expo.dev/push-notifications/fcm-credentials/',
]);

// Check if running inside Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Configure Notification handler safely using dynamic require (Only outside Expo Go)
if (!isExpoGo) {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    // Suppress initialization error silent catch
  }
}

async function registerForPushNotificationsAsync() {
  if (isExpoGo) {
    return undefined;
  }

  try {
    const Notifications = require('expo-notifications');
    let token: string | undefined;

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch (e) {
        // Safe channel fallback
      }
    }

    if (Device.isDevice) {
      const existingStatus = await Notifications.getPermissionsAsync();
      let isGranted = existingStatus.granted || existingStatus.status === 'granted';

      if (!isGranted && existingStatus.canAskAgain) {
        const newStatus = await Notifications.requestPermissionsAsync();
        isGranted = newStatus.granted || newStatus.status === 'granted';
      }

      if (!isGranted) return undefined;

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    }

    return token;
  } catch (e: any) {
    // Catch-all block para sa anumang push token exception
    return undefined;
  }
}

function RootNavigation() {
  const { session, isSessionReady, profileStatus, isAdmin } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // True while we still don't actually know where the user should land.
  // Nothing below should navigate or render real screens while this is true.
  const stillResolving = !isSessionReady || (!!session && profileStatus === 'loading');

  // --- Navigation: the ONLY place in the app that calls router.replace() ---
  useEffect(() => {
    if (stillResolving) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onCompleteProfile = segments.join('/').includes('complete-profile');
    const isRegistering = segments.includes('register');

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)');
      return;
    }

    // Logged in from here on. Admins never get past this point in this
    // app — AuthProvider signs them out automatically, so `session` will
    // become null again shortly and this effect will re-run above.
    if (!isAdmin && (profileStatus === 'no-profile' || profileStatus === 'incomplete')) {
      if (!onCompleteProfile) router.replace('/(auth)/complete-profile');
      return;
    }

    if ((inAuthGroup || !segments[0]) && !isRegistering) {
      router.replace('/');
    }
  }, [stillResolving, session, profileStatus, isAdmin, segments]);

  // --- Push token registration: separate concern, unrelated to navigation ---
  useEffect(() => {
    if (isExpoGo || !session?.user?.id || profileStatus !== 'complete') return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        supabase
          .from('profiles')
          .update({ expo_push_token: token })
          .eq('id', session.user.id)
          .then(({ error }) => {
            if (error) console.error('Error updating push token:', error);
          });
      }
    });
  }, [session?.user?.id, profileStatus]);

  if (stillResolving) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}