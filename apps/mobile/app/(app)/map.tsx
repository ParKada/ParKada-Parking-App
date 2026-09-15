import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Linking, ScrollView, Platform, Image, Animated, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Map, List, Search, Navigation, Route as RouteIcon, Crosshair, Star, Heart, MapPin, Clock, X, MessageSquare, Check } from "lucide-react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useFavorites } from "../../hooks/useFavorites";

const logoImage = require("../../assets/ParKadav2.png");

const lipaCenter = { latitude: 13.9430, longitude: 121.1625, latitudeDelta: 0.015, longitudeDelta: 0.015 };

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getEstimatedTravelTime = (distanceKm: number) => {
  const minutes = Math.ceil(distanceKm / 0.5);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

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

const isParkingOpen = (openHoursStr: string | null | undefined, currentDate: Date) => {
  if (!openHoursStr) return true;
  const hoursText = openHoursStr.toLowerCase();
  if (hoursText.includes('24 hour') || hoursText.includes('24/7')) return true;
  try {
    const times = openHoursStr.split('-').map(t => t.trim());
    if (times.length === 2) {
      const startMins = parseOpenHoursToMins(times[0]);
      const endMins = parseOpenHoursToMins(times[1]);
      const currentMins = currentDate.getHours() * 60 + currentDate.getMinutes();
      if (startMins < endMins) return currentMins >= startMins && currentMins < endMins;
      else return currentMins >= startMins || currentMins < endMins;
    }
    return true;
  } catch (error) {
    return true;
  }
};

const renderStars = (rating: number) => {
  if (!rating || rating === 0) return null;
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <View className="flex-row items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => <Star key={`f-${i}`} size={10} color="#fbbf24" fill="#fbbf24" />)}
      {hasHalf && <Star size={10} color="#fbbf24" fill="#fbbf24" style={{ opacity: 0.5 }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`e-${i}`} size={10} color="#cbd5e1" />)}
      <Text className="text-[9px] text-slate-500 ml-1 font-bold">({rating.toFixed(1)})</Text>
    </View>
  );
};

export default function ParkingMapPage() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "list">("map");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "private" | "public">("all");
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[] | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { favoriteIds: favorites, toggleFavorite, isFavorite, loading: favsLoading } = useFavorites();
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [activeLot, setActiveLot] = useState<any | null>(null);
  const [lotReviews, setLotReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const translateY = useRef(new Animated.Value(800)).current;

  const listOffset = useRef(0);
  const translateYList = useRef(new Animated.Value(0)).current;

  const toggleList = (show: boolean) => {
    const toValue = show ? 0 : 160;
    listOffset.current = toValue;
    Animated.spring(translateYList, {
      toValue,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const panResponderList = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        let newY = listOffset.current + gestureState.dy;
        if (newY < 0) newY = 0;
        if (newY > 160) newY = 160;
        translateYList.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (listOffset.current === 0) {
          if (gestureState.dy > 50 || gestureState.vy > 0.5) {
            toggleList(false);
          } else {
            toggleList(true);
          }
        } else {
          if (gestureState.dy < -50 || gestureState.vy < -0.5) {
            toggleList(true);
          } else {
            toggleList(false);
          }
        }
      },
    })
  ).current;

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: 800,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedLot(null);
      setActiveLot(null);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
    })();
  }, []);

  const centerToUser = () => {
    if (userCoords && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userCoords.lat,
        longitude: userCoords.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      });
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lotsRes, slotsRes] = await Promise.all([
          supabase.from('parking_lots').select('*').neq('maintenance_mode', true),
          supabase.from('parking_slots').select('*')
        ]);
        
        if (lotsRes.data) {
          const mappedLots = lotsRes.data.map(lot => ({
            ...lot,
            open_hours: lot.operating_hours || lot.open_hours || "24 Hours"
          }));
          setLots(mappedLots);
        }
        if (slotsRes.data) setSlots(slotsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearchSubmit = () => {
    if (!search.trim()) return;
    const foundLot = computedLots.find(lot => 
      lot.name.toLowerCase().includes(search.toLowerCase()) ||
      lot.address.toLowerCase().includes(search.toLowerCase())
    );
    if (foundLot && foundLot.latitude && foundLot.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: foundLot.latitude,
        longitude: foundLot.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      });
      setRouteCoords(null);
    }
  };

  const handleShowRoute = async (targetLat: number, targetLng: number) => {
    if (!userCoords) return;
    setIsFetchingRoute(true);
    setView("map");
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => ({ latitude: c[1], longitude: c[0] }));
        setRouteCoords(coords);
        if (mapRef.current) mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingRoute(false);
    }
  };

  const openMaps = async (lat: number, lng: number, provider: "google" | "waze") => {
    const origin = userCoords ? `${userCoords.lat},${userCoords.lng}` : undefined;
    if (provider === "google") {
      if (Platform.OS === "android") {
        Linking.openURL(`google.navigation:q=${lat},${lng}`);
      } else {
        const destUrl = `comgooglemaps://?daddr=${lat},${lng}${origin ? `&saddr=${origin}` : ""}&directionsmode=driving`;
        try {
          await Linking.openURL(destUrl);
        } catch {
          Linking.openURL(`https://maps.google.com/?daddr=${lat},${lng}`);
        }
      }
    } else {
      Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes${origin ? `&from=${origin}` : ""}`);
    }
  };

  const handleSelectLot = async (lot: any) => {
    setSelectedLot(lot);
    setActiveLot(lot);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    
    setRouteCoords(null);
    if (lot.latitude && lot.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: Number(lot.latitude),
        longitude: Number(lot.longitude),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      });
    }
    
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('parking_reviews')
        .select(`
          rating,
          review,
          created_at,
          profiles (full_name)
        `)
        .eq('lot_id', lot.id)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setLotReviews(data);
      } else {
        setLotReviews([]);
      }
    } catch (err) {
      console.error(err);
      setLotReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const computedLots = useMemo(() => {
    return lots.map(lot => {
      const lotSlots = slots.filter(s => s.lot_id === lot.id);
      if (lotSlots.length > 0) {
        const available = lotSlots.filter(s => s.status === 'available').length;
        return { ...lot, available_slots: available, total_slots: lotSlots.length };
      }
      return { ...lot, available_slots: lot.total_slots || 0, total_slots: lot.total_slots || 0 }; 
    });
  }, [lots, slots]);

  const filteredAndSorted = useMemo(() => {
    return computedLots
      .filter((lot) => {
        const matchSearch = lot.name?.toLowerCase().includes(search.toLowerCase()) || lot.address?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || lot.type === filter;
        return matchSearch && matchFilter;
      })
      .map((lot) => {
        const distance = userCoords && lot.latitude && lot.longitude ? getDistance(userCoords.lat, userCoords.lng, lot.latitude, lot.longitude) : null;
        const travelTime = distance ? getEstimatedTravelTime(distance) : null;
        return { ...lot, currentDistance: distance, travelTime };
      })
      .sort((a, b) => {
        if (a.is_accredited !== b.is_accredited) return a.is_accredited === true ? -1 : 1;
        if (a.currentDistance === null) return 1;
        if (b.currentDistance === null) return -1;
        return a.currentDistance - b.currentDistance;
      });
  }, [computedLots, search, filter, userCoords]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Header — logo (acts as back button) + title, replacing a plain back arrow */}
<View className="flex-row items-center gap-2 px-4 py-4 bg-white border-b border-slate-200 z-20">
  <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
    <Image source={logoImage} className="w-10 h-10 rounded-md" resizeMode="contain" />
  </TouchableOpacity>
  <Text className="text-xl font-black text-[#0A1D37]">Find Parking</Text>
</View>

      <View className="px-4 py-3 bg-white border-b border-slate-200 z-20">
        <View className="relative mb-3">
          <View className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
            <Search size={16} color="#94a3b8" />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search parking in Lipa City..."
            placeholderTextColor="#94a3b8"
            style={{ 
              includeFontPadding: false, 
              textAlignVertical: 'center' 
            }}
            className="pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-800 font-medium justify-center items-center"
            returnKeyType="search"
          />
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-2">
            {(["all", "private", "public"] as const).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full border ${filter === f ? "bg-[#0A1D37] border-[#0A1D37]" : "bg-white border-slate-200"}`}
              >
                <Text className={`text-[11px] font-bold capitalize ${filter === f ? "text-white" : "text-slate-500"}`}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row bg-slate-100 rounded-full p-1">
            <TouchableOpacity onPress={() => setView("map")} className={`p-1.5 rounded-full ${view === "map" ? "bg-[#0A1D37]" : ""}`}>
              <Map size={14} color={view === "map" ? "white" : "#94a3b8"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setView("list")} className={`p-1.5 rounded-full ${view === "list" ? "bg-[#0A1D37]" : ""}`}>
              <List size={14} color={view === "list" ? "white" : "#94a3b8"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0A1D37" />
          <Text className="mt-4 text-slate-500 font-bold">Loading Map Data...</Text>
        </View>
      ) : view === "map" ? (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            initialRegion={lipaCenter}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {routeCoords && <Polyline coordinates={routeCoords} strokeColor="#3b82f6" strokeWidth={4} lineDashPattern={[10, 10]} />}
            
            {filteredAndSorted.map(lot => {
              if (!lot.latitude || !lot.longitude) return null;
              const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
              const isAccredited = lot.is_accredited === true;
              
              // Pin color logic — closed/non-accredited lots still get a
              // marker (gray), so they remain visible on the map even
              // though they can't be tapped through to a reservation.
              let pinColor = '#10b981'; // Green
              if (isClosed) pinColor = '#64748b'; // Gray
              else if (isAccredited) {
                if (lot.available_slots === 0) pinColor = '#f43f5e'; // Red
                else if (lot.available_slots <= 5) pinColor = '#f59e0b'; // Amber
              } else {
                pinColor = '#64748b'; // Gray for walk-in-only, non-accredited lots
              }

              const statusText = isClosed ? "Closed" : isAccredited ? `${lot.available_slots} slots` : "Walk-in Only";

              return (
                <Marker
                  key={`marker-${lot.id}`}
                  coordinate={{ latitude: Number(lot.latitude), longitude: Number(lot.longitude) }}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => { if (isAccredited) handleSelectLot(lot); }}
                >
                  <View pointerEvents="none" style={{ alignItems: 'center', width: 150 }}>
                    <View
                      style={{
                        backgroundColor: pinColor,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{statusText}</Text>
                    </View>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: 'white',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: pinColor,
                        elevation: 4,
                        shadowColor: '#000',
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                        shadowOffset: { width: 0, height: 1 },
                      }}
                    >
                      <MapPin size={15} color={pinColor} />
                    </View>
                    <View
                      style={{
                        backgroundColor: 'white',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 8,
                        marginTop: 3,
                        maxWidth: 150,
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOpacity: 0.15,
                        shadowRadius: 2,
                        shadowOffset: { width: 0, height: 1 },
                      }}
                    >
                      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: '#0A1D37' }}>
                        {lot.name}
                      </Text>
                    </View>
                  </View>
                </Marker>
              );
            })}
          </MapView>

          {/* User Location Center Button */}
          <TouchableOpacity 
            onPress={centerToUser} 
            className="absolute right-4 top-4 w-12 h-12 bg-white rounded-full shadow-lg items-center justify-center border border-slate-200 z-10"
          >
            <Crosshair size={24} color="#0A1D37" />
          </TouchableOpacity>

          {/* Bottom Sheet Cards Overlay */}
          <Animated.View 
            pointerEvents={selectedLot ? "none" : "box-none"} 
            style={{ opacity: selectedLot ? 0 : 1, transform: [{ translateY: translateYList }] }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <View className="bg-white/95 rounded-t-3xl pt-0 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <View 
                {...panResponderList.panHandlers} 
                className="w-full py-4 px-4 items-center"
              >
                <View className="w-12 h-1.5 bg-slate-300 rounded-full" />
              </View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-4">{filteredAndSorted.length} Results</Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible pb-2 flex-row px-4">
                {filteredAndSorted.map(lot => {
                  const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
                  const isFav = isFavorite(lot.id);
                  const isAccredited = lot.is_accredited === true;

                  return (
                    <TouchableOpacity
                      key={`card-${lot.id}`}
                      disabled={!isAccredited}
                      onPress={() => handleSelectLot(lot)}
                      className={`w-72 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm mr-4 ${(!isAccredited || isClosed) ? "opacity-80" : ""}`}
                    >
                      <View className="flex-row justify-between items-start mb-1">
                        <Text className="font-black text-slate-800 text-sm flex-1 mr-2" numberOfLines={1}>{lot.name}</Text>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleFavorite(lot.id);
                          }} 
                          className="p-1"
                          activeOpacity={0.7}
                        >
                          <Heart size={18} color={isFav ? "#f43f5e" : "#cbd5e1"} fill={isFav ? "#f43f5e" : "transparent"} />
                        </TouchableOpacity>
                      </View>
                      
                      <View className="flex-row items-center gap-2 mb-3">
                        <View className="border border-slate-200 px-1.5 py-0.5 rounded-md"><Text className="text-[8px] font-bold text-slate-500 uppercase">{lot.type}</Text></View>
                        <Text className="text-[10px] font-bold text-slate-500">
                          {isClosed ? "Closed" : isAccredited ? `₱${lot.rate_per_hour}/hr` : "Walk-In Only"}
                        </Text>
                        {lot.currentDistance !== null && (
                          <Text className="text-[10px] font-black text-blue-600 ml-auto">{lot.currentDistance.toFixed(1)} km</Text>
                        )}
                      </View>

                      <View className="flex-row gap-1.5 mt-auto">
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            handleShowRoute(Number(lot.latitude), Number(lot.longitude));
                          }} 
                          className="flex-1 bg-blue-50 py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          {isFetchingRoute ? <ActivityIndicator size="small" color="#2563EB" /> : <RouteIcon size={12} color="#2563EB" />}
                          <Text className="text-[9px] font-black text-blue-600">ROUTE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            openMaps(Number(lot.latitude), Number(lot.longitude), "google");
                          }} 
                          className="flex-1 bg-emerald-500 py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          <Map size={12} color="white" />
                          <Text className="text-[9px] font-black text-white">GMAPS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            openMaps(Number(lot.latitude), Number(lot.longitude), "waze");
                          }} 
                          className="flex-1 bg-[#33CCFF] py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          <Navigation size={12} color="white" />
                          <Text className="text-[9px] font-black text-white">WAZE</Text>
                        </TouchableOpacity>

                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>

          {/* Animated Place Details Bottom Sheet */}
          <Animated.View 
            pointerEvents={activeLot ? "auto" : "none"}
            style={{ transform: [{ translateY }] }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl pt-0 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
          >
            {activeLot && (
              <>
                <View 
                  {...panResponder.panHandlers} 
                  className="w-full py-4 px-4 items-center"
                >
                  <View className="w-12 h-1.5 bg-slate-300 rounded-full" />
                </View>

                <View className="px-4">
                  {/* Header / Photo */}
                  <View className="relative h-40 rounded-2xl overflow-hidden mb-4 bg-slate-200">
                    {activeLot.front_view_url ? (
                      <Image source={{ uri: activeLot.front_view_url }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center bg-slate-100">
                        <MapPin size={32} color="#94a3b8" />
                      </View>
                    )}
                  </View>

                  {/* Title & Meta */}
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 pr-4">
                      <Text className="text-xl font-black text-slate-900">{activeLot.name}</Text>
                      <View className="flex-row items-center mt-1">
                        <View className="bg-slate-100 px-2 py-0.5 rounded-md mr-2">
                          <Text className="text-[10px] font-bold text-slate-600 uppercase">{activeLot.type}</Text>
                        </View>
                        {(() => {
                          const avgRating = lotReviews.length ? (lotReviews.reduce((sum, r) => sum + r.rating, 0) / lotReviews.length) : 0;
                          return avgRating > 0 ? (
                            <View className="flex-row items-center">
                              {renderStars(avgRating)}
                              <Text className="text-[10px] font-bold text-slate-500 ml-1">({lotReviews.length})</Text>
                            </View>
                          ) : (
                            <Text className="text-[10px] font-bold text-slate-400">No reviews yet</Text>
                          );
                        })()}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => toggleFavorite(activeLot.id)} className="p-2 bg-slate-50 rounded-full">
                      <Heart size={22} color={isFavorite(activeLot.id) ? "#f43f5e" : "#cbd5e1"} fill={isFavorite(activeLot.id) ? "#f43f5e" : "transparent"} />
                    </TouchableOpacity>
                  </View>

                  {/* Address & Rates */}
                  <View className="flex-row items-center gap-2 mb-4">
                    <MapPin size={16} color="#64748b" />
                    <Text className="text-xs text-slate-600 flex-1" numberOfLines={1}>{activeLot.address}</Text>
                  </View>
                  
                  {/* Details Grid */}
                  <View className="flex-row flex-wrap gap-y-4 mt-1 mb-5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <View className="w-1/2 flex-row items-center gap-3">
                      <View className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                        <Star size={16} color="#10b981" />
                      </View>
                      <View>
                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rate</Text>
                        <Text className="text-sm font-black text-slate-700">{activeLot.rate_per_hour ? `₱${activeLot.rate_per_hour}/hr` : "Free"}</Text>
                      </View>
                    </View>
                    
                    <View className="w-1/2 flex-row items-center gap-3">
                      <View className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                        <Clock size={16} color="#3b82f6" />
                      </View>
                      <View>
                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</Text>
                        <Text className={`text-sm font-black ${!isParkingOpen(activeLot.open_hours, currentTime) ? "text-rose-500" : "text-emerald-500"}`}>
                          {!isParkingOpen(activeLot.open_hours, currentTime) ? "Closed Now" : "Open Now"}
                        </Text>
                      </View>
                    </View>

                    <View className="w-1/2 flex-row items-center gap-3">
                      <View className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                        <List size={16} color="#f59e0b" />
                      </View>
                      <View>
                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Capacity</Text>
                        <Text className="text-sm font-black text-slate-700">{activeLot.available_slots} / {activeLot.total_slots} left</Text>
                      </View>
                    </View>

                    {activeLot.type === 'private' && (
                      <View className="w-1/2 flex-row items-center gap-3">
                        <View className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                          <Check size={16} color="#8b5cf6" /> 
                        </View>
                        <View>
                          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Reservable</Text>
                          {(() => {
                            const resSlots = slots.filter(s => s.lot_id === activeLot.id && s.status === 'available' && s.is_reservable !== false && s.type !== 'C1' && s.type !== 'PWD');
                            return <Text className="text-sm font-black text-slate-700">{resSlots.length} slots</Text>;
                          })()}
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Comments/Feedback (Top 3) */}
                  {loadingReviews ? (
                    <ActivityIndicator size="small" color="#cbd5e1" className="mb-5" />
                  ) : lotReviews.length > 0 ? (
                    <View className="mb-5">
                      <Text className="text-sm font-bold text-slate-800 mb-3">Recent Reviews</Text>
                      {lotReviews.slice(0, 3).map((review, idx) => (
                        <View key={idx} className="flex-row gap-2 mb-2 bg-slate-50 p-2 rounded-lg">
                          <View className="w-6 h-6 rounded-full bg-[#0A1D37] items-center justify-center">
                            <Text className="text-white text-[10px] font-bold">{(review.profiles?.full_name || "A").charAt(0)}</Text>
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-0.5">
                              <Text className="text-[10px] font-bold text-slate-700">{review.profiles?.full_name || "Anonymous"}</Text>
                              <View className="flex-row">
                                {[...Array(review.rating)].map((_, i) => <Star key={i} size={8} color="#fbbf24" fill="#fbbf24" />)}
                              </View>
                            </View>
                            <Text className="text-[10px] text-slate-600" numberOfLines={2}>{review.review}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Actions */}
                  <View className="flex-row gap-2 mb-6">
                    <TouchableOpacity 
                      onPress={() => handleShowRoute(Number(activeLot.latitude), Number(activeLot.longitude))} 
                      className="flex-1 bg-blue-50 py-3 rounded-xl items-center flex-row justify-center gap-1.5"
                    >
                      {isFetchingRoute ? <ActivityIndicator size="small" color="#2563EB" /> : <RouteIcon size={14} color="#2563EB" />}
                      <Text className="text-[11px] font-black text-blue-600">ROUTE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => openMaps(Number(activeLot.latitude), Number(activeLot.longitude), "google")} 
                      className="flex-1 bg-emerald-500 py-3 rounded-xl items-center flex-row justify-center gap-1.5"
                    >
                      <Map size={14} color="white" />
                      <Text className="text-[11px] font-black text-white">GMAPS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => openMaps(Number(activeLot.latitude), Number(activeLot.longitude), "waze")} 
                      className="flex-1 bg-[#33CCFF] py-3 rounded-xl items-center flex-row justify-center gap-1.5"
                    >
                      <Navigation size={14} color="white" />
                      <Text className="text-[11px] font-black text-white">WAZE</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity 
                    onPress={() => router.push(`/(app)/lot/${activeLot.id}`)}
                    className="w-full bg-[#0A1D37] py-3.5 rounded-xl items-center flex-row justify-center gap-2"
                  >
                    <Text className="text-white font-black text-sm">See Details & Book</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          {filteredAndSorted.map(lot => {
            const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
            const isFav = isFavorite(lot.id);
            const isAccredited = lot.is_accredited === true;

            return (
              <TouchableOpacity
                key={`list-${lot.id}`}
                disabled={!isAccredited}
                onPress={() => {
                  setView("map");
                  handleSelectLot(lot);
                }}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 ${(!isAccredited || isClosed) ? "opacity-80" : ""}`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 pr-4">
                    <Text className="text-base font-black text-slate-800">{lot.name}</Text>
                    {isAccredited ? (
                      (lot.average_rating && lot.average_rating > 0) ? (
                        <View className="flex-row items-center mt-0.5">
                          {renderStars(lot.average_rating)}
                          <Text className="text-[10px] font-bold text-slate-400 ml-1">({Number(lot.average_rating).toFixed(1)})</Text>
                        </View>
                      ) : (
                        <View className="mt-0.5">
                          <Text className="text-[10px] font-bold text-slate-400">No ratings yet</Text>
                        </View>
                      )
                    ) : null}
                    <View className="flex-row items-center gap-1.5 mt-2">
                      <MapPin size={12} color="#94a3b8" />
                      <Text className="text-[11px] text-slate-500">{lot.address}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(lot.id);
                    }} 
                    className="p-2 -mr-2 -mt-2"
                    activeOpacity={0.7}
                  >
                    <Heart size={20} color={isFav ? "#f43f5e" : "#cbd5e1"} fill={isFav ? "#f43f5e" : "transparent"} />
                  </TouchableOpacity>
                </View>

                <View className="flex-row justify-between items-center py-3 border-t border-slate-50 mt-2">
                  <View className="flex-row items-center gap-2">
                    <View className={`w-2 h-2 rounded-full ${isClosed ? 'bg-slate-400' : isAccredited ? (lot.available_slots > 5 ? 'bg-emerald-500' : lot.available_slots > 0 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-400'}`} />
                    <Text className="text-[11px] font-bold text-slate-700">
                      {isClosed ? "Closed" : isAccredited ? `${lot.available_slots} / ${lot.total_slots} slots` : "Walk-in Only"}
                    </Text>
                  </View>
                  {isAccredited && !isClosed && <Text className="font-black text-blue-600">₱{lot.rate_per_hour}<Text className="text-xs text-slate-400 font-medium">/hr</Text></Text>}
                </View>

                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleShowRoute(Number(lot.latitude), Number(lot.longitude));
                    }} 
                    className="flex-1 bg-blue-50 py-3 rounded-xl items-center flex-row justify-center gap-1"
                  >
                    <RouteIcon size={14} color="#2563EB" />
                    <Text className="text-[10px] font-black text-blue-600">ROUTE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation();
                      openMaps(Number(lot.latitude), Number(lot.longitude), "google");
                    }} 
                    className="flex-1 bg-emerald-500 py-3 rounded-xl items-center flex-row justify-center gap-1"
                  >
                    <Map size={14} color="white" />
                    <Text className="text-[10px] font-black text-white">GMAPS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation();
                      openMaps(Number(lot.latitude), Number(lot.longitude), "waze");
                    }} 
                    className="flex-1 bg-[#33CCFF] py-3 rounded-xl items-center flex-row justify-center gap-1"
                  >
                    <Navigation size={14} color="white" />
                    <Text className="text-[10px] font-black text-white">WAZE</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}