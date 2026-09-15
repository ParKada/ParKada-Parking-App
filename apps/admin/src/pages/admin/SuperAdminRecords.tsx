import { useState, useEffect } from "react";
import { supabase } from "@parkada/shared";
import { FileText, MapPin, Calendar, Clock, Download, Search, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import AdminLayout from "@/components/AdminLayout";
import { cn } from "@/lib/utils";

interface RecordItem {
  id: string;
  type: "walk_in" | "reservation";
  date: Date;
  dateStr: string;
  slotLabel: string;
  lotName: string;
  plateNumber: string;
  amount: number;
  status: string;
}

interface OcrRecordItem {
  id: string;
  detectedPlate: string;
  confidence: number;
  status: string;
  dateStr: string;
  date: Date;
}

type TabType = "general" | "ocr";

interface ParkingLot {
  id: string;
  name: string;
}

const ITEMS_PER_PAGE = 15;

export default function SuperAdminRecords() {
  const { t } = useLanguage();
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const userRole = localStorage.getItem("admin_role") || "admin";
  const userLotId = localStorage.getItem("admin_lot_id");
  const isSuperAdmin = userRole === "superadmin" || userRole === "super_admin";

  const [selectedLotId, setSelectedLotId] = useState<string>(isSuperAdmin ? "" : (userLotId || ""));
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [ocrRecords, setOcrRecords] = useState<OcrRecordItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isLoading, setIsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchLots();
    } else if (userLotId) {
      // For partner admin, just fetch their own lot name for the CSV/PDF header
      supabase.from("parking_lots").select("id, name").eq("id", userLotId).single().then(({ data }) => {
        if (data) setLots([data]);
      });
    }
  }, [isSuperAdmin, userLotId]);

  useEffect(() => {
    if (selectedLotId) {
      fetchRecords();
    } else {
      setRecords([]);
    }
  }, [selectedLotId, dateFilter, customStart, customEnd]);

  useEffect(() => {
    setCurrentPage(1); // Reset page on search
  }, [searchTerm]);

  const fetchLots = async () => {
    const { data, error } = await supabase.from("parking_lots").select("id, name").order("name");
    if (data) setLots(data);
    if (error) console.error(error);
  };

  const fetchRecords = async () => {
    if (dateFilter === "custom" && (!customStart || !customEnd)) {
      return; // wait until both dates are selected
    }

    setIsLoading(true);
    try {
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      let todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (dateFilter === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateFilter === "month") {
        startDate.setDate(startDate.getDate() - 30);
      } else if (dateFilter === "custom") {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        todayEnd = new Date(customEnd);
        todayEnd.setHours(23, 59, 59, 999);
      } else if (dateFilter === "all") {
        startDate = new Date(0); // Epoch
      }

      const [walkInRes, resRes, ocrRes] = await Promise.all([
        supabase
          .from("walk_in_records")
          .select("id, entry_time, amount_paid, status, plate_number, parking_slots(label)")
          .eq("lot_id", selectedLotId)
          .gte("entry_time", startDate.toISOString())
          .lte("entry_time", todayEnd.toISOString())
          .limit(5000),
        supabase
          .from("reservations")
          .select("id, created_at, start_time, total_amount, status, plate_number, parking_slots(label)")
          .eq("lot_id", selectedLotId)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", todayEnd.toISOString())
          .limit(5000),
        supabase
          .from("plate_validation_logs")
          .select("id, created_at, detected_plate, confidence_score, validation_status")
          .eq("lot_id", selectedLotId)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", todayEnd.toISOString())
          .limit(5000)
      ]);

      if (walkInRes.error) throw walkInRes.error;
      if (resRes.error) throw resRes.error;
      if (ocrRes.error) throw ocrRes.error;

      const unified: RecordItem[] = [];
      const lotName = lots.find(l => l.id === selectedLotId)?.name || "Unknown Lot";

      (walkInRes.data || []).forEach((w: any) => {
        const d = new Date(w.entry_time);
        unified.push({
          id: w.id,
          type: "walk_in",
          date: d,
          dateStr: d.toLocaleString(),
          slotLabel: w.parking_slots?.label || "-",
          lotName,
          plateNumber: w.plate_number || "N/A",
          amount: w.amount_paid || 0,
          status: w.status || "Unknown"
        });
      });

      (resRes.data || []).forEach((r: any) => {
        const d = new Date(r.created_at);
        unified.push({
          id: r.id,
          type: "reservation",
          date: d,
          dateStr: d.toLocaleString(),
          slotLabel: r.parking_slots?.label || "-",
          lotName,
          plateNumber: r.plate_number || "N/A",
          amount: r.total_amount || 0,
          status: r.status
        });
      });

      unified.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecords(unified);

      const ocrUnified: OcrRecordItem[] = [];
      (ocrRes.data || []).forEach((o: any) => {
        const d = new Date(o.created_at);
        ocrUnified.push({
          id: o.id,
          date: d,
          dateStr: d.toLocaleString(),
          detectedPlate: o.detected_plate || "UNREADABLE",
          confidence: o.confidence_score || 0,
          status: o.validation_status || "pending"
        });
      });

      ocrUnified.sort((a, b) => b.date.getTime() - a.date.getTime());
      setOcrRecords(ocrUnified);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load records");
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredRecords = () => {
    let filtered = records;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        (r.id || "").toLowerCase().includes(lower) || 
        (r.plateNumber || "").toLowerCase().includes(lower) || 
        (r.slotLabel || "").toLowerCase().includes(lower) ||
        (r.type || "").toLowerCase().includes(lower) ||
        (r.status || "").toLowerCase().includes(lower)
      );
    }
    return filtered;
  };

  const getFilteredOcrRecords = () => {
    let filtered = ocrRecords;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        (r.id || "").toLowerCase().includes(lower) || 
        (r.detectedPlate || "").toLowerCase().includes(lower) ||
        (r.status || "").toLowerCase().includes(lower)
      );
    }
    return filtered;
  };

  const filteredRecords = getFilteredRecords();
  const filteredOcrRecords = getFilteredOcrRecords();
  
  const currentTotalRecords = activeTab === "general" ? filteredRecords.length : filteredOcrRecords.length;
  const totalPages = Math.ceil(currentTotalRecords / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginatedOcrRecords = filteredOcrRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
                <th>${isSuperAdmin ? 'Establishment' : 'Slot'}</th>
                <th>Plate Number</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => `
                <tr>
                  <td><span class="type-badge ${r.type === 'reservation' ? 'type-res' : 'type-walkin'}">${r.type.replace('_', '-')}</span></td>
                  <td>${r.dateStr}</td>
                  <td>${isSuperAdmin ? r.lotName : r.slotLabel}</td>
                  <td>${r.plateNumber.toUpperCase()}</td>
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

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return toast.error("No data to export");
    
    let csvContent = "Type,Date & Time,";
    csvContent += isSuperAdmin ? "Establishment," : "Slot,";
    csvContent += "Plate Number,Status,Amount\n";

    filteredRecords.forEach(r => {
      const type = (r.type || "").replace('_', '-').toUpperCase();
      const date = `"${r.dateStr || ""}"`;
      const location = isSuperAdmin ? `"${r.lotName || ""}"` : `"${r.slotLabel || ""}"`;
      const plate = `"${(r.plateNumber || "N/A").toUpperCase()}"`;
      const status = (r.status || "UNKNOWN").toUpperCase();
      const amount = r.amount || 0;
      
      csvContent += `${type},${date},${location},${plate},${status},${amount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const lotName = lots.find(l => l.id === selectedLotId)?.name || "Records";
    link.setAttribute("href", url);
    link.setAttribute("download", `${lotName.replace(/\s+/g, '_')}_Records.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            Overall Establishment Records
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin ? "Read-only database of all walk-ins and reservations per lot." : "Your complete database of walk-ins and reservations."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
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
          )}
          
          <div className="relative flex items-center">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
            
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

          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="outline" disabled={filteredRecords.length === 0} className="rounded-xl shadow-sm">
              <Download size={16} className="mr-2" /> Print PDF
            </Button>
            <Button onClick={handleExportCSV} disabled={filteredRecords.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm">
              <FileSpreadsheet size={16} className="mr-2" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tabs Row */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => { setActiveTab("general"); setCurrentPage(1); }}
            className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "general" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            General Records
          </button>
          <button
            onClick={() => { setActiveTab("ocr"); setCurrentPage(1); }}
            className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "ocr" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            OCR Validation Logs
          </button>
        </div>

        {/* Search Bar Row */}
        <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search records..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl bg-slate-50 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border-slate-200"
            />
          </div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {currentTotalRecords} Records Found
          </div>
        </div>

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
        ) : (
          <>
            <div className="overflow-x-auto">
              {activeTab === "general" ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Type</th>
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Date & Time</th>
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">{isSuperAdmin ? "Establishment" : "Slot"}</th>
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Plate #</th>
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Amount</th>
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500 font-medium">
                          No general records found for this period.
                        </td>
                      </tr>
                    ) : (
                      paginatedRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider", r.type === "reservation" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700")}>
                              {r.type.replace("_", "-")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{r.dateStr}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">{isSuperAdmin ? r.lotName : r.slotLabel}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            {r.plateNumber === "N/A" ? <span className="text-slate-400 italic">Unrecorded</span> : <span className="font-mono text-slate-800">{r.plateNumber.toUpperCase()}</span>}
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-600">₱{r.amount}</td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full capitalize">
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Date/Time</th>
                      <th className="text-left font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Detected Plate</th>
                      <th className="text-center font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Confidence</th>
                      <th className="text-center font-bold text-slate-600 px-6 py-4 uppercase text-xs tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedOcrRecords.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-500 font-medium">
                          No OCR validation data available.
                        </td>
                      </tr>
                    ) : (
                      paginatedOcrRecords.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            {log.dateStr}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                            {log.detectedPlate}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md">
                              {log.confidence ? `${log.confidence}%` : "N/A"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase ${
                              log.status === 'matched' ? 'bg-emerald-100 text-emerald-700' :
                              log.status === 'mismatched' ? 'bg-rose-100 text-rose-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs font-medium text-slate-500">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="rounded-xl h-8"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="rounded-xl h-8"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout title="Records">
      {renderContent()}
    </AdminLayout>
  );
}
