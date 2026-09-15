import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Trophy, MapPin, ChevronRight, CalendarX2 } from "lucide-react-native";
import { supabase } from "../lib/supabase";

/**
 * "Most Reserved" — the establishment this driver has booked most often.
 *
 * Schema facts (from the actual DDL):
 *  - reservations.profile_id  → the signed-in user
 *  - reservations.lot_id      → direct FK to parking_lots (no join needed)
 *  - reservations.status      → 'pending'|'reserved'|'active'|'completed'|'cancelled'
 *
 * Cancelled reservations are excluded. Everything else counts as a visit.
 */

const EXCLUDED_STATUSES = new Set(["cancelled"]);

type MostReserved = {
  lotId: string;
  name: string;
  address: string | null;
  count: number;
  tiedWith: number;
  lastVisit: string | null;
};

export default function MostReservedCard({
  onPressLot,
  refreshKey,
}: {
  onPressLot?: (lotId: string) => void;
  refreshKey?: number | string;
}) {
  const router = useRouter();
  const [data, setData] = useState<MostReserved | null>(null);
  const [totalCounted, setTotalCounted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setData(null);
        return;
      }

      // reservations.lot_id is a direct FK — no slot join needed.
      const { data: rows, error } = await supabase
        .from("reservations")
        .select("lot_id, status, start_time, created_at")
        .eq("profile_id", user.id)
        .not("lot_id", "is", null);

      if (error) throw error;

      // Tally by lot_id, skipping excluded statuses.
      const tally = new Map<string, { count: number; last: string | null }>();
      let counted = 0;

      (rows ?? []).forEach((row: any) => {
        const status = String(row.status ?? "").toLowerCase();
        if (EXCLUDED_STATUSES.has(status)) return;

        const lotId = String(row.lot_id ?? "").trim();
        if (!lotId) return;

        counted += 1;
        const stamp: string | null = row.start_time || row.created_at || null;
        const existing = tally.get(lotId);

        if (existing) {
          existing.count += 1;
          if (stamp && (!existing.last || new Date(stamp) > new Date(existing.last))) {
            existing.last = stamp;
          }
        } else {
          tally.set(lotId, { count: 1, last: stamp });
        }
      });

      setTotalCounted(counted);

      if (tally.size === 0) {
        setData(null);
        return;
      }

      const entries = Array.from(tally.entries());
      const highestCount = Math.max(...entries.map(([, v]) => v.count));
      const leaders = entries.filter(([, v]) => v.count === highestCount);

      // Tie-break: most recent visit first.
      leaders.sort(([, a], [, b]) => {
        const at = a.last ? new Date(a.last).getTime() : 0;
        const bt = b.last ? new Date(b.last).getTime() : 0;
        return bt - at;
      });

      const [winnerId, winner] = leaders[0];

      // Fetch the lot name + address.
      const { data: lotRow } = await supabase
        .from("parking_lots")
        .select("name, address")
        .eq("id", winnerId)
        .maybeSingle();

      setData({
        lotId: winnerId,
        name: lotRow?.name ?? "Parking establishment",
        address: lotRow?.address ?? null,
        count: winner.count,
        tiedWith: leaders.length - 1,
        lastVisit: winner.last,
      });
    } catch (err: any) {
      console.error("[MostReservedCard]", err);
      setErrorMessage(err?.message ?? "Could not work out your most reserved spot.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handlePress = () => {
    if (!data) return;
    if (onPressLot) onPressLot(data.lotId);
    else router.push(`/lot/${data.lotId}`);
  };

  /* --------------------------- render states ----------------------------- */

  if (loading) {
    return (
      <View className="bg-white rounded-[20px] border border-slate-100 shadow-sm p-5 min-h-[100px] items-center justify-center">
        <ActivityIndicator color="#0A1D37" />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View className="bg-white rounded-[20px] border border-slate-100 shadow-sm p-5">
        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
          Most Reserved
        </Text>
        <Text className="text-xs text-slate-500 font-medium">{errorMessage}</Text>
        <TouchableOpacity onPress={load} className="mt-3">
          <Text className="text-xs font-black text-blue-600">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) {
    return (
      <View className="bg-white rounded-[20px] border border-dashed border-slate-200 p-5 items-center">
        <View className="w-12 h-12 rounded-full bg-slate-50 items-center justify-center mb-3">
          <CalendarX2 size={22} color="#94a3b8" strokeWidth={1.8} />
        </View>
        <Text className="text-sm font-black text-slate-700">No reservations yet</Text>
        <Text className="text-[11px] text-slate-400 font-medium text-center mt-1 max-w-[220px]">
          Book your first slot and your go-to spot will appear here.
        </Text>
        <TouchableOpacity onPress={() => router.push("/map")} className="mt-3.5">
          <Text className="text-xs font-black text-blue-600">Find parking</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      className="bg-[#0A1D37] rounded-[20px] p-5 shadow-lg"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Trophy size={13} color="#fbbf24" />
          <Text className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
            Most Reserved
          </Text>
        </View>
        <ChevronRight size={16} color="rgba(255,255,255,0.45)" />
      </View>

      <View className="flex-row items-end justify-between">
        <View className="flex-1 pr-4">
          <Text
            className="text-white font-black text-lg tracking-tight"
            numberOfLines={2}
          >
            {data.name}
          </Text>

          {data.address ? (
            <View className="flex-row items-center gap-1.5 mt-1.5">
              <MapPin size={11} color="rgba(255,255,255,0.45)" />
              <Text
                className="text-white/55 text-[11px] font-medium flex-1"
                numberOfLines={1}
              >
                {data.address}
              </Text>
            </View>
          ) : null}

          {data.tiedWith > 0 && (
            <Text className="text-white/40 text-[10px] font-medium mt-2">
              Tied with {data.tiedWith} other
              {data.tiedWith === 1 ? "" : "s"} — showing your most recent
            </Text>
          )}
        </View>

        <View className="items-end">
          <Text className="text-amber-400 text-[34px] font-black leading-none">
            {data.count}
          </Text>
          <Text className="text-white/55 text-[10px] font-bold uppercase tracking-wide mt-1">
            {data.count === 1 ? "reservation" : "reservations"}
          </Text>
        </View>
      </View>

      {totalCounted > data.count && (
        <View className="mt-4 pt-3 border-t border-white/10">
          <Text className="text-white/40 text-[10px] font-medium">
            {data.count} of {totalCounted} total ·{" "}
            {Math.round((data.count / totalCounted) * 100)}% of your parking
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}