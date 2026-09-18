import { Modal } from '../../components/SafeModal';
import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, TextInput, Image, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { 
  Car, Wallet, Star, Shield, HelpCircle, LogOut, CheckCircle2, 
  BadgePercent, Upload, X, Clock, Smartphone, Eye, EyeOff, QrCode, Lock,
  Accessibility, Heart
} from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from "../../lib/supabase";
import ProfileAvatarUploader from "../../components/ProfileAvatarUploader";

const getInitials = (name?: string) => {
  if (!name) return "JD";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const maskNumber = (num?: string) => {
  if (!num || num.length < 7) return "•••••••••••";
  const start = num.slice(0, 4);
  const end = num.slice(-3);
  return `${start}••••${end}`;
};

type CaptureStep = 'type' | 'front' | 'back' | 'selfie' | 'review';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showFullPhone, setShowFullPhone] = useState(false);
  
  const [stats, setStats] = useState({
    totalReservations: 0,
    completedReservations: 0,
    totalVehicles: 0
  });

  // Modal States
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [accountDetailsModalVisible, setAccountDetailsModalVisible] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);

  // The discount banner can be dismissed, but the option stays reachable from
  // "Account Details & Security" so a driver who changes their mind can apply later.
  const [discountBannerDismissed, setDiscountBannerDismissed] = useState(false);

  // Editable copies of the fields shown inside the Account Details modal.
  const [displayName, setDisplayName] = useState(userProfile?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phone_number || '');
  const [savingDetails, setSavingDetails] = useState(false);

  // Form States - Discount Application
  const [discountType, setDiscountType] = useState<'pwd' | 'senior'>('pwd');
  const [idNumber, setIdNumber] = useState('');
  const [idFrontImage, setIdFrontImage] = useState<string | null>(null);
  const [idBackImage, setIdBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [captureStep, setCaptureStep] = useState<CaptureStep>('front');
  const [submittingDiscount, setSubmittingDiscount] = useState(false);

  // Form States - Linked e-Wallets
  const [selectedWallet, setSelectedWallet] = useState<'gcash' | 'maya'>('gcash');
  const [walletNumber, setWalletNumber] = useState('');
  const [showFullWallet, setShowFullWallet] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);

  const MAX_VEHICLES = 3;
  const CAPTURE_STEPS: CaptureStep[] = ['type', 'front', 'back', 'selfie', 'review'];

  // AUTO-REFRESH DATA
  useFocusEffect(
    useCallback(() => {
      fetchRealData();
    }, [])
  );

  const fetchRealData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile({
        ...user,
        full_name: profileData?.full_name || user.user_metadata?.full_name || "Juan dela Cruz",
        email: user.email || "juan@example.com",
        phone_number: profileData?.phone_number || "09123456789",
        discount_type: profileData?.discount_type || "none",
        discount_status: profileData?.discount_status || "none",
        discount_id_number: profileData?.discount_id_number || "",
        gcash_number: profileData?.gcash_number || "",
        maya_number: profileData?.maya_number || "",
        user_type: profileData?.role || "user"
      });

      // Fetch Stats
      const [resCount, completeCount, vehData] = await Promise.all([
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("profile_id", user.id),
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("profile_id", user.id).eq("status", "completed"),
        supabase.from("vehicles").select("*", { count: 'exact', head: true }).eq("profile_id", user.id).eq("is_active", true)
      ]);

      setStats({
        totalReservations: resCount.count || 0,
        completedReservations: completeCount.count || 0,
        totalVehicles: vehData.count || 0
      });

    } catch (err) {
      console.error("Connection Error:", err);
      Alert.alert("Error", "Failed to sync profile data");
    } finally {
      setLoading(false);
    }
  };

  // ─── Image Pickers ───────────────────────────────────────────────────────────

  const pickIdImage = async (side: 'front' | 'back') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.8,
    });
    if (!result.canceled) {
      if (side === 'front') setIdFrontImage(result.assets[0].uri);
      else setIdBackImage(result.assets[0].uri);
    }
  };

  const takeSelfie = async () => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (camPerm.status === 'granted') {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.front,
      });
      if (!result.canceled) setSelfieImage(result.assets[0].uri);
    } else {
      // Fallback to library if camera permission denied
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) setSelfieImage(result.assets[0].uri);
    }
  };

  const resetDiscountModal = () => {
    setCaptureStep('type');
    setIdFrontImage(null);
    setIdBackImage(null);
    setSelfieImage(null);
    setIdNumber('');
    setDiscountType('pwd');
  };

  // ─── Submit Discount ─────────────────────────────────────────────────────────

  const handleSubmitDiscount = async () => {
    if (!idNumber.trim()) {
      Alert.alert("Required", "Please enter your ID number.");
      return;
    }
    if (!idFrontImage || !idBackImage || !selfieImage) {
      Alert.alert("Required", "Please complete all photo captures before submitting.");
      return;
    }

    try {
      setSubmittingDiscount(true);
      const user = userProfile;

      const uploadImage = async (uri: string, suffix: string): Promise<string> => {
        const fileName = `${user.id}_${suffix}_${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);
        const { data, error } = await supabase.storage
          .from('discount-ids')
          .upload(fileName, formData);
        if (!error && data) {
          return supabase.storage.from('discount-ids').getPublicUrl(fileName).data.publicUrl;
        }
        return uri; // fallback to local uri on upload error
      };

      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadImage(idFrontImage, 'front'),
        uploadImage(idBackImage, 'back'),
        uploadImage(selfieImage, 'selfie'),
      ]);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          discount_type: discountType,
          discount_status: 'pending',
          discount_id_number: idNumber,
          discount_id_url: frontUrl,
          discount_id_back_url: backUrl,
          discount_selfie_url: selfieUrl,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      Alert.alert("Application Submitted", "Your discount request is under admin review.");
      setDiscountModalVisible(false);
      resetDiscountModal();
      fetchRealData();

    } catch (error: any) {
      Alert.alert("Submission Failed", error.message || "An error occurred.");
    } finally {
      setSubmittingDiscount(false);
    }
  };

  // ─── Save Wallet ─────────────────────────────────────────────────────────────

  const handleSaveWallet = async () => {
    if (!walletNumber.trim() || walletNumber.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid 11-digit mobile number.");
      return;
    }

    try {
      setSavingWallet(true);
      const updatePayload = selectedWallet === 'gcash' 
        ? { gcash_number: walletNumber }
        : { maya_number: walletNumber };

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userProfile.id);

      if (error) throw error;

      Alert.alert("Success", `${selectedWallet.toUpperCase()} account linked successfully!`);
      setWalletModalVisible(false);
      fetchRealData();
    } catch (error: any) {
      Alert.alert("Failed to Link", error.message || "An error occurred.");
    } finally {
      setSavingWallet(false);
    }
  };

  // ─── Logout ──────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    Alert.alert("Logged out", "You have successfully logged out.");
    router.replace("/(auth)/login");
  };

  // ─── Save Display Name & Phone Number ────────────────────────────────────────
  // Email stays read-only because it was verified via OTP during registration.

  const handleSaveDetails = async () => {
    if (!displayName.trim()) {
      Alert.alert("Required", "Please enter a display name.");
      return;
    }
    if (!/^\d{11}$/.test(phoneNumber.trim())) {
      Alert.alert("Invalid Number", "Please enter a valid 11-digit mobile number.");
      return;
    }

    try {
      setSavingDetails(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: displayName.trim(),
          phone_number: phoneNumber.trim(),
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      setUserProfile((prev: any) => ({ ...prev, full_name: displayName.trim(), phone_number: phoneNumber.trim() }));
      Alert.alert("Saved", "Display name and phone number updated.");
      setAccountDetailsModalVisible(false);
      fetchRealData();
    } catch (error: any) {
      Alert.alert("Update Failed", error.message || "Could not save changes.");
    } finally {
      setSavingDetails(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-slate-500">Loading Profile...</Text>
      </SafeAreaView>
    );
  }

  // ─── Theme ───────────────────────────────────────────────────────────────────

  const isApproved = userProfile?.discount_status === 'approved';
  const isPending = userProfile?.discount_status === 'pending';
  const isNone = userProfile?.discount_status === 'none' || userProfile?.discount_status === 'rejected';

  const getUserTheme = () => {
    if (isApproved && userProfile?.discount_type === 'senior') {
      return {
        bg: 'bg-amber-600',
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-400/40',
        badgeText: 'text-amber-300',
        label: 'SENIOR CITIZEN (20% OFF)'
      };
    }
    if (isApproved && userProfile?.discount_type === 'pwd') {
      return {
        bg: 'bg-emerald-700',
        badgeBg: 'bg-emerald-500/20',
        badgeBorder: 'border-emerald-400/40',
        badgeText: 'text-emerald-300',
        label: 'PWD DISCOUNT (20% OFF)'
      };
    }
    if (isPending) {
      return {
        bg: 'bg-[#0A1D37]',
        badgeBg: 'bg-amber-500/20',
        badgeBorder: 'border-amber-500/30',
        badgeText: 'text-amber-400',
        label: 'APPROVAL PENDING'
      };
    }
    return {
      bg: 'bg-[#0A1D37]',
      badgeBg: 'bg-sky-500/20',
      badgeBorder: 'border-sky-400/30',
      badgeText: 'text-sky-300',
      label: 'REGULAR USER'
    };
  };

  const userTheme = getUserTheme();

  const hasLinkedWallet = userProfile?.gcash_number || userProfile?.maya_number;
  const walletLabel = hasLinkedWallet 
    ? `Linked: ${userProfile?.gcash_number ? 'GCash' : ''}${userProfile?.gcash_number && userProfile?.maya_number ? ' & ' : ''}${userProfile?.maya_number ? 'Maya' : ''}`
    : "Connect GCash or Maya for 1-tap payment";

  const currentStepIndex = CAPTURE_STEPS.indexOf(captureStep);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-100 z-10">
        <View className="flex-row items-center gap-2">
          <Image source={require("../../assets/ParKadav2.png")} className="w-10 h-10 rounded-md" resizeMode="contain" />
          <Text className="font-black text-xl">
            <Text className="text-[#0A1D37]">Par</Text>
            <Text className="text-amber-400">Kada</Text>
          </Text>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        
        {/* PROFILE HEADER CARD */}
        <View className={`${userTheme.bg} rounded-3xl p-6 shadow-xl mb-4 relative overflow-hidden`}>
          
          <View className="flex-row gap-4 mb-5 items-center">
            <View className="w-20 h-20 shrink-0">
              <ProfileAvatarUploader 
                size={80} 
                fallbackInitial={getInitials(userProfile?.full_name)} 
                onChange={(url) => {
                  setUserProfile((prev: any) => ({ ...prev, avatar_url: url }));
                  fetchRealData();
                }} 
              />
            </View>

            <View className="flex-1 h-20 justify-between">
              
              <View className="flex-row items-center gap-1.5 pr-1">
                <Text className="text-lg font-bold text-white tracking-tight leading-none" numberOfLines={1}>
                  {userProfile?.full_name}
                </Text>
                {isApproved && <CheckCircle2 size={16} color="#4ade80" />}
              </View>

              <TouchableOpacity 
                onPress={() => setShowFullPhone(!showFullPhone)}
                className="flex-row items-center gap-2 bg-black/15 self-start px-2.5 py-0.5 rounded-full border border-white/10"
              >
                <Text className="text-[11px] text-slate-200 font-mono">
                  {showFullPhone ? userProfile?.phone_number : maskNumber(userProfile?.phone_number)}
                </Text>
                {showFullPhone ? <EyeOff size={11} color="#cbd5e1" /> : <Eye size={11} color="#cbd5e1" />}
              </TouchableOpacity>
              
              <View className="flex-row items-center justify-between">
                <View className={`px-2.5 py-0.5 rounded-full ${userTheme.badgeBg} border ${userTheme.badgeBorder}`}>
                  <Text className={`text-[9px] font-black uppercase tracking-widest ${userTheme.badgeText}`}>
                    {userTheme.label}
                  </Text>
                </View>

                <TouchableOpacity 
                  onPress={() => setQrModalVisible(true)}
                  className="flex-row items-center gap-1 bg-white px-2.5 py-0.5 rounded-xl shadow-xs"
                >
                  <QrCode size={11} color="#0A1D37" />
                  <Text className="text-[10px] font-bold text-[#0A1D37]">My QR</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>

          {/* Stats Bar */}
          <View className="flex-row border-t border-white/15 pt-4">
            <View className="flex-1 items-center border-r border-white/10">
              <Text className="text-xl font-black text-white">{stats.totalReservations}</Text>
              <Text className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">Bookings</Text>
            </View>
            <View className="flex-1 items-center border-r border-white/10">
              <Text className="text-xl font-black text-white">{stats.completedReservations}</Text>
              <Text className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">Completed</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-xl font-black text-white">{stats.totalVehicles} / {MAX_VEHICLES}</Text>
              <Text className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">Vehicles</Text>
            </View>
          </View>
        </View>

        {/* DISCOUNT BANNER */}
        {isNone && !discountBannerDismissed && (
          <View className="bg-sky-600 rounded-2xl p-4 flex-row items-center justify-between shadow-xs mb-4 border border-sky-500">
            <TouchableOpacity 
              onPress={() => setDiscountModalVisible(true)}
              className="flex-row items-center gap-3 flex-1 mr-2"
            >
              <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center shrink-0">
                <BadgePercent size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-black text-sm">Apply PWD / Senior Discount</Text>
                <Text className="text-sky-100 text-[11px]">Get 20% off on all parking reservations</Text>
              </View>
            </TouchableOpacity>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                onPress={() => setDiscountModalVisible(true)}
                className="bg-white px-3 py-1.5 rounded-xl shadow-xs"
              >
                <Text className="text-sky-700 text-xs font-black">Apply Now</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setDiscountBannerDismissed(true)}
                className="bg-black/20 w-7 h-7 rounded-full items-center justify-center"
              >
                <X size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isPending && (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex-row items-center gap-3 mb-4">
            <Clock size={20} color="#d97706" />
            <View className="flex-1">
              <Text className="text-amber-900 font-bold text-xs">Discount Application Under Review</Text>
              <Text className="text-amber-700 text-[11px]">Admin is verifying your ID. You can still book at regular rates.</Text>
            </View>
          </View>
        )}

        {/* 5 MAIN MENU ITEMS */}
        <View className="bg-white rounded-3xl shadow-sm border border-slate-100 mb-3 overflow-hidden">
          <ProfileMenuItem 
            icon={<Car size={20} color="#0A1D37" />} 
            title="My Vehicles" 
            label={`Manage up to ${MAX_VEHICLES} vehicles`} 
            onClick={() => router.push("/(app)/vehicles")} 
          />
          <ProfileMenuItem 
            icon={<Wallet size={20} color="#0A1D37" />} 
            title="Linked e-Wallets" 
            label={walletLabel} 
            onClick={() => setWalletModalVisible(true)} 
          />
          <ProfileMenuItem 
            icon={<Star size={20} color="#0A1D37" />} 
            title="Favorite Spots" 
            label="Quick access to go-to locations" 
            onClick={() => router.push("/(app)/favorites")} 
          />
          <ProfileMenuItem 
            icon={<Shield size={20} color="#0A1D37" />} 
            title="Account Details & Security" 
            label="Update name, phone, password & apply discounts" 
            onClick={() => setAccountDetailsModalVisible(true)} 
          />
          <ProfileMenuItem 
            icon={<HelpCircle size={20} color="#0A1D37" />} 
            title="Help & Support" 
            label="FAQs, contact support & feedback" 
            onClick={() => Linking.openURL('mailto:yourparkada@gmail.com')} 
            isLast 
          />
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity onPress={handleLogout} className="w-full py-3.5 rounded-2xl bg-white border border-rose-200 flex-row items-center justify-center gap-2 mb-3 shadow-xs">
          <LogOut size={18} color="#f43f5e" />
          <Text className="text-rose-500 font-bold text-base">Sign Out</Text>
        </TouchableOpacity>

        {/* APP VERSION & LEGAL FOOTER */}
        <View className="items-center pb-8">
          <Text className="text-xs font-bold text-slate-400">ParKada App v1.0.0</Text>
          <Text className="text-[10px] text-slate-400 mt-0.5">De La Salle Lipa IT4C Group 9</Text>
          <Text className="text-[10px] text-slate-400 mt-0.5">Compliant with National Data Privacy Act</Text>
        </View>

      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: USER QR CODE                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={qrModalVisible} animationType="fade" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-white rounded-3xl p-6 w-full items-center shadow-xl">
            <TouchableOpacity onPress={() => setQrModalVisible(false)} className="absolute right-4 top-4 p-1">
              <X size={22} color="#64748B" />
            </TouchableOpacity>

            <Text className="text-lg font-bold text-slate-800 mt-2">ParKada Digital ID</Text>
            <Text className="text-xs text-slate-400 mb-6 text-center">Scan at carpark entrance for entry validation</Text>

            <View className="bg-slate-50 p-6 rounded-2xl border border-slate-100 items-center justify-center mb-4">
              <QRCode 
                value={userProfile?.id || "parkada_user"}
                size={180}
                color="#0A1D37"
                backgroundColor="transparent"
              />
            </View>

            <Text className="text-sm font-bold text-slate-800">{userProfile?.full_name}</Text>
            <Text className="text-xs font-mono text-slate-400 mt-0.5">{userProfile?.phone_number}</Text>

            {/* ── Discount status — permanently shown inside the Digital ID ── */}
            <View className={`mt-4 mx-2 rounded-2xl border p-3.5 items-center ${isApproved ? 'border-emerald-200 bg-emerald-50' : isPending ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <View className="flex-row items-center gap-2 mb-1">
                <BadgePercent size={16} color={isApproved ? '#059669' : isPending ? '#d97706' : '#64748b'} />
                <Text className={`text-[11px] font-black uppercase tracking-wider ${isApproved ? 'text-emerald-700' : isPending ? 'text-amber-700' : 'text-slate-500'}`}>
                  {isApproved ? `${userProfile?.discount_type === 'senior' ? 'Senior Citizen' : 'PWD'} Discount Active`
                    : isPending ? 'Discount Under Review'
                    : 'No Discount Applied'}
                </Text>
              </View>
              <Text className="text-[10px] text-slate-500 text-center leading-4">
                {isApproved ? '20% off applied to all parking reservations.'
                  : isPending ? 'Admin is verifying your ID. You can still book at regular rates.'
                  : 'Apply for a 20% PWD or Senior Citizen discount.'}
              </Text>
              {!isApproved && !isPending && (
                <TouchableOpacity 
                  onPress={() => { setQrModalVisible(false); setDiscountModalVisible(true); }}
                  className="mt-3 bg-sky-600 px-5 py-2.5 rounded-xl items-center shadow-sm"
                >
                  <Text className="text-white font-bold text-xs">Apply Discount</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: ACCOUNT DETAILS & SECURITY                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={accountDetailsModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '92%' }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-slate-800">Account Details & Security</Text>
              <TouchableOpacity onPress={() => setAccountDetailsModalVisible(false)} className="p-1">
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View className="bg-slate-100 rounded-2xl p-3.5 mb-5 flex-row items-center gap-3 border border-slate-200">
                <Lock size={18} color="#64748b" />
                <Text className="text-xs text-slate-600 flex-1 leading-4">
                  Display name and phone number can be updated here. Email is read-only because it was verified via OTP.
                </Text>
              </View>

              <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="How should we call you?"
                className="w-full border border-slate-200 rounded-xl p-3.5 mb-4 text-sm font-medium text-slate-800 bg-slate-50"
              />

              <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Mobile Phone Number</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="09XXXXXXXXX"
                keyboardType="phone-pad"
                maxLength={11}
                className="w-full border border-slate-200 rounded-xl p-3.5 mb-4 text-sm font-mono font-bold text-slate-800 bg-slate-50"
              />

              <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Email Address</Text>
              <View className="w-full border border-slate-200 rounded-xl p-3.5 mb-6 bg-slate-100 flex-row justify-between items-center">
                <Text className="text-sm font-bold text-slate-700">{userProfile?.email}</Text>
                <Lock size={16} color="#94a3b8" />
              </View>

              <TouchableOpacity 
                onPress={handleSaveDetails}
                disabled={savingDetails}
                className="bg-[#0A1D37] py-4 rounded-xl flex-row items-center justify-center gap-2 mb-3 shadow-xs"
              >
                {savingDetails ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#fff" />
                    <Text className="text-white font-bold text-sm">Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: LINK E-WALLETS                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={walletModalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-slate-800">Link e-Wallet Account</Text>
              <TouchableOpacity onPress={() => setWalletModalVisible(false)} className="p-1">
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Select Provider</Text>
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity 
                onPress={() => {
                  setSelectedWallet('gcash');
                  setWalletNumber(userProfile?.gcash_number || '');
                }}
                className={`flex-1 p-3.5 rounded-2xl border items-center flex-row justify-center gap-2 ${selectedWallet === 'gcash' ? 'bg-blue-50 border-blue-500' : 'border-slate-200'}`}
              >
                <Smartphone size={18} color={selectedWallet === 'gcash' ? '#2563eb' : '#64748b'} />
                <Text className={`font-bold ${selectedWallet === 'gcash' ? 'text-blue-600' : 'text-slate-600'}`}>GCash</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => {
                  setSelectedWallet('maya');
                  setWalletNumber(userProfile?.maya_number || '');
                }}
                className={`flex-1 p-3.5 rounded-2xl border items-center flex-row justify-center gap-2 ${selectedWallet === 'maya' ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200'}`}
              >
                <Smartphone size={18} color={selectedWallet === 'maya' ? '#059669' : '#64748b'} />
                <Text className={`font-bold ${selectedWallet === 'maya' ? 'text-emerald-600' : 'text-slate-600'}`}>Maya</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Mobile Number</Text>
            <View className="relative mb-6">
              <TextInput
                value={walletNumber}
                onChangeText={setWalletNumber}
                placeholder="09123456789"
                keyboardType="phone-pad"
                secureTextEntry={!showFullWallet}
                maxLength={11}
                className="w-full border border-slate-200 rounded-xl p-3.5 text-sm font-medium text-slate-800 bg-slate-50 pr-12"
              />
              <TouchableOpacity 
                onPress={() => setShowFullWallet(!showFullWallet)}
                className="absolute right-3.5 top-3.5"
              >
                {showFullWallet ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={handleSaveWallet}
              disabled={savingWallet}
              className="bg-[#0A1D37] py-4 rounded-xl items-center mb-4 shadow-sm"
            >
              {savingWallet ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Link Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: DISCOUNT APPLICATION — 4-STEP CAPTURE FLOW                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={discountModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl p-6" style={{ height: '92%' }}>

            {/* ── Header ── */}
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-slate-800">Apply for 20% Discount</Text>
              <TouchableOpacity 
                onPress={() => { 
                  setDiscountModalVisible(false); 
                  resetDiscountModal();
                }} 
                className="p-1"
              >
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* ── Step Progress Indicator ── */}
            <View className="flex-row items-center justify-center mb-5">
              {CAPTURE_STEPS.map((step, i) => (
                <View key={step} className="flex-row items-center">
                  <View className={`w-7 h-7 rounded-full items-center justify-center border-2 ${
                    captureStep === step 
                      ? 'bg-[#0A1D37] border-[#0A1D37]' 
                      : i < currentStepIndex
                        ? 'bg-sky-500 border-sky-500'
                        : 'bg-slate-100 border-slate-300'
                  }`}>
                    {i < currentStepIndex ? (
                      <CheckCircle2 size={14} color="white" />
                    ) : (
                      <Text className={`text-[10px] font-black ${
                        captureStep === step ? 'text-white' : 'text-slate-400'
                      }`}>{i + 1}</Text>
                    )}
                  </View>
                  {i < CAPTURE_STEPS.length - 1 && (
                    <View className={`w-8 h-0.5 ${i < currentStepIndex ? 'bg-sky-500' : 'bg-slate-200'}`} />
                  )}
                </View>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* STEP 1 — WHICH DISCOUNT ARE YOU APPLYING FOR?                 */}
              {/* ══════════════════════════════════════════════════════════════ */}
              {captureStep === 'type' && (
                <View>
                  <View className="items-center mb-6">
                    <View className="w-14 h-14 rounded-2xl bg-sky-500/10 items-center justify-center mb-3">
                      <BadgePercent size={26} color="#0284c7" />
                    </View>
                    <Text className="text-lg font-black text-slate-800">Select Discount Type</Text>
                    <Text className="text-xs text-slate-500 mt-1 text-center px-4">
                      Choose the discount you are applying for. This is what the super admin will review.
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={() => setDiscountType('pwd')}
                    className={`flex-row items-center gap-3 p-4 rounded-2xl border mb-3 ${discountType === 'pwd' ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200 bg-white'}`}
                  >
                    <View className="w-11 h-11 rounded-xl bg-emerald-100 items-center justify-center shrink-0">
                      <Accessibility size={22} color="#059669" />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-black text-sm ${discountType === 'pwd' ? 'text-emerald-800' : 'text-slate-800'}`}>PWD Discount</Text>
                      <Text className="text-[11px] text-slate-500">Person with Disability — 20% off</Text>
                    </View>
                    {discountType === 'pwd' && <CheckCircle2 size={18} color="#059669" />}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => setDiscountType('senior')}
                    className={`flex-row items-center gap-3 p-4 rounded-2xl border mb-5 ${discountType === 'senior' ? 'bg-amber-50 border-amber-500' : 'border-slate-200 bg-white'}`}
                  >
                    <View className="w-11 h-11 rounded-xl bg-amber-100 items-center justify-center shrink-0">
                      <Heart size={22} color="#d97706" />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-black text-sm ${discountType === 'senior' ? 'text-amber-800' : 'text-slate-800'}`}>Senior Citizen</Text>
                      <Text className="text-[11px] text-slate-500">Senior Citizen — 20% off</Text>
                    </View>
                    {discountType === 'senior' && <CheckCircle2 size={18} color="#d97706" />}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => setCaptureStep('front')}
                    className="bg-[#0A1D37] py-4 rounded-xl items-center shadow-sm"
                  >
                    <Text className="text-white font-bold text-base">Continue →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* STEP 2 — ID FRONT                                             */}
              {/* ══════════════════════════════════════════════════════════════ */}
              {captureStep === 'front' && (
                <View>
                  <View className="items-center mb-6">
                    <View className="w-14 h-14 rounded-2xl bg-[#0A1D37]/10 items-center justify-center mb-3">
                      <Upload size={26} color="#0A1D37" />
                    </View>
                    <Text className="text-lg font-black text-slate-800">Front of your ID</Text>
                    <Text className="text-xs text-slate-500 mt-1 text-center px-4">
                      Take a clear photo of the front side of your {discountType === 'pwd' ? 'PWD' : 'Senior Citizen'} ID
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={() => pickIdImage('front')}
                    className="w-full border-2 border-dashed border-slate-300 rounded-2xl items-center justify-center bg-slate-50 mb-5 overflow-hidden"
                    style={{ height: 176 }}
                  >
                    {idFrontImage ? (
                      <>
                        <Image source={{ uri: idFrontImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <View className="absolute bottom-2 right-2 bg-emerald-500 rounded-full p-1">
                          <CheckCircle2 size={16} color="white" />
                        </View>
                        <View className="absolute top-2 right-2 bg-black/40 px-2 py-0.5 rounded-lg">
                          <Text className="text-white text-[10px] font-bold">Tap to retake</Text>
                        </View>
                      </>
                    ) : (
                      <View className="items-center">
                        <Upload size={28} color="#94a3b8" />
                        <Text className="text-xs font-medium text-slate-500 mt-2">Tap to upload front of ID</Text>
                        <Text className="text-[10px] text-slate-400 mt-0.5">JPG, PNG • Ensure all text is readable</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => {
                      if (idFrontImage) {
                        setCaptureStep('back');
                      } else {
                        Alert.alert("Required", "Please upload the front of your ID first.");
                      }
                    }}
                    className={`py-4 rounded-xl items-center shadow-sm ${idFrontImage ? 'bg-[#0A1D37]' : 'bg-slate-200'}`}
                  >
                    <Text className={`font-bold text-base ${idFrontImage ? 'text-white' : 'text-slate-400'}`}>
                      Next: Back of ID →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* STEP 2 — ID BACK                                              */}
              {/* ══════════════════════════════════════════════════════════════ */}
              {captureStep === 'back' && (
                <View>
                  <View className="items-center mb-6">
                    <View className="w-14 h-14 rounded-2xl bg-[#0A1D37]/10 items-center justify-center mb-3">
                      <Upload size={26} color="#0A1D37" />
                    </View>
                    <Text className="text-lg font-black text-slate-800">Back of your ID</Text>
                    <Text className="text-xs text-slate-500 mt-1 text-center px-4">
                      Flip it over and capture the back side clearly
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={() => pickIdImage('back')}
                    className="w-full border-2 border-dashed border-slate-300 rounded-2xl items-center justify-center bg-slate-50 mb-5 overflow-hidden"
                    style={{ height: 176 }}
                  >
                    {idBackImage ? (
                      <>
                        <Image source={{ uri: idBackImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <View className="absolute bottom-2 right-2 bg-emerald-500 rounded-full p-1">
                          <CheckCircle2 size={16} color="white" />
                        </View>
                        <View className="absolute top-2 right-2 bg-black/40 px-2 py-0.5 rounded-lg">
                          <Text className="text-white text-[10px] font-bold">Tap to retake</Text>
                        </View>
                      </>
                    ) : (
                      <View className="items-center">
                        <Upload size={28} color="#94a3b8" />
                        <Text className="text-xs font-medium text-slate-500 mt-2">Tap to upload back of ID</Text>
                        <Text className="text-[10px] text-slate-400 mt-0.5">Ensure barcode or signature is visible</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View className="flex-row gap-3">
                    <TouchableOpacity 
                      onPress={() => setCaptureStep('front')}
                      className="flex-1 py-4 rounded-xl items-center border border-slate-200 bg-white"
                    >
                      <Text className="font-bold text-slate-600">← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => {
                        if (idBackImage) {
                          setCaptureStep('selfie');
                        } else {
                          Alert.alert("Required", "Please upload the back of your ID first.");
                        }
                      }}
                      className={`flex-1 py-4 rounded-xl items-center shadow-sm ${idBackImage ? 'bg-[#0A1D37]' : 'bg-slate-200'}`}
                    >
                      <Text className={`font-bold text-base ${idBackImage ? 'text-white' : 'text-slate-400'}`}>
                        Next: Selfie →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* STEP 3 — SELFIE / FACE SCAN                                  */}
              {/* ══════════════════════════════════════════════════════════════ */}
              {captureStep === 'selfie' && (
                <View>
                  <View className="items-center mb-5">
                    <View className="w-14 h-14 rounded-2xl bg-sky-500/10 items-center justify-center mb-3">
                      <Shield size={26} color="#0284c7" />
                    </View>
                    <Text className="text-lg font-black text-slate-800">Face Verification</Text>
                    <Text className="text-xs text-slate-500 mt-1 text-center px-4">
                      Take a selfie so our admin can verify your identity matches the ID
                    </Text>
                  </View>

                  {/* Oval selfie preview */}
                  <TouchableOpacity 
                    onPress={takeSelfie}
                    className="self-center mb-5"
                    style={{ width: 160, height: 200 }}
                  >
                    <View 
                      className="w-full h-full border-2 border-dashed border-slate-300 bg-slate-50 items-center justify-center overflow-hidden"
                      style={{ borderRadius: 80 }}
                    >
                      {selfieImage ? (
                        <>
                          <Image source={{ uri: selfieImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          <View className="absolute bottom-4 right-4 bg-emerald-500 rounded-full p-1">
                            <CheckCircle2 size={16} color="white" />
                          </View>
                        </>
                      ) : (
                        <View className="items-center px-4">
                          <Text className="text-3xl mb-2">🤳</Text>
                          <Text className="text-xs font-medium text-slate-500 text-center">Tap to open camera</Text>
                          <Text className="text-[10px] text-slate-400 mt-0.5 text-center">Look straight, good lighting</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {selfieImage && (
                    <TouchableOpacity onPress={takeSelfie} className="self-center mb-4">
                      <Text className="text-sky-600 text-xs font-bold text-center">Tap photo to retake selfie</Text>
                    </TouchableOpacity>
                  )}

                  <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex-row items-start gap-2">
                    <Text className="text-amber-500 text-sm mt-0.5">💡</Text>
                    <Text className="text-amber-800 text-[11px] flex-1 leading-4">
                      Ensure your face is clearly visible, well-lit, and matches the photo on your ID. No sunglasses or masks.
                    </Text>
                  </View>

                  <View className="flex-row gap-3">
                    <TouchableOpacity 
                      onPress={() => setCaptureStep('back')}
                      className="flex-1 py-4 rounded-xl items-center border border-slate-200 bg-white"
                    >
                      <Text className="font-bold text-slate-600">← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => {
                        if (selfieImage) {
                          setCaptureStep('review');
                        } else {
                          Alert.alert("Required", "Please take a selfie first.");
                        }
                      }}
                      className={`flex-1 py-4 rounded-xl items-center shadow-sm ${selfieImage ? 'bg-[#0A1D37]' : 'bg-slate-200'}`}
                    >
                      <Text className={`font-bold text-base ${selfieImage ? 'text-white' : 'text-slate-400'}`}>
                        Review →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* STEP 4 — REVIEW & SUBMIT                                      */}
              {/* ══════════════════════════════════════════════════════════════ */}
              {captureStep === 'review' && (
                <View>
                  <View className="items-center mb-5">
                    <Text className="text-lg font-black text-slate-800">Review & Submit</Text>
                    <Text className="text-xs text-slate-500 mt-1 text-center">
                      Double-check everything before submitting for admin review
                    </Text>
                  </View>

                  {/* Discount Type */}
                  <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Discount Type</Text>
                  <View className="flex-row gap-3 mb-4">
                    <TouchableOpacity 
                      onPress={() => setDiscountType('pwd')}
                      className={`flex-1 p-3.5 rounded-2xl border items-center ${discountType === 'pwd' ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200'}`}
                    >
                      <Text className={`font-bold text-sm ${discountType === 'pwd' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        PWD Discount
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setDiscountType('senior')}
                      className={`flex-1 p-3.5 rounded-2xl border items-center ${discountType === 'senior' ? 'bg-amber-50 border-amber-500' : 'border-slate-200'}`}
                    >
                      <Text className={`font-bold text-sm ${discountType === 'senior' ? 'text-amber-700' : 'text-slate-500'}`}>
                        Senior Citizen
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ID Number */}
                  <Text className="text-xs font-bold text-slate-500 uppercase mb-2">ID Number</Text>
                  <TextInput
                    value={idNumber}
                    onChangeText={setIdNumber}
                    placeholder="Enter PWD or Senior Citizen ID No."
                    className="w-full border border-slate-200 rounded-xl p-3.5 mb-5 text-sm bg-slate-50"
                  />

                  {/* Photo Preview Row — tap any thumbnail to redo that step */}
                  <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Captured Photos</Text>
                  <View className="flex-row gap-2 mb-5">

                    {/* Front ID thumbnail */}
                    <TouchableOpacity onPress={() => setCaptureStep('front')} className="flex-1 items-center">
                      <View className="w-full rounded-xl overflow-hidden border border-slate-200 mb-1" style={{ height: 72 }}>
                        {idFrontImage 
                          ? <Image source={{ uri: idFrontImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          : <View className="flex-1 bg-slate-100 items-center justify-center"><Text className="text-[10px] text-slate-400">No photo</Text></View>
                        }
                      </View>
                      <Text className="text-[10px] font-bold text-slate-500">ID Front</Text>
                      <Text className="text-[9px] text-sky-500 font-bold">Tap to redo</Text>
                    </TouchableOpacity>

                    {/* Back ID thumbnail */}
                    <TouchableOpacity onPress={() => setCaptureStep('back')} className="flex-1 items-center">
                      <View className="w-full rounded-xl overflow-hidden border border-slate-200 mb-1" style={{ height: 72 }}>
                        {idBackImage 
                          ? <Image source={{ uri: idBackImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          : <View className="flex-1 bg-slate-100 items-center justify-center"><Text className="text-[10px] text-slate-400">No photo</Text></View>
                        }
                      </View>
                      <Text className="text-[10px] font-bold text-slate-500">ID Back</Text>
                      <Text className="text-[9px] text-sky-500 font-bold">Tap to redo</Text>
                    </TouchableOpacity>

                    {/* Selfie thumbnail */}
                    <TouchableOpacity onPress={() => setCaptureStep('selfie')} className="flex-1 items-center">
                      <View 
                        className="w-full overflow-hidden border border-slate-200 mb-1 self-center"
                        style={{ height: 72, borderRadius: 36 }}
                      >
                        {selfieImage 
                          ? <Image source={{ uri: selfieImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          : <View className="flex-1 bg-slate-100 items-center justify-center"><Text className="text-[10px] text-slate-400">No photo</Text></View>
                        }
                      </View>
                      <Text className="text-[10px] font-bold text-slate-500">Selfie</Text>
                      <Text className="text-[9px] text-sky-500 font-bold">Tap to redo</Text>
                    </TouchableOpacity>

                  </View>

                  {/* Privacy notice */}
                  <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 flex-row items-start gap-2">
                    <Lock size={13} color="#94a3b8" style={{ marginTop: 1 }} />
                    <Text className="text-slate-500 text-[10px] flex-1 leading-4">
                      Your ID photos and selfie are encrypted and used solely for discount verification in compliance with the National Data Privacy Act of the Philippines.
                    </Text>
                  </View>

                  <View className="flex-row gap-3 mb-6">
                    <TouchableOpacity 
                      onPress={() => setCaptureStep('selfie')}
                      className="flex-1 py-4 rounded-xl items-center border border-slate-200 bg-white"
                    >
                      <Text className="font-bold text-slate-600">← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleSubmitDiscount}
                      disabled={submittingDiscount}
                      className="flex-1 bg-sky-600 py-4 rounded-xl items-center shadow-sm"
                    >
                      {submittingDiscount 
                        ? <ActivityIndicator color="#fff" />
                        : <Text className="text-white font-bold text-base">Submit →</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Profile Menu Item Component ─────────────────────────────────────────────

function ProfileMenuItem({ icon, title, label, onClick, isLast }: any) {
  return (
    <TouchableOpacity onPress={onClick} className={`w-full flex-row items-center p-4 bg-white ${!isLast ? 'border-b border-slate-100' : ''}`}>
      <View className="flex-row items-center gap-4 flex-1">
        <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center shrink-0">{icon}</View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-800 mb-0.5" numberOfLines={1}>{title}</Text>
          <Text className="text-[11px] font-medium text-slate-400" numberOfLines={1}>{label}</Text>
        </View> 
      </View>
    </TouchableOpacity>
  );
}