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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    // 1. Authenticate Portal User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { application_id, staff_id, new_password } = await req.json();
    if (!application_id || !staff_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Verify ownership of application and get linked lot
    const { data: application, error: appError } = await supabaseAdmin
      .from('partner_applications')
      .select('user_id, linked_lot_id')
      .eq('id', application_id)
      .single();

    if (appError || !application || application.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Application not found or unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (!application.linked_lot_id) {
      return new Response(
        JSON.stringify({ error: "No parking establishment linked to this application" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Verify the staff belongs to this linked_lot_id
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('admin_profiles')
      .select('id, assigned_lot_id')
      .eq('id', staff_id)
      .single();

    if (staffError || !staffData || staffData.assigned_lot_id !== application.linked_lot_id) {
      return new Response(
        JSON.stringify({ error: "Staff member not found or does not belong to your establishment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // 4. Reset Staff Password via Supabase Auth Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      staff_id,
      { password: new_password }
    );

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Staff password updated successfully!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
