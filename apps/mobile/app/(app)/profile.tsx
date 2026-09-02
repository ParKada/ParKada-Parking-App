import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Modal, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { 
  Car, Wallet, Star, Shield, HelpCircle, LogOut, CheckCircle2, 
  BadgePercent, Upload, X, Clock, Smartphone, Eye, EyeOff, QrCode, Lock, Mail
} from "lucide-react-native";
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from "../../lib/supabase";

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

  // Form States - Discount Application
  const [discountType, setDiscountType] = useState<'pwd' | 'senior'>('pwd');
  const [idNumber, setIdNumber] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [submittingDiscount, setSubmittingDiscount] = useState(false);

  // Form States - Linked e-Wallets
  const [selectedWallet, setSelectedWallet] = useState<'gcash' | 'maya'>('gcash');
  const [walletNumber, setWalletNumber] = useState('');
  const [showFullWallet, setShowFullWallet] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);

  const MAX_VEHICLES = 3;

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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setIdImage(result.assets[0].uri);
    }
  };

  const handleSubmitDiscount = async () => {
    if (!idNumber.trim()) {
      Alert.alert("Required", "Please enter your ID number.");
      return;
    }
    if (!idImage) {
      Alert.alert("Required", "Please upload a photo of your PWD or Senior ID.");
      return;
    }

    try {
      setSubmittingDiscount(true);
      const user = userProfile;

      const fileName = `${user.id}_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: idImage,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('discount-ids')
        .upload(fileName, formData);

      let publicUrl = idImage;
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('discount-ids').getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          discount_type: discountType,
          discount_status: 'pending',
          discount_id_number: idNumber,
          discount_id_url: publicUrl
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      Alert.alert("Application Submitted", "Your discount request is under admin review.");
      setDiscountModalVisible(false);
      fetchRealData();

    } catch (error: any) {
      Alert.alert("Submission Failed", error.message || "An error occurred.");
    } finally {
      setSubmittingDiscount(false);
    }
  };

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    Alert.alert("Logged out", "You have successfully logged out.");
    router.replace("/(auth)/login");
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-slate-500">Loading Profile...</Text>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        
        {/* PROFILE HEADER CARD */}
        <View className={`${userTheme.bg} rounded-3xl p-6 shadow-xl mb-4 relative overflow-hidden`}>
          
          <View className="flex-row gap-4 mb-5 items-center">
            {/* LARGE PROFILE AVATAR (Exact 80px / h-20 w-20) */}
            <View className="w-20 h-20 rounded-2xl bg-white/15 items-center justify-center border border-white/20 shrink-0 shadow-xs">
              <Text className="text-3xl font-black text-white">{getInitials(userProfile?.full_name)}</Text>
            </View>

            {/* DETAILS CONTAINER (Fixed h-20 / 80px + Justify Between para eksaktong pantay ang Top, Middle, Bottom) */}
            <View className="flex-1 h-20 justify-between">
              
              {/* TOP: NAME (Pantay sa Top Edge ng Photo) */}
              <View className="flex-row items-center gap-1.5 pr-1">
                <Text className="text-lg font-bold text-white tracking-tight leading-none" numberOfLines={1}>
                  {userProfile?.full_name}
                </Text>
                {isApproved && <CheckCircle2 size={16} color="#4ade80" />}
              </View>

              {/* MIDDLE: PHONE NUMBER (Mismong Gitna) */}
              <TouchableOpacity 
                onPress={() => setShowFullPhone(!showFullPhone)}
                className="flex-row items-center gap-2 bg-black/15 self-start px-2.5 py-0.5 rounded-full border border-white/10"
              >
                <Text className="text-[11px] text-slate-200 font-mono">
                  {showFullPhone ? userProfile?.phone_number : maskNumber(userProfile?.phone_number)}
                </Text>
                {showFullPhone ? <EyeOff size={11} color="#cbd5e1" /> : <Eye size={11} color="#cbd5e1" />}
              </TouchableOpacity>
              
              {/* BOTTOM: USER TYPE BADGE & QR BUTTON (Pantay sa Bottom Edge ng Photo) */}
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
        {isNone && (
          <TouchableOpacity 
            onPress={() => setDiscountModalVisible(true)}
            className="bg-sky-600 rounded-2xl p-4 flex-row items-center justify-between shadow-xs mb-4 border border-sky-500"
          >
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center shrink-0">
                <BadgePercent size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-black text-sm">Apply PWD / Senior Discount</Text>
                <Text className="text-sky-100 text-[11px]">Get 20% off on all parking reservations</Text>
              </View>
            </View>
            <View className="bg-white px-3 py-1.5 rounded-xl shadow-xs">
              <Text className="text-sky-700 text-xs font-black">Apply Now</Text>
            </View>
          </TouchableOpacity>
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
            onClick={() => Alert.alert("Favorite Spots", "Saved locations feature coming soon!")} 
          />
          <ProfileMenuItem 
            icon={<Shield size={20} color="#0A1D37" />} 
            title="Account Details & Security" 
            label="View registered identity & credentials" 
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

      {/* MODAL 1: USER QR CODE */}
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
          </View>
        </View>
      </Modal>

      {/* MODAL 2: READ-ONLY ACCOUNT DETAILS & SECURITY */}
      <Modal visible={accountDetailsModalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-slate-800">Account Details</Text>
              <TouchableOpacity onPress={() => setAccountDetailsModalVisible(false)} className="p-1">
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="bg-slate-100 rounded-2xl p-3.5 mb-5 flex-row items-center gap-3 border border-slate-200">
              <Lock size={18} color="#64748b" />
              <Text className="text-xs text-slate-600 flex-1 leading-4">
                Registered credentials are locked for identity verification and anti-fraud security.
              </Text>
            </View>

            <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Registered Full Name</Text>
            <View className="w-full border border-slate-200 rounded-xl p-3.5 mb-4 bg-slate-100 flex-row justify-between items-center">
              <Text className="text-sm font-bold text-slate-700">{userProfile?.full_name}</Text>
              <Lock size={16} color="#94a3b8" />
            </View>

            <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Mobile Phone Number</Text>
            <View className="w-full border border-slate-200 rounded-xl p-3.5 mb-4 bg-slate-100 flex-row justify-between items-center">
              <Text className="text-sm font-mono font-bold text-slate-700">{userProfile?.phone_number}</Text>
              <Lock size={16} color="#94a3b8" />
            </View>

            <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5">Email Address</Text>
            <View className="w-full border border-slate-200 rounded-xl p-3.5 mb-6 bg-slate-100 flex-row justify-between items-center">
              <Text className="text-sm font-bold text-slate-700">{userProfile?.email}</Text>
              <Lock size={16} color="#94a3b8" />
            </View>

            <TouchableOpacity 
              onPress={() => {
                setAccountDetailsModalVisible(false);
                Linking.openURL('mailto:yourparkada@gmail.com?subject=Request%20Account%20Name/Phone%20Update');
              }}
              className="bg-[#0A1D37] py-4 rounded-xl flex-row items-center justify-center gap-2 mb-4 shadow-xs"
            >
              <Mail size={18} color="#fff" />
              <Text className="text-white font-bold text-sm">Request Info Update via Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: LINK E-WALLETS */}
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

      {/* MODAL 4: DISCOUNT APPLICATION */}
      <Modal visible={discountModalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-slate-800">Apply for 20% Discount</Text>
              <TouchableOpacity onPress={() => setDiscountModalVisible(false)} className="p-1">
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Discount Type</Text>
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity 
                  onPress={() => setDiscountType('pwd')}
                  className={`flex-1 p-3.5 rounded-2xl border items-center ${discountType === 'pwd' ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200'}`}
                >
                  <Text className={`font-bold ${discountType === 'pwd' ? 'text-emerald-700' : 'text-slate-600'}`}>PWD Discount</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setDiscountType('senior')}
                  className={`flex-1 p-3.5 rounded-2xl border items-center ${discountType === 'senior' ? 'bg-amber-50 border-amber-500' : 'border-slate-200'}`}
                >
                  <Text className={`font-bold ${discountType === 'senior' ? 'text-amber-700' : 'text-slate-600'}`}>Senior Citizen</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-xs font-bold text-slate-500 uppercase mb-2">ID Number</Text>
              <TextInput
                value={idNumber}
                onChangeText={setIdNumber}
                placeholder="Enter PWD or Senior Citizen ID No."
                className="w-full border border-slate-200 rounded-xl p-3.5 mb-4 text-sm bg-slate-50"
              />

              <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Upload ID Photo</Text>
              <TouchableOpacity 
                onPress={pickImage}
                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-2xl items-center justify-center bg-slate-50 mb-6 overflow-hidden"
              >
                {idImage ? (
                  <Image source={{ uri: idImage }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <View className="items-center">
                    <Upload size={28} color="#94a3b8" />
                    <Text className="text-xs font-medium text-slate-500 mt-2">Tap to upload front side of ID</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleSubmitDiscount}
                disabled={submittingDiscount}
                className="bg-sky-600 py-4 rounded-xl items-center mb-6 shadow-sm"
              >
                {submittingDiscount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Submit Application</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

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