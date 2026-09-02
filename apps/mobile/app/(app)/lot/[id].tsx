import { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert, Image, FlatList, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, Clock, Car, ChevronRight, Ban, Star, X, Layers } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import MapViewer from "../../../components/parking/MapViewer";

const logoImage = require("../../../assets/ParKadav2.png");

const renderStaticStars = (rating: number) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <View className="flex-row items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => <Star key={`f-${i}`} size={14} color="#fbbf24" fill="#fbbf24" />)}
      {hasHalf && <Star size={14} color="#fbbf24" fill="#fbbf24" style={{ opacity: 0.5 }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={`e-${i}`} size={14} color="#cbd5e1" />)}
    </View>
  );
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

export default function ParkingLotPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [lot, setLot] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const fetchLotDetails = async () => {
    try {
      if (!id) return;
      const { data: lotData, error: lotError } = await supabase.from("parking_lots").select("*").eq("id", id).single();
      if (lotError) throw lotError;
      setLot(lotData);

      const { data: slotsData, error: slotsError } = await supabase.from("parking_slots").select("*").eq("lot_id", id);
      if (slotsError) throw slotsError;

      const sortedSlots = (slotsData || []).sort((a, b) => {
        const lettersA = a.label.match(/^[A-Za-z]+/)?.[0] || "";
        const lettersB = b.label.match(/^[A-Za-z]+/)?.[0] || "";
        const numA = parseInt(a.label.match(/\d+$/)?.[0] || "0", 10);
        const numB = parseInt(b.label.match(/\d+$/)?.[0] || "0", 10);
        if (lettersA !== lettersB) return lettersA.localeCompare(lettersB);
        return numA - numB;
      });

      const updatedSlots = sortedSlots.map(slot => {
        if (slot.label === "C1") return { ...slot, is_reservable: false };
        return slot;
      });
      setSlots(updatedSlots);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotDetails();
    const channel = supabase
      .channel(`lot-slots-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots', filter: `lot_id=eq.${id}` }, () => fetchLotDetails())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const { data: reviewsData, error: reviewsError } = await supabase.from("parking_reviews").select("id, rating, review, created_at, profile_id").eq("lot_id", id).order("created_at", { ascending: false });
      if (reviewsError) throw reviewsError;
      if (!reviewsData || reviewsData.length === 0) {
        setReviews([]);
        return;
      }

      const userIds = [...new Set(reviewsData.map(r => r.profile_id).filter(Boolean))];
      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        if (!profilesError && profilesData) {
          userMap = new Map(profilesData.map(p => [p.id, p.full_name || "Anonymous"]));
        } else {
          userIds.forEach(u => userMap.set(u, "Anonymous"));
        }
      }

      const formatted = reviewsData.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.review,
        created_at: r.created_at,
        user_name: userMap.get(r.profile_id) || "Anonymous",
      }));
      setReviews(formatted);
    } catch (error) {
      console.error(error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const openReviewsModal = () => {
    setShowReviewsModal(true);
    fetchReviews();
  };

  const handleReserve = () => {
    if (lot?.status === 'suspended') {
      Alert.alert("Unavailable", "This location is currently unavailable.");
      return;
    }
    if (!selectedSlot) {
      Alert.alert("Selection Required", "Please select an available slot first");
      return;
    }
    router.push(`/(app)/reserve/${selectedSlot.id}?lot=${lot.id}`);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 text-slate-500 font-bold">Fetching lot details...</Text>
      </SafeAreaView>
    );
  }

  if (!lot) return null;

  const availableCount = slots.filter(s => s.status === 'available').length;
  const isSuspended = lot?.status === 'suspended';
  const activeHours = lot?.operating_hours || lot?.open_hours;
  const isClosed = activeHours ? !isParkingOpen(activeHours, new Date()) : lot?.status === 'closed';
  const averageRating = lot.average_rating || 0;
  const totalReviews = lot.total_reviews || 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="relative flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-1 rounded-xl active:opacity-70 z-10"
        >
          <Image 
            source={logoImage} 
            className="w-9 h-9 rounded-md" 
            resizeMode="contain" 
          />
        </TouchableOpacity>

        <View className="absolute left-0 right-0 items-center justify-center pointer-events-none px-16">
          <Text className="text-base font-black text-[#0A1D37]" numberOfLines={1}>
            {lot.name}
          </Text>
        </View>

        <View className="w-9" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {lot?.front_view_url && (
          <Image 
            source={{ uri: lot.front_view_url }} 
            className="w-full h-56" 
            resizeMode="cover" 
          />
        )}
        <View className="pb-10">
          {isSuspended && (
            <View className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex-row items-start gap-3">
              <View className="bg-amber-100 p-2 rounded-full"><Ban size={20} color="#d97706" /></View>
              <View className="flex-1">
                <Text className="font-bold text-amber-900">Temporarily Unavailable</Text>
                <Text className="text-xs text-amber-700 mt-1">This parking establishment is currently suspended. Reservations are disabled until further notice.</Text>
              </View>
            </View>
          )}

          {/* Lot Info Card */}
          <View className={`mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 ${isSuspended ? 'opacity-60' : ''}`}>
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center gap-2 mb-2 flex-wrap">
                  <View className={`border px-2 py-0.5 rounded-md ${lot.type === 'private' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <Text className={`text-[10px] font-bold uppercase ${lot.type === 'private' ? 'text-blue-700' : 'text-slate-600'}`}>{lot.type}</Text>
                  </View>
                  <View className={`px-2 py-0.5 rounded-full ${isSuspended || isClosed ? 'bg-slate-200' : availableCount > 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    <Text className={`text-[10px] font-bold ${isSuspended || isClosed ? 'text-slate-600' : availableCount > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isSuspended ? "Inactive" : isClosed ? "Closed" : availableCount > 0 ? `${availableCount} Available` : "Full"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5 text-slate-500">
                  <MapPin size={12} color="#64748b" />
                  <Text className="text-xs font-medium flex-1" numberOfLines={2}>{lot.address}</Text>
                </View>

                {(averageRating > 0 || totalReviews > 0) && (
                  <TouchableOpacity onPress={openReviewsModal} className="flex-row items-center gap-2 mt-3 bg-slate-50 p-2 rounded-xl self-start">
                    <View className="flex-row items-center gap-1">
                      {renderStaticStars(averageRating)}
                      <Text className="text-xs font-bold ml-1 text-slate-800">{averageRating.toFixed(1)}</Text>
                    </View>
                    <Text className="text-xs text-slate-400">({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})</Text>
                    <ChevronRight size={14} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              <View className="items-end">
                <Text className="text-2xl font-black text-[#0A1D37]">{lot.rate_per_hour === 0 ? "Free" : `₱${lot.rate_per_hour}`}</Text>
                {lot.rate_per_hour > 0 && <Text className="text-[10px] font-bold text-slate-400">per hour</Text>}
              </View>
            </View>

            <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <Clock size={14} color="#64748b" />
              <Text className="text-xs font-bold text-slate-600">Open: {lot.operating_hours || lot.open_hours || "24/7"}</Text>
            </View>
          </View>

          {/* Slot Grid */}
          <View className={`mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 ${isSuspended ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Tinanggal ang Rate display sa gilid ng Select a Slot */}
            <View className="mb-5">
              <Text className="text-base font-black text-slate-800">Available Slots</Text>
            </View>

            {/* Floor Tabs */}
            {lot?.floors && lot.floors.length > 1 && (
              <View className="mb-2">
                <View className="flex-row items-center mb-2">
                  <Layers size={16} color="#64748b" />
                  <Text className="text-slate-500 font-bold ml-1 text-sm uppercase">Select Floor</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {lot.floors.map((floorName: string, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setSelectedFloorIndex(idx);
                        // @ts-ignore
                        flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                      }}
                      className={`mr-2 px-4 py-2 rounded-full border ${selectedFloorIndex === idx ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                    >
                      <Text className={`font-bold ${selectedFloorIndex === idx ? 'text-white' : 'text-slate-600'}`}>{floorName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Dynamic 2D Map Swiping */}
            {lot?.floors && lot.floors.length > 0 ? (
              <FlatList
                ref={(ref) => {
                  // @ts-ignore
                  flatListRef.current = ref;
                }}
                horizontal
                snapToInterval={Dimensions.get('window').width - 72 + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingRight: 16 }}
                showsHorizontalScrollIndicator={false}
                data={lot.floors}
                keyExtractor={(item, index) => String(index)}
                onMomentumScrollEnd={(e) => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 72 + 16));
                  if (newIndex !== selectedFloorIndex) {
                    setSelectedFloorIndex(newIndex);
                  }
                }}
                renderItem={({ item, index }) => (
                  <View style={{ width: Dimensions.get('window').width - 72, marginRight: 16 }}>
                    <MapViewer 
                      slots={slots.filter(s => (s.floor_index || 0) === index)} 
                      onSelectSlot={setSelectedSlot} 
                      selectedSlotId={selectedSlot?.id} 
                      isClosed={isClosed}
                    />
                  </View>
                )}
                getItemLayout={(data, index) => (
                  {length: Dimensions.get('window').width - 72 + 16, offset: (Dimensions.get('window').width - 72 + 16) * index, index}
                )}
              />
            ) : (
              <MapViewer 
                slots={slots} 
                onSelectSlot={setSelectedSlot} 
                selectedSlotId={selectedSlot?.id} 
                isClosed={isClosed}
              />
            )}
          </View>

          {selectedSlot && !isSuspended && (
            <View className={`mx-4 mt-4 p-4 rounded-2xl border flex-row items-center gap-3 ${
              isClosed ? 'bg-slate-50 border-slate-200' :
              lot.type === 'public' ? (selectedSlot.status === 'available' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200') :
              'bg-blue-50 border-blue-200'
            }`}>
              <View className="w-12 h-12 rounded-xl bg-white items-center justify-center shadow-sm">
                <Car size={20} color={
                  isClosed ? '#64748b' : 
                  lot.type === 'public' ? (selectedSlot.status === 'available' ? '#10b981' : '#f43f5e') : 
                  '#1d4ed8'
                } />
              </View>
              <View className="flex-1">
                <Text className={`text-base font-black ${
                  isClosed ? 'text-slate-700' : 
                  lot.type === 'public' ? (selectedSlot.status === 'available' ? 'text-emerald-800' : 'text-rose-800') : 
                  'text-blue-900'
                }`}>
                  {isClosed ? `${selectedSlot.label} is currently unavailable` : 
                   lot.type === 'public' ? `${selectedSlot.label} is ${selectedSlot.status === 'available' ? 'Vacant' : 'Occupied'}` : 
                   `Slot ${selectedSlot.label} Selected`}
                </Text>
                <Text className={`text-xs font-bold mt-0.5 ${
                  isClosed ? 'text-slate-500' : 
                  lot.type === 'public' ? (selectedSlot.status === 'available' ? 'text-emerald-600' : 'text-rose-600') : 
                  'text-blue-600'
                }`}>
                  ₱{lot.rate_per_hour}/hr · {lot.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSlot(null)} className={`p-2 rounded-full ${
                isClosed ? 'bg-slate-200' : 
                lot.type === 'public' ? (selectedSlot.status === 'available' ? 'bg-emerald-100' : 'bg-rose-100') : 
                'bg-blue-100'
              }`}>
                <X size={16} color={
                  isClosed ? '#475569' : 
                  lot.type === 'public' ? (selectedSlot.status === 'available' ? '#059669' : '#e11d48') : 
                  '#1d4ed8'
                } />
              </TouchableOpacity>
            </View>
          )}

          {lot.type !== "public" && (
            <View className="mx-4 mt-6 mb-8">
              <TouchableOpacity
                onPress={handleReserve}
                disabled={isSuspended || !selectedSlot}
                className={`w-full h-14 rounded-xl flex-row items-center justify-center shadow-lg ${isSuspended ? 'bg-slate-300' : selectedSlot ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <Text className={`text-base font-bold ${isSuspended ? 'text-slate-500' : selectedSlot ? 'text-white' : 'text-slate-400'}`}>
                  {isSuspended ? "Location Suspended" : selectedSlot ? `Reserve Slot ${selectedSlot.label}` : "Select a Slot to Reserve"}
                </Text>
                {!isSuspended && selectedSlot && <ChevronRight size={20} color="white" className="ml-2" />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reviews Modal */}
      <Modal visible={showReviewsModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between p-5 border-b border-slate-100">
              <Text className="text-lg font-black text-slate-800">Customer Reviews</Text>
              <TouchableOpacity onPress={() => setShowReviewsModal(false)} className="p-2 bg-slate-100 rounded-full">
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              {loadingReviews ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color="#0A1D37" />
                  <Text className="mt-4 font-bold text-slate-400">Loading reviews...</Text>
                </View>
              ) : reviews.length === 0 ? (
                <View className="py-10 items-center">
                  <Text className="font-bold text-slate-400">No reviews yet. Be the first to rate!</Text>
                </View>
              ) : (
                <View className="pb-10">
                  {reviews.map(review => (
                    <View key={review.id} className="mb-6 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                      <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center gap-3">
                          <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center">
                            <Text className="font-black text-slate-600">{review.user_name?.charAt(0).toUpperCase() || "?"}</Text>
                          </View>
                          <View>
                            <Text className="font-bold text-slate-800">{review.user_name}</Text>
                            <View className="flex-row items-center mt-1">
                              {renderStaticStars(review.rating)}
                              <Text className="text-[10px] font-bold text-slate-400 ml-1.5">{review.rating}.0</Text>
                            </View>
                          </View>
                        </View>
                        <Text className="text-[10px] font-bold text-slate-400">
                          {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      {review.comment && <Text className="text-sm font-medium text-slate-600 leading-relaxed">{review.comment}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}