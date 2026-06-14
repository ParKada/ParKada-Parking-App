import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <Text className="text-slate-500 font-bold">No new notifications</Text>
    </SafeAreaView>
  );
}
