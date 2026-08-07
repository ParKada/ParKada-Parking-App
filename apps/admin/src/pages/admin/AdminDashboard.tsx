import { useEffect, useState } from "react";
import { supabase } from "@parkada/shared";
import SuperAdminDashboard from "./SuperAdminDashboard";
import PartnerAdminDashboard from "./PartnerAdminDashboard";
import AdminLayout from "@/components/AdminLayout";
import { Loader2 } from "lucide-react";

export default function AdminDashboardRouter() {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("admin_profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        if (data) {
          setRole(data.role.toLowerCase());
        }
      }
      setIsLoading(false);
    }
    
    checkRole();
  }, []);

  if (isLoading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="h-full flex items-center justify-center min-h-[50vh]">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      </AdminLayout>
    );
  }

  // Render the specific dashboard based on the user's role
  if (role === "super_admin" || role === "superadmin") {
    return <SuperAdminDashboard />;
  }

  // Default to the partner admin dashboard for "manager" / "admin"
  return <PartnerAdminDashboard />;
}