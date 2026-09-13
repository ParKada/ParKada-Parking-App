import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View, Text, Image, ActivityIndicator, Platform, LogBox, StyleSheet } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../lib/AuthProvider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';

LogBox.ignoreLogs([
  'Default FirebaseApp is not initialized',
  'Error getting push token',
  'Push Notification Skipped',
  'Make sure to complete the guide at https://docs.expo.dev/push-notifications/fcm-credentials/',
]);

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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
  } catch (e) {}
}

async function registerForPushNotificationsAsync() {
  if (isExpoGo) return undefined;

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
      } catch (e) {}
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
    return undefined;
  }
}

function RootNavigation() {
  const { session, isSessionReady, profileStatus, isAdmin, authMessage } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isColdBooting = !isSessionReady;
  const isResolvingProfile = !!session && profileStatus === 'loading';

  useEffect(() => {
    if (!isSessionReady || isResolvingProfile) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onCompleteProfile = segments.join('/').includes('complete-profile');
    const isRegistering = segments.includes('register');

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)');
      return;
    }

    if (!isAdmin && (profileStatus === 'no-profile' || profileStatus === 'incomplete')) {
      if (!onCompleteProfile) router.replace('/(auth)/complete-profile');
      return;
    }

    if ((inAuthGroup || !segments[0]) && !isRegistering) {
      router.replace('/(app)');
    }
  }, [isSessionReady, isResolvingProfile, session, profileStatus, isAdmin, segments]);

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

  // 1. I-render lamang ito kapag cold boot
  if (isColdBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0A1D37" />
      </View>
    );
  }

  // 2. I-render ITO ng mag-isa para HARANGAN ang <Slot /> habang nag-aauthenticate
  if (isResolvingProfile) {
    return (
      <View
        style={{
          flex: 1, // Gamit ang flex: 1 sa halip na absoluteFillObject
          backgroundColor: '#ffffff',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 26,
            backgroundColor: '#0A1D37',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            shadowColor: '#0A1D37',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 10,
          }}
        >
          <Image
            source={require('../assets/ParKadav2.png')}
            style={{ width: 54, height: 54 }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: '900',
            color: '#0A1D37',
            textAlign: 'center',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {authMessage?.title || 'Signing In Back to ParKada'}
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: '#64748B',
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 32,
            paddingHorizontal: 12,
          }}
        >
          {authMessage?.subtitle || 'Verifying your account details...'}
        </Text>

        <ActivityIndicator size="large" color="#0A1D37" />

        <View
          style={{
            position: 'absolute',
            bottom: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: '#94A3B8',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            ParKada Authentication
          </Text>
        </View>
      </View>
    );
  }

  // 3. Saka lamang lalabas ang buong app (kasama ang Tabs at Home) kapag tapos na ang lahat
  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}