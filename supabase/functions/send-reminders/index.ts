// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req) => {
  try {
    // Find reservations that start in exactly 30 minutes 
    // We use a 2-minute window (29-31 mins) because cron runs every minute
    const { data: upcomingReservations, error } = await supabaseAdmin
      .from("reservations")
      .select("*, profiles(expo_push_token)")
      .eq("status", "reserved")
      .gte("start_time", new Date(Date.now() + 29 * 60000).toISOString())
      .lte("start_time", new Date(Date.now() + 31 * 60000).toISOString());

    if (error) throw error;

    const pushPromises = upcomingReservations
      .filter((res: any) => res.profiles?.expo_push_token)
      .map(async (res: any) => {
        const token = res.profiles.expo_push_token;
        const timeStr = new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: token,
            sound: "default",
            title: "Upcoming Parking Session",
            body: `Your parking reservation starts in 30 minutes at ${timeStr}.`,
          }),
        });
      });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ success: true, processed: pushPromises.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
