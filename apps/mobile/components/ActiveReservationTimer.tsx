import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, X, ChevronRight } from 'lucide-react-native';
import { supabase } from "../lib/supabase";

interface ActiveReservationTimerProps {
  reservation: {
    id: string;
    user_id: string;
    lot_id: string;
    end_time: string;
    start_time: string;
    duration: number;
    extension_count: number;
    extension_fee: number;
    fine_amount: number;
    fine_paid: boolean;
    hourly_rate: number;
    extension_rate_per_hour?: number;
    extension_fee_setting: number;
    fine_penalty: number;
    overtime_rate: number;
    grace_period_minutes: number;
    allow_extensions: boolean;
    total_amount: number;
  };
  onUpdate: () => void;
}

export default function ActiveReservationTimer({ reservation, onUpdate }: ActiveReservationTimerProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extending, setExtending] = useState(false);
  const [fineAmount, setFineAmount] = useState(0);
  const [gracePeriodEnd, setGracePeriodEnd] = useState<Date | null>(null);
  const [settings, setSettings] = useState({
    extension_fee: 10,
    fine_penalty: 50,
    overtime_rate: 30,
    grace_period_minutes: 15,
    allow_extensions: true
  });

  const extensionRate = reservation.extension_rate_per_hour ?? reservation.hourly_rate ?? 30;
  const progress = calculateProgress();

  function calculateProgress() {
    const start = new Date(reservation.start_time).getTime();
    const end = new Date(reservation.end_time).getTime();
    const now = new Date().getTime();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return ((now - start) / (end - start)) * 100;
  }

  useEffect(() => {
    const fetchSettings = async () => {
      if (!reservation.lot_id) return;
      const { data } = await supabase
        .from('parking_lots')
        .select('extension_fee, fine_penalty, overtime_rate, grace_period_minutes, allow_extensions')
        .eq('id', reservation.lot_id)
        .single();
      if (data) setSettings(prev => ({ ...prev, ...data }));
    };
    fetchSettings();
  }, [reservation.lot_id]);

  useEffect(() => {
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [reservation.end_time, settings]);

  const updateTimer = () => {
    const now = new Date();
    const end = new Date(reservation.end_time);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      const graceEnd = new Date(end.getTime() + settings.grace_period_minutes * 60 * 1000);
      if (!gracePeriodEnd) setGracePeriodEnd(graceEnd);

      if (now >= graceEnd && !reservation.fine_paid) {
        const overtimeMinutes = Math.floor((now.getTime() - graceEnd.getTime()) / (1000 * 60));
        const overtimeHours = Math.ceil(overtimeMinutes / 60);
        const fine = settings.fine_penalty + (overtimeHours * settings.overtime_rate);
        setFineAmount(fine);
        setIsOvertime(true);
        setTimeLeft(`Overtime: ${overtimeMinutes} min`);
      } else {
        setTimeLeft('Session ended');
      }
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

    if (diff < 30 * 60 * 1000 && !isExpiringSoon) {
      setIsExpiringSoon(true);
      sendExpiringNotification();
    }
  };

  const sendExpiringNotification = async () => {
    await supabase.from('notifications').insert({
      user_id: reservation.user_id,
      title: 'Parking Session Expiring Soon',
      message: `Your parking ends in 30 minutes. Extend now to avoid penalty.`,
      type: 'expiring_soon'
    });
  };

  const handleExtendClick = (additionalHours: number) => {
    const rate = extensionRate ?? 30;
    const fee = settings.extension_fee ?? 0;
    const additionalAmount = (extensionRate * additionalHours) + fee;

    setShowExtendModal(false);
    
    // We pass data via params to the extension screen
    router.push({
      pathname: '/(app)/payment/extension',
      params: {
        extendReservationId: reservation.id,
        extendHours: additionalHours,
        extendAmount: additionalAmount,
        extendRate: rate,
        extendFee: fee
      }
    });
  };

  const handlePayFine = async () => {
    const { error } = await supabase
      .from('reservations')
      .update({
        fine_amount: fineAmount,
        fine_paid: true,
        status: 'completed'
      })
      .eq('id', reservation.id);
    if (!error && onUpdate) onUpdate();
  };

  return (
    <View className="mt-3 relative">
      <View className={`rounded-2xl p-5 border ${
        isOvertime ? "bg-rose-950 border-rose-500/50" :
        isExpiringSoon ? "bg-[#3A2208] border-amber-500/50" :
        "bg-slate-800 border-white/20"
      }`}>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-1.5">
            <Clock size={14} color={isOvertime ? "#fb7185" : isExpiringSoon ? "#fbbf24" : "#94a3b8"} />
            <Text className={`text-[10px] font-bold uppercase tracking-widest ${
              isOvertime ? "text-rose-400" : isExpiringSoon ? "text-amber-400" : "text-slate-400"
            }`}>
              {isOvertime ? "OVERTIME" : isExpiringSoon ? "ENDING SOON" : "TIME REMAINING"}
            </Text>
          </View>
          {!isOvertime && !isExpiringSoon && (
            <Text className="text-[10px] font-bold text-slate-500">{Math.floor(progress)}%</Text>
          )}
        </View>

        <View className="items-center justify-center mb-3">
          <Text className={`text-4xl font-black tracking-tight ${
            isOvertime ? "text-rose-400" : isExpiringSoon ? "text-amber-400" : "text-white"
          }`}>
            {timeLeft}
          </Text>
        </View>

        {!isOvertime && (
          <View className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
            <View 
              className={`h-full rounded-full ${isExpiringSoon ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </View>
        )}

        {isExpiringSoon && !isOvertime && settings.allow_extensions && (
          <TouchableOpacity
            onPress={() => setShowExtendModal(true)}
            className="w-full h-12 bg-amber-500 rounded-xl items-center justify-center shadow-lg mt-2"
          >
            <Text className="text-white font-bold text-sm tracking-wider">Extend Session</Text>
          </TouchableOpacity>
        )}

        {isOvertime && !reservation.fine_paid && (
          <View className="mt-2 bg-rose-500/20 border border-rose-500/50 rounded-xl p-4 items-center">
            <Text className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">Overtime Penalty</Text>
            <Text className="text-2xl font-black text-rose-400 mt-1 mb-3">₱{fineAmount}</Text>
            <TouchableOpacity
              onPress={handlePayFine}
              className="w-full h-10 bg-rose-600 rounded-lg items-center justify-center"
            >
              <Text className="text-white font-bold text-xs tracking-wider">Pay Fine</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={showExtendModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 items-center justify-center px-4">
          <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <View className="flex-row justify-between items-center px-5 py-4 border-b border-slate-100">
              <Text className="font-black text-lg text-slate-900">Extend Parking</Text>
              <TouchableOpacity onPress={() => setShowExtendModal(false)} className="p-2 bg-slate-100 rounded-full">
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="p-6">
              <View className="bg-blue-50 rounded-2xl p-4 items-center mb-6">
                <Text className="text-[10px] font-bold uppercase text-blue-600 tracking-widest mb-1">Extension Rate</Text>
                <Text className="text-2xl font-black text-blue-700">₱{extensionRate}<Text className="text-sm font-normal">/hour</Text></Text>
                {settings.extension_fee > 0 && (
                  <Text className="text-xs font-semibold text-blue-500 mt-1">+ ₱{settings.extension_fee} fixed fee</Text>
                )}
              </View>

              <View className="space-y-3 flex-col gap-3">
                {[1, 2, 3].map(h => {
                  const total = (extensionRate * h) + settings.extension_fee;
                  return (
                    <TouchableOpacity
                      key={h}
                      onPress={() => handleExtendClick(h)}
                      disabled={extending}
                      className="w-full flex-row items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                          <Text className="text-blue-600 font-bold text-base">{h}</Text>
                        </View>
                        <Text className="font-bold text-slate-800 text-base">{h} hour{h !== 1 ? 's' : ''}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-lg font-black text-blue-600">+₱{total}</Text>
                        <ChevronRight size={20} color="#CBD5E1" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
