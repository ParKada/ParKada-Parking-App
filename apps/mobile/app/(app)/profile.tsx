import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Car, CreditCard, Star, ShieldCheck, HelpCircle, LogOut, ChevronRight, CheckCircle2, ShieldAlert } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

const getInitials = (name?: string) => {
  if (!name) return "JD";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalReservations: 0,
    completedReservations: 0,
    totalVehicles: 0
  });

  const MAX_VEHICLES = 3;

  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/(auth)/login");
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
        phone_number: profileData?.phone_number || "No phone number added",
        verification_status: profileData?.verification_status?.toString().replace(/['"]/g, '').trim().toLowerCase() || "unverified", 
        user_type: profileData?.user_type?.toString().replace(/['"]/g, '').trim() || "Regular"
      });

      const [resCount, completeCount, vehCount] = await Promise.all([
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("profile_id", user.id),
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("profile_id", user.id).eq("status", "completed"),
        supabase.from("vehicles").select("*", { count: 'exact', head: true }).eq("profile_id", user.id).eq("is_active", true)
      ]);

      setStats({
        totalReservations: resCount.count || 0,
        completedReservations: completeCount.count || 0,
        totalVehicles: vehCount.count || 0
      });

    } catch (err) {
      console.error("Connection Error:", err);
      Alert.alert("Error", "Failed to sync with database");
    } finally {
      setLoading(false);
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

  const isVerified = userProfile?.verification_status === 'verified';
  const isUnverified = userProfile?.verification_status === 'unverified';
  const isPending = userProfile?.verification_status === 'pending';

  const handleManageVehicles = () => {
    if (!isVerified) {
      Alert.alert("Verification Required", "Verification required to add or manage vehicles. This feature will be available soon.");
      return;
    }
    router.push("/(app)/vehicles");
  };

  const getVehicleLabel = () => {
    if (!isVerified) return "Verification required to add vehicles";
    if (stats.totalVehicles >= MAX_VEHICLES) return `Max limit reached (${MAX_VEHICLES}/${MAX_VEHICLES})`;
    return "Manage registered vehicles";
  };

  const handleComingSoon = () => {
    Alert.alert("Coming Soon", "This feature will be available in a future update.");
  };

  const handleHelpSupport = () => {
    Linking.openURL('mailto:yourparkada@gmail.com');
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 py-6">
        
        {/* Profile Card */}
        <View className="bg-[#0A1D37] rounded-3xl p-6 shadow-lg mb-6">
          <View className="flex-row items-center gap-4 mb-6">
            <View className="w-16 h-16 rounded-2xl bg-white/10 items-center justify-center border border-white/5">
              <Text className="text-2xl font-bold text-white">{getInitials(userProfile?.full_name)}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-lg font-bold text-white tracking-tight">{userProfile?.full_name}</Text>
                {isVerified && <CheckCircle2 size={16} color="#60a5fa" />}
              </View>
              <Text className="text-xs text-slate-300 mt-0.5">{userProfile?.phone_number}</Text>
              <Text className="text-[11px] text-slate-400">{userProfile?.email}</Text>
              
              <View className="mt-2 items-start">
                {isVerified ? (
                  <View>
                    <Text className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Fully Verified</Text>
                    <TouchableOpacity onPress={() => Alert.alert("Benefits", "COMING VERY SOONEST!")}>
                      <Text className="text-[10px] text-slate-400 underline mt-0.5">View Benefits</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className={`px-2 py-0.5 rounded-full border ${isPending ? "bg-amber-500/20 border-amber-500/30" : "bg-slate-500/20 border-slate-500/30"}`}>
                    <Text className={`text-[9px] font-black uppercase tracking-widest ${isPending ? "text-amber-400" : "text-slate-400"}`}>
                      {isPending ? "Verification Pending" : "Basic Account"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View className="flex-row border-t border-white/10 pt-4">
            <View className="flex-1 items-center border-r border-white/10">
              <Text className="text-lg font-bold text-white">{stats.totalReservations}</Text>
              <Text className="text-[10px] text-slate-400 font-medium tracking-wide">Total</Text>
            </View>
            <View className="flex-1 items-center border-r border-white/10">
              <Text className="text-lg font-bold text-white">{stats.completedReservations}</Text>
              <Text className="text-[10px] text-slate-400 font-medium tracking-wide">Completed</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-lg font-bold text-white">{stats.totalVehicles} <Text className="text-xs font-normal text-slate-400">/ {MAX_VEHICLES}</Text></Text>
              <Text className="text-[10px] text-slate-400 font-medium tracking-wide">Vehicles</Text>
            </View>
          </View>
        </View>

        {/* Verification Banner */}
        {isUnverified && (
          <TouchableOpacity 
            onPress={() => Alert.alert("Coming Soon", "Verification feature will be available soon.")}
            className="bg-blue-600 rounded-2xl p-4 flex-row items-center justify-between shadow-md mb-6"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                <ShieldAlert size={20} color="white" />
              </View>
              <View>
                <Text className="text-white font-black text-sm">Get Verified Now</Text>
                <Text className="text-blue-100 text-[10px]">Secure your account & unlock benefits</Text>
              </View>
            </View>
            <View className="bg-white px-3 py-1.5 rounded-full shadow-sm">
              <Text className="text-blue-600 text-[10px] font-black">COMING SOON</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View className="bg-white rounded-3xl shadow-sm border border-slate-100 mb-6">
          <ProfileMenuItem 
            icon={<Car size={20} color="#64748B" />} 
            title="My Vehicles" 
            label={getVehicleLabel()}
            onClick={handleManageVehicles}
          />
          <ProfileMenuItem 
            icon={<CreditCard size={20} color="#64748B" />} 
            title="Payment Methods" 
            label="Add or manage payment options"
            onClick={handleComingSoon}
          />
          <ProfileMenuItem 
            icon={<Star size={20} color="#64748B" />} 
            title="Favorite Slots" 
            label="Save your go-to parking spots"
            onClick={handleComingSoon}
          />
          <ProfileMenuItem 
            icon={<ShieldCheck size={20} color="#64748B" />} 
            title="Privacy & Security" 
            label="Password and data settings"
            onClick={handleComingSoon}
          />
          <ProfileMenuItem 
            icon={<HelpCircle size={20} color="#64748B" />} 
            title="Help & Support" 
            label="FAQs and contact"
            onClick={handleHelpSupport}
            isLast
          />
        </View>

        <TouchableOpacity 
          onPress={handleLogout}
          className="w-full py-4 rounded-2xl bg-white border border-rose-200 flex-row items-center justify-center gap-2 mb-8 shadow-sm"
        >
          <LogOut size={18} color="#f43f5e" />
          <Text className="text-rose-500 font-bold text-base">Sign Out</Text>
        </TouchableOpacity>

        <View className="items-center pb-8">
          <Text className="text-[10px] text-slate-400 font-medium">ParKada v1.0 - De La Salle Lipa IT3C Group 9</Text>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileMenuItem({ icon, title, label, onClick, isLast }: any) {
  return (
    <TouchableOpacity 
      onPress={onClick}
      className={`w-full flex-row items-center justify-between p-4 bg-white ${!isLast ? 'border-b border-slate-100' : ''}`}
    >
      <View className="flex-row items-center gap-4">
        <View className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center">
          {icon}
        </View>
        <View>
          <Text className="text-[15px] font-bold text-slate-800 mb-0.5">{title}</Text>
          <Text className={`text-[11px] font-medium ${(label.includes("Verification required") || label.includes("Max limit")) ? "text-amber-500" : "text-slate-400"}`}>
            {label}
          </Text>
        </View> 
      </View>
      <ChevronRight size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );
}
