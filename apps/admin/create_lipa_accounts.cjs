const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo';

const supabase = createClient(supabaseUrl, supabaseKey);

const lotId = '0dea029d-4f5e-4cf0-b892-6c154b541597';

async function createUserAndProfile(email, password, fullName, role) {
  console.log(`Creating user: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId;
  if (authError) {
    console.log("Auth creation error (might exist):", authError.message);
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const user = usersData.users.find(u => u.email === email);
    if (!user) {
      console.error("Could not find user after error.");
      return null;
    }
    userId = user.id;
    await supabase.auth.admin.updateUserById(userId, { password });
    console.log("Updated password for existing user.");
  } else {
    userId = authData.user.id;
  }

  console.log(`User ID: ${userId}. Upserting to admin_profiles...`);
  const { error: profileError } = await supabase.from('admin_profiles').upsert({
    id: userId,
    email: email,
    full_name: fullName,
    role: role,
    status: 'Active',
    assigned_lot_id: lotId
  });

  if (profileError) {
    console.error("Error updating profile:", profileError);
  } else {
    console.log(`Successfully configured ${role} account!`);
  }
  return userId;
}

async function main() {
  const adminId = await createUserAndProfile('lipa.public.market@parkada.com', 'LipaPublicMarket!01', 'Lipa City Public Market Admin', 'admin');
  const staffId = await createUserAndProfile('staff.lipa.public.market@parkada.com', 'LipaPublicMarket!01', 'Lipa City Public Market Staff', 'staff');

  if (adminId) {
    console.log("Setting owner_id of parking lot...");
    const { error } = await supabase.from('parking_lots').update({ owner_id: adminId }).eq('id', lotId);
    if (error) {
      console.error("Error updating parking lot:", error);
    } else {
      console.log("Parking lot owner_id updated successfully.");
    }
  }
}

main().catch(console.error);
