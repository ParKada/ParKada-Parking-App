import { Text, TouchableOpacity, View } from "react-native";
import { ChevronRight, Clock } from "lucide-react-native";
import ActiveReservationTimer from "./ActiveReservationTimer";
import type { ActiveBooking } from "../lib/types";

interface ActiveBookingCardProps {
  booking: ActiveBooking;
  /** Called when the card body is tapped — opens the receipt. */
  onPress: () => void;
  /** Called after the timer mutates the reservation (extend / pay fine). */
  onUpdate: () => void;
  /** Optional "1 of 2" style marker shown when several bookings are live. */
  positionLabel?: string;
}

/**
 * A single active booking. Each card owns exactly one live countdown, so
 * several bookings can tick side by side inside the home screen pager.
 */
export default function ActiveBookingCard({
  booking,
  onPress,
  onUpdate,
  positionLabel,
}: ActiveBookingCardProps) {
  const endsAt = new Date(booking.end_time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const showVehicleModel =
    !!booking.vehicleModel && booking.vehicleModel !== booking.vehiclePlate;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      className="bg-[#0f2648] rounded-3xl p-5 border border-[#1e3a68] shadow-lg"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-3">
          <Text
            className="font-black text-white text-lg tracking-tight"
            numberOfLines={1}
          >
            {booking.lotName}
          </Text>

          {showVehicleModel && (
            <Text
              className="text-white/60 text-[11px] mt-1 font-medium"
              numberOfLines={1}
            >
              {booking.vehicleModel}
            </Text>
          )}

          <View className="flex-row items-center gap-2 mt-2 flex-wrap">
            <View className="bg-white/10 px-2 py-0.5 rounded-md">
              <Text className="text-white/80 text-[11px] font-bold">
                Slot {booking.slotLabel}
              </Text>
            </View>
            <Text className="text-amber-400 text-[11px] font-black uppercase tracking-wider">
              {booking.vehiclePlate}
            </Text>
          </View>
        </View>

        <View className="items-end gap-1.5">
          <View className="bg-emerald-500/20 px-2 py-1 rounded-md">
            <Text className="text-emerald-400 text-[9px] font-black tracking-widest">
              ACTIVE
            </Text>
          </View>
          {positionLabel && (
            <Text className="text-white/40 text-[9px] font-black uppercase tracking-widest">
              {positionLabel}
            </Text>
          )}
        </View>
      </View>

      <ActiveReservationTimer
        reservation={{ ...booking, slot_label: booking.slotLabel }}
        onUpdate={onUpdate}
      />

      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <Clock size={10} color="rgba(255,255,255,0.4)" />
          <Text className="text-[10px] text-white/50 font-bold uppercase">
            Ends at {endsAt}
          </Text>
        </View>
        <View className="flex-row items-center gap-0.5">
          <Text className="text-[10px] text-white/40 font-bold uppercase">
            View receipt
          </Text>
          <ChevronRight size={11} color="rgba(255,255,255,0.4)" />
        </View>
      </View>
    </TouchableOpacity>
  );
}
