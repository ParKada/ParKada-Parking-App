import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Clock, Car, Calendar, CheckCircle2, BookmarkCheck, Star, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

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
  return (
    <View className="flex-row items-center justify-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7} className="p-1">
          <Star size={36} color={value >= star ? "#fbbf24" : "#cbd5e1"} fill={value >= star ? "#fbbf24" : "transparent"} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MyReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMyReservations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_slots (
              slot_number,
              parking_lots (id, name, address)
            )
          `)
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const enriched = (data || []).map((res: any) => ({
          ...res,
          hasRated: false
        }));
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
    if (activeTab === "all") return true;
    if (activeTab === "active") return res.status === "active" || res.status === "booked";
    if (activeTab === "completed") return res.status !== "active" && res.status !== "booked";
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

      const { error } = await supabase
        .from("parking_reviews")
        .insert({
          lot_id: selectedReservation.lot_id,
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
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-slate-500">Loading your history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-4 py-4 bg-white border-b border-slate-200">
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
            <Calendar size={48} color="#94a3b8" className="mb-4 opacity-50" />
            <Text className="text-sm text-slate-500 font-bold text-center">No {activeTab !== "all" ? activeTab : ""} reservations found.</Text>
            {activeTab === "active" && (
              <TouchableOpacity onPress={() => router.push("/(app)/map")} className="mt-4">
                <Text className="text-[#0A1D37] font-black underline">Find Parking</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            <View className="pb-20 space-y-4">
              {filteredReservations.map(res => {
                const isOngoing = res.status === "active";
                const isBooked = res.status === "booked";
                const isCompleted = !isOngoing && !isBooked;
                const startTimeFormatted = formatTimeFromISO(res.start_time);
                const endTimeFormatted = formatTimeFromISO(res.end_time);
                const bookingDate = formatDate(res.created_at);

                return (
                  <TouchableOpacity
                    key={res.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(app)/receipt/${res.id}`)}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-3"
                  >
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-base font-black text-slate-800 flex-1 mr-2" numberOfLines={1}>
                        {res.parking_slots?.parking_lots?.name || "Parking Lot"}
                      </Text>
                      <View className={`px-2 py-1 rounded-full flex-row items-center gap-1 ${isOngoing ? "bg-emerald-100" : isBooked ? "bg-blue-100" : "bg-slate-100"}`}>
                        {isBooked ? <BookmarkCheck size={12} color="#2563EB" /> : <CheckCircle2 size={12} color={isOngoing ? "#059669" : "#64748B"} />}
                        <Text className={`text-[10px] font-bold ${isOngoing ? "text-emerald-700" : isBooked ? "text-blue-700" : "text-slate-500"}`}>
                          {isOngoing ? "Active" : isBooked ? "Booked" : "Completed"}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-xs font-bold text-slate-500 mb-3">
                      Slot {res.parking_slots?.slot_number || "--"} • {res.plate_number || "N/A"}
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
                        <Text className="text-[11px] font-bold text-slate-700">{res.duration} hr{res.duration > 1 ? 's' : ''}</Text>
                      </View>
                    </View>

                    <View className="h-px bg-slate-100 w-full mb-3" />

                    <View className="flex-row justify-between items-center">
                      <Text className="text-lg font-black text-slate-800">₱{res.total_amount}</Text>
                      {isCompleted && !res.hasRated && (
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); openRatingModal(res); }}
                          className="bg-amber-50 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                        >
                          <Star size={14} color="#d97706" fill="#d97706" />
                          <Text className="text-xs font-bold text-amber-700">Rate</Text>
                        </TouchableOpacity>
                      )}
                      {isCompleted && res.hasRated && (
                        <View className="px-3 py-1.5 rounded-lg flex-row items-center gap-1">
                          <Star size={14} color="#94a3b8" fill="#94a3b8" />
                          <Text className="text-xs font-bold text-slate-400">Rated</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={showRatingModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-black text-slate-800">Rate Experience</Text>
              <TouchableOpacity onPress={() => setShowRatingModal(false)} className="p-2 bg-slate-100 rounded-full">
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="items-center mb-6">
              <Text className="text-base font-bold text-slate-800 mb-1 text-center">{selectedReservation?.parking_slots?.parking_lots?.name}</Text>
              <Text className="text-xs font-medium text-slate-500">Slot {selectedReservation?.parking_slots?.slot_number} • {selectedReservation?.plate_number}</Text>
            </View>

            <RatingStars value={rating} onChange={setRating} />

            <TextInput
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your experience (optional)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm mt-6 mb-6 h-28"
            />

            <TouchableOpacity
              onPress={submitRating}
              disabled={submitting || rating === 0}
              className={`w-full h-14 rounded-xl flex-row items-center justify-center shadow-md ${submitting || rating === 0 ? "bg-blue-300" : "bg-blue-600"}`}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Submit Rating</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
