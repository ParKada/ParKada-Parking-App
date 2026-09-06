import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import DraggableMapEditor from "@/components/parking/DraggableMapEditor";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import CameraGridEditor from "@/components/parking/CameraGridEditor";
import {
  Loader2,
  Plus,
  Info,
  LayoutDashboard,
  Database,
  Video,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  PenSquare,
  Trash2,
  MapPin,
  MousePointer2,
  Settings,
  Smartphone,
  Maximize,
  Maximize2,
  Minimize,
  ShieldAlert,
  User as UserIcon,
  Camera,
  Upload,
  RefreshCw,
  Car,
  ArrowLeftRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Layers,
  Building2,
  PenTool,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@parkada/shared";
import { useLanguage } from "@/hooks/useLanguage";

export default function AdminParkingSlots() {
  const { t } = useLanguage();

  const getAdminSupabase = async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
  };

  const [lots, setLots] = useState<any[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [isEditingMap, setIsEditingMap] = useState(false);
  const [addFormPos, setAddFormPos] = useState({ x: 16, y: 16 });
  const [isDraggingAddForm, setIsDraggingAddForm] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowStartPos = useRef({ x: 16, y: 16 });

  useEffect(() => {
    if (isAdding) {
      setAddFormPos({ x: 16, y: 16 });
    }
  }, [isAdding]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingAddForm) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      setAddFormPos({
        x: windowStartPos.current.x + dx,
        y: windowStartPos.current.y + dy,
      });
    };
    const handleMouseUp = () => setIsDraggingAddForm(false);

    if (isDraggingAddForm) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingAddForm]);
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotIsPwd, setNewSlotIsPwd] = useState(false);
  const [newSlotIsReservable, setNewSlotIsReservable] = useState(false);
  const [lastSlotSettings, setLastSlotSettings] = useState({ scale: 0.8, rotation: 0 });

  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [editSlotLabel, setEditSlotLabel] = useState("");
  const [editSlotIsPwd, setEditSlotIsPwd] = useState(false);
  const [editSlotIsReservable, setEditSlotIsReservable] = useState(true);
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(-1);
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");
  const [isRenamingFloor, setIsRenamingFloor] = useState(false);
  const [renameFloorName, setRenameFloorName] = useState("");

  const [undoHistory, setUndoHistory] = useState<any[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        e.preventDefault();
        document.getElementById("hidden-undo-btn")?.click();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleUndo = async () => {
    if (undoHistory.length === 0) {
      toast.info(t("Nothing to undo.", "Nothing to undo."));
      return;
    }
    const lastAction = undoHistory[undoHistory.length - 1];
    const { action, slotId, oldData } = lastAction;

    try {
      if (action === "update_buffered") {
        setSlots(prev =>
          prev.map(s => (s.id === slotId ? { ...s, ...oldData } : s))
        );
        if (lastAction.oldPending) {
          setPendingChanges(lastAction.oldPending);
        }
      } else if (action === "update") {
        const { error } = await supabase
          .from("parking_slots")
          .update(oldData)
          .eq("id", slotId);
        if (error) throw error;
        setSlots(prev =>
          prev.map(s => (s.id === slotId ? { ...s, ...oldData } : s))
        );
      } else if (action === "delete") {
        const { error } = await supabase
          .from("parking_slots")
          .insert([oldData]);
        if (error) throw error;
        setSlots(prev => [...prev, oldData]);
      } else if (action === "add") {
        const { error } = await supabase
          .from("parking_slots")
          .delete()
          .eq("id", slotId);
        if (error) throw error;
        setSlots(prev => prev.filter(s => s.id !== slotId));
      }

      setUndoHistory(prev => prev.slice(0, -1));
      toast.success(t("Undo successful.", "Matagumpay na naibalik."));
    } catch (err: any) {
      toast.error(t("Failed to undo.", "Nabigong ibalik."));
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const userRole = localStorage.getItem("admin_role") || "guard";
  const userLotId = localStorage.getItem("admin_lot_id");
  const canEditPhotos = userRole === "admin" || userRole === "admin" || userRole === "superadmin" || userRole === "super_admin";

  // New states for Multi-Camera & Setup
  const [activeTab, setActiveTab] = useState("details");
  const [expandedCameraId, setExpandedCameraId] = useState<string | null>(null);
  const [cameraPage, setCameraPage] = useState(0);
  const [lotAccounts, setLotAccounts] = useState<any[]>([]);

  const [cameras, setCameras] = useState<
    { id: string; name: string; stream_url?: string }[]
  >([]);
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState("");
  const [newCameraUrl, setNewCameraUrl] = useState("");
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [editingCameraField, setEditingCameraField] = useState<
    "name" | "url" | null
  >(null);
  const [editingCameraName, setEditingCameraName] = useState("");
  const [editingCameraUrl, setEditingCameraUrl] = useState("");
  const [showStreamUrl, setShowStreamUrl] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [cameraTestStatus, setCameraTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  const [showCameraGrid, setShowCameraGrid] = useState(false);
  const [isDrawingGrid, setIsDrawingGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for file uploads
  const frontViewRef = useRef<HTMLInputElement>(null);
  const businessPermitRef = useRef<HTMLInputElement>(null);
  const otherPhotoRef = useRef<HTMLInputElement>(null);

  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenMapRef = useRef<HTMLDivElement>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Pending changes for database records batching
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, Partial<any>>
  >({});
  const [tabToSwitch, setTabToSwitch] = useState<string | null>(null);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTabClick = (tab: string) => {
    if (Object.keys(pendingChanges).length > 0 && tab !== activeTab) {
      setTabToSwitch(tab);
      setShowTabWarning(true);
    } else {
      setActiveTab(tab);
      if (tab === "cameras") setExpandedCameraId(null);
    }
  };

  const handleSavePendingChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(pendingChanges).map(
        async ([id, changes]) => {
          const { _label, ...realChanges } = changes;
          const adminSupabase = await getAdminSupabase();
          const { error } = await adminSupabase
            .from("parking_slots")
            .update(realChanges)
            .eq("id", id);
          if (error) throw error;
          return { id, realChanges };
        }
      );
      await Promise.all(updates);
      setSlots(prev =>
        prev.map(s => {
          if (pendingChanges[s.id]) {
            const { _label, ...realChanges } = pendingChanges[s.id];
            return { ...s, ...realChanges };
          }
          return s;
        })
      );
      setPendingChanges({});
      toast.success(t("All changes saved successfully.", "Matagumpay na na-save ang lahat ng pagbabago."));
      setShowSaveModal(false);

      if (tabToSwitch) {
        setActiveTab(tabToSwitch);
        if (tabToSwitch === "cameras") setExpandedCameraId(null);
        setTabToSwitch(null);
        setShowTabWarning(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(t("Failed to save changes.", "Nabigong i-save ang mga pagbabago."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingChanges({});
    setShowSaveModal(false);
    if (tabToSwitch) {
      setActiveTab(tabToSwitch);
      if (tabToSwitch === "cameras") setExpandedCameraId(null);
      setTabToSwitch(null);
      setShowTabWarning(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement === fullscreenContainerRef.current
      );
      setIsMapFullscreen(
        document.fullscreenElement === fullscreenMapRef.current
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current?.requestFullscreen().catch(err => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
        );
      });
    } else {
      document.exitFullscreen();
    }
  };

  const toggleMapFullscreen = () => {
    if (!document.fullscreenElement) {
      fullscreenMapRef.current?.requestFullscreen().catch(err => {
        console.error(err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleUpdateCameraZone = async (
    slotId: string,
    points: { x: number; y: number }[]
  ) => {
    try {
      let STREAM_W = 1024;
      let STREAM_H = 576;
      const img = document.getElementById(
        "expanded-camera-feed"
      ) as HTMLImageElement;
      if (img && img.naturalWidth && img.naturalHeight) {
        STREAM_W = img.naturalWidth;
        STREAM_H = img.naturalHeight;
      }

      const pixelCoords = points.map(p => [
        Math.round((p.x / 100) * STREAM_W),
        Math.round((p.y / 100) * STREAM_H),
      ]);

      // Optimistic update so UI doesn't bounce back
      setSlots(prev =>
        prev.map(s =>
          s.id === slotId
            ? {
                ...s,
                camera_id: expandedCameraId,
                camera_zone_points: points,
                coordinates: pixelCoords,
                status: s.status === "unmapped" ? "available" : s.status,
              }
            : s
        )
      );

      const { error } = await supabase
        .from("parking_slots")
        .update({
          camera_id: expandedCameraId,
          camera_zone_points: points,
          coordinates: pixelCoords,
          status: "available",
        })
        .eq("id", slotId);

      if (error) throw error;
      toast.success(t("Camera zone saved to Supabase!", "Na-save na sa Supabase ang camera zone!"));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteCameraZone = async (slotId: string) => {
    try {
      // Optimistic update so drawing disappears instantly
      setSlots(prev =>
        prev.map(s =>
          s.id === slotId
            ? {
                ...s,
                camera_id: null,
                camera_zone_points: null,
                coordinates: null,
                status: "unmapped",
              }
            : s
        )
      );

      const { error } = await supabase
        .from("parking_slots")
        .update({
          camera_id: null,
          camera_zone_points: null,
          coordinates: null,
          status: "unmapped",
        })
        .eq("id", slotId);

      if (error) throw error;
      toast.success(t("Camera zone deleted from Supabase!", "Nabura na sa Supabase ang camera zone!"));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCameraName.trim()) return;
    
    // Use cam1_lotId or cam2_lotId for the first two cameras to match the AI Node exactly
    const nextIdx = cameras.length + 1;
    const newId = nextIdx <= 2 ? `cam${nextIdx}_${selectedLotId}` : `cam${Date.now()}`;
    
    const newCameras = [
      ...cameras,
      {
        id: newId,
        name: newCameraName.trim(),
        stream_url: newCameraUrl.trim(),
      },
    ];
    setCameras(newCameras);
    localStorage.setItem(
      `cameras_${selectedLotId}`,
      JSON.stringify(newCameras)
    );
    setNewCameraName("");
    setNewCameraUrl("");
    setIsAddingCamera(false);
  };

  // Natural sort comparator for slots
  const naturalSort = (a: any, b: any) => {
    return a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  const handleUploadPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "front_view" | "business_permit" | "other"
  ) => {
    const file = e.target.files?.[0];
    console.log(
      "Photo upload triggered. File:",
      file,
      "Lot ID:",
      selectedLotId
    );
    if (!file || !selectedLotId) return;

    const toastId = toast.loading(
      `Uploading ${type === "front_view" ? "Front View" : type === "business_permit" ? "Business Permit" : "Photo"}...`
    );

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedLotId}/${type}-${Date.now()}.${fileExt}`;
      console.log("Uploading to storage as:", fileName);

      const { data, error } = await supabase.storage
        .from("lot-documents")
        .upload(fileName, file, { upsert: true });

      if (error) {
        console.error("Storage error:", error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from("lot-documents")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log("Upload successful. Public URL:", publicUrl);

      // Update database
      let updatePayload: any = {};
      if (type === "other") {
        const currentOthers = activeLot?.other_photos || [];
        updatePayload = { other_photos: [...currentOthers, publicUrl] };
      } else {
        const updateField =
          type === "front_view" ? "front_view_url" : "business_permit_url";
        updatePayload = { [updateField]: publicUrl };
      }

      const { error: dbError } = await (await getAdminSupabase()).from("parking_lots").update(updatePayload)
        .eq("id", selectedLotId);

      if (dbError) {
        console.error("Database update error:", dbError);
        throw dbError;
      }

      toast.success(t("Photo uploaded successfully!", "Matagumpay na nai-upload ang litrato!"), { id: toastId });
      fetchLots(); // refresh data
    } catch (error: any) {
      console.error("Upload error caught:", error);
      toast.error(t(`Upload failed: ${error.message}`, `Nabigo ang pag-upload: ${error.message}`), { id: toastId });
    }

    // Reset the input value so the same file can be selected again if needed
    e.target.value = "";
  };

  const handleDeleteOtherPhoto = async (urlToDelete: string) => {
    if (!activeLot || !selectedLotId) return;
    if (
      !window.confirm(
        "Sigurado ka bang gusto mong burahin ang litratong ito? (Are you sure you want to delete this photo?)"
      )
    )
      return;

    const toastId = toast.loading(t("Deleting photo...", "Deleting photo..."));
    try {
      const currentOthers = activeLot.other_photos || [];
      const newOthers = currentOthers.filter((u: string) => u !== urlToDelete);

      const { error: dbError } = await (await getAdminSupabase()).from("parking_lots").update({ other_photos: newOthers })
        .eq("id", selectedLotId);

      if (dbError) throw dbError;

      toast.success(t("Photo deleted", "Photo deleted"), { id: toastId });
      fetchLots();
    } catch (error: any) {
      console.error(error);
      toast.error(t(`Delete failed: ${error.message}`, `Delete failed: ${error.message}`), { id: toastId });
    }
  };

  const handleDeleteMainPhoto = async (
    type: "front_view" | "business_permit"
  ) => {
    if (!activeLot || !selectedLotId) return;
    if (
      !window.confirm(
        "Sigurado ka bang gusto mong burahin ang litratong ito? (Are you sure you want to delete this photo?)"
      )
    )
      return;

    const toastId = toast.loading(t("Deleting photo...", "Deleting photo..."));
    try {
      const updateField =
        type === "front_view" ? "front_view_url" : "business_permit_url";
      const { error: dbError } = await (await getAdminSupabase()).from("parking_lots").update({ [updateField]: null })
        .eq("id", selectedLotId);

      if (dbError) throw dbError;

      toast.success(t("Photo deleted", "Photo deleted"), { id: toastId });
      fetchLots();
    } catch (error: any) {
      console.error(error);
      toast.error(t(`Delete failed: ${error.message}`, `Delete failed: ${error.message}`), { id: toastId });
    }
  };

  useEffect(() => {
    fetchLots();
  }, []);

  useEffect(() => {
    if (!selectedLotId) return;

    fetchSlots(selectedLotId);
    fetchLotAccounts(selectedLotId);

    const channel = supabase
      .channel(`realtime-parking-slots-${selectedLotId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "parking_slots",
          filter: `lot_id=eq.${selectedLotId}`,
        },
        payload => {
          if (payload.eventType === "INSERT") {
            setSlots(prev => {
              if (prev.find(s => s.id === payload.new.id)) return prev;
              const newList = [...prev, payload.new];
              newList.sort(naturalSort);
              return newList;
            });
          } else if (payload.eventType === "UPDATE") {
            setSlots(prev =>
              prev.map(slot =>
                slot.id === payload.new.id ? { ...slot, ...payload.new } : slot
              )
            );
          } else if (payload.eventType === "DELETE") {
            setSlots(prev => prev.filter(slot => slot.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Load cameras for this lot
    const storedCameras = localStorage.getItem(`cameras_${selectedLotId}`);
    if (storedCameras) {
      try {
        let parsedCameras = JSON.parse(storedCameras);
        // MIGRATION: Ensure first two cameras match Python AI Node expectations
        let changed = false;
        parsedCameras = parsedCameras.map((cam: any, idx: number) => {
          if (idx === 0 && !cam.id.startsWith("cam1_")) {
            changed = true;
            return { ...cam, id: `cam1_${selectedLotId}` };
          }
          if (idx === 1 && !cam.id.startsWith("cam2_")) {
            changed = true;
            return { ...cam, id: `cam2_${selectedLotId}` };
          }
          return cam;
        });
        setCameras(parsedCameras);
        if (changed) {
          localStorage.setItem(`cameras_${selectedLotId}`, JSON.stringify(parsedCameras));
        }
      } catch (e) {
        setCameras([]);
      }
    } else {
      setCameras([]);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedLotId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFloorIndex]);

  // Refresh slots automatically when switching back to the floor map
  useEffect(() => {
    if (activeTab === "details" && selectedLotId) {
      fetchSlots(selectedLotId);
    }
  }, [activeTab, selectedLotId]);

  // Save cameras to local storage whenever they change
  useEffect(() => {
    if (selectedLotId) {
      localStorage.setItem(`cameras_${selectedLotId}`, JSON.stringify(cameras));
    }
  }, [cameras, selectedLotId]);

  // 🔥 UPDATED: Only accredited lots, sorted alphabetically
  const fetchLots = async () => {
    setLoadingLots(true);
    try {
      let query = supabase
        .from("parking_lots")
        .select("*")
        .order("name", { ascending: true }); // ← alphabetical

      if ((userRole === "admin" || userRole === "guard" || userRole === "admin" || userRole === "staff") && userLotId) {
        query = query.eq("id", userLotId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        setLots(data);
        const viewLotId = localStorage.getItem("view_lot_id");

        if (viewLotId && data.some(l => l.id === viewLotId)) {
          setSelectedLotId(viewLotId);
          localStorage.removeItem("view_lot_id");
        } else {
          setSelectedLotId(data[0].id);
        }
      } else {
        toast.error(t("No accredited parking lots found for your account.", "Walang nakitang awtorisadong parking lots para sa account mo."));
      }
    } catch (error: any) {
      console.error("Supabase Error:", error.message);
      toast.error(t("Failed to fetch parking lots.", "Nabigong kunin ang parking lots."));
    } finally {
      setLoadingLots(false);
    }
  };

  const fetchSlots = async (lotId: string) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("parking_slots")
        .select("*")
        .eq("lot_id", lotId);
      // No .order() – we sort client-side naturally

      if (error) throw error;
      const sortedData = data ? [...data].sort(naturalSort) : [];
      setSlots(sortedData);
    } catch (error: any) {
      console.error("Supabase Error:", error.message);
      toast.error(t("Failed to fetch parking slots.", "Nabigong kunin ang parking slots."));
    } finally {
      setRefreshing(false);
    }
  };

  const fetchLotAccounts = async (lotId: string) => {
    try {
      const { data, error } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("assigned_lot_id", lotId);
      if (!error && data) {
        setLotAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const handleRefresh = async () => {
    if (selectedLotId) {
      await fetchSlots(selectedLotId);
      toast.success(t("Live parking data refreshed!", "Na-refresh na ang parking data!"));
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      userRole !== "superadmin" &&
      userRole !== "super_admin" &&
      userRole !== "admin"
    )
      return;

    if (!newSlotLabel.trim()) {
      toast.error(t("Please enter a slot label.", "Pakisuyo enter a slot label."));
      return;
    }

    try {
      if (slots.some(s => s.label.trim().toLowerCase() === newSlotLabel.trim().toLowerCase())) {
        toast.error(t("Parking slot name already exists. Please choose a different name.", "May kaparehong pangalan ang parking slot na ito. Pumili ng iba."));
        return;
      }

      const currentFloorSlots = slots.filter(
        s => (s.floor_index || 0) === selectedFloorIndex
      );
      let newX = 10;
      let newY = 10;
      let found = false;

      while (!found && newY <= 85) {
        // Check if there is any slot within 10% distance
        const overlap = currentFloorSlots.find(
          s =>
            Math.abs((s.ui_x ?? 10) - newX) < 12 &&
            Math.abs((s.ui_y ?? 10) - newY) < 15
        );

        if (!overlap) {
          found = true;
        } else {
          newX += 15;
          if (newX > 85) {
            newX = 10;
            newY += 20;
          }
        }
      }

      const { data, error } = await supabase
        .from("parking_slots")
        .insert([
          {
            lot_id: selectedLotId,
            label: newSlotLabel.trim().toUpperCase(),
            status: "unmapped",
            ui_x: newX,
            ui_y: newY,
            ui_rotation: lastSlotSettings.rotation,
            ui_scale: lastSlotSettings.scale,
            is_pwd: newSlotIsPwd,
            is_reservable: activeLot?.type === "public" ? false : newSlotIsReservable,
            floor_index: selectedFloorIndex,
          },
        ])
        .select();

      if (error) {
        if (error.code === "23505") {
          toast.error(t("This slot label already exists in this lot.", "Mayroon nang ganitong slot name."));
        } else {
          throw error;
        }
        return;
      }

      if (data && data.length > 0) {
        setSlots([...slots, data[0]]);
        setUndoHistory(prev => [
          ...prev,
          { action: "add", slotId: data[0].id, oldData: data[0] },
        ]);
      }

      toast.success(
        t(`Slot ${newSlotLabel} added! Draw it on the camera feed to link it.`, `Naidagdag na ang Slot ${newSlotLabel}! Iguhit ito sa camera para mai-link.`)
      );
      setNewSlotLabel("");
      setNewSlotIsPwd(false);
      setNewSlotIsReservable(false);
      setIsAdding(false);
    } catch (error: any) {
      console.error("Supabase Error adding slot:", error.message || error);
      toast.error(t(`Error: ${error.message || "Failed to add new slot"}`, `Error: ${error.message || "Nabigong idagdag ang slot"}`));
    }
  };

  const handleEditSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editSlotLabel.trim()) return;

    if (slots.some(s => s.id !== editingSlot.id && s.label.trim().toLowerCase() === editSlotLabel.trim().toLowerCase())) {
      toast.error(t("Parking slot name already exists. Please choose a different name.", "May kaparehong pangalan ang parking slot na ito. Pumili ng iba."));
      return;
    }

    try {
      const updates = {
        label: editSlotLabel.trim().toUpperCase(),
        is_pwd: editSlotIsPwd,
        is_reservable: activeLot?.type === "public" ? false : editSlotIsReservable,
      };

      const oldSlot = slots.find(s => s.id === editingSlot.id);

      const { error } = await supabase
        .from("parking_slots")
        .update(updates)
        .eq("id", editingSlot.id);

      if (error) {
        if (error.code === "23505") {
          toast.error(t("This slot name already exists.", "Mayroon nang ganitong slot name."));
        } else throw error;
        return;
      }

      setSlots(prev =>
        prev.map(s => (s.id === editingSlot.id ? { ...s, ...updates } : s))
      );
      if (oldSlot) {
        setUndoHistory(prev => [
          ...prev,
          { action: "update", slotId: editingSlot.id, oldData: { ...oldSlot } },
        ]);
      }
      toast.success(t("Slot updated!", "Na-update ang slot!"));
      setEditingSlot(null);
    } catch (err: any) {
      console.error("Supabase Error editing slot:", err.message || err);
      toast.error(t(`Error: ${err.message || "Failed to update slot"}`, `Error: ${err.message || "Nabigong i-update ang slot"}`));
    }
  };

  const toggleOccupancyStatus = async (
    slotId: string,
    currentStatus: string,
    slotLabel: string
  ) => {
    const newStatus = currentStatus === "occupied" ? "available" : "occupied";
    const oldSlot = slots.find(s => s.id === slotId);

    // Optimistically update UI
    setSlots(prev =>
      prev.map(s => (s.id === slotId ? { ...s, status: newStatus } : s))
    );

    try {
      const adminSupabase = await getAdminSupabase();
      const { error } = await adminSupabase
        .from("parking_slots")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", slotId);
      if (error) throw error;
      toast.success(t(`Slot ${slotLabel} is now ${newStatus}.`, `Ang slot ${slotLabel} ay ${newStatus} na.`));
    } catch (err: any) {
      console.error(err);
      toast.error(t("Failed to update status.", "Nabigong i-update ang status."));
      // Revert if error
      if (oldSlot) {
        setSlots(prev =>
          prev.map(s => (s.id === slotId ? { ...s, status: oldSlot.status } : s))
        );
      }
    }
  };

  const handleDeleteSlot = async (
    slotId: string,
    slotLabel: string,
    slotStatus: string
  ) => {
    if (slotStatus === "occupied") {
      toast.error(t("Cannot delete an occupied slot.", "Hindi mabubura ang okupadong slot."));
      return;
    }
    if (!window.confirm(t(`Are you sure you want to delete slot ${slotLabel}?`, `Sigurado ka bang gusto mong burahin ang slot na ${slotLabel}?`)))
      return;

    try {
      const oldSlot = slots.find(s => s.id === slotId);
      const { error } = await supabase
        .from("parking_slots")
        .delete()
        .eq("id", slotId);
      if (error) throw error;

      toast.success(t(`Slot ${slotLabel} deleted.`, `Nabura na ang slot ${slotLabel}.`));
      setSlots(slots.filter(s => s.id !== slotId));
      if (oldSlot) {
        setUndoHistory(prev => [
          ...prev,
          { action: "delete", slotId, oldData: { ...oldSlot } },
        ]);
      }
    } catch (error: any) {
      console.error("Supabase Error:", error.message || error);
      toast.error(t(`Error deleting slot: ${error.message || "Failed"}`, `Error sa pagbura: ${error.message || "Nabigo"}`));
    }
  };

  const handleDeleteFloor = async (floorIndex: number) => {
    if (!activeLot) return;
    const currentFloors = activeLot.floors || ["Main Floor"];
    if (currentFloors.length <= 1) {
      toast.error(t("Cannot delete the only floor.", "Cannot delete the only floor."));
      return;
    }

    const slotsOnFloor = slots.filter(s => (s.floor_index || 0) === floorIndex);
    if (slotsOnFloor.length > 0) {
      toast.error(
        t("Cannot delete a floor that has slots. Please delete the slots first.", "Hindi pwedeng burahin ang palapag na may slots. Burahin muna ang mga slots.")
      );
      return;
    }

    if (
      !window.confirm(
        t(`Are you sure you want to delete ${currentFloors[floorIndex]}?`, `Sigurado ka bang buburahin ang ${currentFloors[floorIndex]}?`)
      )
    )
      return;

    try {
      const updatedFloors = currentFloors.filter(
        (_: any, idx: number) => idx !== floorIndex
      );
      const { error } = await (await getAdminSupabase()).from("parking_lots").update({ floors: updatedFloors })
        .eq("id", activeLot.id);
      if (error) throw error;

      setLots(
        lots.map(l =>
          l.id === activeLot.id ? { ...l, floors: updatedFloors } : l
        )
      );
      setSelectedFloorIndex(0);
      toast.success(t("Floor deleted successfully.", "Matagumpay na nabura ang palapag."));
    } catch (error: any) {
      console.error("Failed to delete floor", error.message || error);
      toast.error(t(`Error deleting floor: ${error.message || "Failed"}`, `Error sa pagbura ng palapag: ${error.message || "Nabigo"}`));
    }
  };

  const handleUpdateSlotCoordinates = (
    slotId: string,
    updates: Partial<any>
  ) => {
    if (userRole !== "superadmin" && userRole !== "super_admin") return;
    
    const oldSlot = slots.find(s => s.id === slotId);
    if (oldSlot) {
      setUndoHistory(prev => [
        ...prev,
        { action: "update_buffered", slotId, oldData: { ...oldSlot }, oldPending: pendingChanges }
      ]);
    }

    // Optimistic UI update immediately
    setSlots(prev =>
      prev.map(s => (s.id === slotId ? { ...s, ...updates } : s))
    );

    const slotLabel = slots.find(s => s.id === slotId)?.label || "Slot";
    
    // Buffer changes instead of sending directly to Supabase to prevent notification spam
    setPendingChanges(prev => {
      const existing = prev[slotId] || {};
      return {
        ...prev,
        [slotId]: {
          ...existing,
          ...updates,
          _label: existing._label || slotLabel,
        },
      };
    });

    if (updates.ui_scale !== undefined || updates.ui_rotation !== undefined) {
      setLastSlotSettings(prev => ({
        scale: updates.ui_scale !== undefined ? updates.ui_scale : prev.scale,
        rotation: updates.ui_rotation !== undefined ? updates.ui_rotation : prev.rotation
      }));
    }
  };

  const handleRenameFloor = async () => {
    if (!renameFloorName.trim() || !activeLot || selectedFloorIndex === -1)
      return;
    try {
      const currentFloors = activeLot.floors || ["Main Floor"];
      const updatedFloors = [...currentFloors];
      updatedFloors[selectedFloorIndex] = renameFloorName.trim();

      const { error } = await (await getAdminSupabase()).from("parking_lots").update({ floors: updatedFloors })
        .eq("id", activeLot.id);
      if (error) throw error;

      setLots(
        lots.map(l =>
          l.id === activeLot.id ? { ...l, floors: updatedFloors } : l
        )
      );
      setIsRenamingFloor(false);
      toast.success(t(`Renamed floor to: ${renameFloorName}`, `Pinalitan ang pangalan ng palapag sa: ${renameFloorName}`));
    } catch (e: any) {
      toast.error(t(e.message || "Failed to rename floor", e.message || "Nabigong palitan ang pangalan"));
    }
  };

  const handleAddFloor = async () => {
    if (!newFloorName.trim() || !activeLot) return;
    try {
      const currentFloors = activeLot.floors || ["Main Floor"];
      const updatedFloors = [...currentFloors, newFloorName.trim()];
      const { error } = await (await getAdminSupabase()).from("parking_lots").update({ floors: updatedFloors })
        .eq("id", activeLot.id);
      if (error) throw error;

      setLots(
        lots.map(l =>
          l.id === activeLot.id ? { ...l, floors: updatedFloors } : l
        )
      );
      setNewFloorName("");
      setIsAddingFloor(false);
      setSelectedFloorIndex(updatedFloors.length - 1);
      toast.success(t(`Added floor: ${newFloorName}`, `Naidagdag ang palapag: ${newFloorName}`));
    } catch (e: any) {
      console.error("Failed to add floor", e.message);
      toast.error(t("Failed to add floor.", "Nabigong magdagdag ng palapag."));
    }
  };

  if (loadingLots) {
    return (
      <AdminLayout title="Parking Slots">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <RefreshCw className="animate-spin text-primary mb-4 w-8 h-8" />
          <p className="text-muted-foreground font-medium">
            Loading database...
          </p>
        </div>
      </AdminLayout>
    );
  }

  const getCameraUrl = (cameraId?: string) => {
    const lanBase =
      import.meta.env.VITE_CAMERA_LAN_URL || "http://192.168.8.156:5000";
    const publicBase = import.meta.env.VITE_CAMERA_PUBLIC_URL || "";

    // Use the camera-specific stream path if a cameraId is provided
    const path = cameraId ? `/video_feed/${cameraId}` : "/video_feed";

    // Super admins and admins use the Cloudflare public URL (internet access)
    // Guards use the LAN URL (same WiFi as the camera machine)
    if (userRole === "superadmin" || userRole === "super_admin") {
      return publicBase ? `${publicBase}${path}` : `${lanBase}${path}`;
    }
    // Everyone else (manager, guard) uses the local LAN stream directly — no Cloudflare needed
    return `${lanBase}${path}`;
  };

  const activeLot = lots.find(l => l.id === selectedLotId);
  if (!activeLot)
    return (
      <AdminLayout title="Parking Slots">
        <p className="p-6 text-muted-foreground">No data found.</p>
      </AdminLayout>
    );

  return (
    <AdminLayout title="Parking Slots">
      <button id="hidden-undo-btn" onClick={handleUndo} className="hidden" />
      <div className="space-y-6">
        {/* Lot Selector or Name Display */}
        {lots.length > 1 ? (
          <div className="flex flex-col space-y-1.5 w-full md:max-w-md">
            <label
              htmlFor="lot-dropdown"
              className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
            >
              Select Establishment
            </label>
            <div className="relative">
              <select
                id="lot-dropdown"
                value={selectedLotId}
                onChange={e => setSelectedLotId(e.target.value)}
                className="w-full appearance-none bg-white border border-border text-foreground text-sm font-semibold rounded-xl px-4 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer"
              >
                {lots.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-muted-foreground">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-1.5 w-full md:max-w-md">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Establishment
            </label>
            <div className="w-full bg-slate-50 border border-border text-foreground text-sm font-semibold rounded-xl px-4 py-3 shadow-sm">
              {activeLot?.name || "Loading..."}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-border pb-2">
          <button
            className={cn(
              "px-4 py-2 font-bold text-sm rounded-t-lg border-b-2 transition-colors",
              activeTab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => handleTabClick("details")}
          >
            Lot Details
          </button>
          {userRole !== "guard" && (
            <button
              className={cn(
                "px-4 py-2 font-bold text-sm rounded-t-lg border-b-2 transition-colors",
                activeTab === "records"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleTabClick("records")}
            >
              Database Records
            </button>
          )}
          <button
            className={cn(
              "px-4 py-2 font-bold text-sm rounded-t-lg border-b-2 transition-colors",
              activeTab === "cameras"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => handleTabClick("cameras")}
          >
            Cameras & Setup
          </button>
        </div>

        {activeTab === "details" && (
          <div className="animate-in fade-in duration-300">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* LEFT COLUMN: Main Content (Establishment, Slot Mapping, Database) */}
              <div className="xl:col-span-2 space-y-6">
                {/* Info Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-border">
                  <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                    <Building2 className="text-primary w-5 h-5" /> Establishment
                    Info
                  </h3>
                  <p className="font-semibold text-lg">{activeLot.name}</p>
                  <p className="text-muted-foreground">
                    {activeLot.address || "No address specified"}
                  </p>
                </div>

                {/* Visual Slot Grid & Management (Moved here from below) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-border card-elevated">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-3 rounded-full text-primary">
                        {userRole === "guard" ? (
                          <Eye size={24} />
                        ) : (
                          <Car size={24} />
                        )}
                      </div>
                      <div>
                        <h3
                          className="text-xl font-bold text-foreground"
                          style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}
                        >
                          Slot Mapping
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {userRole === "guard"
                            ? "Live Slot Monitor"
                            : "Draw and map slots on this camera"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="rounded-xl text-sm font-bold"
                      >
                        <RefreshCw
                          size={16}
                          className={cn("mr-2", refreshing && "animate-spin")}
                        />
                        {refreshing ? "Syncing..." : "Refresh Data"}
                      </Button>
                    </div>
                  </div>

                  {/* Floor Navigation */}
                  <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-4">
                    <div className="flex items-center text-muted-foreground font-medium">
                      <Layers size={18} className="mr-2" /> Floors
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedFloorIndex}
                        onChange={e =>
                          setSelectedFloorIndex(Number(e.target.value))
                        }
                        className="h-10 px-4 py-2 rounded-xl border border-border bg-white text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
                      >
                        <option value={-1}>Overview</option>
                        {(activeLot.floors || ["Main Floor"]).map(
                          (floorName: string, idx: number) => (
                            <option key={idx} value={idx}>
                              {floorName}
                            </option>
                          )
                        )}
                      </select>

                      {(userRole === "superadmin" ||
                        userRole === "super_admin") &&
                        selectedFloorIndex !== -1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-slate-500 hover:text-primary rounded-xl"
                            onClick={() => {
                              setRenameFloorName(
                                (activeLot.floors || ["Main Floor"])[
                                  selectedFloorIndex
                                ]
                              );
                              setIsRenamingFloor(true);
                            }}
                            title="Rename Floor"
                          >
                            <PenSquare size={18} />
                          </Button>
                        )}
                    </div>

                    {(userRole === "superadmin" ||
                      userRole === "super_admin") && (
                      <div className="ml-auto flex items-center gap-2">
                        {selectedFloorIndex !== -1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 h-10 rounded-xl font-bold"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteFloor(selectedFloorIndex);
                            }}
                            title="Delete selected floor"
                          >
                            <Trash2 size={16} className="mr-2" /> Delete Floor
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Map Dark Frame Container */}
                  <div className="bg-[#0f172a] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col w-full flex-shrink-0 mb-4 mt-2">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 w-full overflow-hidden">
                      <div className="flex items-center gap-3">
                        <MapPin className="text-primary w-5 h-5 flex-shrink-0" />
                        <h3 className="text-white font-bold">Floor Mapping</h3>
                      </div>
                    </div>

                    {/* Fullscreen Wrapper */}
                    <div
                      ref={fullscreenMapRef}
                      className={cn(
                        "flex flex-col w-full",
                        isMapFullscreen
                          ? "bg-slate-950 h-full overflow-y-auto"
                          : "relative bg-[#0f172a]"
                      )}
                    >
                      <div
                        className={cn(
                          "w-full max-w-full flex-1",
                          isMapFullscreen ? "p-8" : ""
                        )}
                      >
                        {isAdding &&
                          (userRole === "superadmin" ||
                            userRole === "super_admin") && (
                            <div 
                              className="absolute z-50 p-5 pb-5 pt-3 bg-slate-800/95 backdrop-blur-md border border-slate-700 shadow-xl rounded-2xl w-[320px]"
                              style={{ left: addFormPos.x, top: addFormPos.y }}
                            >
                              <div
                                className="w-full h-6 -mt-1 mb-2 cursor-move bg-slate-700/0 rounded-t-2xl flex items-center justify-center hover:bg-slate-700/30 transition-colors"
                                onMouseDown={(e) => {
                                  setIsDraggingAddForm(true);
                                  dragStartPos.current = { x: e.clientX, y: e.clientY };
                                  windowStartPos.current = { ...addFormPos };
                                }}
                              >
                                <div className="w-12 h-1.5 bg-slate-500/50 rounded-full pointer-events-none" />
                              </div>
                              <form
                                onSubmit={handleAddSlot}
                                className="flex flex-col"
                              >
                                <div className="flex flex-col mb-4">
                                  <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">
                                    Slot Name (e.g., A1, PWD-1)
                                  </label>
                                  <input
                                    type="text"
                                    value={newSlotLabel}
                                    onChange={e =>
                                      setNewSlotLabel(
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    className="w-full h-10 px-3 mb-4 rounded-lg border border-slate-600 bg-slate-700 text-white focus:border-primary focus:ring-1 focus:ring-primary text-sm shadow-sm transition-all"
                                    placeholder="Enter slot name"
                                    autoFocus
                                  />

                                  {activeLot?.type !== "public" && (
                                    <>
                                      <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">
                                        Type
                                      </label>
                                      <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-900/50 p-1 rounded-xl">
                                        <button
                                          type="button"
                                          disabled={newSlotIsPwd}
                                          onClick={() =>
                                            setNewSlotIsReservable(true)
                                          }
                                          className={cn(
                                            "py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                            newSlotIsReservable
                                              ? "bg-amber-500 text-white shadow-sm"
                                              : "text-slate-400 hover:text-white"
                                          )}
                                        >
                                          Reservable
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setNewSlotIsReservable(false)
                                          }
                                          className={cn(
                                            "py-1.5 text-xs font-bold rounded-lg transition-all",
                                            !newSlotIsReservable
                                              ? "bg-amber-500 text-white shadow-sm"
                                              : "text-slate-400 hover:text-white"
                                          )}
                                        >
                                          Walk-In
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="isPwd"
                                      checked={newSlotIsPwd}
                                      onChange={e => {
                                        const checked = e.target.checked;
                                        setNewSlotIsPwd(checked);
                                        if (checked)
                                          setNewSlotIsReservable(false);
                                      }}
                                      className="rounded border-slate-500 bg-slate-700 text-primary w-4 h-4"
                                    />
                                    <label
                                      htmlFor="isPwd"
                                      className="text-[11px] font-bold text-slate-400 tracking-wider uppercase cursor-pointer"
                                    >
                                      PWD / Priority Slot?
                                    </label>
                                  </div>
                                  {newSlotIsPwd && activeLot?.type !== "public" && (
                                    <div className="mt-2 text-[10px] text-amber-500 font-medium">
                                      * PWD slots cannot be made reservable and
                                      are automatically set to Walk-In.
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    type="submit"
                                    className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                                    onClick={() => setIsAdding(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            </div>
                          )}

                        {editingSlot &&
                          (userRole === "superadmin" ||
                            userRole === "super_admin") && (
                            <div className="absolute top-4 left-4 z-50 p-5 bg-slate-800/95 backdrop-blur-md border border-slate-700 shadow-xl rounded-2xl w-[320px]">
                              <form
                                onSubmit={handleEditSlotSubmit}
                                className="flex flex-col"
                              >
                                <div className="flex flex-col mb-4">
                                  <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">
                                    Edit Slot Name
                                  </label>
                                  <input
                                    type="text"
                                    value={editSlotLabel}
                                    onChange={e =>
                                      setEditSlotLabel(
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    className="w-full h-10 px-3 mb-4 rounded-lg border border-slate-600 bg-slate-700 text-white focus:border-primary focus:ring-1 focus:ring-primary text-sm shadow-sm transition-all"
                                    placeholder="Enter slot name"
                                    autoFocus
                                  />

                                  {activeLot?.type !== "public" && (
                                    <>
                                      <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">
                                        Type
                                      </label>
                                      <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-900/50 p-1 rounded-xl">
                                        <button
                                          type="button"
                                          disabled={editSlotIsPwd}
                                          onClick={() =>
                                            setEditSlotIsReservable(true)
                                          }
                                          className={cn(
                                            "py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                            editSlotIsReservable
                                              ? "bg-amber-500 text-white shadow-sm"
                                              : "text-slate-400 hover:text-white"
                                          )}
                                        >
                                          Reservable
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditSlotIsReservable(false)
                                          }
                                          className={cn(
                                            "py-1.5 text-xs font-bold rounded-lg transition-all",
                                            !editSlotIsReservable
                                              ? "bg-amber-500 text-white shadow-sm"
                                              : "text-slate-400 hover:text-white"
                                          )}
                                        >
                                          Walk-In
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="editIsPwd"
                                      checked={editSlotIsPwd}
                                      onChange={e => {
                                        const checked = e.target.checked;
                                        setEditSlotIsPwd(checked);
                                        if (checked)
                                          setEditSlotIsReservable(false);
                                      }}
                                      className="rounded border-slate-500 bg-slate-700 text-primary w-4 h-4"
                                    />
                                    <label
                                      htmlFor="editIsPwd"
                                      className="text-[11px] font-bold text-slate-400 tracking-wider uppercase cursor-pointer"
                                    >
                                      PWD / Priority Slot?
                                    </label>
                                  </div>
                                  {editSlotIsPwd && activeLot?.type !== "public" && (
                                    <div className="mt-2 text-[10px] text-amber-500 font-medium">
                                      * PWD slots cannot be made reservable and
                                      are automatically set to Walk-In.
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    type="submit"
                                    className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                                  >
                                    Update
                                  </Button>
                                  <Button
                                    type="button"
                                    className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                                    onClick={() => setEditingSlot(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            </div>
                          )}

                        {selectedFloorIndex === -1 ? (
                          <div
                            className={cn(
                              "space-y-8",
                              !isMapFullscreen ? "p-4" : ""
                            )}
                          >
                            {(activeLot.floors || ["Main Floor"]).map(
                              (floorName: string, idx: number) => {
                                const floorSlots = slots.filter(
                                  s => (s.floor_index || 0) === idx
                                );
                                if (floorSlots.length === 0) return null;
                                return (
                                  <div key={idx} className="space-y-3 w-full">
                                    <h4 className="font-bold text-slate-200 flex items-center gap-2">
                                      <Layers className="w-4 h-4 text-primary" />{" "}
                                      {floorName}
                                    </h4>
                                    <DraggableMapEditor
                                      slots={floorSlots}
                                      interactive={false}
                                      onUpdateSlot={handleUpdateSlotCoordinates}
                                    />
                                  </div>
                                );
                              }
                            )}
                            {slots.length === 0 && (
                              <div className="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 w-full mt-4">
                                {userRole === "guard" ? (
                                  "Wala pang nakalagay na slots sa mapang ito."
                                ) : (
                                  <>
                                    Wala pang slots sa parking lot na ito.
                                    <br />
                                    I-click ang "Add Slot" button sa taas o
                                    gumuhit sa AI Camera Dashboard para
                                    mag-umpisa.
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : slots.filter(
                            s => (s.floor_index || 0) === selectedFloorIndex
                          ).length > 0 ? (
                          <div 
                            className={cn(
                              "flex items-center justify-center min-h-[300px] mx-auto",
                              isMapFullscreen ? "w-full max-w-[1400px]" : "w-full h-full"
                            )}
                            style={isMapFullscreen ? { height: '80vh', maxHeight: '80vh', aspectRatio: '16/9' } : {}}
                          >
                            <DraggableMapEditor
                              slots={slots.filter(
                                s => (s.floor_index || 0) === selectedFloorIndex
                              )}
                              interactive={
                                isEditingMap &&
                                (userRole === "superadmin" ||
                                userRole === "super_admin")
                              }
                              onUpdateSlot={handleUpdateSlotCoordinates}
                              onEditSlot={slot => {
                                setEditingSlot(slot);
                                setEditSlotLabel(slot.label || "");
                                setEditSlotIsPwd(slot.is_pwd || false);
                                setEditSlotIsReservable(
                                  slot.is_reservable ?? true
                                );
                                setIsAdding(false);
                              }}
                              onDeleteSlot={slotId => {
                                const slot = slots.find(s => s.id === slotId);
                                if (slot)
                                  handleDeleteSlot(
                                    slot.id,
                                    slot.label,
                                    slot.status
                                  );
                              }}
                            />
                          </div>
                        ) : (
                          <div className="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 w-full h-full flex items-center justify-center min-h-[300px]">
                            {userRole === "guard" ? (
                              "Wala pang nakalagay na slots sa mapang ito."
                            ) : (
                              <p>
                                Wala pang slots sa parking lot na ito.
                                <br />
                                I-click ang "Add Slot" button sa ibaba para
                                mag-umpisa.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Toolbar */}
                      <div
                        className={cn(
                          "p-3 border-t border-slate-800 transition-all z-50 mt-auto",
                          isMapFullscreen
                            ? "fixed bottom-4 right-4 w-auto border-none bg-transparent p-0 block"
                            : "relative flex justify-end items-center w-full bg-slate-950/50"
                        )}
                      >
                        {/* Right Side (Fullscreen Toggle and Fullscreen Add Slot) */}
                        <div
                          className={cn(
                                    "flex items-center gap-2 relative z-10",
                            isMapFullscreen
                              ? "bg-slate-950/60 p-1.5 rounded-xl border border-white/10 shadow-lg backdrop-blur-md"
                              : ""
                          )}
                        >
                          {(userRole === "superadmin" ||
                            userRole === "super_admin") &&
                            selectedFloorIndex !== -1 &&
                            isEditingMap && (
                              <Button
                                size="sm"
                                variant={
                                  isMapFullscreen ? "default" : "outline"
                                }
                                className={cn(
                                  "h-8 px-3 text-xs font-bold transition-colors rounded-lg",
                                  isMapFullscreen
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "text-slate-300 border-slate-700 bg-slate-900/40 hover:bg-slate-800 hover:text-white"
                                )}
                                onClick={() => {
                                  setIsAdding(!isAdding);
                                  if (!isAdding) setIsAddingFloor(false);
                                }}
                              >
                                <Plus size={14} className="mr-1.5" />
                                Add Slot
                              </Button>
                            )}
                          {Object.keys(pendingChanges).length > 0 && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 px-3 text-xs font-bold transition-colors rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg animate-in fade-in zoom-in"
                              onClick={handleSavePendingChanges}
                              disabled={isSaving}
                            >
                              {isSaving ? t("Saving...", "Nagsa-save...") : t("Save Layout Changes", "I-save ang Map Layout")}
                            </Button>
                          )}
                          {(userRole === "superadmin" ||
                            userRole === "super_admin") &&
                            selectedFloorIndex !== -1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "h-8 px-3 text-xs font-bold transition-colors rounded-lg",
                                  isEditingMap
                                    ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-700"
                                    : "text-slate-300 border-slate-700 bg-slate-900/40 hover:bg-slate-800 hover:text-white"
                                )}
                                onClick={() => setIsEditingMap(!isEditingMap)}
                              >
                                <PenTool size={14} className="mr-1.5" />
                                {isEditingMap ? "Editing Map" : "Edit Map"}
                              </Button>
                            )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleMapFullscreen}
                            className={cn(
                              "h-8 w-8 transition-colors rounded-lg",
                              isMapFullscreen
                                ? "text-slate-300 hover:text-white bg-slate-800"
                                : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                            title="Toggle Fullscreen"
                          >
                            {isMapFullscreen ? (
                              <Minimize size={16} />
                            ) : (
                              <Maximize size={16} />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add Floor Section at the bottom */}
                  {(userRole === "superadmin" || userRole === "super_admin") &&
                    selectedFloorIndex !== -1 && (
                      <div className="flex flex-col mt-2">
                        <div className="grid grid-cols-3 items-center mb-4 gap-4">
                          <div className="flex justify-start"></div>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl flex-shrink-0"
                              onClick={() =>
                                setSelectedFloorIndex(
                                  Math.max(-1, selectedFloorIndex - 1)
                                )
                              }
                              disabled={selectedFloorIndex === -1}
                              title="Previous Floor"
                            >
                              <ChevronLeft size={18} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl flex-shrink-0"
                              onClick={() =>
                                setSelectedFloorIndex(
                                  Math.min(
                                    (activeLot.floors?.length || 1) - 1,
                                    selectedFloorIndex + 1
                                  )
                                )
                              }
                              disabled={
                                selectedFloorIndex ===
                                (activeLot.floors?.length || 1) - 1
                              }
                              title="Next Floor"
                            >
                              <ChevronRight size={18} />
                            </Button>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant={isAddingFloor ? "default" : "outline"}
                              className="rounded-xl text-sm font-bold"
                              onClick={() => {
                                setIsAddingFloor(!isAddingFloor);
                                if (!isAddingFloor) setIsAdding(false);
                              }}
                            >
                              <Plus size={16} className="mr-2" />
                              Add New Floor
                            </Button>
                          </div>
                        </div>

                        {isAddingFloor && (
                          <div className="flex justify-end w-full">
                            <div className="p-5 bg-white border border-slate-200 shadow-sm rounded-2xl w-full max-w-lg mb-2">
                              <form
                                onSubmit={e => {
                                  e.preventDefault();
                                  handleAddFloor();
                                }}
                                className="flex flex-col"
                              >
                                <div className="flex flex-col mb-5">
                                  <label className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1.5">
                                    Floor Name (e.g., 2nd Floor, Basement)
                                  </label>
                                  <input
                                    type="text"
                                    value={newFloorName}
                                    onChange={e =>
                                      setNewFloorName(e.target.value)
                                    }
                                    className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary text-sm shadow-sm transition-all text-foreground bg-white"
                                    placeholder="Enter floor name"
                                    autoFocus
                                  />
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    type="submit"
                                    className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
                                  >
                                    Save Floor
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-10 px-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                    onClick={() => setIsAddingFloor(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>

              {/* RIGHT COLUMN: Sidebar Content (Accounts, Photos) */}
              <div className="xl:col-span-1 space-y-6">
                {/* Accounts */}
                {userRole === "super_admin" && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-border">
                    <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                      <UserIcon className="text-primary w-5 h-5" /> Admin
                      Accounts
                    </h3>
                    <div className="space-y-3">
                      {lotAccounts.map(acc => (
                        <div
                          key={acc.id}
                          className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl"
                        >
                          <div className="truncate pr-2">
                            <p className="font-bold text-foreground truncate">
                              {acc.email}
                            </p>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                              {acc.role}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200 shrink-0"
                          >
                            Active
                          </Badge>
                        </div>
                      ))}
                      {lotAccounts.length === 0 && (
                        <p className="text-sm text-muted-foreground p-4 bg-slate-50 rounded-xl border border-dashed">
                          No accounts found for this lot.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo References */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-border">
                  <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                    <Camera className="text-primary w-5 h-5" /> Photo References
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                    {/* Front View */}
                    <div
                      className={`relative group aspect-video bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 overflow-hidden ${canEditPhotos ? "cursor-pointer" : activeLot?.front_view_url ? "cursor-zoom-in" : ""}`}
                      onClick={() => {
                        if (canEditPhotos) {
                          frontViewRef.current?.click();
                        } else if (activeLot?.front_view_url) {
                          setExpandedImageUrl(activeLot.front_view_url);
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={frontViewRef}
                        onChange={e => handleUploadPhoto(e, "front_view")}
                      />

                      {activeLot?.front_view_url ? (
                        <>
                          <img
                            src={activeLot.front_view_url}
                            alt="Front View"
                            className="w-full h-full object-cover"
                          />

                          {/* Expand Button */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedImageUrl(activeLot.front_view_url);
                            }}
                            className={`absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-md transition-colors z-20 shadow-md ${canEditPhotos ? "opacity-0 group-hover:opacity-100" : "hidden"}`}
                            title="View Full Image"
                          >
                            <Maximize2 size={16} />
                          </button>

                          {/* Delete Button */}
                          {canEditPhotos && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteMainPhoto("front_view");
                              }}
                              className="absolute top-2 left-2 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors z-20 shadow-md opacity-0 group-hover:opacity-100"
                              title="Delete Photo"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          {canEditPhotos && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity z-10">
                              <Upload size={24} className="mb-2" />
                              <span className="text-sm font-semibold">
                                Change Photo
                              </span>
                            </div>
                          )}
                          {!canEditPhotos && (
                            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm z-10">
                              Front View
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className={`w-full h-full flex flex-col items-center justify-center ${canEditPhotos ? "hover:bg-slate-100 transition-colors" : ""}`}
                        >
                          <Camera size={24} className="mb-2" />
                          <span className="text-sm font-semibold">
                            Front View
                          </span>
                          {canEditPhotos && (
                            <span className="text-[10px] mt-1 text-primary">
                              Click to upload
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Business Permit */}
                    <div
                      className={`relative group aspect-video bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 overflow-hidden ${canEditPhotos ? "cursor-pointer" : activeLot?.business_permit_url ? "cursor-zoom-in" : ""}`}
                      onClick={() => {
                        if (canEditPhotos) {
                          businessPermitRef.current?.click();
                        } else if (activeLot?.business_permit_url) {
                          setExpandedImageUrl(activeLot.business_permit_url);
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={businessPermitRef}
                        onChange={e => handleUploadPhoto(e, "business_permit")}
                      />

                      {activeLot?.business_permit_url ? (
                        <>
                          <img
                            src={activeLot.business_permit_url}
                            alt="Business Permit"
                            className="w-full h-full object-cover"
                          />

                          {/* Expand Button */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedImageUrl(
                                activeLot.business_permit_url
                              );
                            }}
                            className={`absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-md transition-colors z-20 shadow-md ${canEditPhotos ? "opacity-0 group-hover:opacity-100" : "hidden"}`}
                            title="View Full Image"
                          >
                            <Maximize2 size={16} />
                          </button>

                          {/* Delete Button */}
                          {canEditPhotos && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteMainPhoto("business_permit");
                              }}
                              className="absolute top-2 left-2 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors z-20 shadow-md opacity-0 group-hover:opacity-100"
                              title="Delete Photo"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          {canEditPhotos && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity z-10">
                              <Upload size={24} className="mb-2" />
                              <span className="text-sm font-semibold">
                                Change Photo
                              </span>
                            </div>
                          )}
                          {!canEditPhotos && (
                            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm z-10">
                              Business Permit
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className={`w-full h-full flex flex-col items-center justify-center ${canEditPhotos ? "hover:bg-slate-100 transition-colors" : ""}`}
                        >
                          <Camera size={24} className="mb-2" />
                          <span className="text-sm font-semibold">
                            Business Permit
                          </span>
                          {canEditPhotos && (
                            <span className="text-[10px] mt-1 text-primary">
                              Click to upload
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Other Photos Section */}
                    {(activeLot?.other_photos?.length > 0 ||
                      canEditPhotos) && (
                      <div className="pt-4 mt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-slate-700">
                            Additional Photos
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {activeLot?.other_photos?.map(
                            (url: string, idx: number) => (
                              <div
                                key={idx}
                                className={`relative group aspect-video bg-slate-50 border border-slate-200 rounded-xl overflow-hidden ${!canEditPhotos ? "cursor-zoom-in" : ""}`}
                                onClick={() => {
                                  if (!canEditPhotos)
                                    setExpandedImageUrl(url);
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Other ${idx}`}
                                  className="w-full h-full object-cover"
                                />

                                {canEditPhotos && (
                                  <>
                                    {/* Expand Button for Admin */}
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setExpandedImageUrl(url);
                                      }}
                                      className="absolute top-2 left-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md"
                                      title="View Full Image"
                                    >
                                      <Maximize2 size={14} />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleDeleteOtherPhoto(url);
                                      }}
                                      className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 z-20 shadow-md"
                                      title="Delete Photo"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )
                          )}

                          {canEditPhotos && (
                            <div
                              className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 hover:border-primary/50 transition-colors"
                              onClick={() => otherPhotoRef.current?.click()}
                            >
                              <Plus size={20} className="mb-1" />
                              <span className="text-[10px] font-semibold text-center">
                                Add Photo
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={otherPhotoRef}
                                onChange={e => handleUploadPhoto(e, "other")}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "cameras" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {expandedCameraId === null ? (
              // MULTI-CAMERA GRID VIEW
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {cameras.map(cam => (
                  <div
                    key={cam.id}
                    className="bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-800 cursor-pointer group hover:ring-4 hover:ring-primary/50 transition-all"
                    onClick={() => setExpandedCameraId(cam.id)}
                  >
                    <div className="aspect-video bg-black flex items-center justify-center relative">
                      <img
                        src={cam.stream_url || getCameraUrl(cam.id)}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity relative z-10"
                        onLoad={e => {
                          const fallback = document.getElementById(
                            `fallback-grid-${cam.id}`
                          );
                          if (fallback) fallback.style.display = "none";
                        }}
                        onError={e => (e.currentTarget.style.display = "none")}
                      />
                      {activeLot.name.includes("Thesis Demo") && (
                        <div className="absolute top-3 right-3 bg-red-600/90 text-white text-[10px] font-extrabold px-2 py-1 rounded-md flex items-center gap-1.5 shadow-lg backdrop-blur-sm z-20">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>{" "}
                          LIVE
                        </div>
                      )}
                      <div
                        id={`fallback-grid-${cam.id}`}
                        className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-0"
                      >
                        <Camera size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-bold text-slate-300">
                          Camera Offline
                        </p>
                      </div>
                      <div className="absolute top-3 left-3 bg-slate-900/80 text-white text-xs font-bold px-2.5 py-1 rounded-md backdrop-blur-sm max-w-[70%] truncate">
                        {cam.name}
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="bg-primary/90 text-primary-foreground p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-lg">
                          <Eye size={20} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {(userRole === "superadmin" || userRole === "super_admin") &&
                  (isAddingCamera ? (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center min-h-[200px]">
                      <form
                        onSubmit={handleAddCamera}
                        className="flex flex-col gap-3"
                      >
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          New Camera Name
                        </label>
                        <input
                          type="text"
                          value={newCameraName}
                          onChange={e => setNewCameraName(e.target.value)}
                          className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                          placeholder="e.g. Roof Deck Camera"
                          autoFocus
                        />

                        <div className="flex gap-2 mt-2">
                          <Button type="submit" size="sm" className="flex-1">
                            Add Camera
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsAddingCamera(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div
                      className="bg-slate-50 rounded-2xl shadow-sm border-2 border-dashed border-slate-300 cursor-pointer hover:border-primary/50 hover:bg-slate-100 transition-all flex flex-col items-center justify-center min-h-[200px] group"
                      onClick={() => setIsAddingCamera(true)}
                    >
                      <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Plus size={24} className="text-primary" />
                      </div>
                      <span className="text-sm font-bold text-slate-600">
                        Add New Camera
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              // EXPANDED SINGLE CAMERA VIEW
              <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
                {/* Main Video Area (Left) */}
                <div className="bg-[#0f172a] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col w-full xl:w-3/4 flex-shrink-0">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 w-full overflow-hidden">
                    <div className="flex items-center gap-3 w-full mr-4">
                      <Camera className="text-primary w-5 h-5 flex-shrink-0" />
                      {editingCameraId === expandedCameraId &&
                      editingCameraField === "name" ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full max-w-2xl">
                          <input
                            type="text"
                            value={editingCameraName}
                            onChange={e => setEditingCameraName(e.target.value)}
                            className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-sm outline-none border border-slate-700 focus:border-primary w-full sm:flex-1 sm:min-w-[200px]"
                            placeholder="Camera Name"
                            autoFocus
                          />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (editingCameraName.trim()) {
                                  const newCameras = cameras.map(c =>
                                    c.id === expandedCameraId
                                      ? { ...c, name: editingCameraName.trim() }
                                      : c
                                  );
                                  setCameras(newCameras);
                                  localStorage.setItem(
                                    `cameras_${selectedLotId}`,
                                    JSON.stringify(newCameras)
                                  );
                                }
                                setEditingCameraId(null);
                                setEditingCameraField(null);
                              }}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCameraId(null);
                                setEditingCameraField(null);
                              }}
                              className="h-8 px-3 text-slate-300 hover:text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center w-full">
                          <h3 className="text-white font-bold">
                            {cameras.find(c => c.id === expandedCameraId)
                              ?.name || "Camera Feed"}
                          </h3>
                          {userRole !== "guard" && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                const cam = cameras.find(
                                  c => c.id === expandedCameraId
                                );
                                setEditingCameraName(cam?.name || "");
                                setEditingCameraId(expandedCameraId);
                                setEditingCameraField("name");
                              }}
                              className="ml-3 text-slate-500 hover:text-primary transition-colors p-1 flex-shrink-0"
                              title="Edit Camera Name"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0 rounded-full h-8 w-8"
                      onClick={() => setExpandedCameraId(null)}
                      title="Back to Grid"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                  </div>
                  {/* Fullscreen Wrapper */}
                  <div
                    ref={fullscreenContainerRef}
                    className={cn(
                      "flex flex-col w-full",
                      isFullscreen
                        ? "bg-black h-full items-center justify-center"
                        : ""
                    )}
                  >
                    <div
                      className={cn(
                        "relative bg-black",
                        isFullscreen
                          ? "h-full aspect-video max-w-full"
                          : "w-full aspect-video overflow-hidden"
                      )}
                    >
                      <img
                        id="expanded-camera-feed"
                        src={
                          cameras.find(c => c.id === expandedCameraId)
                            ?.stream_url ||
                          getCameraUrl(expandedCameraId ?? undefined)
                        }
                        className="absolute inset-0 w-full h-full object-contain opacity-90"
                        onError={e => {
                          e.currentTarget.style.display = "none";
                          const fallbackMsg = document.getElementById(
                            "stream-fallback-expanded"
                          );
                          if (fallbackMsg) fallbackMsg.style.display = "flex";
                        }}
                      />
                      {activeLot.name.includes("Thesis Demo") && (
                        <div className="absolute top-4 right-4 bg-red-600/90 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg backdrop-blur-sm z-10">
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>{" "}
                          LIVE
                        </div>
                      )}
                      <div
                        id="stream-fallback-expanded"
                        className="absolute inset-0 flex-col items-center justify-center text-slate-400 hidden"
                      >
                        <Eye size={48} className="mb-4 opacity-50" />
                        <p className="text-xl font-bold text-slate-300">
                          Camera Feed Offline
                        </p>
                        <p className="text-sm opacity-70 mt-2 font-medium">
                          Please check the connection or start the local stream
                          script.
                        </p>
                      </div>

                      {/* Camera Grid Overlay */}
                      {(showCameraGrid || isDrawingGrid) &&
                        expandedCameraId && (
                          <CameraGridEditor
                            interactive={isDrawingGrid}
                            slots={selectedFloorIndex === -1 ? slots : slots.filter(s => (s.floor_index || 0) === selectedFloorIndex)}
                            cameraId={expandedCameraId}
                            onSaveZone={handleUpdateCameraZone}
                            onDeleteZone={handleDeleteCameraZone}
                          />
                        )}
                    </div>

                    {/* Footer Toolbar - Becomes floating buttons in Fullscreen */}
                    <div
                      className={cn(
                        "p-3 border-t border-slate-800 transition-all z-50",
                        isFullscreen
                          ? "absolute bottom-4 right-4 w-auto border-none bg-transparent p-0 block"
                          : "relative grid grid-cols-3 items-center w-full bg-slate-950/50"
                      )}
                    >
                      {/* Empty Left Column for Grid Balance */}
                      {!isFullscreen && <div></div>}

                      {/* Centered Text */}
                      {!isFullscreen && (
                        <div className="flex justify-center text-center">
                          <p className="text-xs text-slate-400">
                            Live feed processing via edge node.
                          </p>
                        </div>
                      )}

                      {/* Action Buttons (Right-aligned in normal mode) */}
                      <div
                        className={cn(
                          "flex items-center gap-2 relative z-10",
                          isFullscreen
                            ? "bg-slate-950/60 p-1.5 rounded-xl border border-white/10 shadow-lg backdrop-blur-md"
                            : "justify-end"
                        )}
                      >
                        {userRole !== "guard" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowCameraGrid(!showCameraGrid)}
                              className={cn(
                                "h-8 px-3 text-xs transition-colors",
                                showCameraGrid
                                  ? "text-blue-400 border-blue-400 bg-blue-400/10"
                                  : "text-slate-300 border-slate-700 bg-slate-900/40 hover:bg-slate-800 hover:text-white"
                              )}
                            >
                              {showCameraGrid ? (
                                <EyeOff size={14} className="mr-1.5" />
                              ) : (
                                <Eye size={14} className="mr-1.5" />
                              )}
                              {showCameraGrid ? "Hide Grid" : "Show Grid"}
                            </Button>
                            {(userRole === "superadmin" ||
                              userRole === "super_admin") && (
                              <Button
                                size="sm"
                                variant={isDrawingGrid ? "default" : "outline"}
                                onClick={() => {
                                  if (!isDrawingGrid) setShowCameraGrid(true); // Always show grid when entering drawing mode
                                  setIsDrawingGrid(!isDrawingGrid);
                                }}
                                className={cn(
                                  "h-8 px-3 text-xs transition-colors",
                                  isDrawingGrid
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-800"
                                )}
                              >
                                {isDrawingGrid ? (
                                  <>
                                    <Check size={14} className="mr-1.5" /> Done
                                  </>
                                ) : (
                                  <>
                                    <PenTool size={14} className="mr-1.5" />{" "}
                                    Edit Zones
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={toggleFullscreen}
                              className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-800 ml-1 border border-slate-700 bg-slate-900/40"
                              title={
                                isFullscreen ? "Exit Fullscreen" : "Fullscreen"
                              }
                            >
                              {isFullscreen ? (
                                <Minimize size={16} />
                              ) : (
                                <Maximize size={16} />
                              )}
                            </Button>
                            {(userRole === "superadmin" || userRole === "super_admin") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const cam = cameras.find(c => c.id === expandedCameraId);
                                  if (cam && window.confirm(`Are you sure you want to delete camera: ${cam.name}?`)) {
                                    const newCameras = cameras.filter(c => c.id !== expandedCameraId);
                                    setCameras(newCameras);
                                    localStorage.setItem(`cameras_${selectedLotId}`, JSON.stringify(newCameras));
                                    setExpandedCameraId(null);
                                    setCameraPage(0);
                                  }
                                }}
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/40 ml-2 border border-red-900/50 bg-slate-900/40 transition-colors"
                                title="Delete Camera"
                              >
                                <Trash2 size={16} />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Camera Selection Sidebar (Right) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col w-full xl:w-[calc(25%-1.5rem)] flex-shrink-0">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary" /> Camera Views
                  </h3>
                  <div className="flex flex-col gap-3">
                    {cameras.slice(cameraPage * 8, (cameraPage + 1) * 8).map(cam => (
                      <button
                        key={cam.id}
                        onClick={() => {
                          setExpandedCameraId(cam.id);
                          setIsDrawingGrid(false);
                        }}
                        className={cn(
                          "p-3 rounded-xl border text-left flex flex-col gap-1 transition-all",
                          cam.id === expandedCameraId
                            ? "bg-slate-900 border-slate-900 text-white shadow-md ring-4 ring-slate-900/10"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <span className="text-sm font-bold truncate w-full leading-tight">
                          {cam.name}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider",
                            cam.id === expandedCameraId
                              ? "text-slate-400"
                              : "text-slate-400"
                          )}
                        >
                          {cam.id === expandedCameraId
                            ? "Currently Viewing"
                            : "Click to View"}
                        </span>
                      </button>
                    ))}
                  </div>

                  {cameras.length > 8 && (
                    <div className="pt-4 mt-4 border-t border-slate-200 flex justify-between items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraPage(p => Math.max(0, p - 1))}
                        disabled={cameraPage === 0}
                        className="rounded-lg h-9 w-12"
                      >
                        &lt;
                      </Button>
                      <span className="text-xs font-bold text-slate-500">
                        {cameraPage + 1} / {Math.ceil(cameras.length / 8)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCameraPage(p => Math.min(Math.ceil(cameras.length / 8) - 1, p + 1))}
                        disabled={cameraPage >= Math.ceil(cameras.length / 8) - 1}
                        className="rounded-lg h-9 w-12"
                      >
                        &gt;
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "records" && userRole !== "guard" && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border card-elevated">
              <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-4">
                <div className="flex items-center text-muted-foreground font-medium">
                  <Layers size={18} className="mr-2" /> Filter by Floor
                </div>
                <select
                  value={selectedFloorIndex}
                  onChange={e => {
                    setSelectedFloorIndex(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-10 px-4 py-2 rounded-xl border border-border bg-white text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
                >
                  <option value={-1}>Overview</option>
                  {(activeLot.floors || ["Main Floor"]).map(
                    (floorName: string, idx: number) => (
                      <option key={idx} value={idx}>
                        {floorName}
                      </option>
                    )
                  )}
                </select>
              </div>
              <h3
                className="text-base font-bold text-foreground mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Database Records
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">
                        Slot Label
                      </th>
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">
                        Booking Mode
                      </th>
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right pb-3 font-semibold uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const filtered = slots.filter(
                        s =>
                          selectedFloorIndex === -1 ||
                          (s.floor_index || 0) === selectedFloorIndex
                      );
                      const paginated = filtered.slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage
                      );
                      return paginated.map(baseSlot => {
                        const slot = pendingChanges[baseSlot.id]
                          ? { ...baseSlot, ...pendingChanges[baseSlot.id] }
                          : baseSlot;
                        const isPending = !!pendingChanges[baseSlot.id];
                        const isReservable =
                          slot.is_reservable !== false &&
                          String(slot.is_reservable) !== "false";

                        return (
                          <tr
                            key={slot.id}
                            className={cn(
                              "transition-colors",
                              isPending ? "bg-amber-50/50" : "hover:bg-muted/30"
                            )}
                          >
                            <td className="py-3 font-bold text-base">
                              <div className="flex items-center">
                                <span
                                  className="w-16 shrink-0 truncate"
                                  title={slot.label}
                                >
                                  {slot.label}
                                </span>
                                {isPending && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]"
                                  >
                                    Unsaved
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3">
                              {slot.is_pwd ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-200 text-amber-700 bg-amber-50"
                                >
                                  PWD
                                </Badge>
                              ) : isReservable ? (
                                <Badge
                                  variant="outline"
                                  className="border-blue-200 text-blue-700 bg-blue-50"
                                >
                                  Reservable
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs font-medium">
                                  Regular
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <Badge
                                variant="outline"
                                className={
                                  isReservable
                                    ? "border-blue-200 text-blue-700 bg-blue-50"
                                    : "border-gray-300 text-gray-500 bg-gray-100"
                                }
                              >
                                {isReservable
                                  ? "Reservable"
                                  : "Walk-in Only (X)"}
                              </Badge>
                            </td>
                            <td className="py-3">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                                  slot.status === "available"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : slot.status === "occupied"
                                      ? "bg-rose-100 text-rose-700"
                                      : slot.status === "unmapped"
                                        ? "bg-slate-200 text-slate-500"
                                        : "bg-amber-100 text-amber-700"
                                )}
                              >
                                {slot.status === "unmapped"
                                  ? "Null / Not Drawn"
                                  : slot.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() =>
                                    toggleOccupancyStatus(
                                      slot.id,
                                      slot.status,
                                      slot.label
                                    )
                                  }
                                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                                  title={`Toggle to ${slot.status === "occupied" ? "Available" : "Occupied"}`}
                                >
                                  <ArrowLeftRight size={16} />
                                </button>

                                {(userRole === "superadmin" ||
                                  userRole === "super_admin") && (
                                  <button
                                    onClick={() =>
                                      handleDeleteSlot(
                                        slot.id,
                                        slot.label,
                                        slot.status
                                      )
                                    }
                                    className={cn(
                                      "p-2 rounded-lg transition-colors inline-flex items-center",
                                      slot.status !== "occupied"
                                        ? "text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                        : "text-slate-300 cursor-not-allowed"
                                    )}
                                    title={
                                      slot.status !== "occupied"
                                        ? "Delete Slot"
                                        : "Cannot delete occupied slot"
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {(() => {
                const filtered = slots.filter(
                  s =>
                    selectedFloorIndex === -1 ||
                    (s.floor_index || 0) === selectedFloorIndex
                );
                const totalPages = Math.ceil(filtered.length / itemsPerPage);
                if (totalPages <= 1) return null;

                return (
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, filtered.length)} of{" "}
                      {filtered.length} records
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage(p => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* Save Changes Floating Action */}
            {Object.keys(pendingChanges).length > 0 && (
              <div className="mt-4 flex items-center justify-end gap-3 bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                <p className="text-sm font-semibold text-amber-700 mr-auto">
                  You have {Object.keys(pendingChanges).length} unsaved{" "}
                  {Object.keys(pendingChanges).length === 1
                    ? "change"
                    : "changes"}
                  .
                </p>
                <Button
                  variant="ghost"
                  onClick={handleDiscardChanges}
                  className="text-slate-600"
                >
                  Discard
                </Button>
                <Button
                  onClick={() => setShowSaveModal(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen Image Viewer (Facebook/Messenger style) */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200 cursor-zoom-out backdrop-blur-sm"
          onClick={() => setExpandedImageUrl(null)}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50"
            onClick={e => {
              e.stopPropagation();
              setExpandedImageUrl(null);
            }}
          >
            <X size={24} />
          </button>

          {/* Image */}
          <img
            src={expandedImageUrl}
            className="max-w-full max-h-full object-contain drop-shadow-2xl select-none"
            alt="Expanded view"
            onClick={e => e.stopPropagation()} // Prevent clicking the image from closing it immediately
          />
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Database className="text-amber-500 w-6 h-6" /> Confirm Changes
              </h3>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50">
              <p className="text-sm text-slate-600 mb-4 font-medium">
                Are you sure you want to save the following changes to the
                database?
              </p>
              <div className="space-y-3">
                {Object.entries(pendingChanges).map(([id, changes]) => (
                  <div
                    key={id}
                    className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center font-bold text-amber-800 shrink-0">
                      {changes._label}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-700">
                        Set Booking Mode to:
                      </p>
                      <p className="text-sm text-amber-600 font-semibold">
                        {changes.is_reservable
                          ? "Reservable (R)"
                          : "Walk-in Only (X)"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePendingChanges}
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {isSaving ? "Saving..." : "Confirm & Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Switch Warning Modal */}
      {showTabWarning && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-rose-50/50">
              <h3 className="text-xl font-bold text-rose-600 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6" /> Unsaved Changes
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 font-medium">
                You have unsaved changes in the Database Records. Do you want to
                save them before leaving?
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-600 mb-6 space-y-1">
                {Object.entries(pendingChanges).map(([id, changes]) => (
                  <li key={id}>
                    Slot <strong>{changes._label}</strong>:{" "}
                    {changes.is_reservable ? "Reservable" : "Walk-in Only"}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowTabWarning(false)}
                  className="mr-auto text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDiscardChanges}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  Discard
                </Button>
                <Button
                  onClick={handleSavePendingChanges}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isSaving ? "Saving..." : "Save & Continue"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Floor Dialog */}
      <Dialog open={isRenamingFloor} onOpenChange={setIsRenamingFloor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Floor</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col space-y-4 pt-4">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Floor Name
              </label>
              <input
                type="text"
                value={renameFloorName}
                onChange={e => setRenameFloorName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary text-sm shadow-sm transition-all text-foreground bg-white"
                placeholder="Enter floor name"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRenameFloor();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="ghost"
                onClick={() => setIsRenamingFloor(false)}
                className="text-slate-600"
              >
                Cancel
              </Button>
              <Button onClick={handleRenameFloor}>Rename</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
