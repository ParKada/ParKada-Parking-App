/*
 * ParKada — AdminReservations (Added Booked Status & Cross-Midnight Fix)
 * Fixed: Time display in 12‑hour format, fine calculation uses actual timestamps.
 * Added: Pagination (Load More) + manual refresh button.
 * Added: Date filters (Today, Last 7 days, Last 30 days, Custom) + Print PDF report.
 * Layout: Stats cards on top, then filter row.
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@parkada/shared";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, Clock, Search, CalendarDays, AlertTriangle, Coins, Printer, Plus, Eye, Receipt, User, Car, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import SuperAdminRecords from "./SuperAdminRecords";

const PENALTY_RATE_PER_HOUR = 50;
const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  booked: "bg-indigo-100 text-indigo-700 border-indigo-200",
  active: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const format12HourTime = (dateInput: Date | string | null): string => {
  if (!dateInput) return "--:--";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "--:--";
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, "0");
  return `${hours}:${minuteStr} ${ampm}`;
};

export default function AdminReservations() {
  const { t } = useLanguage();
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [recordType, setRecordType] = useState<"active" | "completed" | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [form, setForm] = useState({ plate_number: "", slot_id: "", end_time: "", is_paid: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [reservationDetails, setReservationDetails] = useState<any>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const userRole = localStorage.getItem("admin_role");
  const userLotId = localStorage.getItem("admin_lot_id");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchReservations(true);
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    fetchReservations(true);
    const channel = supabase
      .channel('admin-res-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const applyDateFilters = (query: any) => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      return query.gte("created_at", start).lte("created_at", end);
    } else if (dateFilter === "week") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
      return query.gte("created_at", start);
    } else if (dateFilter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
      return query.gte("created_at", start);
    } else if (dateFilter === "custom" && customStart && customEnd) {
      const start = new Date(customStart + "T00:00:00").toISOString();
      const end = new Date(customEnd + "T23:59:59").toISOString();
      return query.gte("created_at", start).lte("created_at", end);
    }
    return query;
  };

  const getBaseQuery = () => {
    let query = supabase
      .from('reservations')
      .select(`*, parking_lots (name), parking_slots (label)`)
      .order('created_at', { ascending: false });
    if (userRole === 'admin' && userLotId) {
      query = query.eq('lot_id', userLotId);
    }
    query = applyDateFilters(query);
    return query;
  };

  const fetchReservations = async (reset = false) => {
    if (reset) {
      setIsRefreshing(true);
      setPage(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = getBaseQuery().range(from, to);
      const { data, error } = await query;
      if (error) throw error;

      const formattedData = (data || []).map((res: any) => ({
        id: res.id,
        shortId: res.id.substring(0, 8).toUpperCase(),
        lotName: res.parking_lots?.name || "Unknown Lot",
        slotLabel: res.parking_slots?.label || "N/A",
        plate_number: res.plate_number,
        createdAt: res.created_at,
        startTime: res.start_time,
        endTime: res.end_time,
        totalPrice: res.total_amount || 0,
        status: res.status || 'pending',
        slotId: res.slot_id,
      }));

      if (reset) {
        setReservations(formattedData);
      } else {
        setReservations(prev => [...prev, ...formattedData]);
      }

      setHasMore((data?.length || 0) === PAGE_SIZE);
      if (!reset) setPage(prev => prev + 1);
    } catch (error: any) {
      toast.error(t("Failed to fetch reservations.", "Nabigong fetch reservations."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore && !isRefreshing) {
      fetchReservations(false);
    }
  };

  const manualRefresh = () => {
    if (!isRefreshing) {
      fetchReservations(true);
    }
  };

  const calculateFine = (reservation: any): number => {
    if (reservation.status !== 'active') return 0;
    if (!reservation.startTime || !reservation.endTime) return 0;
    const end = new Date(reservation.endTime);
    const now = currentTime;
    if (now <= end) return 0;
    const diffMs = now.getTime() - end.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.ceil(diffHours * PENALTY_RATE_PER_HOUR);
  };

  const updateReservationStatus = async (res: any, newStatus: string) => {
    const fine = calculateFine(res);
    const finalAmount = Number(res.totalPrice) + fine;

    try {
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          status: newStatus,
          total_amount: finalAmount 
        })
        .eq('id', res.id);
      if (resError) throw resError;

      let slotStatus = 'available';
      if (newStatus === 'active' || newStatus === 'pending' || newStatus === 'booked') slotStatus = 'reserved';
      await supabase.from('parking_slots').update({ status: slotStatus }).eq('id', res.slotId);

      toast.success(fine > 0 ? `Completed with ₱${fine} fine!` : `Marked as ${newStatus}`);
      fetchReservations(true);
    } catch (error: any) {
      toast.error(t("Update failed.", "Update failed."));
    }
  };

  const handleApprove = (res: any) => {
    const now = currentTime;
    const start = new Date(res.startTime);
    const newStatus = now < start ? 'booked' : 'active';
    updateReservationStatus(res, newStatus);
  };

  const checkIsOverstaying = (res: any) => calculateFine(res) > 0;

  const handleViewDetails = async (res: any) => {
    setSelectedReservation(res);
    setReservationDetails(null);
    setIsFetchingDetails(true);

    try {
      const adminSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: rawRes, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', res.id)
        .single();
      
      if (resError) throw resError;

      let user = null;
      if (rawRes?.profile_id) {
         const { data: profile } = await adminSupabase.from('profiles').select('id, first_name, last_name, phone_number').eq('id', rawRes.profile_id).single();
         if (profile) {
           user = {
             ...profile,
             full_name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Guest"
           };
         }
      } else if (rawRes?.user_id) {
         const { data: profile } = await adminSupabase.from('profiles').select('id, first_name, last_name, phone_number').eq('id', rawRes.user_id).single();
         if (profile) {
           user = {
             ...profile,
             full_name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Guest"
           };
         }
      }
      
      const { data: receipts } = await adminSupabase.from('receipts').select('*').eq('reservation_id', res.id);
      
      setReservationDetails({
         ...rawRes,
         user: user,
         receipt: receipts && receipts.length > 0 ? receipts[0] : null
      });

    } catch (err) {
      console.error(err);
      toast.error(t("Failed to fetch detailed info", "Nabigong fetch detailed info"));
      setReservationDetails({ error: true });
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const fetchAvailableSlots = async () => {
    let query = supabase.from('parking_slots').select('id, label, lot_id').eq('status', 'available').eq('is_reservable', true);
    if (userLotId && userRole !== 'superadmin' && userRole !== 'super_admin') {
      query = query.eq('lot_id', userLotId);
    }
    const { data } = await query;
    if (data) setAvailableSlots(data);
  };

  useEffect(() => {
    if (showForm) fetchAvailableSlots();
  }, [showForm]);

  const handleManualAdd = async () => {
    if (!form.plate_number || !form.slot_id || !form.end_time) return toast.error("Complete all fields");
    
    const now = new Date();
    const [hours, minutes] = form.end_time.split(":");
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
    if (endDate <= now) return toast.error("End time must be in the future (for today).");
    
    setIsSubmitting(true);
    try {
      const selectedSlot = availableSlots.find(s => s.id === form.slot_id);
      const targetLotId = selectedSlot?.lot_id || userLotId;
      
      const { error } = await supabase.from('reservations').insert({
        plate_number: form.plate_number.toUpperCase(),
        slot_id: form.slot_id,
        lot_id: targetLotId,
        start_time: now.toISOString(),
        end_time: endDate.toISOString(),
        status: form.is_paid ? 'active' : 'pending',
        total_amount: 0,
        payment_method: 'Cash',
        duration: Math.ceil((endDate.getTime() - now.getTime()) / 60000)
      });
      if (error) throw error;
      
      await supabase.from('parking_slots').update({ status: 'reserved' }).eq('id', form.slot_id);
      toast.success("Manual reservation created!");
      setShowForm(false);
      setForm({ plate_number: "", slot_id: "", end_time: "", is_paid: false });
      fetchReservations(true);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
    setIsSubmitting(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, customStart, customEnd, recordType]);

  const filteredReservations = reservations.filter(res => {
    const matchesSearch = res.shortId.toLowerCase().includes(searchTerm.toLowerCase()) || res.lotName.toLowerCase().includes(searchTerm.toLowerCase()) || (res.plate_number && res.plate_number.toLowerCase().includes(searchTerm.toLowerCase()));
    let matchesTab = true;
    if (recordType === "active") matchesTab = ["active", "booked", "pending"].includes(res.status);
    else if (recordType === "completed") matchesTab = res.status === "completed" || res.status === "cancelled";
    return matchesSearch && matchesTab;
  });

  const pendingCount = reservations.filter(r => r.status === 'pending').length;
  const activeCount = reservations.filter(r => r.status === 'active').length;
  const overstayCount = reservations.filter(r => checkIsOverstaying(r)).length;

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredReservations.length / ITEMS_PER_PAGE);
  const paginatedReservations = filteredReservations.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getDateRangeText = () => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "week") return "Last 7 days";
    if (dateFilter === "month") return "Last 30 days";
    if (dateFilter === "custom" && customStart && customEnd) {
      return `${customStart} to ${customEnd}`;
    }
    return "All time";
  };

  const handlePrint = async () => {
    try {
      let query = getBaseQuery();
      const { data, error } = await query;
      if (error) throw error;

      const records = data || [];
      const totalRevenue = records.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      const completedCount = records.filter((r: any) => r.status === 'completed').length;
      const activeCountAll = records.filter((r: any) => r.status === 'active').length;
      const pendingCountAll = records.filter((r: any) => r.status === 'pending').length;

      const getDateRangeText = () => {
        if (dateFilter === "today") return "Today";
        if (dateFilter === "week") return "Last 7 days";
        if (dateFilter === "month") return "Last 30 days";
        if (dateFilter === "custom" && customStart && customEnd) {
          return `${customStart} to ${customEnd}`;
        }
        return "All time";
      };

      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>ParKada Reservations Report</title>
          <style>
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 2rem; padding: 0; }
            .report-header { text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #2c3e50; padding-bottom: 0.5rem; }
            .report-header h1 { font-size: 24pt; margin: 0; }
            .report-header p { margin: 0.25rem 0; font-size: 10pt; color: #555; }
            .stats-cards { display: flex; gap: 1rem; margin-bottom: 2rem; justify-content: space-between; }
            .stat-card { flex: 1; border: 1px solid #ddd; padding: 0.75rem; text-align: center; border-radius: 12px; background: #f9f9f9; }
            .stat-card h3 { font-size: 20pt; margin: 0; }
            .stat-card p { margin: 0; font-size: 9pt; color: #666; }
            .print-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 1rem; }
            .print-table th, .print-table td { border: 1px solid #aaa; padding: 6px 8px; text-align: left; vertical-align: top; }
            .print-table th { background-color: #2c3e50; color: white; font-weight: 600; }
            .print-table tr:nth-child(even) td { background-color: #f9f9f9; }
            .report-footer { margin-top: 1rem; text-align: center; font-size: 8pt; color: #777; border-top: 1px solid #ccc; padding-top: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>ParKada Reservations Report</h1>
            <p>Period: ${getDateRangeText()}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          <div class="stats-cards">
            <div class="stat-card"><h3>${records.length}</h3><p>Total</p></div>
            <div class="stat-card"><h3>${pendingCountAll}</h3><p>Pending</p></div>
            <div class="stat-card"><h3>${activeCountAll}</h3><p>Active</p></div>
            <div class="stat-card"><h3>${completedCount}</h3><p>Completed</p></div>
            <div class="stat-card"><h3>₱${totalRevenue.toFixed(2)}</h3><p>Revenue</p></div>
          </div>
          <table class="print-table">
            <thead>
              <tr><th>Booking ID</th><th>Vehicle & Slot</th><th>Date</th><th>Time</th><th>Fine</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${records.map((res: any) => {
                const slotLabel = res.parking_slots?.label || "N/A";
                const dateFormatted = res.created_at ? new Date(res.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A";
                const startTimeFormatted = format12HourTime(res.start_time);
                const endTimeFormatted = format12HourTime(res.end_time);
                return `
                  <tr>
                    <td>#${res.id.substring(0, 8).toUpperCase()}</td>
                    <td><strong>${res.plate_number || 'N/A'}</strong><br/>Slot: ${slotLabel}</td>
                    <td>${dateFormatted}</td>
                    <td>${startTimeFormatted} – ${endTimeFormatted}</td>
                    <td>—</td>
                    <td style="text-transform:capitalize">${res.status}</td>
                  </tr>
                `;
              }).join('')}
              ${records.length === 0 ? '<tr><td colspan="6" style="text-align:center">No reservations found for the selected period.</td></tr>' : ''}
            </tbody>
          </table>
          <div class="report-footer">ParKada Parking Management System – Official Reservations Record</div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.print();
      } else {
        toast.error(t('Unable to open print window. Please allow pop-ups.', 'Unable to open print window. Pakisuyo allow pop-ups.'));
      }
    } catch (err: any) {
      toast.error(t("Failed to prepare report.", "Nabigong prepare report."));
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title={userRole === "superadmin" || userRole === "super_admin" ? "Records" : "Reservations"}>
        <div className="flex justify-center items-center h-[60vh]">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      </AdminLayout>
    );
  }

  // SuperAdmin intercept removed since they have a separate Records route now

  return (
    <AdminLayout title="Reservations">
      <div className="space-y-6">
        {/* Stats cards - at the very top */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full text-primary"><CalendarDays size={20} /></div>
            <div><p className="text-2xl font-bold">{reservations.length}</p><p className="text-xs text-muted-foreground uppercase font-black">Total</p></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full text-amber-600"><Clock size={20} /></div>
            <div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Pending</p></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600"><CheckCircle size={20} /></div>
            <div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Active</p></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-600"><CheckCircle size={20} /></div>
            <div><p className="text-2xl font-bold">{reservations.filter(r => r.status === 'completed').length}</p><p className="text-xs text-muted-foreground uppercase font-black">Completed</p></div>
          </div>
          <div className={cn("p-4 rounded-2xl border flex items-center gap-4 transition-all", overstayCount > 0 ? "bg-rose-50 border-rose-200" : "bg-white")}>
            <div className={cn("p-3 rounded-full", overstayCount > 0 ? "bg-rose-600 text-white" : "bg-slate-100")}><AlertTriangle size={20} /></div>
            <div><p className={cn("text-2xl font-bold", overstayCount > 0 ? "text-rose-600" : "")}>{overstayCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Overstaying</p></div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            {recordType === "active" ? (
              <><Clock className="text-amber-600" size={24} /> Active Reservations ({getDateRangeText()})</>
            ) : recordType === "completed" ? (
              <><CheckCircle className="text-emerald-600" size={24} /> Completed Records ({getDateRangeText()})</>
            ) : (
              <><List className="text-blue-600" size={24} /> All Records ({getDateRangeText()})</>
            )}
          </h3>
        </div>

        {/* Unified Filter Row matching Walk-ins layout */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Record Type Tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecordType("all")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-full transition-colors",
                    recordType === "all" ? "bg-blue-600 text-white shadow-md" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  )}
                >
                  All Records
                </button>
                <button
                  onClick={() => setRecordType("active")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-full transition-colors",
                    recordType === "active" ? "bg-amber-500 text-white shadow-md" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  )}
                >
                  Active Reservations
                </button>
                <button
                  onClick={() => setRecordType("completed")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-full transition-colors",
                    recordType === "completed" ? "bg-emerald-600 text-white shadow-md" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  )}
                >
                  Completed
                </button>
              </div>

              <div className="w-px h-6 bg-slate-200 hidden md:block" />

              {/* Date Filters */}
              <div className="relative flex items-center">
                <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
                  {["today", "week", "month", "custom"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f as any)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-full capitalize transition-colors",
                        dateFilter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-200"
                      )}
                    >
                      {f === "today" ? "Today" : f === "week" ? "Last 7 days" : f === "month" ? "Last 30 days" : "Custom"}
                    </button>
                  ))}
                </div>
                
                {dateFilter === "custom" && (
                  <div className="absolute top-[120%] right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl p-4 flex flex-row items-center gap-4 z-[60] animate-in fade-in slide-in-from-top-2 w-max">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Start Date</span>
                      <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[140px] h-9 text-sm" />
                    </div>
                    <div className="text-slate-300 mt-5">–</div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase px-1">End Date</span>
                      <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[140px] h-9 text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} variant="outline" size="sm" className="rounded-xl gap-2 h-8 text-xs">
                <Printer size={14} /> Export
              </Button>
              {(userRole === "admin" || userRole === "superadmin" || userRole === "super_admin") && (
                <Button onClick={() => setShowForm(true)} className="bg-primary text-white rounded-xl gap-1 font-bold h-8 text-xs">
                  <Plus size={14} /> New
                </Button>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-slate-100" />

          {/* Bottom Row: Search & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder="Search by ID, plate number, etc..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-8 pr-3 py-2 bg-slate-50 border rounded-xl text-sm w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" 
              />
            </div>
            <Button variant="outline" size="sm" onClick={manualRefresh} disabled={isRefreshing} className="rounded-xl h-9 bg-slate-50">
              <RefreshCw size={14} className={cn("mr-2", isRefreshing && "animate-spin")} />
              Refresh List
            </Button>
          </div>
        </div>

      {/* Main table section */}
      <div className="mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border">

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b uppercase font-black">
                  <th className="text-left pb-3">Booking ID</th>
                  <th className="text-left pb-3">Vehicle & Slot</th>
                  <th className="text-left pb-3">Date</th>
                  <th className="text-left pb-3">Time</th>
                  <th className="text-left pb-3 text-rose-600">Fine</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-right pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground font-medium">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  paginatedReservations.map((res) => {
                    const fine = calculateFine(res);
                  const isOverstaying = fine > 0;
                  const startTimeFormatted = format12HourTime(res.startTime);
                  const endTimeFormatted = format12HourTime(res.endTime);
                  const dateFormatted = res.createdAt ? new Date(res.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : "N/A";

                  return (
                    <tr key={res.id} className={cn("hover:bg-muted/30 transition-colors", isOverstaying && "bg-rose-50/50")}>
                      <td className="py-4 font-mono text-xs">#{res.shortId}</td>
                      <td className="py-4">
                        <p className="font-bold">{res.plate_number || 'N/A'}</p>
                        <p className="text-[10px] text-primary font-black uppercase">Slot: {res.slotLabel}</p>
                      </td>
                      <td className="py-4 text-xs font-semibold text-slate-700">{dateFormatted}</td>
                      <td className="py-4 text-xs whitespace-nowrap">
                        {startTimeFormatted} <span className={cn("font-bold", isOverstaying ? "text-rose-600" : "text-muted-foreground")}>to {endTimeFormatted}</span>
                      </td>
                      <td className="py-4 font-bold">{fine > 0 ? <span className="text-rose-600">+₱{fine}</span> : "-"}</td>
                      <td className="py-4">
                        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border", isOverstaying ? "bg-rose-600 text-white" : statusStyles[res.status])}>
                          {isOverstaying ? "OVERSTAYING" : res.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="h-8 rounded-lg text-slate-700 bg-white shadow-sm font-semibold" onClick={() => handleViewDetails(res)}>
                            <Eye size={14} className="mr-1.5" /> Details
                          </Button>
                          {res.status === 'pending' && (
                            <Button size="sm" className="h-8 bg-blue-600 text-white rounded-lg" onClick={() => handleApprove(res)}>Approve</Button>
                          )}
                          {res.status === 'booked' && (
                            <Button size="sm" className="h-8 bg-indigo-600 text-white rounded-lg" onClick={() => updateReservationStatus(res, 'active')}>Set Active</Button>
                          )}
                          {(res.status === 'pending' || res.status === 'active' || res.status === 'booked') && (
                            <Button variant="outline" size="sm" className="h-8 text-rose-600 rounded-lg" onClick={() => window.confirm("Cancel?") && updateReservationStatus(res, 'cancelled')}>
                              <XCircle size={14} className="mr-1" /> Cancel
                            </Button>
                          )}
                          {res.status === 'active' && (
                            <Button size="sm" className={cn("h-8 rounded-lg text-white font-bold", isOverstaying ? "bg-rose-600" : "bg-emerald-600")} onClick={() => updateReservationStatus(res, 'completed')}>
                              {isOverstaying ? <Coins size={14} className="mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                              {isOverstaying ? "Collect & Complete" : "Complete"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>

          {filteredReservations.length > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="text-sm text-slate-500 font-medium">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredReservations.length)} of {filteredReservations.length} records
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0}>Next</Button>
              </div>
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoadingMore || isRefreshing} className="text-xs text-muted-foreground">
                {isLoadingMore ? "Loading more from server..." : "Fetch older records from server"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800">Add Manual Reservation</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-rose-500">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Plate Number</Label>
                <Input 
                  placeholder="e.g. ABC 1234" 
                  value={form.plate_number} 
                  onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                  className="font-mono h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Select Reservable Slot</Label>
                <select 
                  className="w-full h-11 px-3 border rounded-md bg-transparent text-sm font-medium"
                  value={form.slot_id}
                  onChange={(e) => setForm({ ...form, slot_id: e.target.value })}
                >
                  <option value="" disabled>Select a slot...</option>
                  {availableSlots.map(slot => (
                    <option key={slot.id} value={slot.id}>{slot.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">End Time (Today)</Label>
                <Input 
                  type="time" 
                  value={form.end_time} 
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="h-11 font-medium"
                />
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <input 
                  type="checkbox" 
                  id="is_paid" 
                  checked={form.is_paid} 
                  onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} 
                  className="w-4 h-4 rounded text-primary"
                />
                <Label htmlFor="is_paid" className="font-bold cursor-pointer">Mark as Paid (Active)</Label>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isSubmitting} className="font-bold">Cancel</Button>
              <Button onClick={handleManualAdd} disabled={isSubmitting || !form.plate_number || !form.slot_id || !form.end_time} className="bg-primary text-white font-bold rounded-xl px-6 shadow-sm">
                {isSubmitting ? "Saving..." : "Save Reservation"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedReservation && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800">Reservation Details</h2>
              <button onClick={() => setSelectedReservation(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-rose-500">
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {isFetchingDetails ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <RefreshCw className="animate-spin text-primary mb-4" size={32} />
                  <p className="text-sm font-medium text-slate-500">Loading details...</p>
                </div>
              ) : reservationDetails?.error ? (
                <div className="py-10 text-center text-rose-500 font-medium">
                  Failed to load reservation details.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Booking ID</p>
                      <p className="text-xl font-black font-mono text-slate-800">#{selectedReservation.shortId}</p>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-[10px] font-bold px-3 py-1.5 rounded-full uppercase border", checkIsOverstaying(selectedReservation) ? "bg-rose-600 text-white" : statusStyles[selectedReservation.status])}>
                        {checkIsOverstaying(selectedReservation) ? "OVERSTAYING" : selectedReservation.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                        <User size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Reserver Name</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {reservationDetails?.user?.full_name || 'Walk-in / Guest'}
                      </p>
                      {reservationDetails?.user?.phone_number && (
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{reservationDetails.user.phone_number}</p>
                      )}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                        <Car size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Vehicle Plate</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 uppercase">
                        {selectedReservation.plate_number || reservationDetails?.plate_number || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5"><CalendarDays size={14} /> Date</span>
                       <span className="text-sm font-bold text-slate-800">
                         {selectedReservation.createdAt ? new Date(selectedReservation.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : "N/A"}
                       </span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5"><Clock size={14} /> Schedule</span>
                       <span className="text-sm font-bold text-slate-800">
                         {format12HourTime(selectedReservation.startTime)} – {format12HourTime(selectedReservation.endTime)}
                       </span>
                     </div>
                  </div>

                  {reservationDetails?.receipt && (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                       <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-wider flex items-center gap-1.5 mb-3">
                         <Receipt size={14} /> Sales Invoice
                       </h4>
                       <div className="space-y-2">
                         <div className="flex justify-between items-center">
                           <span className="text-xs text-slate-600 font-medium">Invoice No.</span>
                           <span className="text-sm font-black font-mono text-slate-800">{reservationDetails.receipt.reference_no}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-xs text-slate-600 font-medium">Payment Method</span>
                           <span className="text-sm font-bold text-slate-800 uppercase">{reservationDetails.receipt.payment_method}</span>
                         </div>
                         <div className="flex justify-between items-center pt-2 border-t border-blue-200/50">
                           <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Amount Paid</span>
                           <span className="text-lg font-black text-blue-700">₱{Number(reservationDetails.receipt.amount_paid).toFixed(2)}</span>
                         </div>
                       </div>
                    </div>
                  )}
                  
                  {!reservationDetails?.receipt && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                       <p className="text-xs text-slate-500 font-medium">No sales invoice associated with this booking.</p>
                       <p className="text-[10px] text-slate-400 mt-1">Total Expected: ₱{Number(selectedReservation.totalPrice).toFixed(2)}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}