import { useState, useEffect } from "react";
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
  BackHandler,
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

  useEffect(() => {
    // Pre-populate preferred name from Google metadata if available
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const metadata = user.user_metadata;
        const suggestedName =
          metadata?.given_name ||
          metadata?.full_name?.split(" ")[0] ||
          metadata?.name?.split(" ")[0] ||
          "";
        if (suggestedName) {
          setPreferredName((prev) => (prev ? prev : suggestedName));
        }
      }
    });

    // Prevent going back to login / get started while profile is incomplete
    const onBackPress = () => true;
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  const handlePhoneChange = (text: string) => {
    // Keep digits only, and hard-cap at 11 characters as you type.
    setPhone(text.replace(/\D/g, "").slice(0, 11));
  };

  const handleSubmit = async () => {
    const cleanName = preferredName.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      Alert.alert("Required Field", "Please enter your preferred name.");
      return;
    }

    if (cleanName.length < 2) {
      Alert.alert("Invalid Name", "Please enter a valid preferred name (at least 2 characters).");
      return;
    }

    if (!cleanPhone) {
      Alert.alert("Required Field", "Please enter your mobile phone number.");
      return;
    }

    if (!cleanPhone.startsWith("09")) {
      Alert.alert(
        "Invalid Phone Number",
        "Phone number must start with '09' (e.g., 09XXXXXXXXX). Please check your input."
      );
      return;
    }

    if (cleanPhone.length !== 11 || !/^09\d{9}$/.test(cleanPhone)) {
      Alert.alert(
        "Invalid Phone Number",
        "Phone number must be exactly 11 digits (e.g., 09XXXXXXXXX). Please check your input."
      );
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Session Expired", "Your session has expired. Please sign in again.");
        await supabase.auth.signOut();
        return;
      }

      // Block if this number is already used by a DIFFERENT account.
      const { data: existingPhone, error: phoneCheckError } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", cleanPhone)
        .neq("id", user.id)
        .maybeSingle();

      if (phoneCheckError) {
        console.error("Phone verification query error:", phoneCheckError.message);
      }

      if (existingPhone) {
        Alert.alert(
          "Duplicate Phone Number",
          "This phone number is already registered to another account. Please input another number."
        );
        return;
      }

      // Upsert covers both cases: a brand-new user (no row yet) and an
      // existing user with an incomplete profile — same call either way.
      const rawName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const nameParts = rawName.split(" ").filter(Boolean);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        preferred_name: cleanName,
        phone_number: cleanPhone,
        user_type: "driver",
        discount_type: "regular",
        verification_status: "unverified",
        profile_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        const isDuplicate =
          upsertError.code === "23505" ||
          upsertError.message?.toLowerCase().includes("unique") ||
          upsertError.message?.toLowerCase().includes("duplicate") ||
          upsertError.message?.toLowerCase().includes("profiles_phone_number_key");

        if (isDuplicate) {
          Alert.alert(
            "Duplicate Phone Number",
            "This phone number is already registered to another account. Please input another number."
          );
          return;
        }

        throw upsertError;
      }

      // Update the shared auth state, then the root layout's effect
      // will route to home on its own. We also nudge it directly for
      // an instant transition.
      await refreshProfileStatus();
      router.replace("/(app)");
    } catch (error: any) {
      console.error("Complete profile error:", error);
      const msg = error?.message?.toLowerCase() || "";

      if (
        msg.includes("unique") ||
        msg.includes("duplicate") ||
        msg.includes("profiles_phone_number_key") ||
        error?.code === "23505"
      ) {
        Alert.alert(
          "Duplicate Phone Number",
          "This phone number is already registered to another account. Please input another number."
        );
      } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please check your internet connection and try again."
        );
      } else {
        Alert.alert(
          "Setup Error",
          "Unable to save your details at this time. Please check your information and try again."
        );
      }
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
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-slate-700">Phone Number</Text>
              <Text className="text-xs text-slate-400 font-medium">{phone.length}/11</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="09XXXXXXXXX"
              keyboardType="number-pad"
              maxLength={11}
              editable={!loading}
              className="h-14 px-4 rounded-xl bg-slate-100 text-slate-800"
            />
            <Text className="text-[11px] text-slate-400">
              Must be 11 digits starting with 09 (e.g. 09123456789)
            </Text>
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

          <TouchableOpacity
            onPress={async () => {
              await supabase.auth.signOut();
            }}
            disabled={loading}
            className="w-full py-4 mt-2 items-center justify-center"
          >
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Sign out / Use another account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}