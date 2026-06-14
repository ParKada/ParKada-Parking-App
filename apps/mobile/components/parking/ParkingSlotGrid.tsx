import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Car, X, Accessibility } from "lucide-react-native";

interface ParkingSlot {
  id: string;
  label: string;
  status?: string;
  row?: string;
  [key: string]: any;
}

interface ParkingSlotGridProps {
  slots: ParkingSlot[];
  selectedSlot?: string;
  onSelectSlot?: (slot: ParkingSlot) => void;
  interactive?: boolean;
  isAdmin?: boolean;
}

const statusConfig = {
  available: {
    bg: "bg-emerald-50 border-emerald-500",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  occupied: {
    bg: "bg-rose-50 border-rose-500 opacity-80",
    text: "text-rose-700",
    dot: "bg-rose-500",
  },
  reserved: {
    bg: "bg-amber-50 border-amber-500 opacity-80",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  unmapped: {
    bg: "bg-slate-100 border-slate-400 border-dashed opacity-60",
    text: "text-slate-500",
    dot: "bg-slate-400",
  },
};

export default function ParkingSlotGrid({
  slots,
  selectedSlot,
  onSelectSlot,
  interactive = true,
  isAdmin = false,
}: ParkingSlotGridProps) {
  const visibleSlots = isAdmin
    ? slots
    : slots.filter(s => {
        const status = s.status === "NULL / NOT DRAWN" || !s.status ? "unmapped" : s.status;
        return status !== "unmapped";
      });

  const totalSlots = visibleSlots.length;
  const availableSlots = visibleSlots.filter(s => s.status === "available").length;
  const occupiedSlots = visibleSlots.filter(s => s.status === "occupied").length;
  const reservedSlots = visibleSlots.filter(s => s.status === "reserved").length;
  const pwdSlots = visibleSlots.filter(s => s.is_pwd === true || String(s.is_pwd) === "true").length;

  const rows = visibleSlots.reduce<Record<string, ParkingSlot[]>>((acc, slot) => {
    const row = slot.row || (slot.label ? slot.label.charAt(0).toUpperCase() : "A");
    if (!acc[row]) acc[row] = [];
    acc[row].push(slot);
    return acc;
  }, {});

  return (
    <View className="space-y-4 w-full">
      {/* Legend */}
      <View className="w-full mb-4">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Legend</Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          <View className="flex-row items-center gap-2 w-[45%]">
            <View className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <Text className="text-xs font-bold text-slate-800">Available</Text>
          </View>
          <View className="flex-row items-center gap-2 w-[45%]">
            <View className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <Text className="text-xs font-bold text-slate-800">Occupied</Text>
          </View>
          <View className="flex-row items-center gap-2 w-[45%]">
            <View className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <Text className="text-xs font-bold text-slate-800">Reserved</Text>
          </View>
          <View className="flex-row items-center gap-2 w-[45%]">
            <Accessibility size={12} color="#2563EB" />
            <Text className="text-xs font-bold text-blue-600">PWD</Text>
          </View>
          <View className="flex-row items-center gap-2 w-[45%] mt-1">
            <View className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-600" />
            <Text className="text-xs font-bold text-slate-800">Selected</Text>
          </View>
          {isAdmin && (
            <View className="flex-row items-center gap-2 w-[45%] mt-1">
              <View className="w-2.5 h-2.5 rounded-sm bg-slate-400 border border-dashed border-slate-400" />
              <Text className="text-xs font-bold text-slate-500">Unmapped</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Summary */}
      <View className="bg-white border border-slate-200 rounded-xl py-3 mb-4 flex-row shadow-sm">
        <View className="flex-1 items-center border-r border-slate-100">
          <Text className="text-sm font-black text-slate-900">{totalSlots}</Text>
          <Text className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mt-0.5">Total</Text>
        </View>
        <View className="flex-1 items-center border-r border-slate-100">
          <Text className="text-sm font-black text-emerald-600">{availableSlots}</Text>
          <Text className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mt-0.5">Avail</Text>
        </View>
        <View className="flex-1 items-center border-r border-slate-100">
          <Text className="text-sm font-black text-rose-600">{occupiedSlots}</Text>
          <Text className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mt-0.5">Occ</Text>
        </View>
        <View className="flex-1 items-center border-r border-slate-100">
          <Text className="text-sm font-black text-amber-500">{reservedSlots}</Text>
          <Text className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mt-0.5">Res</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-sm font-black text-blue-600">{pwdSlots}</Text>
          <Text className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mt-0.5">PWD</Text>
        </View>
      </View>

      {/* Slot Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
        <View className="pb-4">
          <View className="items-center justify-center h-6 bg-slate-100 rounded-md mt-2 mb-4 relative flex-row mx-4">
            <View className="flex-row gap-2">
              {Array.from({ length: 8 }).map((_, i) => <View key={i} className="w-6 h-0.5 bg-slate-300" />)}
            </View>
            <View className="absolute bg-slate-100 px-2">
              <Text className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Driving Lane</Text>
            </View>
          </View>

          <View className="flex-col gap-3 ml-2 pr-4">
            {Object.entries(rows).map(([row, rowSlots]) => (
              <View key={row} className="flex-row items-center">
                <Text className="text-sm font-black text-slate-900 w-6 mr-2 text-center">{row}</Text>
                <View className="flex-row gap-2">
                  {rowSlots.map(slot => {
                    const isWalkIn = slot.label === "C1" || slot.is_reservable === false || String(slot.is_reservable) === "false";
                    const isPwd = slot.is_pwd === true || String(slot.is_pwd) === "true";
                    const normalizedStatus = slot.status === "NULL / NOT DRAWN" || !slot.status ? "unmapped" : slot.status;
                    const config = statusConfig[normalizedStatus as keyof typeof statusConfig] || statusConfig.unmapped;
                    const isSelected = selectedSlot === slot.id;
                    const canSelect = interactive && slot.status === "available";

                    return (
                      <TouchableOpacity
                        key={slot.id}
                        onPress={() => {
                          if (isWalkIn) Alert.alert("Walk-in Only", `Slot ${slot.label} is for walk-in parking only.`);
                          if (canSelect) onSelectSlot?.(slot);
                        }}
                        disabled={!canSelect}
                        activeOpacity={0.7}
                        className={`w-12 h-14 rounded-xl border-2 items-center justify-center transition-all ${
                          isSelected ? "bg-blue-50 border-blue-600 scale-105" : config.bg
                        }`}
                      >
                        <View className="h-4 items-center justify-center mb-0.5">
                          {slot.physical_status === "occupied" ? (
                            <Car size={16} color={isSelected ? "#2563EB" : "#94A3B8"} />
                          ) : isPwd ? (
                            <Accessibility size={14} color={isSelected ? "#2563EB" : "#2563EB"} />
                          ) : isWalkIn ? (
                            <X size={14} color={isSelected ? "#2563EB" : "#94a3b8"} strokeWidth={3} />
                          ) : (
                            <View className={`w-2.5 h-2.5 rounded-full ${isSelected ? "bg-blue-600" : config.dot}`} />
                          )}
                        </View>
                        <Text className={`text-[11px] font-black mt-1 ${isSelected ? "text-blue-700" : config.text}`}>
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
