import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Star, MapPin, Navigation, Heart } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useFavorites } from "../../hooks/useFavorites";

export default function FavoritesScreen() {
  const { favoriteIds, toggleFavorite, loading: favsLoading } = useFavorites();
  const [favoriteLots, setFavoriteLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavoriteLots = async () => {
      if (!favoriteIds || favoriteIds.size === 0) {
        setFavoriteLots([]);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("parking_lots")
          .select(`*, parking_reviews ( rating )`)
          .in("id", Array.from(favoriteIds));
        
        if (error) throw error;

        const enriched = (data || []).map(lot => {
          const reviews = lot.parking_reviews || [];
          const validReviews = reviews.filter((r: any) => r && typeof r.rating === 'number');
          const totalRating = validReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
          const computedAvg = validReviews.length > 0 ? totalRating / validReviews.length : 0;
          
          return {
            ...lot,
            average_rating: lot.average_rating || computedAvg,
            total_reviews: lot.total_reviews || validReviews.length,
          };
        });

        setFavoriteLots(enriched);
      } catch (error) {
        console.error("Error fetching favorite lots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteLots();
  }, [favoriteIds]);

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

  if (loading || favsLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0A1D37" />
        <Text className="mt-4 font-bold text-slate-500">Loading Favorites...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View className="flex-row items-center px-4 py-4 bg-white border-b border-slate-100 z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-slate-50 rounded-full border border-slate-100 mr-3">
          <ChevronLeft size={24} color="#0A1D37" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-slate-800">Favorite Spots</Text>
      </View>

      {favoriteLots.length === 0 ? (
        <View className="flex-1 justify-center items-center p-8">
          <Heart size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <Text className="text-slate-500 font-bold text-center text-base mb-2">No favorites yet</Text>
          <Text className="text-slate-400 text-sm text-center">Tap the heart icon on any parking lot to save it for quick access later.</Text>
          <TouchableOpacity onPress={() => router.push("/map")} className="mt-6 bg-[#0A1D37] px-6 py-3 rounded-xl">
            <Text className="text-white font-bold">Find Parking</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {favoriteLots.map((lot) => (
            <TouchableOpacity
              key={lot.id}
              onPress={() => router.push(`/(app)/lot/${lot.id}`)}
              activeOpacity={0.9}
              className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4"
            >
              <View className="flex-row gap-4">
                <View className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100">
                  {lot.image_url ? (
                    <Image source={{ uri: lot.image_url }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <MapPin size={24} color="#94a3b8" />
                    </View>
                  )}
                </View>

                <View className="flex-1 justify-center">
                  <View className="flex-row justify-between items-start">
                    <Text className="text-base font-black text-slate-800 pr-2 flex-1" numberOfLines={1}>{lot.name}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(lot.id);
                      }}
                      className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center -mr-1 -mt-1"
                    >
                      <Heart size={16} color="#e11d48" fill="#e11d48" />
                    </TouchableOpacity>
                  </View>

                  <Text className="text-[11px] text-slate-500 font-medium mb-1" numberOfLines={1}>
                    {lot.address}
                  </Text>

                  <View className="flex-row items-center gap-2 mt-1">
                    {renderStars(lot.average_rating)}
                    {lot.total_reviews > 0 && (
                      <Text className="text-[9px] text-slate-400 font-bold">({lot.total_reviews} reviews)</Text>
                    )}
                  </View>

                  <View className="flex-row items-center justify-between mt-2">
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-base font-black text-[#0A1D37]">₱{lot.rate_per_hour || 30}</Text>
                      <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">/ hr</Text>
                    </View>
                    <View className="flex-row items-center gap-1 bg-[#0A1D37]/5 px-2 py-1 rounded-md">
                      <Navigation size={10} color="#0A1D37" />
                      <Text className="text-[9px] font-black text-[#0A1D37]">VIEW DETAILS</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View className="h-6" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
