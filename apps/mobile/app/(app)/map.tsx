import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Linking, ScrollView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Map, List, Search, Navigation, Route as RouteIcon, Crosshair, Star, Heart, MapPin } from "lucide-react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";

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
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem("favoriteParkingLots").then(saved => {
      if (saved) setFavorites(JSON.parse(saved));
    });
    
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
    })();
  }, []);

  const toggleFavorite = async (lotId: number) => {
    setFavorites(prev => {
      const newFavs = prev.includes(lotId) 
        ? prev.filter(id => id !== lotId) 
        : [...prev, lotId];
      
      AsyncStorage.setItem("favoriteParkingLots", JSON.stringify(newFavs)).catch(err => 
        console.error("Failed to save favorites:", err)
      );
      return newFavs;
    });
  };

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

  const openMaps = (lat: number, lng: number, provider: "google" | "waze") => {
    if (provider === "google") {
      const url = Platform.select({
        ios: `maps:0,0?q=${lat},${lng}`,
        android: `google.navigation:q=${lat},${lng}`
      });
      if (url) Linking.openURL(url);
    } else {
      Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
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
    <SafeAreaView className="flex-1 bg-slate-50">
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
          {/* MapView gamit ang native Marker properties (walang custom JSX children) */}
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={lipaCenter}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {routeCoords && <Polyline coordinates={routeCoords} strokeColor="#3b82f6" strokeWidth={4} lineDashPattern={[10, 10]} />}
            
            {filteredAndSorted.map(lot => {
              if (!lot.latitude || !lot.longitude) return null;
              const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
              const isAccredited = lot.is_accredited === true;
              
              // Pin color logic
              let pinColor = '#10b981'; // Green
              if (isClosed) pinColor = '#64748b'; // Gray
              else if (isAccredited) {
                if (lot.available_slots === 0) pinColor = '#f43f5e'; // Red
                else if (lot.available_slots <= 5) pinColor = '#f59e0b'; // Amber
              }

              // Marker status text
              const statusText = isClosed ? "Closed" : isAccredited ? `${lot.available_slots} slots available` : "Walk-in Only";

              return (
                <Marker
                  key={`marker-${lot.id}`}
                  coordinate={{ latitude: Number(lot.latitude), longitude: Number(lot.longitude) }}
                  title={lot.name}
                  description={statusText}
                  pinColor={pinColor}
                  onCalloutPress={() => isAccredited ? router.push(`/(app)/lot/${lot.id}`) : null}
                />
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
          <View 
            pointerEvents="box-none" 
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <View className="bg-white/95 rounded-t-3xl pt-2 pb-6 px-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <View className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{filteredAndSorted.length} Results</Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible pb-2 flex-row">
                {filteredAndSorted.map(lot => {
                  const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
                  const isFavorite = favorites.includes(lot.id);
                  const isAccredited = lot.is_accredited === true;

                  return (
                    <TouchableOpacity
                      key={`card-${lot.id}`}
                      disabled={!isAccredited}
                      onPress={() => router.push(`/(app)/lot/${lot.id}`)}
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
                          <Heart size={18} color={isFavorite ? "#f43f5e" : "#cbd5e1"} fill={isFavorite ? "#f43f5e" : "transparent"} />
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

                      <View className="flex-row gap-2 mt-auto">
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            handleShowRoute(Number(lot.latitude), Number(lot.longitude));
                          }} 
                          className="flex-1 bg-blue-50 py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          {isFetchingRoute ? <ActivityIndicator size="small" color="#2563EB" /> : <RouteIcon size={12} color="#2563EB" />}
                          <Text className="text-[10px] font-black text-blue-600">ROUTE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            e.stopPropagation();
                            openMaps(Number(lot.latitude), Number(lot.longitude), "google");
                          }} 
                          className="flex-1 bg-emerald-500 py-2 rounded-lg items-center flex-row justify-center gap-1"
                        >
                          <Map size={12} color="white" />
                          <Text className="text-[10px] font-black text-white">GMAPS</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {filteredAndSorted.map(lot => {
            const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
            const isFavorite = favorites.includes(lot.id);
            const isAccredited = lot.is_accredited === true;

            return (
              <TouchableOpacity
                key={`list-${lot.id}`}
                disabled={!isAccredited}
                onPress={() => router.push(`/(app)/lot/${lot.id}`)}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 ${(!isAccredited || isClosed) ? "opacity-80" : ""}`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 pr-4">
                    <Text className="text-base font-black text-slate-800">{lot.name}</Text>
                    {isAccredited && lot.average_rating > 0 && renderStars(lot.average_rating)}
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
                    <Heart size={20} color={isFavorite ? "#f43f5e" : "#cbd5e1"} fill={isFavorite ? "#f43f5e" : "transparent"} />
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