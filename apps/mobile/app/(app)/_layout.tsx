import { Tabs } from 'expo-router';
import { Home, Map, BookOpen, Bell, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
  const insets = useSafeAreaInsets();

  // Siguraduhing may minimum bottom padding para sa mga lumang Android button bar
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: '#0A1D37',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'System',
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Find',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      
      {/* Hide these screens from the tabs */}
      <Tabs.Screen name="lot/[id]" options={{ href: null }} />
      <Tabs.Screen name="payment/index" options={{ href: null }} />
      <Tabs.Screen name="payment/extension" options={{ href: null }} />
      <Tabs.Screen name="receipt/[id]" options={{ href: null }} />
      <Tabs.Screen name="reserve/[id]" options={{ href: null }} />
      <Tabs.Screen name="vehicles" options={{ href: null }} />
    </Tabs>
  );
}