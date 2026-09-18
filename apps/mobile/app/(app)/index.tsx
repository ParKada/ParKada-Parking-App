import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { useFonts, DancingScript_700Bold } from "@expo-google-fonts/dancing-script";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  MapPin,
  ChevronRight,
  Bell,
  Search,
  RefreshCcw,
  Navigation,
  WifiOff,
  Star,
  Heart,
} from "lucide-react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Location from "expo-location";
import MapView from "react-native-maps";
import { supabase } from "../../lib/supabase";
import ActiveBookingCarousel from "../../components/ActiveBookingCarousel";
import { useFavorites } from "../../hooks/useFavorites";
import type { ActiveBooking } from "../../lib/types";
import {
  notifyReservationCompleted,
  notifyReservationEndingSoon,
} from "../../lib/notify";

const MAP_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-lipa-map-bf9Bjp7jKhLR43sJchAZUD.webp";

const NAVY = "#0A1D37";

/**
 * Plain absolute-fill style. Written out by hand instead of using
 * StyleSheet.absoluteFillObject, which is missing from some versions of the
 * React Native type definitions.
 */
const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Minutes remaining at which the "ending soon" alert fires. */
const ENDING_SOON_WINDOW_MINUTES = 15;

const parseOpenHoursToMins = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let [_, h, m, period] = match;
  let hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (period.toUpperCase() === "PM" && hours < 12) hours += 12;
  if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function LoadingSkeleton() {
  return (
    <View className="p-4 flex-col gap-4">
      <View className="h-32 bg-slate-200 rounded-2xl" />
      <View className="flex-row gap-3">
        <View className="flex-1 h-20 bg-slate-200 rounded-2xl" />
        <View className="flex-1 h-20 bg-slate-200 rounded-2xl" />
        <View className="flex-1 h-20 bg-slate-200 rounded-2xl" />
      </View>
      <View className="h-28 bg-slate-200 rounded-2xl" />
      <View className="h-28 bg-slate-200 rounded-2xl" />
    </View>
  );
}

function OfflineIndicator() {
  return (
    <View className="mx-4 mt-3 mb-1 bg-red-50 border border-red-200 rounded-xl p-2.5 flex-row items-center justify-center gap-2">
      <WifiOff size={14} color="#ef4444" />
      <Text className="text-[10px] font-medium text-red-600">
        You are offline. Some data may be outdated.
      </Text>
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
      <Text className="text-xs text-slate-500 font-bold">
        {available}/{total}
      </Text>
    </View>
  );
}

const renderStars = (rating: number) => {
  const fullStars = Math.floor(rating || 0);
  const hasHalf = (rating || 0) % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <View className="flex-row items-center gap-0.5 mt-1">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`f-${i}`} size={12} color="#fbbf24" fill="#fbbf24" />
      ))}
      {hasHalf && <Star size={12} color="#fbbf24" fill="#fbbf24" style={{ opacity: 0.5 }} />}
      {[...Array(Math.max(emptyStars, 0))].map((_, i) => (
        <Star key={`e-${i}`} size={12} color="#cbd5e1" />
      ))}
      <Text className="text-[10px] text-slate-500 ml-1 font-bold">
        ({(rating || 0).toFixed(1)})
      </Text>
    </View>
  );
};

export default function DriverHome() {
  const router = useRouter();
  const netInfo = useNetInfo();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite, refresh: refreshFavorites } = useFavorites();
  
  const [fontsLoaded] = useFonts({
    DancingScript_700Bold,
  });

  const [userName, setUserName] = useState<string>("Driver");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [dbParkingLots, setDbParkingLots] = useState<any[]>([]);
  const [dbSlots, setDbSlots] = useState<any[]>([]);
  const [activeReservations, setActiveReservations] = useState<ActiveBooking[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  // Mirrors the selection so `fetchAllData` can read it without listing it as a
  // dependency — otherwise every swipe would rebuild the callback and refetch.
  const selectedReservationIdRef = useRef<string | null>(null);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigatingToMap, setIsNavigatingToMap] = useState(false);

  // --- Smooth transition to the map page ------------------------------------
  // A navy curtain fades in over the whole screen, then the router pushes.
  // On focus it fades back out, which also covers the trip back.
  const curtain = useRef(new Animated.Value(0)).current;
  const searchScale = useRef(new Animated.Value(1)).current;

  const curtainLogoScale = curtain.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const goToMap = useCallback(() => {
    if (isNavigatingToMap) return;
    setIsNavigatingToMap(true);
    Animated.timing(curtain, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      router.push("/map");
    });
  }, [curtain, isNavigatingToMap, router]);

  const onSearchPressIn = () => {
    Animated.spring(searchScale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const onSearchPressOut = () => {
    Animated.spring(searchScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const activeStatuses = ["reserved", "active", "pending"];
  const isOnline = netInfo.isConnected ?? true;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    })();

    // Immediate profile fetch on mount so the greeting is never "Driver" for
    // longer than it has to be.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          applyProfileName(profile, user);
        });
    });
  }, []);

  /** Prefer preferred_name, then first_name, then auth metadata. */
  const applyProfileName = (profile: any, user: any) => {
    const cleanPreferred = profile?.preferred_name?.trim();
    const cleanFirst = profile?.first_name?.trim();
    const metaName =
      user?.user_metadata?.preferred_name?.trim() ||
      user?.user_metadata?.given_name?.trim() ||
      user?.user_metadata?.first_name?.trim() ||
      (user?.user_metadata?.full_name
        ? user.user_metadata.full_name.trim().split(" ")[0]
        : "") ||
      (user?.user_metadata?.name ? user.user_metadata.name.trim().split(" ")[0] : "");

    if (cleanPreferred) setUserName(cleanPreferred);
    else if (cleanFirst) setUserName(cleanFirst);
    else if (metaName) setUserName(metaName);
    else setUserName("Driver");

    const photo =
      profile?.avatar_url ||
      profile?.photo_url ||
      profile?.profile_image_url ||
      profile?.profile_photo_url ||
      user?.user_metadata?.avatar_url ||
      null;
    setAvatarUrl(typeof photo === "string" && photo.trim() ? photo.trim() : null);
  };

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
        if (adjustedEnd < startDateTime)
          adjustedEnd = new Date(adjustedEnd.getTime() + 24 * 60 * 60 * 1000);
        if (now >= adjustedEnd) {
          await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
          await supabase.from("parking_slots").update({ status: "available" }).eq("id", res.slot_id);
          // Persist an alert so the driver sees the session closed out.
          notifyReservationCompleted({ reservationId: res.id, userId });
        }
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }, []);

  const fetchAllData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsRefreshing(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
        await runCleanup(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        applyProfileName(profile, user);

        // The Alerts screen stores the read flag as `is_read`; an older query
        // here used `read`. Reading the rows and deciding client-side keeps the
        // badge correct whichever spelling the column actually uses.
        const { data: notifRows } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);
        setHasUnreadNotifs(
          (notifRows ?? []).some((n: any) => !(n?.is_read ?? n?.read ?? false)),
        );

        const [lotsRes, slotsRes] = await Promise.all([
          supabase.from("parking_lots").select(`
          *,
          parking_reviews ( rating )
        `),
          supabase.from("parking_slots").select("*"),
        ]);

        if (lotsRes.data) {
          const mappedLots = lotsRes.data.map((lot) => {
            const reviews = lot.parking_reviews || [];
            const validReviews = reviews.filter(
              (r: any) => r && typeof r.rating === "number",
            );
            const totalRating = validReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
            const computedAvg = validReviews.length > 0 ? totalRating / validReviews.length : 0;

            return {
              ...lot,
              average_rating: lot.average_rating || computedAvg,
              total_reviews: lot.total_reviews || validReviews.length,
              open_hours: lot.operating_hours || lot.open_hours || "24 Hours",
              overtime_rate: lot.overtime_fee_per_hour || lot.overtime_rate || 30,
            };
          });
          setDbParkingLots(mappedLots);
        }

        if (slotsRes.data) setDbSlots(slotsRes.data);

        // NOTE: `parking_slots` does not have a `slot_number` column — the
        // actual label column used everywhere else in this app (MapViewer,
        // lot/[id].tsx, reservation.tsx) is `label`.
        const { data: resData } = await supabase
          .from("reservations")
          .select(
            `
          *,
          parking_slots (
            label,
            parking_lots (*)
          )
        `,
          )
          .eq("profile_id", user.id)
          .in("status", activeStatuses)
          .order("created_at", { ascending: false });

        let vehicleMap = new Map<string, string>();
        if (resData && resData.length > 0) {
          const plates = [...new Set(resData.map((r) => r.plate_number).filter(Boolean))];
          if (plates.length > 0) {
            // NOTE: `vehicles` columns are `plate_number, vehicle_type, brand,
            // color` — there is no `plate` or `model` column.
            const { data: vehicles } = await supabase
              .from("vehicles")
              .select("plate_number, brand, vehicle_type")
              .in("plate_number", plates);
            if (vehicles)
              vehicles.forEach((v) =>
                vehicleMap.set(v.plate_number, v.brand || v.vehicle_type || v.plate_number),
              );
          }
        }

        if (resData && resData.length > 0) {
          const formatted = resData.map((rawRes: any) => {
            const slotData = Array.isArray(rawRes.parking_slots)
              ? rawRes.parking_slots[0]
              : rawRes.parking_slots;
            const lotData = slotData?.parking_lots
              ? Array.isArray(slotData.parking_lots)
                ? slotData.parking_lots[0]
                : slotData.parking_lots
              : null;
            const vehicleModel = vehicleMap.get(rawRes.plate_number) || rawRes.plate_number;
            return {
              ...rawRes,
              lotName: lotData?.name || "Parking Lot",
              hourly_rate: lotData?.rate_per_hour || 30,
              slotLabel: slotData?.label || "-",
              vehiclePlate: rawRes.plate_number || "N/A",
              vehicleModel,
              extension_fee_setting: lotData?.extension_fee || 10,
              fine_penalty: lotData?.fine_penalty || 50,
              overtime_rate: lotData?.overtime_fee_per_hour || 30,
              grace_period_minutes: lotData?.grace_period_minutes || 15,
              allow_extensions: lotData?.allow_extensions ?? true,
              extension_rate_per_hour:
                lotData?.extension_rate_per_hour ?? lotData?.rate_per_hour ?? 30,
              pricing_scheme: lotData?.pricing_scheme || "hourly",
            };
          });
          formatted.sort(
            (a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime(),
          );
          setActiveReservations(formatted);
          // Keep the driver on the booking they were looking at; fall back to
          // the soonest-ending one when that booking is gone.
          const previousSelection = selectedReservationIdRef.current;
          const nextSelection =
            previousSelection && formatted.some((r) => r.id === previousSelection)
              ? previousSelection
              : formatted[0]?.id ?? null;
          selectedReservationIdRef.current = nextSelection;
          setSelectedReservationId(nextSelection);

          // "Session ending soon" alerts. notify() dedupes per reservation, so
          // this is safe to run on every refresh and focus.
          const now = Date.now();
          formatted.forEach((res: any) => {
            if (!res.end_time) return;
            const minutesLeft = Math.round((new Date(res.end_time).getTime() - now) / 60000);
            if (minutesLeft > 0 && minutesLeft <= ENDING_SOON_WINDOW_MINUTES) {
              notifyReservationEndingSoon({
                reservationId: res.id,
                lotName: res.lotName,
                slotLabel: res.slotLabel,
                minutesLeft,
                userId: user.id,
              });
            }
          });
        } else {
          setActiveReservations([]);
          selectedReservationIdRef.current = null;
          setSelectedReservationId(null);
        }
      } catch (error) {
        console.error("Dashboard Fetch Error:", error);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [runCleanup],
  );

  useEffect(() => {
    if (isOnline) fetchAllData();
  }, [isOnline]);

  useFocusEffect(
    useCallback(() => {
      // Lift the transition curtain whenever we land back on Home.
      Animated.timing(curtain, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setIsNavigatingToMap(false));

      if (isOnline) {
        fetchAllData(true);
        refreshFavorites();
      }
    }, [isOnline, fetchAllData, refreshFavorites, curtain]),
  );

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
        const availableCount =
          lotSlots.length > 0
            ? lotSlots.filter((s) => s.status === "available").length
            : lot.total_slots || 0;

        let distance = null;
        if (userLocation && lot.latitude && lot.longitude) {
          distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            lot.latitude,
            lot.longitude,
          );
        }
        const isOpen = isLotOpen(lot.open_hours);
        return { ...lot, lotSlots, availableCount, distance, isOpen };
      })
      .filter((lot) => lot.isOpen)
      .slice(0, 5);
  }, [dbParkingLots, dbSlots, userLocation]);

  const primaryLotIds = primaryLots.map((lot) => lot.id);
  const primarySlots = dbSlots.filter((slot) => primaryLotIds.includes(slot.lot_id));
  const totalAvailable = primarySlots.filter((s) => s.status === "available").length;
  const totalOccupied = primarySlots.filter((s) => s.status !== "available").length;
  const totalOpenLots = primaryLots.length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  /** Fired by the carousel when the driver swipes to another booking. */
  const handleSelectBooking = useCallback((bookingId: string) => {
    selectedReservationIdRef.current = bookingId;
    setSelectedReservationId(bookingId);
  }, []);

  const handleOpenReceipt = useCallback(
    (bookingId: string) => {
      router.push(`/(app)/receipt/${bookingId}`);
    },
    [router],
  );

  /** A timer mutated a reservation — refresh quietly in the background. */
  const handleBookingUpdate = useCallback(() => {
    fetchAllData(true);
  }, [fetchAllData]);

  const handleToggleFavorite = async (lotId: string) => {
    const result = await toggleFavorite(lotId);
    if (!result.ok && result.error) console.warn("[favorites]", result.error);
  };

  if (!isOnline && !loading && dbParkingLots.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#f8fafc",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          paddingTop: insets.top + 24,
        }}
      >
        <WifiOff size={48} color="#94a3b8" />
        <Text className="text-slate-600 font-bold mt-4">You're offline</Text>
        <Text className="text-xs text-slate-400 mt-1">Please check your internet connection</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="light-content" />

      {/* Navy strip behind the status bar so the hero reads edge-to-edge */}
      <View
        style={{
          height: insets.top,
          backgroundColor: NAVY,
          zIndex: 20,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchAllData(false)} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/*  HERO                                                              */}
        {/* ================================================================= */}
        <View 
          style={{ 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: 12 }, 
            shadowOpacity: 0.15, 
            shadowRadius: 16, 
            elevation: 20, 
            backgroundColor: NAVY, 
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            zIndex: 10 
          }}
        >
          <View className="overflow-hidden rounded-b-[36px]" style={{ backgroundColor: NAVY }}>
            {/* Background Image Texture */}
            <Image 
              source={{ uri: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?q=80&w=1000&auto=format&fit=crop" }} 
              style={[FILL, { opacity: 0.25 }]} 
              resizeMode="cover" 
            />
            {/* Gradient / Solid overlay to keep it Navy */}
            <View style={[FILL, { backgroundColor: 'rgba(10, 29, 55, 0.85)' }]} />

          <View className="px-5 pt-2 pb-7">
            {/* Brand row */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Image
                  source={require("../../assets/ParKadav2.png")}
                  className="w-9 h-9 rounded-md"
                  resizeMode="contain"
                />
                <Text className="font-black text-xl">
                  <Text className="text-white">Par</Text>
                  <Text className="text-amber-400">Kada</Text>
                </Text>
              </View>

              <View className="flex-row items-center gap-2.5">
                <TouchableOpacity
                  onPress={() => router.push("/notifications")}
                  className="w-10 h-10 bg-white/10 border border-white/10 rounded-full items-center justify-center relative"
                >
                  <Bell size={19} color="#ffffff" />
                  {hasUnreadNotifs && (
                    <View
                      className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 rounded-full"
                      style={{ borderWidth: 2, borderColor: NAVY }}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/profile")}
                  className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/20 items-center justify-center"
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <Text className="text-white font-black text-sm">
                      {(userName || "D").charAt(0).toUpperCase()}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="items-center mt-12">
              <Text className="text-white/70 text-[15px] font-medium" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>Hi, {userName}</Text>
              <Text className="text-white text-[42px] mt-1 tracking-tight" style={{ fontFamily: fontsLoaded ? 'DancingScript_700Bold' : undefined, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 8 }}>
                {greeting}!
              </Text>

              <View className="mt-4 items-center px-4">
                <Text className="text-amber-400 text-lg font-black text-center" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>
                  Hit the road with a smile!
                </Text>
                <Text className="text-white/90 text-sm font-medium text-center mt-1" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>
                  We've got <Text className="font-black text-white">{totalAvailable}</Text> parking spots open nearby.
                </Text>
              </View>
            </View>

            {/* Centred Search Now */}
            <View className="items-center mt-6">
              <Animated.View style={{ transform: [{ scale: searchScale }] }}>
                <TouchableOpacity
                  onPress={goToMap}
                  onPressIn={onSearchPressIn}
                  onPressOut={onSearchPressOut}
                  activeOpacity={0.9}
                  className="bg-amber-400 px-8 py-3.5 rounded-2xl flex-row items-center justify-center gap-2"
                >
                  <Search size={17} color="#451a03" />
                  <Text
                    style={{ includeFontPadding: false, textAlignVertical: "center" }}
                    className="text-amber-950 text-[15px] font-black"
                  >
                    Search Now
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

          </View>
        </View>
        </View>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <View>
            {!isOnline && <OfflineIndicator />}

            {/* Active reservation */}
            <View className="mx-4 mt-6">
              <View className="flex-row justify-between items-end mb-3">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {activeReservations.length > 1
                    ? `My Active Bookings (${activeReservations.length})`
                    : "My Current Booking"}
                </Text>
                <TouchableOpacity
                  onPress={() => fetchAllData(false)}
                  className="flex-row items-center gap-1"
                >
                  <RefreshCcw size={10} color="#2563EB" />
                  <Text className="text-[10px] font-bold text-blue-600">Refresh</Text>
                </TouchableOpacity>
              </View>

              {activeReservations.length > 0 ? (
                <ActiveBookingCarousel
                  bookings={activeReservations}
                  selectedId={selectedReservationId}
                  onSelect={handleSelectBooking}
                  onPressBooking={handleOpenReceipt}
                  onUpdate={handleBookingUpdate}
                />
              ) : (
                <View className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 items-center shadow-sm">
                  <Text className="text-sm text-slate-500 font-semibold">
                    No active reservations found.
                  </Text>
                  <TouchableOpacity onPress={goToMap} className="mt-3">
                    <Text className="text-xs font-black text-blue-600">Find a slot</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Stats grid */}
            <View className="mx-4 mt-6 overflow-hidden rounded-2xl relative shadow-sm">
              <View style={FILL}>
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: userLocation?.lat || 13.9430,
                    longitude: userLocation?.lng || 121.1625,
                    latitudeDelta: 0.025,
                    longitudeDelta: 0.025,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  showsCompass={false}
                />
                <View style={[FILL, { backgroundColor: "rgba(255,255,255,0.6)" }]} />
              </View>
              <View className="flex-row gap-2.5 justify-between p-3">
                <View className="flex-1 bg-emerald-50/90 border border-emerald-100 rounded-2xl py-4 px-1 items-center justify-center min-h-[96px]">
                  <Text className="text-emerald-600 text-3xl font-black mb-1">{totalAvailable}</Text>
                  <Text className="text-[9px] font-black text-emerald-700/80 uppercase">
                    AVAILABLE
                  </Text>
                </View>

                <View className="flex-1 bg-rose-50/90 border border-rose-100 rounded-2xl py-4 px-1 items-center justify-center min-h-[96px]">
                  <Text className="text-rose-500 text-3xl font-black mb-1">{totalOccupied}</Text>
                  <Text className="text-[9px] font-black text-rose-700/80 uppercase">OCCUPIED</Text>
                </View>

                <View className="flex-1 bg-blue-50/90 border border-blue-100 rounded-2xl py-4 px-1 items-center justify-center min-h-[96px]">
                  <Text className="text-blue-600 text-3xl font-black mb-1 text-center">
                    {totalOpenLots}
                  </Text>
                  <Text className="text-[9px] font-black text-blue-700/80 uppercase text-center">
                    TOTAL LOTS
                  </Text>
                </View>
              </View>
            </View>

            {/* Nearby suggestions */}
            <View className="mx-4 mt-8">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-black text-slate-800">Nearby Suggestions</Text>
                  {userLocation && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                </View>
                <TouchableOpacity onPress={goToMap} className="flex-row items-center gap-1">
                  <Text className="text-xs font-bold text-blue-600">View Map</Text>
                  <ChevronRight size={14} color="#2563EB" />
                </TouchableOpacity>
              </View>

              <View className="flex-col gap-3">
                {primaryLots.length > 0 ? (
                  primaryLots.map((lot) => {
                    const isAccredited = lot.is_accredited === true;
                    const available = lot.availableCount;
                    const favorited = isFavorite(lot.id);
                    const slotsColor =
                      available >= 30
                        ? "text-emerald-600"
                        : available > 10
                          ? "text-amber-500"
                          : "text-rose-600";

                    return (
                      <TouchableOpacity
                        key={lot.id}
                        disabled={!isAccredited}
                        onPress={() => router.push(`/lot/${lot.id}`)}
                        activeOpacity={0.85}
                        className={`bg-white p-5 rounded-[20px] shadow-sm border border-slate-100 ${
                          !isAccredited ? "opacity-90 bg-slate-50" : ""
                        }`}
                      >
                        <View className="flex-row justify-between items-start mb-2">
                          <View className="flex-1 pr-3">
                            <View className="flex-row items-center gap-2 flex-wrap">
                              <Text className="font-black text-[15px] text-slate-800">
                                {lot.name}
                              </Text>
                              {lot.distance !== null && (
                                <View className="bg-blue-50 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                                  <Navigation size={10} color="#1d4ed8" />
                                  <Text className="text-[10px] font-bold text-blue-700">
                                    {lot.distance.toFixed(1)} km
                                  </Text>
                                </View>
                              )}
                            </View>
                            {isAccredited &&
                              (lot.average_rating || 0) > 0 &&
                              renderStars(lot.average_rating || 0)}
                            <View className="flex-row items-center gap-1.5 mt-2">
                              <MapPin size={12} color="#94a3b8" />
                              <Text
                                className="text-[11px] text-slate-500 font-medium flex-1"
                                numberOfLines={1}
                              >
                                {lot.address}
                              </Text>
                            </View>
                            <Text className="text-[10px] font-bold text-amber-600 mt-1">
                              🕒 {lot.open_hours}
                            </Text>
                            {isAccredited ? (
                              <Text className={`text-[11px] font-black mt-1 ${slotsColor}`}>
                                {available} {available === 1 ? "slot" : "slots"} available
                              </Text>
                            ) : (
                              <Text className="text-[10px] text-slate-400 font-medium italic mt-1">
                                ℹ️ Walk-In Only
                              </Text>
                            )}
                          </View>

                          <View className="items-end gap-2">
                            <TouchableOpacity
                              onPress={() => handleToggleFavorite(lot.id)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              className={`w-9 h-9 rounded-full items-center justify-center border ${
                                favorited
                                  ? "bg-rose-50 border-rose-100"
                                  : "bg-slate-50 border-slate-100"
                              }`}
                            >
                              <Heart
                                size={17}
                                color={favorited ? "#e11d48" : "#94a3b8"}
                                fill={favorited ? "#e11d48" : "transparent"}
                              />
                            </TouchableOpacity>

                            {isAccredited && (
                              <View className="items-end">
                                <Text className="text-[15px] font-black text-blue-700">
                                  ₱{lot.pricing_scheme === 'fixed' ? (lot.fixed_rate || 0) : (lot.base_rate || 0)}
                                </Text>
                                <Text className="text-[9px] font-bold text-blue-400 uppercase -mt-0.5">
                                  {lot.pricing_scheme === 'fixed' ? 'Whole Day' : 'First 3 Hrs'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {isAccredited && (
                          <AvailabilityBar
                            available={available}
                            total={lot.lotSlots?.length || lot.total_slots || 0}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 items-center shadow-sm">
                    <Text className="text-sm text-slate-500 font-semibold">
                      No parking suggestions available.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Transition curtain — fades in before pushing to the map */}
      <Animated.View
        pointerEvents={isNavigatingToMap ? "auto" : "none"}
        style={[
          FILL,
          {
            backgroundColor: NAVY,
            opacity: curtain,
            zIndex: 100,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: curtainLogoScale }], alignItems: "center" }}>
          <Image
            source={require("../../assets/ParKadav2.png")}
            style={{ width: 64, height: 64 }}
            resizeMode="contain"
          />
          <Text className="text-white/60 text-xs font-bold mt-3">Opening map…</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
