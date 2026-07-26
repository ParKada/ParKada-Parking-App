import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import '../global.css';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  let token: string | undefined;
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
        if (projectId) {
            token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        } else {
            token = (await Notifications.getExpoPushTokenAsync()).data;
        }
    } catch (e) {
        console.log("Error getting push token", e);
    }
  }

  return token;
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const segment = segments?.[0];
    const inAuthGroup = segment === '(auth)';
    const inAppGroup = segment === '(app)';
    const isRegistering = segments?.includes('register');

    const checkAndRedirect = async () => {
      // Double check true session to avoid React state race conditions
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
         // User is logged in, grab token and save to DB
         registerForPushNotificationsAsync().then(token => {
            if (token) {
                // @ts-ignore: we added this field via SQL, but types might not be perfectly synced yet
                supabase.from('profiles').update({ expo_push_token: token }).eq('id', currentSession.user.id).then();
            }
         });
      }

      if (!currentSession && inAppGroup) {
        router.replace('/(auth)');
      } else if (currentSession && inAuthGroup && !isRegistering) {
        router.replace('/(app)'); // Explicitly route to (app) group
      }
    };

    checkAndRedirect();
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
