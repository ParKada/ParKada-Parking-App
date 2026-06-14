import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Wallet, CreditCard, ChevronLeft } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";

export default function ExtendPaymentPage() {
  const { extendReservationId, extendAmount, extendHours, extendFee } = useLocalSearchParams<{ 
    extendReservationId: string, 
    extendAmount: string, 
    extendHours: string, 
    extendFee: string 
  }>();
  const router = useRouter();

  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'maya'>('gcash');
  const [success, setSuccess] = useState(false);

  if (!extendReservationId || !extendAmount || !extendHours) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
            <ChevronLeft size={24} color="#0A1D37" />
          </TouchableOpacity>
          <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">Error</Text>
        </View>
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-red-500 font-bold text-center">Invalid extension request. Please go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handlePayment = async () => {
    setProcessing(true);
    
    setTimeout(async () => {
      try {
        const additionalHours = parseInt(extendHours || '0');
        const additionalAmount = parseFloat(extendAmount || '0');
        const fee = parseFloat(extendFee || '0');

        const { data: reservation, error: fetchError } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', extendReservationId)
          .single();
          
        if (fetchError) throw fetchError;

        const newEnd = new Date(reservation.end_time);
        newEnd.setHours(newEnd.getHours() + additionalHours);

        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            end_time: newEnd.toISOString(),
            duration: reservation.duration + additionalHours,
            extension_count: (reservation.extension_count || 0) + 1,
            extension_fee: (reservation.extension_fee || 0) + fee,
            total_amount: reservation.total_amount + additionalAmount
          })
          .eq('id', extendReservationId);

        if (updateError) throw updateError;

        setSuccess(true);
      } catch (err: any) {
        console.error(err);
        Alert.alert("Payment Failed", err.message);
        setProcessing(false);
      }
    }, 1500);
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center px-6">
        <View className="items-center">
          <View className="w-24 h-24 bg-emerald-100 rounded-full items-center justify-center mb-6">
            <CheckCircle2 size={48} color="#059669" />
          </View>
          <Text className="text-2xl font-black text-[#0A1D37] mb-2 text-center">Extension Successful!</Text>
          <Text className="text-sm text-slate-500 mb-8 text-center">Your parking session has been extended.</Text>
          
          <TouchableOpacity 
            onPress={() => router.replace('/(app)')} 
            className="w-full h-14 bg-[#0A1D37] rounded-2xl items-center justify-center shadow-lg"
          >
            <Text className="font-bold text-white text-base">Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isGcash = paymentMethod === 'gcash';

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
          <ChevronLeft size={24} color="#0A1D37" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">Extension Payment</Text>
      </View>

      <View className="flex-1 p-5">
        
        <View className="bg-white rounded-3xl p-8 items-center shadow-sm border border-slate-100 mb-6">
          <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Additional Payment</Text>
          <Text className="text-5xl font-black text-[#0A1D37] mb-2">₱{extendAmount}</Text>
          <Text className="text-xs font-bold text-slate-400">for {extendHours} hour(s) extension</Text>
        </View>

        <View className="bg-white rounded-2xl p-5 border border-slate-100 mb-6">
          <View className="flex-row items-center gap-1.5 mb-4 px-1">
            <CreditCard size={14} color="#64748B" />
            <Text className="text-[11px] font-black uppercase text-slate-500 tracking-wide">Payment Method</Text>
          </View>
          
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setPaymentMethod('gcash')}
              className={`flex-1 h-14 rounded-2xl border-2 flex-row items-center justify-center gap-2 ${isGcash ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}
            >
              <View className="w-6 h-6 bg-blue-600 rounded-lg items-center justify-center">
                <Text className="text-white font-black text-xs">G</Text>
              </View>
              <Text className={`font-bold ${isGcash ? "text-blue-600" : "text-slate-600"}`}>GCash</Text>
              {isGcash && <CheckCircle2 size={16} color="#2563EB" className="absolute right-3" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentMethod('maya')}
              className={`flex-1 h-14 rounded-2xl border-2 flex-row items-center justify-center gap-2 ${!isGcash ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}
            >
              <View className="w-6 h-6 bg-emerald-500 rounded-lg items-center justify-center">
                <Text className="text-white font-black text-xs">M</Text>
              </View>
              <Text className={`font-bold ${!isGcash ? "text-emerald-600" : "text-slate-600"}`}>Maya</Text>
              {!isGcash && <CheckCircle2 size={16} color="#10B981" className="absolute right-3" />}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={handlePayment}
          disabled={processing}
          className={`w-full h-16 rounded-2xl shadow-lg mt-auto mb-4 flex-row items-center justify-center ${isGcash ? "bg-blue-600" : "bg-emerald-600"}`}
        >
          {processing ? (
            <View className="flex-row items-center gap-3">
              <ActivityIndicator color="white" />
              <Text className="font-black text-white uppercase tracking-widest">Processing...</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Wallet size={20} color="white" />
              <Text className="font-black text-white text-base">Pay ₱{extendAmount} with {isGcash ? 'GCash' : 'Maya'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text className="text-center text-[10px] font-medium text-slate-400 mb-4 px-4">
          By continuing, you agree to pay the extension fee. No refunds.
        </Text>
      </View>
    </SafeAreaView>
  );
}
