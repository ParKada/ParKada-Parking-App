import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, Platform, LogBox } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
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

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Handle Supabase Auth Session Initialization
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle Protected Routes & Initial App Landing
  useEffect(() => {
    if (!initialized) return;

    const segment = segments?.[0];
    const inAuthGroup = segment === '(auth)';
    const isRegistering = segments?.includes('register');

    if (session?.user?.id && !isExpoGo) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          supabase
            .from('profiles')
            .update({ expo_push_token: token })
            .eq('id', session.user.id)
            .then(({ error }) => {
              if (error) console.error("Error updating push token:", error);
            });
        }
      });
    }

    const timer = setTimeout(() => {
      if (!session && !inAuthGroup) {
        router.replace('/(auth)');
      } else if (session && (inAuthGroup || !segment) && !isRegistering) {
        // BAGONG BAGO: Diretso na sa / (index.tsx) kung saan nakalagay ang DriverHome
        router.replace('/');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return <Slot />;
}