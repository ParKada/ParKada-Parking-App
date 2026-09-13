import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, Check, Clock, Ticket, AlertCircle, Accessibility, Play, Timer, Car, Calendar, CreditCard, ChevronLeft } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { useVerification } from "../../../hooks/useVerification";

// PWD/Senior discount applied to verified accounts. Verification no longer
// gates access to reservations at all — it now exclusively controls
// discount eligibility on the final fee.
const VERIFIED_DISCOUNT_RATE = 0.20;

const getLotClosingTime24 = (openHours: string) => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return "23:59";
  const parts = openHours.split("-");
  if (parts.length === 2) {
    let closeStr = parts[1].trim().toUpperCase();
    let isPM = closeStr.includes("PM");
    let isAM = closeStr.includes("AM");
    let timePart = closeStr.replace("PM", "").replace("AM", "").trim();
    let [h, m] = timePart.split(":").map(Number);
    if (isNaN(h)) return "23:59";
    if (isNaN(m)) m = 0;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return "23:59";
};

const getRemainingMinutesUntilClose = (openHours: string): number => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return 24 * 60;
  const parts = openHours.split("-");
  if (parts.length !== 2) return 0;
  let startStr = parts[0].trim().toUpperCase();
  let startIsPM = startStr.includes("PM");
  let startIsAM = startStr.includes("AM");
  let startTimePart = startStr.replace("PM", "").replace("AM", "").trim();
  let [startH, startM] = startTimePart.split(":").map(Number);
  if (isNaN(startH)) return 0;
  if (isNaN(startM)) startM = 0;
  if (startIsPM && startH !== 12) startH += 12;
  if (startIsAM && startH === 12) startH = 0;
  const startMinutes = startH * 60 + startM;

  let endStr = parts[1].trim().toUpperCase();
  let endIsPM = endStr.includes("PM");
  let endIsAM = endStr.includes("AM");
  let endTimePart = endStr.replace("PM", "").replace("AM", "").trim();
  let [endH, endM] = endTimePart.split(":").map(Number);
  if (isNaN(endH)) return 0;
  if (isNaN(endM)) endM = 0;
  if (endIsPM && endH !== 12) endH += 12;
  if (endIsAM && endH === 12) endH = 0;
  let endMinutes = endH * 60 + endM;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const isNextDay = endMinutes < startMinutes;
  if (isNextDay) {
    if (currentMinutes < startMinutes) return 0;
    const endTomorrow = endMinutes + 24 * 60;
    return endTomorrow - currentMinutes;
  } else {
    if (currentMinutes < startMinutes) return 0;
    if (currentMinutes >= endMinutes) return 0;
    return endMinutes - currentMinutes;
  }
};

const getMaxDuration = (openHours: string): number => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return 6;
  const remainingMins = getRemainingMinutesUntilClose(openHours);
  const remainingHours = Math.floor(remainingMins / 60);
  const MAX_DURATION = 6;
  if (remainingMins <= 60) return 0;
  return Math.min(remainingHours - 1, MAX_DURATION);
};

const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export default function ReservationPage() {
  const { id: slotId, lot: lotId } = useLocalSearchParams<{ id: string, lot: string }>();
  const router = useRouter();

  const [lot, setLot] = useState<any>(null);
  const [slot, setSlot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeReservation, setActiveReservation] = useState<any>(null); 
  const [userActiveBooking, setUserActiveBooking] = useState<any>(null); 

  const [plateNumber, setPlateNumber] = useState("");
  const [duration, setDuration] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState<"gcash" | "maya">("gcash");

  const [userVehicles, setUserVehicles] = useState<any[]>([]);
  const [activePlates, setActivePlates] = useState<string[]>([]);
  
  // `isVerified` is now used ONLY to decide PWD/Senior discount eligibility.
  // It no longer gates whether a user can make a reservation at all.
  const { isVerified, verificationStatus, isLoading: verificationLoading, userId } = useVerification();

  const getCurrentTime24 = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const startTime = getCurrentTime24();
  const maxDuration = lot ? getMaxDuration(lot.open_hours) : 6;
  const remainingMins = lot ? getRemainingMinutesUntilClose(lot.open_hours) : 360;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!lotId || !slotId) return;
        const [lotRes, slotRes] = await Promise.all([
          supabase.from("parking_lots").select("*").eq("id", lotId).single(),
          supabase.from("parking_slots").select("*").eq("id", slotId).single(),
        ]);
        setLot(lotRes.data);
        setSlot(slotRes.data);

        const { data: slotResData } = await supabase.from("reservations").select("*").in("status", ["active", "booked", "reserved"]).eq("slot_id", slotId).limit(1); 
        if (slotResData && slotResData.length > 0) setActiveReservation(slotResData[0]);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Columns on `vehicles` are: plate_number, vehicle_type, brand, color
          // (there is no `plate` or `model` column — using those silently
          // returned undefined, which is why vehicles rendered blank/unreadable).
          const { data: vehiclesData } = await supabase.from("vehicles").select("*").eq("profile_id", user.id).eq("is_active", true);
          setUserVehicles(vehiclesData || []);

          const { data: activeResData } = await supabase.from("reservations").select("*").in("status", ["active", "booked", "reserved"]).eq("profile_id", user.id);
          if (activeResData && activeResData.length > 0) {
            setActivePlates(activeResData.map(res => res.plate_number));
            setUserActiveBooking(activeResData[0]); 
          }
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [lotId, slotId]);

  useEffect(() => {
    if (duration > maxDuration && maxDuration > 0) setDuration(maxDuration);
  }, [maxDuration, duration]);

  const calculateEndTime24 = (start: string, dur: number) => {
    if (!start) return "";
    const [hours, minutes] = start.split(":").map(Number);
    const endHours = (hours + dur) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const format12Hour = (time24: string) => {
    if (!time24) return "--:--";
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const endTime24 = calculateEndTime24(startTime, duration);
  const startTimeFormatted = format12Hour(startTime);
  const endTimeFormatted = format12Hour(endTime24);

  let subtotal = 0;
  let baseRateDisplay = 0;
  let extendedFee = 0;

  if (lot) {
    if (lot.pricing_scheme === 'fixed') {
      subtotal = Number(lot.fixed_rate) || 150;
      baseRateDisplay = Number(lot.fixed_rate) || 150;
    } else {
      baseRateDisplay = Number(lot.base_rate) || 50;
      const hourlyRate = Number(lot.rate_per_hour) || 20;
      extendedFee = duration > 3 ? (duration - 3) * hourlyRate : 0;
      subtotal = baseRateDisplay + extendedFee;
    }
  }

  // Discount is derived strictly from verification status now — it has no
  // bearing on whether the reservation itself is allowed.
  const discountAmount = isVerified ? Math.round(subtotal * VERIFIED_DISCOUNT_RATE) : 0;
  const totalCost = subtotal - discountAmount;
  
  const isExceedingCloseTime = () => {
    if (!lot?.open_hours || lot.open_hours.toLowerCase().includes("24 hours")) return false;
    const remaining = getRemainingMinutesUntilClose(lot.open_hours);
    return remaining < duration * 60;
  };

  const availableVehicles = userVehicles.filter(v => !activePlates.includes(v.plate_number));
  const hasNoRegisteredVehicles = userVehicles.length === 0;
  const isParkingClosed = remainingMins <= 0;
  const isBookingCutoff = remainingMins > 0 && remainingMins <= 60;

  // Walk-in-only is a property of the SLOT itself (PWD bays, the fixed
  // "C1" walk-in slot, or slots explicitly marked non-reservable) — it is
  // unrelated to the booking user's verification status.
  const isWalkInOnly = slot?.label === "C1" || slot?.is_reservable === false || String(slot?.is_reservable) === "false";

  // Reservation eligibility now depends only on: no conflicting active
  // reservation, having at least one available (registered, not already
  // in use) vehicle, the slot being reservable, and the lot being open.
  // Verification is intentionally excluded from this check.
  const isBlocked = activeReservation !== null || availableVehicles.length === 0 || isWalkInOnly || isParkingClosed || isBookingCutoff || isExceedingCloseTime();
  const isMyBooking = activeReservation?.profile_id === userId;

  const handleProceed = () => {
    if (isParkingClosed) return Alert.alert("Closed", "Parking lot is currently closed. Please check operating hours.");
    if (isBookingCutoff) return Alert.alert("Cutoff", "Hindi na tumatanggap ng reservations 1 hour bago mag-close.");
    if (isWalkInOnly) return Alert.alert("Walk-in Only", (slot?.slot_type === 'pwd') ? "Ang PWD slot ay para sa walk-in lamang." : "Ang slot na ito ay para sa mga walk-in customers lamang.");
    if (hasNoRegisteredVehicles) return Alert.alert("Vehicle Required", "Please register a vehicle to your account before making a reservation.");
    if (isBlocked) return Alert.alert("Blocked", "Hindi ka pwedeng mag-proceed dahil may active booking ka pa.");
    if (isExceedingCloseTime()) return Alert.alert("Exceeds Time", "Exceeds operating hours.");
    if (!plateNumber) return Alert.alert("Vehicle Required", "Please select a vehicle.");
    
    const [endH] = endTime24.split(":").map(Number);
    const [selH] = startTime.split(":").map(Number);
    const isNextDay = endH < selH ? "true" : "false";
    const formattedDate = new Date().toISOString().split('T')[0];
    
    router.push({
      pathname: '/(app)/payment',
      params: {
        lot: lotId,
        slot: slotId,
        date: formattedDate,
        start: startTimeFormatted,
        end: endTimeFormatted,
        dur: duration,
        plate: plateNumber,
        pay: paymentMethod,
        subtotal: subtotal,
        discount: discountAmount,
        total: totalCost,
        verifiedDiscountApplied: isVerified ? "true" : "false",
        nextDay: isNextDay,
        start24: startTime,
        end24: endTime24
      }
    });
  };

  if (loading || verificationLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 text-slate-500 font-bold">Loading details...</Text>
      </SafeAreaView>
    );
  }

  const durationOptions = [1, 2, 3, 4, 5, 6].filter(h => h <= maxDuration);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full">
          <ChevronLeft size={24} color="#0A1D37" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-lg text-[#0A1D37] mr-6">Reservation</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 pb-10 space-y-4">
          
          {/* Verified Badge — now communicates discount, not unlocked access */}
          {isVerified && (
            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex-row items-center gap-2 mb-4 shadow-sm">
              <View className="w-6 h-6 bg-emerald-500 rounded-full items-center justify-center">
                <Check size={14} color="white" strokeWidth={3} />
              </View>
              <Text className="text-xs font-bold text-emerald-800">Verified • {Math.round(VERIFIED_DISCOUNT_RATE * 100)}% PWD/Senior Discount Applied</Text>
            </View>
          )}

          {/* Slot Info Card */}
          <View className={`rounded-3xl p-5 shadow-lg ${isBlocked ? "bg-slate-400" : "bg-[#0A1D37]"} mb-4`}>
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="opacity-70 text-[10px] font-bold uppercase tracking-widest text-white">{lot?.name}</Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <Text className="text-3xl font-black text-white">Slot {slot?.label}</Text>
                  {slot?.slot_type === 'pwd' && <Accessibility size={24} color="white" style={{ opacity: 0.8 }} />}
                </View>
                <View className="flex-row items-center gap-1.5 mt-2 opacity-80">
                  <Clock size={12} color="white" />
                  <Text className="text-[10px] text-white">{lot?.open_hours}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-bold opacity-70 uppercase text-white">
                  {lot?.pricing_scheme === 'fixed' ? 'Fixed (Whole Day)' : 'Base (3h)'}
                </Text>
                <Text className="text-base font-bold text-white">₱{baseRateDisplay}</Text>
                {lot?.pricing_scheme !== 'fixed' && extendedFee > 0 && (
                  <View className="items-end mt-1">
                    <Text className="text-[10px] font-bold text-amber-200 uppercase">Extra</Text>
                    <Text className="text-sm font-bold text-amber-200">+₱{extendedFee}</Text>
                  </View>
                )}
                {isVerified && discountAmount > 0 && (
                  <View className="items-end mt-1">
                    <Text className="text-[10px] font-bold text-emerald-300 uppercase">PWD/Senior Discount</Text>
                    <Text className="text-sm font-bold text-emerald-300">-₱{discountAmount}</Text>
                  </View>
                )}
                <View className="mt-2 border-t border-white/20 pt-2 items-end">
                  <Text className="text-[10px] font-bold opacity-70 uppercase text-white">Total</Text>
                  <Text className="text-2xl font-black text-white">₱{isParkingClosed || isWalkInOnly || isBookingCutoff ? "--" : totalCost}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Select Vehicle */}
          <View className={`mb-4 ${isBlocked ? "opacity-50" : ""}`}>
            <View className="flex-row items-center gap-1.5 mb-2 px-1">
              <Car size={14} color="#64748b" />
              <Text className="text-[11px] font-black uppercase text-slate-500">Select Vehicle</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {availableVehicles.map(v => (
                <TouchableOpacity
                  key={v.id}
                  disabled={isBlocked}
                  onPress={() => setPlateNumber(v.plate_number)}
                  className={`mr-3 p-3 rounded-2xl border-2 w-32 ${plateNumber === v.plate_number ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`font-black text-base ${plateNumber === v.plate_number ? 'text-blue-700' : 'text-slate-700'}`}>{v.plate_number}</Text>
                  <Text className={`text-[10px] mt-1 ${plateNumber === v.plate_number ? 'text-blue-600' : 'text-slate-400'}`} numberOfLines={1}>
                    {[v.brand, v.color].filter(Boolean).join(" · ") || v.vehicle_type || ""}
                  </Text>
                </TouchableOpacity>
              ))}
              {availableVehicles.length === 0 && (
                <View className="p-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 w-full">
                  <Text className="text-slate-400 font-bold text-center text-xs">
                    {hasNoRegisteredVehicles ? "No registered vehicles — add one in your profile to book" : "No available vehicles"}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Select Duration */}
          <View className={`mb-4 ${isBlocked ? "opacity-50" : ""}`}>
            <View className="flex-row items-center gap-1.5 mb-2 px-1">
              <Timer size={14} color="#64748b" />
              <Text className="text-[11px] font-black uppercase text-slate-500">Duration</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {durationOptions.map(h => (
                <TouchableOpacity
                  key={h}
                  disabled={isBlocked}
                  onPress={() => setDuration(h)}
                  className={`mr-3 p-3 items-center justify-center rounded-2xl border-2 w-20 ${duration === h ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`font-black text-xl ${duration === h ? 'text-blue-700' : 'text-slate-700'}`}>{h}</Text>
                  <Text className={`text-[10px] font-bold uppercase mt-1 ${duration === h ? 'text-blue-600' : 'text-slate-400'}`}>Hour{h > 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Time Range */}
          <View className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 ${isBlocked ? "opacity-50" : ""}`}>
            <View className="flex-row items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
              <View className="items-center flex-1">
                <Text className="text-[10px] font-bold uppercase text-slate-400 mb-1">Start</Text>
                <Text className="text-xl font-black text-emerald-600">{startTimeFormatted}</Text>
                <View className="flex-row items-center mt-1">
                  <Play size={10} color="#059669" />
                  <Text className="text-[9px] text-emerald-600 font-bold ml-1 uppercase">Now</Text>
                </View>
              </View>
              
              <View className="w-10 h-0.5 bg-slate-300 rounded-full mx-2" />
              
              <View className="items-center flex-1">
                <Text className="text-[10px] font-bold uppercase text-slate-400 mb-1">End</Text>
                <Text className="text-xl font-black text-slate-800">{endTimeFormatted}</Text>
                <Text className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Estimated</Text>
              </View>
            </View>
          </View>

          {/* Price Breakdown */}
          <View className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 ${isBlocked ? "opacity-50" : ""}`}>
            <View className="flex-row items-center gap-1.5 mb-3 px-1">
              <Ticket size={14} color="#64748b" />
              <Text className="text-[11px] font-black uppercase text-slate-500">Price Breakdown</Text>
            </View>
            <View className="space-y-2">
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-medium text-slate-500">Subtotal</Text>
                <Text className="text-sm font-bold text-slate-700">₱{subtotal}</Text>
              </View>
              {isVerified && discountAmount > 0 && (
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm font-medium text-emerald-600">PWD/Senior Discount ({Math.round(VERIFIED_DISCOUNT_RATE * 100)}%)</Text>
                  <Text className="text-sm font-bold text-emerald-600">-₱{discountAmount}</Text>
                </View>
              )}
              <View className="h-px bg-slate-100 w-full my-1" />
              <View className="flex-row justify-between items-center">
                <Text className="text-base font-black text-slate-800">Total</Text>
                <Text className="text-base font-black text-slate-800">₱{totalCost}</Text>
              </View>
            </View>
          </View>

          {/* Payment Method — available to all users, not just verified ones */}
          <View className={`mb-6 ${isBlocked ? "opacity-50" : ""}`}>
            <View className="flex-row items-center gap-1.5 mb-2 px-1">
              <CreditCard size={14} color="#64748b" />
              <Text className="text-[11px] font-black uppercase text-slate-500">Payment Method</Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity disabled={isBlocked} onPress={() => setPaymentMethod("gcash")} className={`flex-1 h-14 rounded-2xl border-2 flex-row items-center justify-center gap-2 ${paymentMethod === "gcash" ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}>
                <View className="w-6 h-6 bg-blue-600 rounded-lg items-center justify-center"><Text className="text-white font-black text-xs">G</Text></View>
                <Text className="font-bold text-blue-600">GCash</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={isBlocked} onPress={() => setPaymentMethod("maya")} className={`flex-1 h-14 rounded-2xl border-2 flex-row items-center justify-center gap-2 ${paymentMethod === "maya" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <View className="w-6 h-6 bg-emerald-500 rounded-lg items-center justify-center"><Text className="text-white font-black text-xs">M</Text></View>
                <Text className="font-bold text-emerald-600">Maya</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Button — verification is no longer part of the gate */}
          <TouchableOpacity 
            onPress={handleProceed} 
            disabled={isBlocked || !plateNumber || isExceedingCloseTime() || isParkingClosed || isBookingCutoff} 
            className={`w-full h-16 rounded-2xl items-center justify-center shadow-lg mb-6 ${
              isBlocked || !plateNumber || isExceedingCloseTime() || isParkingClosed || isBookingCutoff
                ? "bg-slate-300" 
                : "bg-[#0A1D37]"
            }`}
          >
            <Text className={`text-base font-black ${isBlocked || !plateNumber || isExceedingCloseTime() || isParkingClosed || isBookingCutoff ? "text-slate-500" : "text-white"}`}>
              {isParkingClosed ? "Parking Currently Closed" : 
               isBookingCutoff ? "Booking Cutoff Reached" : 
               isWalkInOnly ? "Walk-in Only Slot" : 
               hasNoRegisteredVehicles ? "Register a Vehicle to Book" :
               isBlocked ? "Action Not Allowed" : 
               isExceedingCloseTime() ? "Exceeds Closing Time" : 
               !plateNumber ? "Select a Vehicle" : 
               `Pay ₱${totalCost} to Reserve Now`}
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}