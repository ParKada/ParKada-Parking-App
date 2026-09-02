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
    // 1. Authenticate user
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

    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(
        JSON.stringify({ error: "Missing application_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Verify ownership & get linked_lot_id
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
        JSON.stringify({ data: [] }), // No lot linked yet, so no staff
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 3. Fetch staff profiles
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('admin_profiles')
      .select('id, full_name, email, role, status')
      .eq('assigned_lot_id', application.linked_lot_id)
      .neq('role', 'manager') // Exclude the manager (which is the applicant)
      .order('created_at', { ascending: false });

    if (staffError) throw staffError;

    return new Response(
      JSON.stringify({ data: staff || [] }),
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
