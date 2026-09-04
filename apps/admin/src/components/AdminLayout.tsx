import { useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  LayoutDashboard, ParkingSquare, BookOpen, BarChart3, 
  Settings, LogOut, Bell, User, MapPin, 
  CheckCircle2, Users, QrCode, Clock,
  ShieldCheck, DollarSign, FileText, Upload, Save, Pencil, Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@parkada/shared";
import DarkVeil from "@/components/ui/dark-veil"; 
import { useLanguage } from "@/hooks/useLanguage";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const allNavItems = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", allowedRoles: ["super_admin", "superadmin", "manager", "admin"] },
  { path: "/admin/lots", icon: MapPin, label: "Parking Lots", allowedRoles: ["super_admin", "superadmin"] },
  { path: "/admin/slots", icon: ParkingSquare, label: "Parking Slots", allowedRoles: ["super_admin", "superadmin", "manager", "admin", "guard", "staff"] },
  { path: "/admin/scanner", icon: QrCode, label: "QR Scanner", allowedRoles: ["manager", "admin", "guard", "staff"] },
  { path: "/admin/applications", icon: FileText, label: "Partner Applications", allowedRoles: ["super_admin", "superadmin"] },
  { path: "/admin/personnel", icon: User, label: "Personnel", allowedRoles: ["super_admin", "superadmin"] }, 
  { path: "/admin/verifications", icon: ShieldCheck, label: "Verifications", allowedRoles: ["super_admin", "superadmin"] }, 
  { path: "/admin/walkin", icon: DollarSign, label: "Walk‑ins", allowedRoles: ["manager", "admin", "guard", "staff"] },
  { path: "/admin/reservations", icon: BookOpen, label: "Reservations", allowedRoles: ["super_admin", "superadmin", "manager", "admin"] },
  { path: "/admin/reports", icon: BarChart3, label: "Reports", allowedRoles: ["super_admin", "superadmin", "manager", "admin"] },
  { path: "/admin/staffmanagement", icon: Users, label: "Staff Management", allowedRoles: ["manager", "admin"] },
  { path: "/admin/settings", icon: Settings, label: "Settings", allowedRoles: ["super_admin", "superadmin", "manager", "admin"] }, 
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [adminEmail, setAdminEmail] = useState<string>("Loading...");
  const [initials, setInitials] = useState<string>("A");
  const [userId, setUserId] = useState<string | null>(null);
  const [lotType, setLotType] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const avatarRef = useRef<HTMLInputElement>(null);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [editNameValue, setEditNameValue] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState(false);
  
  const adminRole = localStorage.getItem("admin_role") || "manager"; 
  const adminLotId = localStorage.getItem("admin_lot_id");

  const closeDropdowns = () => {
    setShowNotifs(false);
    setShowProfileMenu(false);
  };

  const fetchNotifications = useCallback(async () => {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_role', 'admin') 
      .order('created_at', { ascending: false });

    if (adminRole === "manager" && adminLotId) {
      query = query.or(`lot_id.eq.${adminLotId},lot_id.is.null`);
    }

    const { data } = await query.limit(15);
    if (data) setNotifications(data);
  }, [adminRole, adminLotId]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setAdminEmail(user.email);
        setInitials(user.email.charAt(0).toUpperCase());
        setUserId(user.id);

        const { data: profile } = await supabase
          .from('admin_profiles')
          .select('avatar_url, full_name')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          if (profile.full_name) {
            setFullName(profile.full_name);
            setEditNameValue(profile.full_name);
          }
        }
      }
    };

    const fetchLotType = async () => {
      if (adminLotId) {
        const { data } = await supabase.from('parking_lots').select('type').eq('id', adminLotId).single();
        if (data) setLotType(data.type);
      }
    };

    fetchUser();
    fetchLotType();
    fetchNotifications();

    const notifChannel = supabase
      .channel('admin-notifs-stream')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `recipient_role=eq.admin` 
        }, 
        (payload) => {
          const newN = payload.new;
          if (adminRole === "super_admin" || !newN.lot_id || newN.lot_id === adminLotId) {
            setNotifications(prev => [newN, ...prev]);
            toast.info(`🔔 ${newN.title}`, { 
              description: newN.message,
              action: { label: "View", onClick: () => setShowNotifs(true) }
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(notifChannel); };
  }, [adminRole, adminLotId, fetchNotifications]);

  // Mark single notification as read and navigate
  const handleNotificationClick = async (notif: any) => {
    // Mark as read if not already read
    if (!notif.read) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notif.id);
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      }
    }
    // Navigate based on notification type or related_id
    if (notif.type === 'reservation_confirmed' || notif.type === 'reservation_started' || notif.type === 'reservation_completed') {
      setLocation('/admin/reservations');
    } else if (notif.type === 'vehicle_added' || notif.type === 'walkin_recorded') {
      setLocation('/admin/walkin');
    } else if (notif.type === 'session_expiring' || notif.type === 'overtime_fee') {
      setLocation('/admin/reservations');
    } else if (notif.related_id) {
      // Fallback: try to go to reservations page
      setLocation('/admin/reservations');
    } else {
      setLocation('/admin/dashboard');
    }
    setShowNotifs(false);
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true }) 
      .eq('recipient_role', 'admin')
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success(t("All notifications marked as read", "All notifications marked as read"));
    }
  };

  useEffect(() => {
    if (!userId) return;
    const subscription = supabase
      .channel('admin-status-kicker')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_profiles', filter: `id=eq.${userId}` },
        async (payload: any) => {
          if (payload.new.status === 'Suspended') {
            toast.error(t("⚠️ SYSTEM ALERT: Ang iyong account ay sinuspinde.", "⚠️ SYSTEM ALERT: Ang iyong account ay sinuspinde."), { duration: 8000 });
            await supabase.auth.signOut();
            localStorage.removeItem('admin_role');
            localStorage.removeItem('admin_lot_id');
            setTimeout(() => { setLocation("/admin"); }, 2000);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [userId, setLocation]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_lot_id');
      toast.success(t("Successfully logged out", "Successfully logged out"));
      setLocation("/admin");
    } catch (error) {
      toast.error(t("Error logging out", "Problema logging out"));
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const toastId = toast.loading(t("Uploading profile picture...", "Ina-upload ang profile picture..."));
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("lot-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("lot-documents")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      setAvatarUrl(publicUrl);

      const { error: dbError } = await supabase
        .from("admin_profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (dbError) throw dbError;

      toast.success(t("Profile picture updated!", "Na-update na ang profile picture!"), { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(t(`Upload failed: ${err.message}`, `Nabigo ang pag-upload: ${err.message}`), { id: toastId });
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleSaveName = async () => {
    if (!userId || !editNameValue.trim()) return;
    setIsSavingName(true);
    const toastId = toast.loading(t("Saving name...", "Sini-save ang pangalan..."));
    try {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ full_name: editNameValue.trim() })
        .eq('id', userId);
      
      if (error) throw error;
      
      setFullName(editNameValue.trim());
      toast.success(t("Name updated successfully!", "Na-update ang pangalan!"), { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(t(`Save failed: ${err.message}`, `Nabigo ang pag-save: ${err.message}`), { id: toastId });
    } finally {
      setIsSavingName(false);
    }
  };

  const filteredNavItems = allNavItems.filter(item => {
    if (!item.allowedRoles.includes(adminRole)) return false;
    if (item.path === "/admin/reservations" && lotType === "public") return false;
    return true;
  });
  const unreadCount = notifications.filter(n => n.read === false).length;

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      
      {/* Sidebar (unchanged) */}
      <aside className="w-64 flex flex-col shrink-0 z-20 relative overflow-hidden bg-black text-white border-r border-border/50">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <DarkVeil
            speed={1.5}
            noiseIntensity={0.05}
            scanlineIntensity={0.3}
            scanlineFrequency={800}
            hueShift={(adminRole === 'superadmin' || adminRole === 'super_admin') ? 260 : 15}
            warpAmount={0.3}
            resolutionScale={1}
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10 flex flex-col h-full w-full">
          <button
            onClick={() => setLocation("/admin/dashboard")}
            className="w-full flex items-center gap-3 px-6 py-5 border-b border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <img src="/ParKadav2.png" alt="ParKada Logo" className="w-10 h-10 object-contain drop-shadow-md" />
            <div className="text-left">
              <p className="font-bold text-lg text-white">ParKada</p>
              <p className="text-xs text-white/70 capitalize">
                {(adminRole === 'superadmin' || adminRole === 'super_admin') ? 'Super Admin' : (adminRole === 'staff' || adminRole === 'guard') ? 'Staff' : 'Lot Manager'} Panel
              </p>
            </div>
          </button>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map(({ path, icon: Icon, label }) => {
              const isActive = location === path;
              return (
                <button
                  key={path}
                  onClick={() => setLocation(path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-white text-slate-900 shadow-md font-bold" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-white/10 space-y-1">
            {/* Profile section: NON-CLICKABLE (no button) */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-xs font-bold text-white uppercase border border-white/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white capitalize truncate">
                  {fullName || ((adminRole === 'superadmin' || adminRole === 'super_admin') ? 'Super Admin' : 'Manager')}
                </p>
                <p className="text-[10px] text-white/50 truncate" title={adminEmail}>
                  {adminEmail}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border shrink-0 relative z-40">
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          
          <div className="flex items-center gap-3">
            {/* NOTIFICATIONS DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => { setShowProfileMenu(false); setShowNotifs(!showNotifs); }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell size={16} className="text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white"></span>
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-slate-50 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800">Notifications</h4>
                    {unreadCount > 0 && <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            "w-full text-left px-4 py-2.5 border-b border-border flex gap-3 transition-colors cursor-pointer",
                            n.read === false ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50 opacity-70"
                          )}
                        >
                          <div className={cn("mt-0.5 p-1.5 rounded-full shrink-0", n.type === 'urgent' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600")}>
                            {n.type === 'urgent' ? <Bell size={12} /> : <CheckCircle2 size={12} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 truncate">{n.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                            <p className="text-[8px] text-slate-400 mt-1 uppercase font-medium flex items-center gap-1">
                              <Clock size={8} /> {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400 text-[11px] italic">No notifications yet.</div>
                    )}
                  </div>
                  <div className="bg-slate-50 border-t border-border p-1.5">
                    <button onClick={markAllAsRead} className="w-full text-center text-[11px] text-primary font-bold hover:underline py-1">
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PROFILE DROPDOWN */}
            <div className="relative">
              <button 
                onClick={() => { setShowNotifs(false); setShowProfileMenu(!showProfileMenu); }}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm border-2 border-white ring-1 ring-slate-200 cursor-pointer overflow-hidden hover:ring-primary transition-all"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-72 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 flex flex-col">
                  {/* Profile Header & Picture */}
                  <div className="bg-slate-50 border-b border-border p-6 flex flex-col items-center relative">
                    <div className="w-20 h-20 rounded-full border-4 border-white shadow-sm overflow-hidden bg-primary flex items-center justify-center text-2xl font-bold text-white relative group">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                      <div 
                        onClick={() => avatarRef.current?.click()}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Upload Picture"
                      >
                        <ImageIcon size={20} className="text-white" />
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => avatarRef.current?.click()}
                      className="mt-3 text-xs font-bold text-primary hover:underline"
                    >
                      Change Picture
                    </button>
                    
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={avatarRef} 
                      onChange={handleUploadAvatar} 
                    />
                  </div>

                  {/* Name Configuration */}
                  <div className="p-4 border-b border-border space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                        <Pencil size={10} /> Display Name
                      </label>
                      <input 
                        type="text" 
                        placeholder="Enter full name"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleSaveName}
                      disabled={isSavingName || editNameValue.trim() === fullName}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save size={14} />
                      {isSavingName ? "Saving..." : "Save Name"}
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="p-2 bg-slate-50">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-rose-600 font-bold hover:bg-rose-100 transition-all"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* OVERLAY */}
        {(showNotifs || showProfileMenu) && (
          <div className="fixed inset-0 z-30" onClick={closeDropdowns} aria-hidden="true" />
        )}

        <main className="flex-1 overflow-y-auto p-6 bg-background relative z-10 text-sm">
          {children}
        </main>
      </div>
    </div>
  );
}