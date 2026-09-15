import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Favourite parking establishments.
 *
 * Table (see supabase/parkada_updates.sql):
 *   favorites(id, profile_id, lot_id, created_at)
 *   unique (profile_id, lot_id)
 *
 * `profile_id` is used rather than `user_id` to stay consistent with the
 * `reservations` table, which already keys off `profile_id`.
 *
 * The hook keeps a single module-level cache so every screen that uses it
 * (home, favourites, lot details) shows the same heart state instantly,
 * without pulling in a state library.
 */

export const FAVORITES_TABLE = "favorites";

let cachedIds: Set<string> | null = null;
let cachedUserId: string | null = null;
let tableMissing = false;

type Listener = (ids: Set<string>) => void;
const listeners = new Set<Listener>();

function broadcast() {
  const snapshot = new Set(cachedIds ?? []);
  listeners.forEach((listener) => listener(snapshot));
}

function isMissingTableError(error: any) {
  // 42P01 = undefined_table
  return error?.code === "42P01" || /does not exist/i.test(error?.message ?? "");
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(cachedIds ?? []),
  );
  const [loading, setLoading] = useState(cachedIds === null);
  const [missingTable, setMissingTable] = useState(tableMissing);

  useEffect(() => {
    const listener: Listener = (ids) => setFavoriteIds(ids);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        cachedIds = new Set();
        cachedUserId = null;
        broadcast();
        return;
      }

      cachedUserId = user.id;

      const { data, error } = await supabase
        .from(FAVORITES_TABLE)
        .select("lot_id")
        .eq("profile_id", user.id);

      if (error) {
        if (isMissingTableError(error)) {
          tableMissing = true;
          setMissingTable(true);
          cachedIds = new Set();
          broadcast();
          console.warn(
            "[useFavorites] The `favorites` table does not exist yet. " +
              "Run supabase/parkada_updates.sql to create it.",
          );
          return;
        }
        throw error;
      }

      tableMissing = false;
      setMissingTable(false);
      cachedIds = new Set((data ?? []).map((row: any) => String(row.lot_id)));
      broadcast();
    } catch (error) {
      console.warn("[useFavorites] refresh failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedIds === null) refresh();
    else setLoading(false);
  }, [refresh]);

  const isFavorite = useCallback(
    (lotId: string | number) => favoriteIds.has(String(lotId)),
    [favoriteIds],
  );

  /**
   * Optimistically flips the heart, then writes to the database.
   * Reverts and returns an error message if the write fails.
   */
  const toggleFavorite = useCallback(
    async (lotId: string | number): Promise<{ ok: boolean; added: boolean; error?: string }> => {
      const key = String(lotId);
      const wasFavorite = (cachedIds ?? new Set()).has(key);

      let userId = cachedUserId;
      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
        cachedUserId = userId;
      }
      if (!userId) {
        return { ok: false, added: false, error: "You need to be signed in." };
      }

      // Optimistic update
      const next = new Set(cachedIds ?? []);
      if (wasFavorite) next.delete(key);
      else next.add(key);
      cachedIds = next;
      broadcast();

      try {
        if (wasFavorite) {
          const { error } = await supabase
            .from(FAVORITES_TABLE)
            .delete()
            .eq("profile_id", userId)
            .eq("lot_id", key);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from(FAVORITES_TABLE)
            .upsert(
              { profile_id: userId, lot_id: key },
              { onConflict: "profile_id,lot_id", ignoreDuplicates: true },
            );
          if (error) throw error;
        }
        return { ok: true, added: !wasFavorite };
      } catch (error: any) {
        // Revert
        const reverted = new Set(cachedIds ?? []);
        if (wasFavorite) reverted.add(key);
        else reverted.delete(key);
        cachedIds = reverted;
        broadcast();

        if (isMissingTableError(error)) {
          tableMissing = true;
          setMissingTable(true);
          return {
            ok: false,
            added: false,
            error: "Favourites are not set up yet. Run parkada_updates.sql in Supabase.",
          };
        }
        return { ok: false, added: false, error: error?.message ?? "Could not save that." };
      }
    },
    [],
  );

  return {
    favoriteIds,
    favoriteCount: favoriteIds.size,
    isFavorite,
    toggleFavorite,
    refresh,
    loading,
    missingTable,
  };
}

/** Clear the cache on sign-out so the next user does not inherit hearts. */
export function resetFavoritesCache() {
  cachedIds = null;
  cachedUserId = null;
  tableMissing = false;
  broadcast();
}