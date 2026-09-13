import { useState, useEffect } from "react";
import { supabase } from "@parkada/shared";
import { FileText, MapPin, Calendar, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

interface RecordItem {
  id: string;
  type: "walk_in" | "reservation";
  date: Date;
  dateStr: string;
  slotLabel: string;
  amount: number;
  status: string;
}

interface ParkingLot {
  id: string;
  name: string;
}

export default function SuperAdminRecords() {
  const { t } = useLanguage();
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState("month");

  useEffect(() => {
    fetchLots();
  }, []);

  useEffect(() => {
    if (selectedLotId) {
      fetchRecords();
    } else {
      setRecords([]);
    }
  }, [selectedLotId, dateFilter]);

  const fetchLots = async () => {
    const { data, error } = await supabase.from("parking_lots").select("id, name").order("name");
    if (data) setLots(data);
    if (error) console.error(error);
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      if (dateFilter === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateFilter === "month") {
        startDate.setDate(startDate.getDate() - 30);
      } else if (dateFilter === "all") {
        startDate = new Date(0); // Epoch
      }

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Fetch Walk-Ins
      const { data: walkIns, error: walkErr } = await supabase
        .from("walk_in_records")
        .select("id, entry_time, amount_paid, status, parking_slots(label)")
        .eq("lot_id", selectedLotId)
        .gte("entry_time", startDate.toISOString())
        .lte("entry_time", todayEnd.toISOString())
        .limit(1000);

      if (walkErr) throw walkErr;

      // Fetch Reservations
      const { data: res, error: resErr } = await supabase
        .from("reservations")
        .select("id, created_at, start_time, total_amount, status, parking_slots(label)")
        .eq("lot_id", selectedLotId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .limit(1000);

      if (resErr) throw resErr;

      const unified: RecordItem[] = [];

      (walkIns || []).forEach((w: any) => {
        const d = new Date(w.entry_time);
        unified.push({
          id: w.id,
          type: "walk_in",
          date: d,
          dateStr: d.toLocaleString(),
          slotLabel: w.parking_slots?.label || "Walk-In",
          amount: w.amount_paid || 0,
          status: w.status
        });
      });

      (res || []).forEach((r: any) => {
        const d = new Date(r.created_at);
        unified.push({
          id: r.id,
          type: "reservation",
          date: d,
          dateStr: d.toLocaleString(),
          slotLabel: r.parking_slots?.label || "Unassigned",
          amount: r.total_amount || 0,
          status: r.status
        });
      });

      // Sort by date descending
      unified.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setRecords(unified);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load records");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return toast.error("Pop-ups are blocked.");

    const lotName = lots.find(l => l.id === selectedLotId)?.name || "Parking Lot";

    const content = `
      <html>
        <head>
          <title>${lotName} - Records</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            p { color: #64748b; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #f8fafc; font-weight: bold; text-transform: uppercase; font-size: 12px; color: #475569; }
            td { font-size: 14px; }
            .type-badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .type-res { background-color: #e0e7ff; color: #4338ca; }
            .type-walkin { background-color: #f1f5f9; color: #475569; }
            .amount { font-weight: bold; color: #10b981; }
          </style>
        </head>
        <body>
          <h1>Overall Records</h1>
          <p>Establishment: <strong>${lotName}</strong> &bull; Generated on: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Date & Time</th>
                <th>Slot</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td><span class="type-badge ${r.type === 'reservation' ? 'type-res' : 'type-walkin'}">${r.type.replace('_', '-')}</span></td>
                  <td>${r.dateStr}</td>
                  <td>${r.slotLabel}</td>
                  <td style="text-transform: capitalize;">${r.status}</td>
                  <td class="amount">₱${r.amount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            Overall Establishment Records
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Read-only database of walk-ins and reservations per lot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={selectedLotId}
              onChange={e => setSelectedLotId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              <option value="">-- Select Establishment --</option>
              {lots.map(lot => (
                <option key={lot.id} value={lot.id}>{lot.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <Button onClick={handlePrint} disabled={records.length === 0} className="bg-primary text-white rounded-xl shadow-sm">
            <Download size={16} className="mr-2" /> Print Records
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {!selectedLotId ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <MapPin size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-lg">Select an establishment</p>
            <p className="text-sm">Choose a parking lot from the dropdown above to view its records.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-lg">No records found</p>
            <p className="text-sm">There are no walk-ins or reservations for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase font-black tracking-widest border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-4 px-6">Type</th>
                  <th className="text-left py-4 px-6">Date & Time</th>
                  <th className="text-left py-4 px-6">Slot</th>
                  <th className="text-left py-4 px-6">Status</th>
                  <th className="text-right py-4 px-6">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                        record.type === 'reservation' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {record.type.replace('_', '-')}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700 flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" />
                      {record.dateStr}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">{record.slotLabel}</td>
                    <td className="py-4 px-6">
                      <span className="capitalize text-sm font-medium text-slate-600">{record.status}</span>
                    </td>
                    <td className="py-4 px-6 text-right font-black text-emerald-600">
                      ₱{record.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
