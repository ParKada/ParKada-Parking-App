import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator } from 'react-native';
import '../global.css';

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
