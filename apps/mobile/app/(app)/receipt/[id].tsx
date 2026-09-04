import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ShieldCheck, MapPin, Clock, Car, CircleCheck, Share2, ChevronLeft } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import QRCode from "react-native-qrcode-svg";

const formatTimeFromISO = (isoString: string) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

export default function DigitalReceiptPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [res, setRes] = useState<any>(null);
  const [receiptRef, setReceiptRef] = useState<string>("PROCESSING"); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!id || id === "undefined" || id === "null") {
        setLoading(false);
        return;
      }

      try {
        const { data: resData, error: resError } = await supabase
          .from("reservations")
          .select(`*, parking_lots (name, address), parking_slots (label)`)
          .eq("id", id)
          .single();

        if (resError) throw resError;
        setRes(resData);

        const { data: receiptData } = await supabase
          .from("receipts")
          .select("reference_no")
          .eq("reservation_id", id)
          .single();

        if (receiptData) {
          setReceiptRef(receiptData.reference_no);
        }

      } catch (err) {
        console.error("Receipt error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [id]);

  const handleShare = async () => {
    if (!res) return;
    try {
      const shareMessage = `Parkada Ticket\n\nLocation: ${res.parking_lots?.name || 'N/A'}\nSlot: ${res.parking_slots?.label || 'N/A'}\nVehicle: ${res.plate_number}\nRef: ${receiptRef}`;
      
      await Share.share({
        message: shareMessage,
        title: "My Parking Ticket"
      });
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share receipt.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-slate-500">Generating Receipt...</Text>
      </SafeAreaView>
    );
  }

  if (!res) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
            <ChevronLeft size={24} color="#0A1D37" />
          </TouchableOpacity>
          <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">Error</Text>
        </View>
        <View className="flex-1 justify-center items-center p-10">
          <Text className="text-slate-500 font-bold">Receipt not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const qrData = JSON.stringify({
    id: res.id,
    plate: res.plate_number,
    ref: receiptRef
  });

  const bookingDate = new Date(res.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const startTimeFormatted = formatTimeFromISO(res.start_time);
  const endTimeFormatted = formatTimeFromISO(res.end_time);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
          <ChevronLeft size={24} color="#0A1D37" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">Digital Receipt</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6">
        
        {/* TICKET CONTAINER */}
        <View className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          
          <View className="bg-[#0A1D37] p-6 items-center">
            <View className="bg-white/20 p-3 rounded-full mb-3">
              <ShieldCheck size={28} color="white" />
            </View>
            <Text className="text-xl font-black uppercase tracking-widest text-white mb-1">Confirmed Booking</Text>
            <Text className="text-[10px] text-white/80 font-bold uppercase tracking-widest">Parkada Official Ticket</Text>
          </View>

          <View className="p-8 items-center bg-white">
            <View className="items-center mb-6">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-tight mb-1">Your Reserved Slot</Text>
              <Text className="text-6xl font-black text-[#0A1D37] tracking-tighter">
                {res.parking_slots?.label || "--"}
              </Text>
            </View>

            <View className="p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 mb-6">
              <QRCode value={qrData} size={140} color="#0A1D37" backgroundColor="transparent" />
            </View>

            <View className="items-center">
              <Text className="text-base font-black text-slate-800 uppercase mb-1">{res.plate_number}</Text>
              <Text className="text-[10px] text-slate-400 font-bold">Ref: {receiptRef}</Text>
            </View>
          </View>

          {/* Ticket Divider */}
          <View className="flex-row items-center justify-center relative my-1">
            <View className="absolute left-[-16px] w-8 h-8 bg-slate-50 rounded-full border-r border-slate-200 z-10" />
            <View className="w-full h-[1px] border-t-2 border-dashed border-slate-200 mx-4" />
            <View className="absolute right-[-16px] w-8 h-8 bg-slate-50 rounded-full border-l border-slate-200 z-10" />
          </View>

          <View className="p-6 bg-white">
            <View className="flex-row flex-wrap">
              <View className="w-1/2 flex-row items-start gap-3 mb-6 pr-2">
                <MapPin size={20} color="#0A1D37" />
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Location</Text>
                  <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>{res.parking_lots?.name || "N/A"}</Text>
                </View>
              </View>

              <View className="w-1/2 flex-row items-start gap-3 mb-6 pl-2">
                <Clock size={20} color="#0A1D37" />
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Schedule</Text>
                  <Text className="text-xs font-bold text-slate-800">{bookingDate}</Text>
                  <Text className="text-[10px] font-medium text-slate-500">{startTimeFormatted} - {endTimeFormatted}</Text>
                </View>
              </View>

              <View className="w-1/2 flex-row items-start gap-3 pr-2">
                <Car size={20} color="#0A1D37" />
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Vehicle</Text>
                  <Text className="text-xs font-bold text-slate-800 uppercase">{res.plate_number}</Text>
                </View>
              </View>

              <View className="w-1/2 flex-row items-start gap-3 pl-2">
                <CircleCheck size={20} color="#059669" />
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Payment</Text>
                  <Text className="text-xs font-bold uppercase text-emerald-600">₱{res.total_amount} ({res.payment_method})</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="pt-6 pb-12">
          <TouchableOpacity 
            onPress={handleShare} 
            className="w-full h-14 rounded-2xl bg-white border border-slate-200 flex-row items-center justify-center gap-2 shadow-sm"
          >
            <Share2 size={18} color="#64748B" />
            <Text className="font-bold text-slate-700 text-base">Share Receipt Details</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}