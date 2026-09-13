// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("[reserve-slot] incoming payload:", JSON.stringify(body));

    // NOTE: renamed from `user_id` -> `profile_id`. The frontend
    // (payment/index.tsx) sends `profile_id`, and the `reservations` table's
    // actual FK column is `profile_id` (not `user_id`). The previous
    // mismatch meant this always read as undefined, tripping the
    // "Missing required fields" 400 below on every single request.
    const { slot_id, profile_id, lot_id, plate_number, start_time, end_time, duration, total_amount, payment_method } = body;

    if (!slot_id || !profile_id || !lot_id || !plate_number || !start_time || !end_time) {
      console.log("[reserve-slot] missing required fields", { slot_id, profile_id, lot_id, plate_number, start_time, end_time });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TC-18: Check Maintenance Mode
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("system_settings")
      .select("maintenance_mode")
      .eq("id", 1)
      .single();

    if (settingsError) console.log("[reserve-slot] settings lookup error:", settingsError.message);

    if (settings?.maintenance_mode) {
      return new Response(JSON.stringify({ error: "System is currently under maintenance. New reservations are temporarily disabled." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Business rule (replaces the old "verified user" gate): a user can
    // only book if they have at least one registered, active vehicle, and
    // the specific plate being booked with must belong to them. Verification
    // status is intentionally NOT checked here anymore — it now only
    // affects discount eligibility (see below).
    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("profile_id", profile_id)
      .eq("plate_number", plate_number.toUpperCase())
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (vehicleError) {
      console.log("[reserve-slot] vehicle lookup error:", vehicleError.message);
      throw vehicleError;
    }

    if (!vehicle) {
      console.log("[reserve-slot] no matching active vehicle for profile", profile_id, plate_number);
      return new Response(JSON.stringify({ error: "This vehicle is not registered to your account, or is inactive. Please register it first." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TC-12: Enforce Maximum 3 Active Reservations per User
    const { count: activeCount, error: countError } = await supabaseAdmin
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profile_id)
      .in("status", ["active", "confirmed", "reserved"]);

    if (countError) {
      console.log("[reserve-slot] active count error:", countError.message);
      throw countError;
    }

    console.log("[reserve-slot] active reservation count for profile:", activeCount);

    if (activeCount !== null && activeCount >= 3) {
      return new Response(JSON.stringify({ error: "Reservation failed. You have reached the maximum limit of 3 active bookings." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for overlapping active reservations
    const { data: conflicts, error: checkError } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("slot_id", slot_id)
      .in("status", ["active", "confirmed", "reserved"])
      .filter("start_time", "lt", end_time)
      .filter("end_time", "gt", start_time)
      .limit(1);

    if (checkError) {
      console.log("[reserve-slot] conflict check error:", checkError.message);
      throw checkError;
    }

    if (conflicts && conflicts.length > 0) {
      // 🔥 User‑friendly message
      return new Response(JSON.stringify({ error: "Slot reservation failed. This slot has just been taken by another user. Please choose a different slot or time." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert reservation
    // `duration`, `extension_count`, `extension_fee`, `fine_amount`,
    // `fine_paid`, and `original_end_time` now exist on `reservations`
    // (added via migration) so they're safe to insert again.
    const { data: newRes, error: insertError } = await supabaseAdmin
      .from("reservations")
      .insert({
        profile_id,
        vehicle_id: vehicle.id,
        lot_id,
        slot_id,
        plate_number: plate_number.toUpperCase(),
        start_time,
        end_time,
        duration,
        total_amount,
        payment_method,
        status: "reserved",
        extension_count: 0,
        extension_fee: 0,
        fine_amount: 0,
        fine_paid: false,
        original_end_time: end_time,
      })
      .select()
      .single();

    if (insertError) {
      console.log("[reserve-slot] insert error:", insertError.message);
      throw insertError;
    }

    console.log("[reserve-slot] reservation created:", newRes.id);

    // Update slot status
    const { error: slotUpdateError } = await supabaseAdmin
      .from("parking_slots")
      .update({ status: "reserved" })
      .eq("id", slot_id);

    if (slotUpdateError) console.log("[reserve-slot] slot status update error:", slotUpdateError.message);

    // TC-14: Trigger Push Notification (asynchronous)
    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        user_id: profile_id,
        title: "Reservation Confirmed!",
        message: `Your slot has been successfully reserved for ${plate_number}.`,
      }),
    }).catch(console.error);

    return new Response(JSON.stringify({ success: true, reservation: newRes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[reserve-slot] unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});