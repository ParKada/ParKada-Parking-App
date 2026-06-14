import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ShieldCheck, Wallet, CheckCircle2, ChevronLeft, Info } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";

export default function PaymentPage() {
  const params = useLocalSearchParams<{
    lot: string;
    slot: string;
    date: string;
    start: string;
    end: string;
    dur: string;
    plate: string;
    pay: string;
    total: string;
    nextDay: string;
    start24: string;
    end24: string;
  }>();
  
  const router = useRouter();

  const [lot, setLot] = useState<any>(null);
  const [slot, setSlot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newReservationId, setNewReservationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (!params.lot || !params.slot) return;
        const [lotRes, slotRes] = await Promise.all([
          supabase.from("parking_lots").select("*").eq("id", params.lot).single(),
          supabase.from("parking_slots").select("*").eq("id", params.slot).single()
        ]);
        setLot(lotRes.data);
        setSlot(slotRes.data);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [params.lot, params.slot]);

  const triggerNotification = async (userId: string, slotLabel: string) => {
    const { error } = await supabase.from("notifications").insert([
      {
        user_id: userId,
        title: "Congratulations! 🎉",
        message: `Reservation confirmed for Slot ${slotLabel}.`,
        type: "reservation",
        read: false
      }
    ]);
    if (error) console.error("Notification trigger failed:", error.message);
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const now = new Date();
      const startTimeISO = now.toISOString();
      const durationHours = parseInt(params.dur || "3");
      const endTimeDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
      const endTimeISO = endTimeDate.toISOString();

      const { data, error } = await supabase.functions.invoke("reserve-slot", {
        body: {
          slot_id: params.slot,
          profile_id: user.id,
          lot_id: params.lot,
          plate_number: params.plate?.toUpperCase(),
          start_time: startTimeISO,
          end_time: endTimeISO,
          duration: durationHours,
          total_amount: parseFloat(params.total || "40"),
          payment_method: params.pay,
          status: "reserved" 
        }
      });

      if (error) throw new Error(error.message);

      const newRes = data.reservation;

      const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
      const refNo = `EZP-${randomChars}`;
      const { error: receiptError } = await supabase
        .from("receipts")
        .insert({
          reservation_id: newRes.id,
          reference_no: refNo,
          amount_paid: parseFloat(params.total || "40"),
          payment_method: params.pay || "Unknown"
        });
      if (receiptError) throw receiptError;

      const { error: updateError } = await supabase
        .from("parking_slots")
        .update({ status: "reserved" })
        .eq("id", params.slot);
      if (updateError) throw updateError;

      await triggerNotification(user.id, slot?.label || "");

      setNewReservationId(newRes.id);
      setIsSuccess(true);

    } catch (err: any) {
      console.error("Reservation error:", err);
      Alert.alert("Error", err.message || "Slot may have been taken. Please try again.");
      setIsProcessing(false);
      router.back();
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-[#0A1D37]">Verifying Payment Details...</Text>
      </SafeAreaView>
    );
  }

  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center px-8">
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-emerald-100 rounded-full items-center justify-center mb-6">
            <CheckCircle2 size={48} color="#059669" />
          </View>
          <Text className="text-2xl font-black text-slate-800 text-center">Payment Received</Text>
          <Text className="text-sm text-slate-500 mt-2 text-center">
            Your reservation for <Text className="font-bold text-slate-800">{params.plate}</Text> is now active.
          </Text>
        </View>

        <View className="w-full bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-8">
           <View className="flex-row justify-between items-center mb-4">
             <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reference No.</Text>
             <Text className="text-sm font-black text-slate-800 uppercase tracking-tight">
               {newReservationId?.slice(0, 8) || "PROCESSING"}
             </Text>
           </View>
           <View className="flex-row justify-between items-center">
             <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Method</Text>
             <Text className="text-sm font-black text-slate-800 uppercase">{params.pay}</Text>
           </View>
        </View>

        <TouchableOpacity 
          onPress={() => {
            // Need to create digital receipt view later. For now, go to reservations.
            router.replace('/(app)/reservations');
          }} 
          className="w-full h-14 rounded-2xl bg-[#0A1D37] items-center justify-center shadow-lg"
        >
          <Text className="font-bold text-white text-base">View Bookings</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isGcash = params.pay === 'gcash';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
          <ChevronLeft size={24} color="#0A1D37" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">Payment</Text>
      </View>

      <View className="flex-1 p-5">
        <View className="items-center py-6">
          <Text className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Total Amount Due</Text>
          <Text className="text-5xl font-black text-[#0A1D37]">₱{params.total}.00</Text>
        </View>

        <View className={`flex-row items-center justify-between p-4 rounded-2xl border-2 mb-6 ${isGcash ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"}`}>
          <View className="flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-xl items-center justify-center ${isGcash ? "bg-blue-600" : "bg-emerald-500"}`}>
              <Text className="text-white font-black text-lg">{isGcash ? "G" : "M"}</Text>
            </View>
            <View>
              <Text className="text-xs font-black uppercase tracking-tight text-slate-800">Paying via {params.pay}</Text>
              <Text className="text-[10px] text-slate-500 font-medium mt-0.5">Secure electronic payment</Text>
            </View>
          </View>
          <ShieldCheck size={24} color={isGcash ? "#2563EB" : "#10B981"} />
        </View>

        <View className="bg-slate-50 rounded-3xl p-5 border border-slate-100 mb-6">
          <Text className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-3 mb-4">Booking Details</Text>
          
          <View className="flex-row flex-wrap">
            <View className="w-1/2 mb-4 pr-2">
              <Text className="text-[9px] font-black text-slate-400 uppercase mb-1">Parking Lot</Text>
              <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>{lot?.name}</Text>
            </View>
            <View className="w-1/2 mb-4 pl-2">
              <Text className="text-[9px] font-black text-slate-400 uppercase mb-1">Slot Label</Text>
              <Text className="text-sm font-black text-blue-600">Slot {slot?.label}</Text>
            </View>
            <View className="w-1/2 pr-2">
              <Text className="text-[9px] font-black text-slate-400 uppercase mb-1">Vehicle Plate</Text>
              <Text className="text-sm font-bold text-slate-800 uppercase">{params.plate}</Text>
            </View>
            <View className="w-1/2 pl-2">
              <Text className="text-[9px] font-black text-slate-400 uppercase mb-1">Schedule</Text>
              <Text className="text-sm font-bold text-slate-800">{params.start} - {params.end}</Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-start gap-2 px-2 opacity-60 mb-8 mt-auto">
           <Info size={16} color="#64748B" className="mt-0.5" />
           <Text className="flex-1 text-[10px] font-medium text-slate-500 leading-relaxed">
             By clicking "Pay Now", you authorize ParKada to deduct ₱{params.total} from your {params.pay} account. This transaction is encrypted and secured.
           </Text>
        </View>

        <TouchableOpacity 
          onPress={handlePayment}
          disabled={isProcessing}
          className={`w-full h-16 rounded-2xl flex-row items-center justify-center shadow-lg mb-4 ${isGcash ? "bg-blue-600" : "bg-emerald-600"}`}
        >
          {isProcessing ? (
            <View className="flex-row items-center gap-3">
              <ActivityIndicator color="white" />
              <Text className="text-white font-black uppercase tracking-widest">Processing...</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Wallet size={20} color="white" />
              <Text className="text-white font-black text-base">Pay Now with {isGcash ? 'GCash' : 'Maya'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
