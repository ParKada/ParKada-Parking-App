import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View, Text, Image, ActivityIndicator, Platform, LogBox, StyleSheet } from 'react-native';
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
  const { session, isSessionReady, profileStatus, isAdmin, authMessage } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // True only when the app is cold-booting and initial session/profile is not determined.
  const isColdBooting = !isSessionReady;

  // True when user has logged in and we are actively checking their profile status.
  const isResolvingProfile = !!session && profileStatus === 'loading';

  // --- Navigation: the ONLY place in the app that calls router.replace() ---
  useEffect(() => {
    if (!isSessionReady || isResolvingProfile) return;

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
      router.replace('/(app)');
    }
  }, [isSessionReady, isResolvingProfile, session, profileStatus, isAdmin, segments]);

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

  if (isColdBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {isResolvingProfile && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#ffffff',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999,
              paddingHorizontal: 32,
            },
          ]}
        >
          {/* ParKada Logo Container */}
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

          {/* Title (e.g. "Signing In Back to ParKada") */}
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

          {/* Subtitle */}
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

          {/* Activity Indicator */}
          <ActivityIndicator size="large" color="#0A1D37" />

          {/* Footer Security Badge */}
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
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}