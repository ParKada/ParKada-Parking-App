import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from 'expo-router';
import { MapPin, Shield, Clock, ChevronRight } from 'lucide-react-native';

const { height } = Dimensions.get('window');

const features = [
  { icon: MapPin, title: "Real-Time Availability", desc: "See open slots instantly as they update" },
  { icon: Shield, title: "Secure Reservations", desc: "Book your slot in advance with confidence" },
  { icon: Clock, title: "Save Time", desc: "No more circling — go straight to your spot" },
];

export default function AuthLanding() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      {/* Hero Section */}
      <View className="relative bg-[#0A1D37] overflow-hidden" style={{ height: height * 0.52 }}>
        <Image
          source={require('../../assets/hero.png')}
          className="w-full h-full opacity-60"
          resizeMode="cover"
        />
        
        {/* Gradient Overlay approximation using solid color with opacity */}
        <View className="absolute inset-0 bg-[#0A1D37]/40" />

        {/* Logo & Title */}
        <View className="absolute inset-0 flex flex-col items-center justify-end pb-10 px-6 z-10">
          <Image 
            source={require('../../assets/ParKadaBG.png')} 
            className="w-24 h-24 rounded-3xl mb-6 border-2 border-white/10"
          />
          <Text className="text-4xl font-black text-white text-center tracking-tighter">
            Par<Text className="text-amber-400">Kada</Text>
          </Text>
          <Text className="text-white/70 text-xs text-center mt-2 font-bold uppercase tracking-widest">
            Lipa City Downtown
          </Text>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View className="flex-1 bg-white -mt-8 px-8 pt-10 pb-10 flex flex-col rounded-t-[40px] shadow-2xl relative z-20">
        
        {/* Features List */}
        <View className="space-y-6 mb-8 flex-col gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <View key={title} className="flex-row items-center gap-4">
              <View className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <Icon size={20} color="#0A1D37" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-black text-slate-800 tracking-tight">{title}</Text>
                <Text className="text-[11px] text-slate-400 font-bold mt-0.5 leading-tight">{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="space-y-3 mt-auto flex-col gap-3">
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            className="w-full h-14 bg-[#0A1D37] rounded-[20px] flex-row items-center justify-center shadow-xl"
          >
            <Text className="text-sm font-black text-white tracking-widest mr-2">GET STARTED</Text>
            <ChevronRight size={18} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            className="w-full h-14 border-2 border-slate-100 rounded-[20px] flex items-center justify-center bg-white"
          >
            <Text className="text-sm font-black text-slate-600 tracking-widest">Log In</Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View className="mt-6 pt-6 border-t border-slate-50">
          <Text className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
            De La Salle Lipa • IT3C Group 9
          </Text>
        </View>
      </View>
    </View>
  );
}
