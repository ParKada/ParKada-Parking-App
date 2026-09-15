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
    const { email, password, full_name, lot_id, role, application_id } = await req.json();
    if (!email || !password || !lot_id || !role || !full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Create user via Supabase Admin API
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto confirm so they can login immediately
      user_metadata: { full_name }
    });

    if (createError) {
      if (createError.message && (createError.message.includes("already registered") || createError.message.includes("already exists") || createError.message.includes("already been registered"))) {
        return new Response(
          JSON.stringify({ error: "This email is already registered as an admin." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      throw createError;
    }

    const userId = createdUser.user.id;

    // 2. Insert into admin_profiles
    const { error: profileError } = await supabaseAdmin
      .from("admin_profiles")
      .insert({ 
        id: userId, 
        role: role, 
        assigned_lot_id: lot_id, 
        status: "Active",
        email: email,
        full_name: full_name
      });
      
    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // 3. If this was from an application, update application status
    if (application_id) {
      const { error: appError } = await supabaseAdmin
        .from("partner_applications")
        .update({
          parkada_email: email,
          linked_lot_id: lot_id,
          status: "account_activated",
          activated_at: new Date().toISOString(),
          current_password: password
        })
        .eq("id", application_id);
        
      if (!appError) {
        // Create audit log
        await supabaseAdmin.from("partner_application_audit_log").insert({
          application_id,
          changed_by_role: "super_admin",
          new_status: "account_activated",
          notes: `Account created for ${email}`
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
