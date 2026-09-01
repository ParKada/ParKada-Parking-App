import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import '../global.css';

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
    console.log('Error initializing notifications handler:', e);
  }
}

async function registerForPushNotificationsAsync() {
  if (isExpoGo) {
    return undefined;
  }

  const Notifications = require('expo-notifications');
  let token: string | undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const existingStatus = await Notifications.getPermissionsAsync();
    let isGranted = existingStatus.granted || existingStatus.status === 'granted';

    if (!isGranted && existingStatus.canAskAgain) {
      const newStatus = await Notifications.requestPermissionsAsync();
      isGranted = newStatus.granted || newStatus.status === 'granted';
    }

    if (!isGranted) return undefined;

    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    } catch (e) {
      console.log('Error getting push token', e);
    }
  }

  return token;
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
            .eq('id', session.user.id);
        }
      });
    }

    // Retained the working setTimeout delay to prevent frame mounts crashes
    const timer = setTimeout(() => {
      if (!session && !inAuthGroup) {
        router.replace('/(auth)');
      } else if (session && inAuthGroup && !isRegistering) {
        router.replace('/(app)');
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