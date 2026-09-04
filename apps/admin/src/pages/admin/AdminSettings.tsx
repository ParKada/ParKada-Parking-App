/*
 * ParKada — AdminSettings (Global System Configuration)
 * Reservation‑only, no advance booking, no grace period.
 * Added: concurrent limits, overtime fee, maintenance mode, etc.
 */
import { useState, useEffect } from "react";
import { supabase } from "@parkada/shared";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Assuming you have a Switch component
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Banknote, Clock, Save, BadgePercent, CalendarClock, CreditCard, 
  Eye, EyeOff, ShieldAlert, Ban, AlertCircle, Car, Settings, Activity, MapPin, Timer, Languages
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export default function AdminSettings() {
  const { language, setLanguage, t } = useLanguage();
  const adminRole = localStorage.getItem("admin_role") || "manager";
  const isSuperAdmin = adminRole === "super_admin" || adminRole === "superadmin";
  const [localLanguage, setLocalLanguage] = useState(language);
  const [isSaving, setIsSaving] = useState(false);
  const [adminLotId, setAdminLotId] = useState<string | null>(null);
  
  // 1. Standard Rates (Manager)
  const [pricingScheme, setPricingScheme] = useState<"hourly" | "fixed">("hourly");
  const [baseRate, setBaseRate] = useState("50");
  const [hourlyRate, setHourlyRate] = useState("20");
  const [fixedRate, setFixedRate] = useState("150");
  const [overnightRate, setOvernightRate] = useState("250");

  // 2. Statutory Discounts
  const [seniorDiscount, setSeniorDiscount] = useState("20");


  // 3. Global Operating Hours
  const [openTime, setOpenTime] = useState("06:00");
  const [closeTime, setCloseTime] = useState("22:00");

  // 4. Reservation Rules (enhanced)
  const [maxReservationHours, setMaxReservationHours] = useState("6");
  const [minReservationHours, setMinReservationHours] = useState("1");
  const [overtimeFeePerHour, setOvertimeFeePerHour] = useState("50");
  const [slotCleanupMinutes, setSlotCleanupMinutes] = useState("10");
  
  // 4b. Global Rules (Super Admin)
  const [maxConcurrentReservations, setMaxConcurrentReservations] = useState("1");
  const [maxVehiclesPerUser, setMaxVehiclesPerUser] = useState("3");
  const [globalMaintenanceMode, setGlobalMaintenanceMode] = useState(false);

  // 5. Feature toggles
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(true);

  // 6. Payment API (mock)
  const [merchantId, setMerchantId] = useState("LGU-IPARK-00192");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchGlobalSettings();
    } else {
      fetchManagerData();
    }
  }, [adminRole]);

  const fetchGlobalSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (data) {
      setMaxConcurrentReservations(data.max_concurrent_reservations?.toString() || "1");
      setMaxVehiclesPerUser(data.max_vehicles_per_user?.toString() || "3");
      setGlobalMaintenanceMode(data.maintenance_mode || false);
    }
  };

  const fetchManagerData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("admin_profiles")
          .select("assigned_lot_id")
          .eq("id", user.id)
          .single();
        
        if (data?.assigned_lot_id) {
          setAdminLotId(data.assigned_lot_id);
          fetchLotSettings(data.assigned_lot_id);
        }
      }
    };

  const parseTimeFrom12Hour = (timeStr: string) => {
    if (!timeStr) return "";
    let [time, modifier] = timeStr.trim().split(" ");
    let [hours, minutes] = time.split(":");
    if (hours === "12") hours = "00";
    if (modifier && modifier.toUpperCase() === "PM") {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours.padStart(2, "0")}:${minutes}`;
  };

  const formatTimeTo12Hour = (time24: string) => {
    if (!time24) return "";
    let [hours, minutes] = time24.split(":");
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h.toString().padStart(2, "0")}:${minutes} ${ampm}`;
  };

  const fetchLotSettings = async (lotId: string) => {
    const { data, error } = await supabase.from('parking_lots').select('*').eq('id', lotId).single();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setPricingScheme(data.pricing_scheme || "hourly");
      setBaseRate(data.base_rate?.toString() || "50");
      setHourlyRate(data.rate_per_hour?.toString() || "20");
      setFixedRate(data.fixed_rate?.toString() || "150");
      setOvernightRate(data.overnight_rate?.toString() || "250");
      setSeniorDiscount(data.senior_discount_pct?.toString() || "20");
      setMaxReservationHours(data.max_reservation_hours?.toString() || "6");
      setMinReservationHours(data.min_reservation_hours?.toString() || "1");
      setOvertimeFeePerHour(data.overtime_fee_per_hour?.toString() || "50");
      setSlotCleanupMinutes(data.slot_cleanup_minutes?.toString() || "10");
      setMaintenanceMode(data.maintenance_mode || false);
      setOnlinePaymentsEnabled(data.online_payments_enabled ?? true);
      
      if (data.operating_hours) {
        const parts = data.operating_hours.split("-");
        if (parts.length === 2) {
          setOpenTime(parseTimeFrom12Hour(parts[0].trim()));
          setCloseTime(parseTimeFrom12Hour(parts[1].trim()));
        }
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (isSuperAdmin) {
      try {
        // Use service key to bypass RLS for system_settings (since this is restricted to super_admin anyway)
        const { createClient } = await import('@supabase/supabase-js');
        const adminSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_SERVICE_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false
            }
          }
        );

        const { error } = await adminSupabase.from('system_settings').upsert({
          id: 1,
          max_concurrent_reservations: parseInt(maxConcurrentReservations),
          max_vehicles_per_user: parseInt(maxVehiclesPerUser),
          maintenance_mode: globalMaintenanceMode,
          updated_at: new Date().toISOString()
        });
        if (error) throw error;
        setLanguage(localLanguage);
        toast.success(t("Global rules saved successfully!", "Matagumpay na nai-save ang global rules!"));
      } catch (err: any) {
        console.error("Global Rules Save Error:", err);
        toast.error(t(`Failed to save global rules: ${err.message || err.details || JSON.stringify(err)}`, `Nabigong i-save ang global rules: ${err.message || err.details || JSON.stringify(err)}`));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!adminLotId) {
      toast.error(t("No assigned lot found.", "Walang nakitang assigned na parking lot."));
      setIsSaving(false);
      return;
    }

    try {
      const operatingHoursStr = `${formatTimeTo12Hour(openTime)} - ${formatTimeTo12Hour(closeTime)}`;
      const { error } = await supabase.from('parking_lots').update({
        pricing_scheme: pricingScheme,
        base_rate: parseFloat(baseRate),
        rate_per_hour: parseFloat(hourlyRate),
        fixed_rate: parseFloat(fixedRate),
        overnight_rate: parseFloat(overnightRate),
        senior_discount_pct: parseFloat(seniorDiscount),
        max_reservation_hours: parseInt(maxReservationHours),
        min_reservation_hours: parseInt(minReservationHours),
        overtime_fee_per_hour: parseFloat(overtimeFeePerHour),
        slot_cleanup_minutes: parseInt(slotCleanupMinutes),
        maintenance_mode: maintenanceMode,
        online_payments_enabled: onlinePaymentsEnabled,
        operating_hours: operatingHoursStr,
        updated_at: new Date().toISOString()
      }).eq('id', adminLotId);
      
      if (error) throw error;
      setLanguage(localLanguage);
      toast.success(t("Lot configuration saved successfully!", "Matagumpay na nai-save ang lot configuration!"));
    } catch (err: any) {
      console.error(err);
      toast.error(t(err.message || "Failed to save settings", err.message || "Nabigong i-save ang settings"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="System Configurations">
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        
        {adminRole === "manager" && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-start gap-4">
            <div className="bg-rose-500/20 p-2 rounded-full shrink-0"><Ban className="text-rose-600" size={24} /></div>
            <div><h4 className="text-rose-800 font-black text-sm uppercase tracking-wider">No Refund Policy</h4><p className="text-rose-700/80 text-xs font-medium mt-1">ParKada does NOT issue refunds for any reason. Once a reservation is paid, it is final.</p></div>
          </div>
        )}

        <form onSubmit={handleSaveSettings}>
          {isSuperAdmin ? (
            <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center gap-3"><div className="bg-violet-500/10 p-2 rounded-xl text-violet-600"><CalendarClock size={20} /></div><h3 className="font-bold text-lg">Global Reservation Limits</h3></div>
              
              <div className="space-y-5">
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3"><Activity size={16} className="text-muted-foreground"/><div><p className="text-sm font-bold">Max Concurrent per User</p><p className="text-[10px] text-muted-foreground">Active reservations at once across all lots</p></div></div>
                  <div className="w-24"><Input type="number" className="h-12 rounded-xl text-center" value={maxConcurrentReservations} onChange={(e) => setMaxConcurrentReservations(e.target.value)} required /></div>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-3"><Car size={16} className="text-muted-foreground"/><div><p className="text-sm font-bold">Max Vehicles per User</p><p className="text-[10px] text-muted-foreground">Limit per account globally</p></div></div>
                  <div className="w-24"><Input type="number" className="h-12 rounded-xl text-center" value={maxVehiclesPerUser} onChange={(e) => setMaxVehiclesPerUser(e.target.value)} required /></div>
                </div>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6 max-w-3xl mx-auto mt-6">
                <div className="flex items-center gap-3"><div className="bg-amber-500/10 p-2 rounded-xl text-amber-600"><Settings size={20} /></div><h3 className="font-bold text-lg">System Toggles</h3></div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-bold">Global Maintenance Mode</p><p className="text-[10px] text-muted-foreground">Pause all new reservations across the ENTIRE platform</p></div>
                    <Switch checked={globalMaintenanceMode} onCheckedChange={setGlobalMaintenanceMode} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ========== LEFT COLUMN ========== */}
            <div className="space-y-6">
              {/* Pricing */}
              <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600"><Banknote size={20} /></div>
                    <h3 className="font-bold text-lg">Standard Parking Rates</h3>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setPricingScheme("hourly")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", pricingScheme === "hourly" ? "bg-white shadow-sm text-emerald-700" : "text-slate-500 hover:text-slate-700")}
                    >
                      Hourly
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingScheme("fixed")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", pricingScheme === "fixed" ? "bg-white shadow-sm text-emerald-700" : "text-slate-500 hover:text-slate-700")}
                    >
                      Fixed (Whole Day)
                    </button>
                  </div>
                </div>
                
                {pricingScheme === "hourly" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-[10px] font-bold uppercase">Base Rate (1st 3 Hrs)</Label><div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2">₱</span><Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} required /></div></div>
                    <div><Label className="text-[10px] font-bold uppercase">Hourly Succeeding</Label><div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2">₱</span><Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} required /></div></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-[10px] font-bold uppercase">Fixed Rate (Whole Day)</Label><div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2">₱</span><Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8" value={fixedRate} onChange={(e) => setFixedRate(e.target.value)} required /></div></div>
                    <div><Label className="text-[10px] font-bold uppercase">Overnight Stay</Label><div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2">₱</span><Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8" value={overnightRate} onChange={(e) => setOvernightRate(e.target.value)} required /></div></div>
                  </div>
                )}
              </div>

              {/* Discounts */}
              <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center gap-3"><div className="bg-blue-500/10 p-2 rounded-xl text-blue-600"><BadgePercent size={20} /></div><h3 className="font-bold text-lg">Statutory & Eco Discounts</h3></div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><div><p className="text-sm font-bold">Senior Citizen & PWD</p></div><div className="relative w-24"><Input type="number" className="h-10 rounded-xl text-right pr-8" value={seniorDiscount} onChange={(e) => setSeniorDiscount(e.target.value)} /><span className="absolute right-3 top-1/2 -translate-y-1/2">%</span></div></div>

                </div>
              </div>

              {/* Operating Hours */}
              <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center gap-3"><div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-600"><Clock size={20} /></div><h3 className="font-bold text-lg">Operating Hours</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-[10px] font-bold uppercase">Opening Time</Label><Input type="time" className="h-12 rounded-xl mt-1" value={openTime} onChange={(e) => setOpenTime(e.target.value)} required /></div>
                  <div><Label className="text-[10px] font-bold uppercase">Closing Time</Label><Input type="time" className="h-12 rounded-xl mt-1" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} required /></div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertCircle size={10} /> Reservations outside these hours are not allowed.</p>
              </div>
            </div>

            {/* ========== RIGHT COLUMN ========== */}
            <div className="space-y-6">
              {/* Reservation Rules (enhanced) */}
              <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center gap-3"><div className="bg-violet-500/10 p-2 rounded-xl text-violet-600"><CalendarClock size={20} /></div><h3 className="font-bold text-lg">Reservation Rules</h3></div>
                
                <div className="space-y-5">
                  {/* Duration limits */}
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-bold">Max Duration (Hours)</p><p className="text-[10px] text-muted-foreground">Per reservation</p></div>
                    <div className="w-24"><Input type="number" className="h-12 rounded-xl text-center" value={maxReservationHours} onChange={(e) => setMaxReservationHours(e.target.value)} required /></div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-b pb-4">
                    <div><p className="text-sm font-bold">Minimum Duration (Hours)</p><p className="text-[10px] text-muted-foreground">Lowest allowed</p></div>
                    <div className="w-24"><Input type="number" className="h-12 rounded-xl text-center" value={minReservationHours} onChange={(e) => setMinReservationHours(e.target.value)} required /></div>
                  </div>

                  {/* Fees & cleanup */}
                  <div className="flex items-center justify-between pt-2">
                    <div><p className="text-sm font-bold">Overtime Fee (per hour)</p><p className="text-[10px] text-muted-foreground">After booked duration</p></div>
                    <div className="relative w-24"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">₱</span><Input type="number" className="h-12 rounded-xl text-center pl-6" value={overtimeFeePerHour} onChange={(e) => setOvertimeFeePerHour(e.target.value)} required /></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><Timer size={16} className="text-muted-foreground"/><div><p className="text-sm font-bold">Slot Cleanup Time</p><p className="text-[10px] text-muted-foreground">Minutes after end before available</p></div></div>
                    <div className="w-24"><Input type="number" className="h-12 rounded-xl text-center" value={slotCleanupMinutes} onChange={(e) => setSlotCleanupMinutes(e.target.value)} required /></div>
                  </div>
                  <div className="flex items-center justify-between">                  
                    
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                    <p className="font-bold mb-1">📌 How it works:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      <li>Reservation starts <strong>immediately</strong> upon payment.</li>
                      <li>You may arrive any time within your booked duration.</li>
                      <li>No grace period – your slot is reserved for the full period.</li>
                      <li>No refunds for any reason (including early exit or no‑show).</li>
                    </ul>
                  </div>
                </div>

                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-rose-600">Cancellation / No‑Show</p>
                    <div className="bg-rose-100 text-rose-700 text-[10px] font-black px-3 py-1.5 rounded-full">No Refunds</div>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="bg-white rounded-3xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center gap-3"><div className="bg-amber-500/10 p-2 rounded-xl text-amber-600"><Settings size={20} /></div><h3 className="font-bold text-lg">System Toggles</h3></div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-bold">Maintenance Mode</p><p className="text-[10px] text-muted-foreground">Pause all new reservations</p></div>
                    <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div><p className="text-sm font-bold">Online Payments</p><p className="text-[10px] text-muted-foreground">If disabled, reservations are cash‑only</p></div>
                    <Switch checked={onlinePaymentsEnabled} onCheckedChange={setOnlinePaymentsEnabled} />
                  </div>
                </div>
              </div>



              {/* Payment Gateway (mock) */}
              <div className="bg-slate-50 rounded-3xl border p-6 space-y-4">
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-white p-2 rounded-xl shadow-sm"><CreditCard size={20} /></div><h3 className="font-bold text-lg">Payment Gateway</h3></div><span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-md">Coming Soon</span></div>
                <div className="space-y-3">
                  <div><Label className="text-[10px] font-bold uppercase">Merchant ID</Label><Input type="text" className="h-10 rounded-lg bg-white font-mono text-sm mt-1" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} /></div>
                  <div><Label className="text-[10px] font-bold uppercase">Production API Key</Label><div className="relative mt-1"><Input type={showKey ? "text" : "password"} className="h-10 rounded-lg bg-white font-mono text-sm pr-10" defaultValue="pk_live_51HXXXXXParKadagcash" /><button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2">{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Language Preferences */}
          <div className="mt-8 bg-white rounded-3xl shadow-sm border p-6 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3"><div className="bg-blue-500/10 p-2 rounded-xl text-blue-600"><Languages size={20} /></div><h3 className="font-bold text-lg">System Language</h3></div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-bold">Preferred Language</p><p className="text-[10px] text-muted-foreground">Changes notification language for this account</p></div>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setLocalLanguage("en")}
                    className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all", localLanguage === "en" ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700")}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalLanguage("tl")}
                    className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all", localLanguage === "tl" ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700")}
                  >
                    Tagalog
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 bg-white border rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center gap-4 text-slate-600">
              <div className="bg-slate-100 p-3 rounded-full"><ShieldAlert size={24} /></div>
              <div>
                <h4 className="font-bold text-sm">{isSuperAdmin ? "Global System Rules" : "System Maintenance"}</h4>
                <p className="text-xs text-muted-foreground">{isSuperAdmin ? "Changes apply to all users across all lots." : "Pause all incoming reservations globally."}</p>
              </div>
            </div>
            <Button type="submit" disabled={isSaving} className="w-full md:w-auto h-14 px-8 font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              <Save size={18} /> {isSaving ? "Processing..." : isSuperAdmin ? "Save Global Rules" : "Save Lot Settings"}
            </Button>
          </div>
        </form>

        <div className="text-center text-[10px] text-muted-foreground mt-4">
          ⚡ {isSuperAdmin ? "These limits prevent abuse across the entire platform." : "Settings are automatically applied to your assigned parking establishment."}
        </div>
      </div>
    </AdminLayout>
  );
}