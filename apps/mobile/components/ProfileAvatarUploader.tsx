import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Trash2, User, X } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { notifyProfileUpdated } from "../lib/notify";

/**
 * Profile photo: upload, replace and remove.
 *
 * Storage: the `avatars` bucket, one folder per user (`<uid>/avatar-<ts>.jpg`).
 * That folder layout is what the RLS policy in parkada_updates.sql keys off, so
 * a user can only write inside their own folder.
 *
 * Requires expo-image-picker:
 *     npx expo install expo-image-picker
 * (Your ID/selfie upload screen almost certainly already uses it.)
 */

const BUCKET = "avatars";

/** Column names to try when saving the URL back onto the profile row. */
// avatar_url is added to profiles by parkada_updates.sql (section 1a).
// If you already have a different column name, add it here.
const AVATAR_COLUMNS = [
  "avatar_url",
] as const;

/** Pure-JS base64 -> bytes, so no extra npm dependency is needed. */
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const cleaned = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const byteLength = Math.floor((cleaned.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = chars.indexOf(cleaned[i]);
    const b = chars.indexOf(cleaned[i + 1]);
    const c = chars.indexOf(cleaned[i + 2]);
    const d = chars.indexOf(cleaned[i + 3]);

    const chunk = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);

    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < byteLength && c >= 0) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < byteLength && d >= 0) bytes[byteIndex++] = chunk & 0xff;
  }
  return bytes;
}

/** Write the avatar URL back to whichever column this project uses. */
async function saveAvatarUrl(userId: string, url: string | null): Promise<void> {
  let lastError: any = null;
  for (const column of AVATAR_COLUMNS) {
    const { error } = await supabase
      .from("profiles")
      .update({ [column]: url })
      .eq("id", userId);
    if (!error) return;
    // 42703 = undefined_column — try the next candidate.
    if (error.code !== "42703" && !/column .* does not exist/i.test(error.message)) {
      throw error;
    }
    lastError = error;
  }
  throw new Error(
    "No avatar column found on `profiles`. Add one (see parkada_updates.sql) or edit AVATAR_COLUMNS. " +
      (lastError?.message ?? ""),
  );
}

export default function ProfileAvatarUploader({
  size = 96,
  fallbackInitial,
  onChange,
}: {
  size?: number;
  /** Letter shown when there is no photo. Defaults to the profile's first letter. */
  fallbackInitial?: string;
  /** Fired after a successful upload or removal. */
  onChange?: (url: string | null) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState(fallbackInitial ?? "");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url, preferred_name, first_name, last_name, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const url = AVATAR_COLUMNS.map((column) => profile?.[column]).find(
      (value) => typeof value === "string" && value.trim(),
    );
    setAvatarUrl(url ? String(url).trim() : null);

    if (!fallbackInitial) {
      const name =
        profile?.preferred_name ||
        profile?.first_name ||
        profile?.full_name ||
        user.email ||
        "";
      setInitial(String(name).trim().charAt(0).toUpperCase() || "D");
    }
  }, [fallbackInitial]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!userId) {
      Alert.alert("Not signed in", "Sign in again to update your photo.");
      return;
    }
    if (!asset.base64) {
      Alert.alert("Could not read image", "Please pick a different photo.");
      return;
    }

    try {
      setBusy(true);

      const bytes = base64ToUint8Array(asset.base64);
      const extension = asset.uri.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpg";
      const contentType = extension === "png" ? "image/png" : "image/jpeg";
      const path = `${userId}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      // Cache-bust so the new photo shows immediately.
      const url = `${publicData.publicUrl}?v=${Date.now()}`;

      await saveAvatarUrl(userId, url);

      setAvatarUrl(url);
      onChange?.(url);
      notifyProfileUpdated({ what: "Your profile photo" });
    } catch (error: any) {
      console.error("[ProfileAvatarUploader] upload failed:", error);
      Alert.alert(
        "Upload failed",
        error?.message?.includes("Bucket not found")
          ? `The "${BUCKET}" storage bucket does not exist yet. Run parkada_updates.sql in Supabase.`
          : (error?.message ?? "Please try again."),
      );
    } finally {
      setBusy(false);
      setSheetOpen(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access in your device settings to choose a picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) upload(result.assets[0]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in your device settings to take a photo.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) upload(result.assets[0]);
  };

  const removePhoto = () => {
    Alert.alert("Remove your photo?", "Your profile will show your initial instead.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!userId) return;
          try {
            setBusy(true);
            // Clear the reference first so the UI is correct even if the
            // storage delete is refused by a policy.
            await saveAvatarUrl(userId, null);

            const { data: files } = await supabase.storage.from(BUCKET).list(userId);
            if (files?.length) {
              await supabase.storage
                .from(BUCKET)
                .remove(files.map((file) => `${userId}/${file.name}`));
            }

            setAvatarUrl(null);
            onChange?.(null);
            notifyProfileUpdated({ what: "Your profile photo" });
          } catch (error: any) {
            console.error("[ProfileAvatarUploader] remove failed:", error);
            Alert.alert("Could not remove photo", error?.message ?? "Please try again.");
          } finally {
            setBusy(false);
            setSheetOpen(false);
          }
        },
      },
    ]);
  };

  return (
    <View className="items-center">
      <TouchableOpacity
        onPress={() => setSheetOpen(true)}
        activeOpacity={0.85}
        disabled={busy}
        style={{ width: size, height: size }}
        className="rounded-full bg-slate-200 items-center justify-center overflow-hidden relative"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} />
        ) : (
          <Text style={{ fontSize: size / 2.6 }} className="font-black text-slate-500">
            {initial || <User size={size / 2.4} color="#94a3b8" />}
          </Text>
        )}

        {busy && (
          <View className="absolute inset-0 bg-black/40 items-center justify-center">
            <ActivityIndicator color="#ffffff" />
          </View>
        )}

        {/* Camera affordance */}
        <View
          className="absolute bottom-0 right-0 rounded-full bg-[#0A1D37] items-center justify-center"
          style={{
            width: size / 3.2,
            height: size / 3.2,
            borderWidth: 2.5,
            borderColor: "#ffffff",
          }}
        >
          <Camera size={size / 6.5} color="#ffffff" />
        </View>
      </TouchableOpacity>


      {/* Action sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSheetOpen(false)}
          className="flex-1 bg-black/45 justify-end"
        >
          <TouchableOpacity activeOpacity={1} className="bg-white rounded-t-[28px] pb-8">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
              <View className="w-9" />
              <Text className="font-black text-base text-[#0A1D37]">Profile photo</Text>
              <TouchableOpacity
                onPress={() => setSheetOpen(false)}
                className="w-9 h-9 items-center justify-center -mr-2"
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={takePhoto}
              className="flex-row items-center gap-4 px-6 py-4 border-b border-slate-50"
            >
              <View className="w-11 h-11 rounded-2xl bg-blue-50 items-center justify-center">
                <Camera size={20} color="#2563eb" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Take a photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickFromLibrary}
              className="flex-row items-center gap-4 px-6 py-4 border-b border-slate-50"
            >
              <View className="w-11 h-11 rounded-2xl bg-amber-50 items-center justify-center">
                <ImagePlus size={20} color="#d97706" />
              </View>
              <Text className="text-[15px] font-bold text-slate-800">Choose from library</Text>
            </TouchableOpacity>

            {avatarUrl && (
              <TouchableOpacity
                onPress={removePhoto}
                className="flex-row items-center gap-4 px-6 py-4"
              >
                <View className="w-11 h-11 rounded-2xl bg-rose-50 items-center justify-center">
                  <Trash2 size={20} color="#e11d48" />
                </View>
                <Text className="text-[15px] font-bold text-rose-600">Remove current photo</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}