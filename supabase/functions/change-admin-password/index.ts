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
    // 1. Get the authenticated user making the request
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { application_id, new_password } = await req.json();

    if (!application_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Verify that this portal user owns the application
    const { data: application, error: appError } = await supabaseAdmin
      .from('partner_applications')
      .select('user_id, parkada_email')
      .eq('id', application_id)
      .single();

    if (appError || !application || application.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Application not found or unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (!application.parkada_email) {
      return new Response(
        JSON.stringify({ error: "No admin account linked to this application" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Find the admin user by email
    const { data: users, error: findUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (findUserError) {
      throw findUserError;
    }

    const adminUser = users.users.find(u => u.email === application.parkada_email);

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin account not found in Auth system" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // 4. Update the Admin User's actual password in Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      adminUser.id,
      { password: new_password }
    );

    if (updateError) {
      throw updateError;
    }

    // 5. Update the current_password column in the database so the portal can see it
    const { error: dbUpdateError } = await supabaseAdmin
      .from('partner_applications')
      .update({ current_password: new_password })
      .eq('id', application_id);

    if (dbUpdateError) {
      throw dbUpdateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
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
