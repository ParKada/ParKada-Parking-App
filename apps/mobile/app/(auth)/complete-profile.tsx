import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthProvider";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { refreshProfileStatus } = useAuth();

  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (text: string) => {
    // Keep digits only, and hard-cap at 11 characters as you type.
    setPhone(text.replace(/\D/g, "").slice(0, 11));
  };

  const handleSubmit = async () => {
    if (!preferredName.trim()) {
      Alert.alert("Required Field", "Please tell us what to call you.");
      return;
    }

    if (phone.length !== 11) {
      Alert.alert("Invalid Number", "Phone number must be exactly 11 digits (e.g. 09XXXXXXXXX).");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("No active session. Please log in again.");
      }

      // Block if this number is already used by a DIFFERENT account.
      const { data: existingPhone, error: phoneCheckError } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phone)
        .neq("id", user.id)
        .maybeSingle();

      if (phoneCheckError) throw phoneCheckError;

      if (existingPhone) {
        Alert.alert(
          "Phone Number Already Used",
          "This phone number is already registered to another account. Please use a different number."
        );
        return;
      }

      // Upsert covers both cases: a brand-new user (no row yet) and an
      // existing user with an incomplete profile — same call either way.
      const rawName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const nameParts = rawName.split(" ").filter(Boolean);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        preferred_name: preferredName.trim(),
        phone_number: phone,
        user_type: "driver",
        discount_type: "regular",
        verification_status: "unverified",
        profile_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Update the shared auth state, then the root layout's effect
      // will route to home on its own. We also nudge it directly for
      // an instant transition — safe here since this is a single
      // deliberate user action, not a race with another listener.
      await refreshProfileStatus();
      router.replace("/");
    } catch (error: any) {
      Alert.alert(
        "Setup Error",
        error?.message || "Failed to save your details. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View className="flex-1 px-6 pt-24 pb-8">
          <Text className="text-3xl font-extrabold text-[#0A1D37] mb-2">
            Complete Your Profile
          </Text>
          <Text className="text-sm text-slate-500 mb-10 leading-relaxed">
            Just a couple more details before you get started with ParKada.
          </Text>

          <View className="flex-col gap-2 mb-6">
            <Text className="text-sm font-semibold text-slate-700">
              What name do you prefer us to call you?
            </Text>
            <TextInput
              value={preferredName}
              onChangeText={setPreferredName}
              placeholder="e.g. Jeric"
              editable={!loading}
              className="h-14 px-4 rounded-xl bg-slate-100 text-slate-800"
            />
          </View>

          <View className="flex-col gap-2 mb-10">
            <Text className="text-sm font-semibold text-slate-700">Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="09XXXXXXXXX"
              keyboardType="number-pad"
              maxLength={11}
              editable={!loading}
              className="h-14 px-4 rounded-xl bg-slate-100 text-slate-800"
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="w-full h-14 bg-[#0A1D37] rounded-xl flex-row justify-center items-center"
          >
            {loading ? <ActivityIndicator color="white" className="mr-2" /> : null}
            <Text className="text-white text-base font-bold">
              {loading ? "Saving..." : "Continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}