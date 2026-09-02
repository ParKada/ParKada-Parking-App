import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, Clock, ChevronRight, Bell, Search, RefreshCcw, Navigation, WifiOff, Star } from "lucide-react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../lib/supabase";
import ActiveReservationTimer from "../../components/ActiveReservationTimer";

const MAP_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/ParKada-lipa-map-bf9Bjp7jKhLR43sJchAZUD.webp";

const parseOpenHoursToMins = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let [_, h, m, period] = match;
  let hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (period.toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

function LoadingSkeleton() {
  return (
    <View className="p-4 space-y-4 flex-col gap-4">
      <View className="h-36 bg-slate-200 rounded-2xl" />
      <View className="h-32 bg-slate-200 rounded-2xl" />
      <View className="flex-row gap-3">
        <View className="flex-1 h-20 bg-slate-200 rounded-2xl" />
        <View className="flex-1 h-20 bg-slate-200 rounded-2xl" />
        <View className="flex-1 h-20 bg-slate-200 rounded-2xl" />
      </View>
    </View>
  );
}

function OfflineIndicator() {
  return (
    <View className="mx-4 mt-2 mb-2 bg-red-50 border border-red-200 rounded-xl p-2 flex-row items-center justify-center gap-2">
      <WifiOff size={14} color="#ef4444" />
      <Text className="text-[10px] font-medium text-red-600">You are offline. Some data may be outdated.</Text>
    </View>
  );
}

function AvailabilityBar({ available, total }: { available: number; total: number }) {
  if (!total || total === 0) return null;
  const pct = Math.round((available / total) * 100);
  const colorClass = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500";
  return (
    <View className="flex-row items-center gap-2 mt-3">
      <View className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <View className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-xs text-slate-500 font-bold">{available}/{total}</Text>
    </View>
  );
}

const renderStars = (rating: number) => {
  const fullStars = Math.floor(rating || 0);
  const hasHalf = (rating || 0) % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <View className="flex-row items-center gap-0.5 mt-1">
      {[...Array(fullStars)].map((_, i) => <Star key={`f-${i}`} size={12} color="#fbbf24" fill="#fbbf24" />)}
      {hasHalf && <Star size={12} color="#fbbf24" fill="#fbbf24" style={{ opacity: 0.5 }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`e-${i}`} size={12} color="#cbd5e1" />)}
      <Text className="text-[10px] text-slate-500 ml-1 font-bold">({(rating || 0).toFixed(1)})</Text>
    </View>
  );
};

function getVehicleDisplay(reservation: any, allReservations: any[]) {
  const model = reservation.vehicleModel || reservation.vehiclePlate;
  const duplicates = allReservations.filter(r => r.vehicleModel === reservation.vehicleModel && r.vehiclePlate !== reservation.vehiclePlate);
  if (duplicates.length > 0) {
    return `${model} - ${reservation.vehiclePlate}`;
  }
  return model;
}

export default function DriverHome() {
  const router = useRouter();
  const netInfo = useNetInfo();
  
  const [userName, setUserName] = useState<string>("Driver");
  const [dbParkingLots, setDbParkingLots] = useState<any[]>([]);
  const [dbSlots, setDbSlots] = useState<any[]>([]);
  const [activeReservations, setActiveReservations] = useState<any[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const activeStatuses = ["reserved", "active", "pending", "booked", "Reserved", "Active", "Pending", "Booked"];
  const isOnline = netInfo.isConnected ?? true;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    })();
  }, []);

  const runCleanup = useCallback(async (userId: string) => {
    try {
      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, slot_id, start_time, end_time, created_at")
        .eq("profile_id", userId)
        .in("status", activeStatuses);
      if (!reservations || reservations.length === 0) return;
      const now = new Date();
      for (const res of reservations) {
        if (!res.end_time) continue;
        const endDateTime = new Date(res.end_time);
        const startDateTime = new Date(res.start_time || res.created_at);
        let adjustedEnd = endDateTime;
        if (adjustedEnd < startDateTime) adjustedEnd = new Date(adjustedEnd.getTime() + 24 * 60 * 60 * 1000);
        if (now >= adjustedEnd) {
          await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
          await supabase.from("parking_slots").update({ status: "available" }).eq("id", res.slot_id);
        }
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }, []);

  const fetchAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        setIsRefreshing(false);
        return;
      }
      await runCleanup(user.id);
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, full_name")
        .eq("id", user.id)
        .single();

      if (profile?.first_name) {
        setUserName(profile.first_name);
      } else if (profile?.full_name) {
        setUserName(profile.full_name.split(" ")[0]);
      } else if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name.split(" ")[0]);
      }
      
      const { data: unreadNotif } = await supabase.from("notifications").select("id").eq("user_id", user.id).eq("read", false).limit(1);
      setHasUnreadNotifs(!!(unreadNotif && unreadNotif.length > 0));

      const [lotsRes, slotsRes] = await Promise.all([
        supabase.from("parking_lots").select("*"),
        supabase.from("parking_slots").select("*"),
      ]);

      if (lotsRes.data) {
        const mappedLots = lotsRes.data.map(lot => ({
          ...lot,
          open_hours: lot.operating_hours || lot.open_hours || "24 Hours",
          overtime_rate: lot.overtime_fee_per_hour || lot.overtime_rate || 30
        }));
        setDbParkingLots(mappedLots);
      }
      if (slotsRes.data) setDbSlots(slotsRes.data);

      const { data: resData } = await supabase
        .from("reservations")
        .select(`
          *,
          parking_slots (
            slot_number,
            parking_lots (*)
          )
        `)
        .eq("profile_id", user.id)
        .in("status", activeStatuses)
        .order("created_at", { ascending: false });

      let vehicleMap = new Map<string, string>();
      if (resData && resData.length > 0) {
        const plates = [...new Set(resData.map(r => r.plate_number).filter(Boolean))];
        if (plates.length > 0) {
          const { data: vehicles } = await supabase.from("vehicles").select("plate, model").in("plate", plates);
          if (vehicles) vehicles.forEach(v => vehicleMap.set(v.plate, v.model));
        }
      }

      if (resData && resData.length > 0) {
        const formatted = resData.map((rawRes: any) => {
          const slotData = Array.isArray(rawRes.parking_slots) ? rawRes.parking_slots[0] : rawRes.parking_slots;
          const lotData = slotData?.parking_lots ? (Array.isArray(slotData.parking_lots) ? slotData.parking_lots[0] : slotData.parking_lots) : null;
          const vehicleModel = vehicleMap.get(rawRes.plate_number) || rawRes.plate_number;
          return {
            ...rawRes,
            lotName: lotData?.name || "Parking Lot",
            hourly_rate: lotData?.rate_per_hour || 30,
            slotLabel: slotData?.slot_number || "-",
            vehiclePlate: rawRes.plate_number || "N/A",
            vehicleModel,
            extension_fee_setting: lotData?.extension_fee || 10,
            fine_penalty: lotData?.fine_penalty || 50,
            overtime_rate: lotData?.overtime_fee_per_hour || 30,
            grace_period_minutes: lotData?.grace_period_minutes || 15,
            allow_extensions: lotData?.allow_extensions ?? true,
            extension_rate_per_hour: lotData?.extension_rate_per_hour ?? lotData?.rate_per_hour ?? 30,
          };
        });
        formatted.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
        setActiveReservations(formatted);
        if (!selectedReservationId || !formatted.some(r => r.id === selectedReservationId)) {
          setSelectedReservationId(formatted[0]?.id || null);
        }
      } else {
        setActiveReservations([]);
        setSelectedReservationId(null);
      }
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [runCleanup, selectedReservationId]);

  useEffect(() => {
    if (isOnline) fetchAllData();
  }, [isOnline]);

  const isLotOpen = (openHoursStr?: string) => {
    if (!openHoursStr) return true;
    const hoursText = openHoursStr.toLowerCase();
    if (hoursText.includes("24 hour") || hoursText.includes("24/7")) return true;
    const times = openHoursStr.split("-").map((t) => t.trim());
    if (times.length === 2) {
      const startMins = parseOpenHoursToMins(times[0]);
      const endMins = parseOpenHoursToMins(times[1]);
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      if (startMins < endMins) return currentMins >= startMins && currentMins < endMins;
      else return currentMins >= startMins || currentMins < endMins;
    }
    return true;
  };

  const primaryLots = useMemo(() => {
    if (!dbParkingLots || dbParkingLots.length === 0) return [];

    return dbParkingLots
      .map((lot) => {
        const lotSlots = dbSlots.filter((s) => s.lot_id === lot.id);
        const availableCount = lotSlots.length > 0 
          ? lotSlots.filter((s) => s.status === "available").length 
          : (lot.total_slots || 0);
        
        let distance = null;
        if (userLocation && lot.latitude && lot.longitude) {
          distance = calculateDistance(userLocation.lat, userLocation.lng, lot.latitude, lot.longitude);
        }
        const isOpen = isLotOpen(lot.open_hours);
        return { ...lot, lotSlots, availableCount, distance, isOpen };
      })
      .filter((lot) => lot.isOpen) // Filters out closed lots entirely
      .slice(0, 5);
  }, [dbParkingLots, dbSlots, userLocation]);

  const primaryLotIds = primaryLots.map((lot) => lot.id);
  const primarySlots = dbSlots.filter((slot) => primaryLotIds.includes(slot.lot_id));
  const totalAvailable = primarySlots.filter((s) => s.status === "available").length;
  const totalOccupied = primarySlots.filter((s) => s.status !== "available").length;
  const totalOpenLots = primaryLots.length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const selectedReservation = activeReservations.find(r => r.id === selectedReservationId);

  if (!isOnline && !loading && dbParkingLots.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center p-6">
        <WifiOff size={48} color="#94a3b8" />
        <Text className="text-slate-600 font-bold mt-4">You're offline</Text>
        <Text className="text-xs text-slate-400 mt-1">Please check your internet connection</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <View className="flex-row items-center gap-2">
          <Image source={require("../../assets/ParKadav2.png")} className="w-8 h-8 rounded-md" resizeMode="contain" />
          <Text className="font-black text-lg text-[#0A1D37]">ParKada</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/notifications")} className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center relative">
          <Bell size={20} color="#0A1D37" />
          {hasUnreadNotifs && <View className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />}
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchAllData(false)} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <LoadingSkeleton /> : (
          <View className="pb-10">
            {!isOnline && <OfflineIndicator />}

            {/* Banner */}
            <View className="relative h-36 mx-4 mt-4 rounded-[20px] overflow-hidden shadow-sm">
              <Image source={{ uri: MAP_IMG }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
              <View className="absolute inset-0 bg-[#0A1D37]/80 p-5 justify-between">
                <View>
                  <Text className="text-white/80 text-xs font-bold">{greeting}, {userName} 👋</Text>
                  <Text className="text-white text-lg font-black mt-1">Lipa City Downtown</Text>
                </View>

                {/* Fixed Search Now Button */}
                <TouchableOpacity 
                  onPress={() => router.push("/map")} 
                  activeOpacity={0.8}
                  className="self-start bg-amber-400 px-3.5 py-2 rounded-xl flex-row items-center justify-center gap-1.5 shrink-0"
                >
                  <Search size={14} color="#451a03" />
                  <Text 
                    numberOfLines={1}
                    style={{ includeFontPadding: false, textAlignVertical: 'center' }} 
                    className="text-amber-950 text-xs font-black"
                  >
                    Search Now
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Reservation */}
            <View className="mx-4 mt-6">
              <View className="flex-row justify-between items-end mb-3">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">My Current Booking</Text>
                <TouchableOpacity onPress={() => fetchAllData(false)} className="flex-row items-center gap-1">
                  <RefreshCcw size={10} color="#2563EB" />
                  <Text className="text-[10px] font-bold text-blue-600">Refresh</Text>
                </TouchableOpacity>
              </View>

              {activeReservations.length > 0 ? (
                <View>
                  {activeReservations.length > 1 && (
                    <View className="mb-3 bg-blue-50 border border-blue-100 rounded-xl overflow-hidden justify-center h-12">
                      <Picker
                        selectedValue={selectedReservationId}
                        onValueChange={(val) => setSelectedReservationId(val)}
                        style={{ width: '100%', color: '#1e3a8a' }}
                      >
                        {activeReservations.map(res => (
                          <Picker.Item key={res.id} label={getVehicleDisplay(res, activeReservations)} value={res.id} />
                        ))}
                      </Picker>
                    </View>
                  )}

                  {selectedReservation && (
                    <View className="bg-[#0A1D37] rounded-3xl p-5 shadow-xl">
                      <View className="flex-row justify-between items-start">
                        <View>
                          <Text className="font-black text-white text-lg tracking-tight">{selectedReservation.lotName}</Text>
                          <Text className="text-white/70 text-xs mt-1 font-medium">
                            Slot {selectedReservation.slotLabel} • <Text className="uppercase text-amber-400 font-bold">{selectedReservation.vehiclePlate}</Text>
                          </Text>
                        </View>
                        <View className="bg-emerald-500/20 px-2 py-1 rounded-md">
                          <Text className="text-emerald-400 text-[9px] font-black tracking-widest">ACTIVE</Text>
                        </View>
                      </View>

                      <ActiveReservationTimer reservation={selectedReservation} onUpdate={() => fetchAllData()} />

                      <View className="mt-4 items-end">
                        <Text className="text-[10px] text-white/50 font-bold uppercase">Ends at: {new Date(selectedReservation.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 items-center shadow-sm">
                  <Text className="text-sm text-slate-500 font-semibold">No active reservations found.</Text>
                </View>
              )}
            </View>

            {/* Stats Grid */}
            <View className="mx-4 mt-6 flex-row gap-2.5 justify-between">
              <View className="flex-1 bg-emerald-50/80 border border-emerald-100 rounded-2xl py-4 px-1 items-center justify-center min-h-[96px] shadow-sm">
                <Text className="text-emerald-600 text-3xl font-black mb-1">
                  {totalAvailable}
                </Text>
                <Text className="text-[9px] font-black text-emerald-700/80 uppercase">
                  AVAILABLE
                </Text>
              </View>

              <View className="flex-1 bg-rose-50/80 border border-rose-100 rounded-2xl py-4 px-1 items-center justify-center min-h-[96px] shadow-sm">
                <Text className="text-rose-500 text-3xl font-black mb-1">
                  {totalOccupied}
                </Text>
                <Text className="text-[9px] font-black text-rose-700/80 uppercase">
                  OCCUPIED
                </Text>
              </View>

              <View className="flex-1 bg-blue-50/80 border border-blue-100 rounded-2xl py-4 px-1 items-center justify-center min-h-[96px] shadow-sm">
                <Text className="text-blue-600 text-3xl font-black mb-1 text-center">
                  {totalOpenLots}
                </Text>
                <Text className="text-[9px] font-black text-blue-700/80 uppercase text-center">
                  TOTAL LOTS
                </Text>
              </View>
            </View>

            {/* Nearby Suggestions */}
            <View className="mx-4 mt-8">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-black text-slate-800">Nearby Suggestions</Text>
                  {userLocation && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                </View>
                <TouchableOpacity onPress={() => router.push("/map")} className="flex-row items-center gap-1">
                  <Text className="text-xs font-bold text-blue-600">View Map</Text>
                  <ChevronRight size={14} color="#2563EB" />
                </TouchableOpacity>
              </View>

              <View className="space-y-3 flex-col gap-3">
                {primaryLots.length > 0 ? (
                  primaryLots.map(lot => {
                    const isAccredited = lot.is_accredited === true;
                    const available = lot.availableCount;
                    const slotsColor = available >= 30 ? "text-emerald-600" : available > 10 ? "text-amber-500" : "text-rose-600";

                    return (
                      <TouchableOpacity
                        key={lot.id}
                        disabled={!isAccredited}
                        onPress={() => router.push(`/lot/${lot.id}`)}
                        className={`bg-white p-5 rounded-[20px] shadow-sm border border-slate-100 ${!isAccredited ? 'opacity-90 bg-slate-50' : ''}`}
                      >
                        <View className="flex-row justify-between items-start mb-2">
                          <View className="flex-1 pr-4">
                            <View className="flex-row items-center gap-2 flex-wrap">
                              <Text className="font-black text-[15px] text-slate-800">{lot.name}</Text>
                              {lot.distance !== null && (
                                <View className="bg-blue-50 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                                  <Navigation size={10} color="#1d4ed8" />
                                  <Text className="text-[10px] font-bold text-blue-700">{lot.distance.toFixed(1)} km</Text>
                                </View>
                              )}
                            </View>
                            {isAccredited && lot.average_rating > 0 && renderStars(lot.average_rating)}
                            <View className="flex-row items-center gap-1.5 mt-2">
                              <MapPin size={12} color="#94a3b8" />
                              <Text className="text-[11px] text-slate-500 font-medium" numberOfLines={1}>{lot.address}</Text>
                            </View>
                            <Text className="text-[10px] font-bold text-amber-600 mt-1">🕒 {lot.open_hours}</Text>
                            {isAccredited ? (
                              <Text className={`text-[11px] font-black mt-1 ${slotsColor}`}>
                                {available} {available === 1 ? "slot" : "slots"} available
                              </Text>
                            ) : (
                              <Text className="text-[10px] text-slate-400 font-medium italic mt-1">ℹ️ Walk-In Only</Text>
                            )}
                          </View>
                          {isAccredited && <Text className="text-[15px] font-black text-blue-700">₱{lot.rate_per_hour}<Text className="text-xs font-bold text-blue-400">/hr</Text></Text>}
                        </View>
                        {isAccredited && <AvailabilityBar available={available} total={lot.lotSlots?.length || lot.total_slots || 0} />}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 items-center shadow-sm">
                    <Text className="text-sm text-slate-500 font-semibold">No parking suggestions available.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}