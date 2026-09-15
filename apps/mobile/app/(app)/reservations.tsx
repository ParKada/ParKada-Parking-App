import { Modal } from '../../components/SafeModal';
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Clock, Car, Calendar, CheckCircle2, BookmarkCheck, Star, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

const logoImage = require("../../assets/ParKadav2.png");

const formatTimeFromISO = (isoString: string) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

function RatingStars({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {stars.map((star) => {
        const filled = value >= star;
        return (
          <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7} style={{ padding: 4 }}>
            <Star size={36} color={filled ? "#fbbf24" : "#cbd5e1"} fill={filled ? "#fbbf24" : "transparent"} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ReservationsTabScreen() {
  const [reservations, setReservations] = useState([] as any[]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all" as "all" | "active" | "completed");

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null as any);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMyReservations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch user's reservations.
        // NOTE: previously used `parking_slots!inner (...)`, which performs
        // an INNER join — any reservation whose slot join didn't resolve
        // (null slot_id, deleted slot, orphaned FK, etc.) was silently
        // dropped from the results entirely, with no error. That's why
        // reserved/active/pending bookings were invisible on this screen.
        // Switched to a normal (left) join so every reservation the user
        // owns always shows up, even if its slot data is missing — the UI
        // already falls back to "--" for a missing label.
        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_slots (
              label,
              parking_lots (id, name, address)
            )
          `)
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // 2. Fetch user's existing reviews
        const { data: reviews } = await supabase
          .from("parking_reviews")
          .select("reservation_id")
          .eq("profile_id", user.id);

        const ratedReservationIds = new Set(reviews?.map(r => r.reservation_id) || []);

        const enriched = (data || []).map((rawRes: any) => {
          const slotData = Array.isArray(rawRes.parking_slots) ? rawRes.parking_slots[0] : rawRes.parking_slots;
          const lotData = slotData?.parking_lots ? (Array.isArray(slotData.parking_lots) ? slotData.parking_lots[0] : slotData.parking_lots) : null;
          return {
            ...rawRes,
            parking_slots: {
              ...slotData,
              parking_lots: lotData
            },
            duration: String(rawRes.duration || 0),
            total_amount: String(rawRes.total_amount || 0),
            plate_number: String(rawRes.plate_number || "N/A"),
            hasRated: ratedReservationIds.has(rawRes.id)
          };
        });
        setReservations(enriched);
      } catch (error) {
        console.error("Error fetching reservations:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMyReservations();
  }, []);

  const filteredReservations = reservations.filter((res) => {
    if (!res) return false;
    if (activeTab === "all") return true;
    if (activeTab === "active") return res.status === "active" || res.status === "reserved" || res.status === "pending";
    if (activeTab === "completed") return res.status === "completed" || res.status === "cancelled";
    return true;
  });

  const openRatingModal = (reservation: any) => {
    setSelectedReservation(reservation);
    setRating(0);
    setReviewText("");
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (rating === 0) return Alert.alert("Rating Required", "Please select a rating");
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const lotId = selectedReservation?.parking_slots?.parking_lots?.id;

      const { error } = await supabase
        .from("parking_reviews")
        .insert({
          lot_id: lotId,
          profile_id: user.id,
          reservation_id: selectedReservation.id,
          rating,
          review: reviewText.trim() || null
        });
        
      if (error) throw error;

      Alert.alert("Success", "Thank you for your review!");
      setShowRatingModal(false);
      setReservations(prev => prev.map(r => r.id === selectedReservation.id ? { ...r, hasRated: true } : r));
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text style={{ marginTop: 16, fontWeight: 'bold', color: '#64748b' }}>Loading your history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <Image source={logoImage} style={{ width: 40, height: 40, borderRadius: 6 }} resizeMode="contain" />
        <Text className="text-xl font-black text-[#0A1D37]">My Bookings</Text>
      </View>

      <View className="p-4 flex-1">
        <View className="flex-row bg-slate-200 p-1 rounded-xl mb-4">
          {(["all", "active", "completed"] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? "bg-[#0A1D37] shadow-sm" : ""}`}
            >
              <Text className={`text-xs font-bold capitalize ${activeTab === tab ? "text-white" : "text-slate-500"}`}>
                {tab === "active" ? "Active" : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredReservations.length === 0 ? (
          <View className="bg-slate-100 rounded-3xl p-10 items-center border border-dashed border-slate-300 mt-4">
            <View className="mb-4" style={{ opacity: 0.5 }}>
              <Calendar size={48} color="#94a3b8" />
            </View>
            <Text className="text-sm text-slate-500 font-bold text-center">
              {activeTab === "active" ? "No active reservations found." : activeTab === "completed" ? "No completed reservations found." : "No reservations found."}
            </Text>
            {activeTab === "active" ? (
              <TouchableOpacity onPress={() => router.push("/map")} className="mt-4">
                <Text className="text-[#0A1D37] font-black underline">Find Parking</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            <View className="pb-20 space-y-4">
              {filteredReservations.map(res => {
                if (!res) return null;
                const isOngoing = res.status === "active";
                const isReserved = res.status === "reserved" || res.status === "pending";
                const isCancelled = res.status === "cancelled";
                const isCompleted = res.status === "completed";
                const startTimeFormatted = res.start_time ? formatTimeFromISO(res.start_time) : "--:--";
                const endTimeFormatted = res.end_time ? formatTimeFromISO(res.end_time) : "--:--";
                const bookingDate = res.created_at ? formatDate(res.created_at) : "";

                const badgeLabel = isOngoing ? "Active" : isReserved ? "Reserved" : isCancelled ? "Cancelled" : "Completed";
                const badgeBg = isOngoing ? "bg-emerald-100" : isReserved ? "bg-blue-100" : isCancelled ? "bg-red-100" : "bg-slate-100";
                const badgeText = isOngoing ? "text-emerald-700" : isReserved ? "text-blue-700" : isCancelled ? "text-red-700" : "text-slate-500";
                const badgeIconColor = isOngoing ? "#059669" : isReserved ? "#2563EB" : isCancelled ? "#DC2626" : "#64748B";

                return (
                  <TouchableOpacity
                      key={res.id}
                      onPress={() => router.push(`/(app)/receipt/${res.id}`)}
                      activeOpacity={0.8}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-3"
                    >
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-base font-black text-slate-800 flex-1 mr-2" numberOfLines={1}>
                          {res.parking_slots?.parking_lots?.name || "Parking Lot"}
                        </Text>
                        <View className={`px-2 py-1 rounded-full flex-row items-center gap-1 ${badgeBg}`}>
                          {isReserved ? <BookmarkCheck size={12} color={badgeIconColor} /> : <CheckCircle2 size={12} color={badgeIconColor} />}
                          <Text className={`text-[10px] font-bold ${badgeText}`}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </View>

                    <Text className="text-xs font-bold text-slate-500 mb-3">
                      Slot {res.parking_slots?.label || "--"} • {res.plate_number || "N/A"}
                    </Text>

                      <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                          <Clock size={14} color="#64748B" />
                          <Text className="text-[11px] font-medium text-slate-500 truncate" numberOfLines={1}>
                            {bookingDate} • {startTimeFormatted} – {endTimeFormatted}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                          <Car size={14} color="#334155" />
                          <Text className="text-[11px] font-bold text-slate-700">{res.duration} hr{Number(res.duration || 0) > 1 ? 's' : ''}</Text>
                        </View>
                      </View>

                      <View className="h-px bg-slate-100 w-full mb-3" />

                      <View className="flex-row justify-between items-center">
                        <Text className="text-lg font-black text-slate-800">₱{res.total_amount}</Text>
                        {isCompleted && !res.hasRated ? (
                          <TouchableOpacity
                            onPress={() => openRatingModal(res)}
                            className="bg-amber-50 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                          >
                            <Star size={14} color="#d97706" fill="#d97706" />
                            <Text className="text-xs font-bold text-amber-700">Rate</Text>
                          </TouchableOpacity>
                        ) : null}
                        {isCompleted && res.hasRated ? (
                          <View className="px-3 py-1.5 rounded-lg flex-row items-center gap-1">
                            <Star size={14} color="#94a3b8" fill="#94a3b8" />
                            <Text className="text-xs font-bold text-slate-400">Rated</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {showRatingModal ? (
        <Modal visible={true} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e293b' }}>Rate Experience</Text>
                <TouchableOpacity onPress={() => setShowRatingModal(false)} style={{ padding: 8, backgroundColor: '#f1f5f9', borderRadius: 999 }}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4, textAlign: 'center' }}>{selectedReservation?.parking_slots?.parking_lots?.name || "Parking Lot"}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#64748b' }}>Slot {selectedReservation?.parking_slots?.label || "--"} • {selectedReservation?.plate_number || "N/A"}</Text>
              </View>

              <RatingStars value={rating} onChange={setRating} />

              <TextInput
                placeholder="Share your experience (optional)"
                placeholderTextColor="#94a3b8"
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                textAlignVertical="top"
                style={{ width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 14, marginTop: 24, marginBottom: 24, height: 112 }}
              />

              <TouchableOpacity 
                onPress={submitRating}
                disabled={submitting || rating === 0}
                style={{ width: '100%', height: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: submitting || rating === 0 ? '#93c5fd' : '#2563eb' }}
              >
                {submitting ? <ActivityIndicator color="white" /> : <Text style={{ fontWeight: '700', color: 'white', fontSize: 16 }}>Submit Rating</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}