import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <Text className="text-slate-500 font-bold">No new notifications</Text>
    </SafeAreaView>
  );
}
