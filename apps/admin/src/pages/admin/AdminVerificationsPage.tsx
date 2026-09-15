import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@parkada/shared";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  X,
  Image as ImageIcon,
  UserCircle,
  ExternalLink,
  ShieldAlert,
  UserCheck,
  ShieldClose,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCcw,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Percent,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

/* -------------------------------------------------------------------------- */
/*  CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Storage bucket that holds the ID / selfie uploads.
 * This matches the bucket the previous version of this page used.
 * If your discount IDs live in a different bucket, add it to EXTRA_BUCKETS
 * and the resolver will try it as a fallback.
 */
const ID_BUCKET = "id-verifications";
const EXTRA_BUCKETS: string[] = []; // e.g. ["discount-ids"]
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/* -------------------------------------------------------------------------- */
/*  TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Profile = Record<string, any>;

type DocImage = {
  label: string;
  rawPath: string | null;
  url: string | null;
  shape: "card" | "circle";
};

type FilterKey = "all" | "identity" | "discount";

/* -------------------------------------------------------------------------- */
/*  PURE HELPERS                                                               */
/* -------------------------------------------------------------------------- */

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const firstNonEmpty = (...values: unknown[]): string => {
  for (const value of values) {
    const c = clean(value);
    if (c) return c;
  }
  return "";
};

/**
 * ROOT CAUSE OF "Unknown User":
 * ------------------------------------------------------------------
 * The old query selected a single `full_name` column and rendered
 * `user.full_name || "Unknown Citizen"`.
 *
 * The mobile sign-up flow writes `first_name` / `preferred_name`
 * (see apps/mobile/app/(app)/index.tsx, which reads exactly those two
 * columns). For every account created through that flow, `full_name`
 * is NULL — so the fallback string rendered even though the profile
 * clearly had a name stored.
 *
 * The fix is to derive the display name from every name column the
 * profile actually has, in priority order, instead of trusting one
 * column. Nothing is invented: if the profile genuinely has no name
 * stored, the row is flagged as an incomplete profile so the admin
 * knows it is a data problem, not a rendering bug.
 */
function getDisplayName(profile: Profile): string {
  const explicitFullName = firstNonEmpty(
    profile?.full_name,
    profile?.fullname,
    profile?.display_name,
    profile?.name,
  );
  if (explicitFullName) return explicitFullName;

  // profiles table has first_name and last_name only (no middle_name column).
  const composed = [profile?.first_name, profile?.last_name]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  if (composed) return composed;

  return firstNonEmpty(profile?.preferred_name, profile?.nickname);
}

/** Last-resort label so the admin can still identify the account. */
function getFallbackLabel(profile: Profile): string {
  const email = clean(profile?.email);
  if (email) return email.split("@")[0];
  const phone = clean(profile?.phone_number);
  if (phone) return phone;
  return "";
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(raw);
}

/**
 * Storage paths in this project are stored a few different ways depending on
 * which screen uploaded them:
 *   - a bare object path            "userid/front.jpg"
 *   - a path prefixed by the bucket "id-verifications/userid/front.jpg"
 *   - a complete public URL         "https://xxx.supabase.co/storage/v1/..."
 * Normalise all three into something the storage client can sign.
 */
function normalizeStorageRef(
  raw: string | null | undefined,
): { kind: "url"; value: string } | { kind: "path"; value: string } | null {
  const value = clean(raw);
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    // A stored public URL for a private bucket will 400 on load. Pull the
    // object path back out so it can be re-signed properly.
    const match = value.match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?|$)/i,
    );
    if (match) {
      const [, bucket, objectPath] = match;
      if (bucket === ID_BUCKET || EXTRA_BUCKETS.includes(bucket)) {
        return { kind: "path", value: decodeURIComponent(objectPath) };
      }
    }
    return { kind: "url", value };
  }

  let path = value.replace(/^\/+/, "");
  for (const bucket of [ID_BUCKET, ...EXTRA_BUCKETS]) {
    if (path.startsWith(`${bucket}/`)) {
      path = path.slice(bucket.length + 1);
      break;
    }
  }
  return { kind: "path", value: path };
}

/**
 * Private buckets need a signed URL. getPublicUrl() silently returns a URL
 * that 400s on a private bucket, which is why the previews rendered as broken
 * images. Sign first, fall back to the public URL only if signing is refused
 * (i.e. the bucket really is public).
 */
async function resolveStorageUrl(raw: string | null | undefined): Promise<string | null> {
  const ref = normalizeStorageRef(raw);
  if (!ref) return null;
  if (ref.kind === "url") return ref.value;

  for (const bucket of [ID_BUCKET, ...EXTRA_BUCKETS]) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(ref.value, SIGNED_URL_TTL_SECONDS);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {
      /* try the next bucket */
    }
  }

  try {
    const { data } = supabase.storage.from(ID_BUCKET).getPublicUrl(ref.value);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * In-app notification insert. The admin approve/reject flow already fires the
 * `send-push` edge function, but a push is not persisted anywhere, so nothing
 * ever showed up in the driver's Alerts tab. Writing the row here is what makes
 * the notification survive.
 *
 * The read-flag column is spelled `is_read` in the mobile app and `read` in an
 * older query, so the insert omits it and lets the column default apply,
 * retrying with each spelling only if the column is NOT NULL without a default.
 */
async function insertInAppNotification(userId: string, title: string, message: string) {
  const base = { user_id: userId, title, message };
  let { error } = await supabase.from("notifications").insert(base);
  if (error) {
    let retry = await supabase.from("notifications").insert({ ...base, is_read: false });
    if (retry.error) {
      retry = await supabase.from("notifications").insert({ ...base, read: false });
    }
    error = retry.error;
  }
  if (error) {
    console.warn("[verifications] notification insert failed:", error.message);
  }
}

/* -------------------------------------------------------------------------- */
/*  SMALL PRESENTATIONAL PIECES                                                */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm",
        accent,
      )}
    >
      <div className="rounded-full bg-slate-50 p-3 text-slate-600">{icon}</div>
      <div className="min-w-0">
        <p className="text-3xl font-black leading-none text-slate-800">{value}</p>
        <p className="mt-1 truncate text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}

function Thumb({
  image,
  onOpen,
}: {
  image: DocImage;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const isCircle = image.shape === "circle";

  const frameClasses = cn(
    "relative flex items-center justify-center overflow-hidden border bg-slate-100 shadow-sm transition-all",
    isCircle ? "h-16 w-16 rounded-full" : "h-16 w-24 rounded-lg",
  );

  if (!image.rawPath) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            frameClasses,
            "border-dashed border-slate-300 bg-slate-50 text-slate-300",
          )}
        >
          {isCircle ? <UserCircle size={20} /> : <ImageIcon size={18} />}
        </div>
        <span className="text-[10px] font-semibold text-slate-400">Not uploaded</span>
      </div>
    );
  }

  if (failed || !image.url) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            frameClasses,
            "border-amber-200 bg-amber-50 text-amber-500",
          )}
          title={`Stored path: ${image.rawPath}`}
        >
          <FileWarning size={18} />
        </div>
        <span className="text-[10px] font-semibold text-amber-600">
          {image.url ? "Failed to load" : "Loading…"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        title={`View ${image.label}`}
        className={cn(
          frameClasses,
          "group/img cursor-zoom-in border-slate-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-500/30",
        )}
      >
        <img
          src={image.url}
          alt={image.label}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/45 text-white group-hover/img:flex">
          <Search size={16} />
        </span>
      </button>
      <span className="text-[10px] font-semibold text-slate-500">{image.label}</span>
    </div>
  );
}

function Lightbox({
  images,
  index,
  applicantName,
  onClose,
  onNavigate,
}: {
  images: DocImage[];
  index: number;
  applicantName: string;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const active = images[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && images.length > 1) {
        onNavigate((index + 1) % images.length);
      }
      if (event.key === "ArrowLeft" && images.length > 1) {
        onNavigate((index - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, images.length, onClose, onNavigate]);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${active.label} — ${applicantName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 p-4 backdrop-blur-sm sm:p-8"
    >
      {/* Toolbar */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between gap-4 pb-4 text-white"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{applicantName}</p>
          <p className="text-xs text-white/60">
            {active.label}
            {images.length > 1 ? ` · ${index + 1} of ${images.length}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {active.url && (
            <>
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                <ExternalLink size={14} />
                Open
              </a>
              <a
                href={active.url}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                <Download size={14} />
                Download
              </a>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-200"
          >
            <X size={14} />
            Close
          </button>
        </div>
      </div>

      {/* Image stage */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative mx-auto flex w-full max-w-5xl flex-1 items-center justify-center overflow-hidden rounded-2xl bg-slate-900/60"
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate((index - 1 + images.length) % images.length)}
            aria-label="Previous document"
            className="absolute left-3 z-10 rounded-full bg-slate-900/70 p-2 text-white transition-colors hover:bg-slate-900"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {active.url ? (
          <img
            src={active.url}
            alt={active.label}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-white/70">
            <FileWarning size={40} />
            <p className="text-sm font-bold">This document could not be loaded</p>
            <p className="max-w-sm text-xs text-white/50">
              The file may have been removed from storage, or the admin account
              does not have read access to the {ID_BUCKET} bucket.
            </p>
          </div>
        )}

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % images.length)}
            aria-label="Next document"
            className="absolute right-3 z-10 rounded-full bg-slate-900/70 p-2 text-white transition-colors hover:bg-slate-900"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      {images.length > 1 && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="mx-auto mt-4 flex w-full max-w-5xl shrink-0 items-center justify-center gap-3"
        >
          {images.map((image, imageIndex) => (
            <button
              key={`${image.label}-${imageIndex}`}
              type="button"
              onClick={() => onNavigate(imageIndex)}
              className={cn(
                "h-14 w-20 overflow-hidden rounded-lg border-2 bg-slate-800 transition-all",
                imageIndex === index
                  ? "border-blue-400 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-90",
              )}
            >
              {image.url ? (
                <img src={image.url} alt={image.label} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-white/40">
                  <ImageIcon size={16} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-slate-100 p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,auto)] lg:items-center lg:gap-6">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
        <div className="w-full space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-12 w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex gap-2">
        <div className="h-16 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-16 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div className="flex justify-end gap-2">
        <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminVerifications() {
  const { t } = useLanguage();

  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  // Resolved (signed) storage URLs, keyed by the raw stored path.
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});
  const resolvingRef = useRef<Set<string>>(new Set());

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    images: DocImage[];
    index: number;
    applicantName: string;
  } | null>(null);

  // Success / reject visual indication before the row disappears
  const [processedStatus, setProcessedStatus] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const animatingRef = useRef<Set<string>>(new Set());

  /* ------------------------------- data load ------------------------------ */

  const fetchPendingVerifications = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        // `select("*")` is deliberate. Naming individual columns meant one
        // renamed/missing column would fail the entire
        // query with a 42703 and blank the page. Selecting everything keeps
        // the page resilient and gives getDisplayName every name column the
        // profile actually has.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .or("verification_status.eq.pending,discount_status.eq.pending")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setPendingUsers(data || []);
        setLoadError(null);
      } catch (error: any) {
        console.error("Error fetching pending verifications:", error);
        setLoadError(error?.message || "Unknown error");
        if (!isSilent) {
          toast.error(
            t(
              "Failed to load pending verifications.",
              "Nabigong i-load ang pending verifications.",
            ),
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    fetchPendingVerifications();

    // Supabase Realtime subscription so the queue updates on its own
    const channel = supabase
      .channel("admin-verifications-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: any) => {
          if (
            payload.eventType === "INSERT" &&
            (payload.new?.verification_status === "pending" ||
              payload.new?.discount_status === "pending")
          ) {
            fetchPendingVerifications(true);
          } else if (payload.eventType === "UPDATE") {
            if (
              payload.new?.verification_status === "pending" ||
              payload.new?.discount_status === "pending"
            ) {
              fetchPendingVerifications(true);
            } else if (!animatingRef.current.has(payload.new?.id)) {
              // Another admin approved/rejected it — drop it from the queue
              setPendingUsers((prev) => prev.filter((u) => u.id !== payload.new?.id));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------- storage url resolve ------------------------ */

  const documentPathsFor = useCallback((user: Profile): { label: string; path: string | null; shape: DocImage["shape"] }[] => {
    const isDiscountApplication = user.discount_status === "pending";
    if (isDiscountApplication) {
      return [
        { label: "Discount ID", path: clean(user.discount_id_url) || null, shape: "card" },
        { label: "Selfie", path: clean(user.selfie_photo_url) || null, shape: "circle" },
      ];
    }
    return [
      { label: "ID front", path: clean(user.id_front_photo_url) || null, shape: "card" },
      { label: "ID back", path: clean(user.id_back_photo_url) || null, shape: "card" },
      { label: "Selfie", path: clean(user.selfie_photo_url) || null, shape: "circle" },
    ];
  }, []);

  useEffect(() => {
    const paths = pendingUsers
      .flatMap((user) => documentPathsFor(user).map((doc) => doc.path))
      .filter((path): path is string => Boolean(path))
      .filter((path) => !(path in imageUrls) && !resolvingRef.current.has(path));

    if (paths.length === 0) return;

    const unique = Array.from(new Set(paths));
    unique.forEach((path) => resolvingRef.current.add(path));

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        unique.map(async (path) => [path, await resolveStorageUrl(path)] as const),
      );
      if (cancelled) return;
      setImageUrls((prev) => {
        const next = { ...prev };
        entries.forEach(([path, url]) => {
          next[path] = url;
        });
        return next;
      });
      unique.forEach((path) => resolvingRef.current.delete(path));
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingUsers, documentPathsFor, imageUrls]);

  const buildImages = useCallback(
    (user: Profile): DocImage[] =>
      documentPathsFor(user).map((doc) => ({
        label: doc.label,
        rawPath: doc.path,
        url: doc.path ? imageUrls[doc.path] ?? null : null,
        shape: doc.shape,
      })),
    [documentPathsFor, imageUrls],
  );

  /* ------------------------------- actions -------------------------------- */

  const handleApprove = async (user: Profile) => {
    const displayName = getDisplayName(user) || getFallbackLabel(user) || "This applicant";
    try {
      setActionLoading(user.id);

      animatingRef.current.add(user.id);
      setProcessedStatus((prev) => ({ ...prev, [user.id]: "approved" }));

      const updates: Record<string, any> = {};
      let message = "";

      if (user.verification_status === "pending") {
        updates.verification_status = "verified";
        message = `${displayName}'s identity verified.`;
      }

      if (user.discount_status === "pending") {
        updates.discount_status = "approved";
        if (user.discount_type) updates.user_type = user.discount_type;
        message = message
          ? `${message} Discount approved.`
          : `${displayName}'s discount application approved.`;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      toast.success(t(message, message));

      // Persist the in-app alert so it shows up in the driver's Alerts tab.
      await insertInAppNotification(
        user.id,
        "Account verified",
        updates.discount_status === "approved"
          ? "Your discount application was approved. The discount now applies automatically to your reservations."
          : "Your identity has been verified. You can now use all ParKada features.",
      );

      // Push notification (best effort — the row above is the source of truth)
      supabase.functions
        .invoke("send-push", {
          body: {
            user_id: user.id,
            title: "Account verified",
            message: "Your ParKada account has been verified.",
          },
        })
        .catch(console.error);

      setTimeout(() => {
        setPendingUsers((prev) => prev.filter((u) => u.id !== user.id));
        setProcessedStatus((prev) => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
        animatingRef.current.delete(user.id);
      }, 1500);
    } catch (error: any) {
      console.error("Error approving user:", error);
      toast.error(t("Failed to approve user.", "Nabigong i-approve ang user."));
      setProcessedStatus((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      animatingRef.current.delete(user.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (user: Profile) => {
    const displayName = getDisplayName(user) || getFallbackLabel(user) || "this applicant";
    if (!window.confirm(`Reject ${displayName}'s request?`)) return;

    try {
      setActionLoading(user.id);

      animatingRef.current.add(user.id);
      setProcessedStatus((prev) => ({ ...prev, [user.id]: "rejected" }));

      const updates: Record<string, any> = {};
      if (user.verification_status === "pending") updates.verification_status = "rejected";
      if (user.discount_status === "pending") updates.discount_status = "rejected";

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      toast.info(
        t(`${displayName}'s request was rejected.`, `Na-reject ang request ni ${displayName}.`),
      );

      await insertInAppNotification(
        user.id,
        "Verification not approved",
        "Your submitted documents could not be verified. Please re-upload a clearer photo of your valid ID and selfie, then submit again.",
      );

      setTimeout(() => {
        setPendingUsers((prev) => prev.filter((u) => u.id !== user.id));
        setProcessedStatus((prev) => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
        animatingRef.current.delete(user.id);
      }, 1500);
    } catch (error: any) {
      console.error("Error rejecting user:", error);
      toast.error(t("Failed to reject user.", "Nabigong i-reject ang user."));
      setProcessedStatus((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      animatingRef.current.delete(user.id);
    } finally {
      setActionLoading(null);
    }
  };

  /* ------------------------------- derived -------------------------------- */

  const identityCount = useMemo(
    () => pendingUsers.filter((u) => u.verification_status === "pending").length,
    [pendingUsers],
  );
  const discountCount = useMemo(
    () => pendingUsers.filter((u) => u.discount_status === "pending").length,
    [pendingUsers],
  );
  const missingNameCount = useMemo(
    () => pendingUsers.filter((u) => !getDisplayName(u)).length,
    [pendingUsers],
  );

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pendingUsers.filter((user) => {
      if (filter === "identity" && user.verification_status !== "pending") return false;
      if (filter === "discount" && user.discount_status !== "pending") return false;
      if (!needle) return true;
      const haystack = [
        getDisplayName(user),
        user.email,
        user.phone_number,
        user.id_number,
        user.discount_id_number,
        user.address,
      ]
        .map(clean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [pendingUsers, query, filter]);

  /* -------------------------------- render -------------------------------- */

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: pendingUsers.length },
    { key: "identity", label: "Identity", count: identityCount },
    { key: "discount", label: "Discount", count: discountCount },
  ];

  return (
    <AdminLayout title="Identity Verifications">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={<ShieldAlert size={22} className="text-blue-700" />}
            value={pendingUsers.length}
            label="Pending approvals"
            accent="border-l-blue-600"
          />
          <StatCard
            icon={<BadgeCheck size={22} className="text-indigo-700" />}
            value={identityCount}
            label="Identity checks"
            accent="border-l-indigo-500"
          />
          <StatCard
            icon={<Percent size={22} className="text-emerald-700" />}
            value={discountCount}
            label="Discount applications"
            accent="border-l-emerald-500"
          />
        </div>

        {/* Data-quality hint — surfaces the real cause of a blank name */}
        {missingNameCount > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              <span className="font-bold">
                {missingNameCount} {missingNameCount === 1 ? "profile has" : "profiles have"} no
                name stored.
              </span>{" "}
              These accounts were created without a first/last name on the profile row, so there is
              nothing to display. Verify them against the uploaded ID, and run the backfill in
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                parkada_updates.sql
              </code>
              to keep <code className="font-mono text-xs">full_name</code> in sync going forward.
            </p>
          </div>
        )}

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Card header */}
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800">Submissions</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Review each ID and selfie before granting platform access.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email, ID number"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-72"
                />
              </div>

              <button
                type="button"
                onClick={() => fetchPendingVerifications(true)}
                disabled={refreshing}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCcw size={14} className={cn(refreshing && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "relative -mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-bold transition-colors",
                  filter === tab.key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-black",
                    filter === tab.key
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Column header (desktop only) */}
          {!loading && !loadError && visibleUsers.length > 0 && (
            <div className="hidden border-b border-slate-200 bg-slate-100/70 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,auto)] lg:items-center lg:gap-6">
              <span>Applicant</span>
              <span>Account &amp; ID</span>
              <span>Documents</span>
              <span className="text-right">Actions</span>
            </div>
          )}

          {/* Body */}
          {loading ? (
            <div>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle size={30} className="text-rose-500" />
              </div>
              <h3 className="mb-1 text-lg font-bold text-slate-800">
                Could not load the queue
              </h3>
              <p className="mb-5 max-w-md text-sm text-slate-500">{loadError}</p>
              <button
                type="button"
                onClick={() => fetchPendingVerifications()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                <RefreshCcw size={15} />
                Try again
              </button>
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <Check size={38} className="text-emerald-600" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">
                {pendingUsers.length === 0 ? "Queue is empty" : "No matching submissions"}
              </h3>
              <p className="max-w-sm text-slate-500">
                {pendingUsers.length === 0
                  ? "Every submitted verification has been processed."
                  : "Clear the search or switch tabs to see the rest of the queue."}
              </p>
              {pendingUsers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                  className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleUsers.map((user) => {
                const isApproved = processedStatus[user.id] === "approved";
                const isRejected = processedStatus[user.id] === "rejected";
                const isBusy = actionLoading === user.id;

                const displayName = getDisplayName(user);
                const fallbackLabel = getFallbackLabel(user);
                const initials = getInitials(displayName || fallbackLabel);
                const isDiscountApplication = user.discount_status === "pending";
                const images = buildImages(user);
                const openableImages = images.filter((image) => image.rawPath);

                return (
                  <div
                    key={user.id}
                    className={cn(
                      "grid grid-cols-1 gap-5 border-l-4 p-5 transition-colors lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,auto)] lg:items-center lg:gap-6",
                      isApproved && "border-l-emerald-500 bg-emerald-50/60",
                      isRejected && "border-l-rose-500 bg-rose-50/60",
                      !isApproved && !isRejected && "border-l-transparent hover:bg-slate-50/70",
                    )}
                  >
                    {/* 1 — Applicant */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-black text-white">
                        {initials || <UserCircle size={22} />}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        {displayName ? (
                          <p className="truncate text-[15px] font-bold leading-tight text-slate-800">
                            {displayName}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="truncate text-[15px] font-bold leading-tight text-slate-500">
                              {fallbackLabel || "No name on file"}
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              <AlertTriangle size={10} />
                              Name missing on profile
                            </span>
                          </div>
                        )}

                        <div className="space-y-1 text-xs text-slate-500">
                          {clean(user.email) && (
                            <p className="flex items-center gap-1.5">
                              <Mail size={12} className="shrink-0 text-slate-400" />
                              <span className="truncate text-slate-700">{user.email}</span>
                            </p>
                          )}
                          {clean(user.phone_number) && (
                            <p className="flex items-center gap-1.5">
                              <Phone size={12} className="shrink-0 text-slate-400" />
                              <span className="font-mono text-slate-700">{user.phone_number}</span>
                            </p>
                          )}
                          {formatDate(user.birthdate) && (
                            <p className="flex items-center gap-1.5">
                              <CalendarDays size={12} className="shrink-0 text-slate-400" />
                              <span className="text-slate-700">{formatDate(user.birthdate)}</span>
                            </p>
                          )}
                          {clean(user.address) && (
                            <p className="flex items-start gap-1.5" title={user.address}>
                              <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                              <span className="line-clamp-2 text-slate-700">{user.address}</span>
                            </p>
                          )}
                          {formatDateTime(user.created_at) && (
                            <p
                              className="pt-0.5 text-[11px] text-slate-400"
                              title={formatDateTime(user.created_at)}
                            >
                              Submitted {timeAgo(user.created_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2 — Account & ID */}
                    <div className="space-y-2.5">
                      {isDiscountApplication ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                          {user.discount_type === "pwd" ? "PWD applicant" : "Senior applicant"}
                        </span>
                      ) : clean(user.user_type) ? (
                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                          {user.user_type}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Standard driver
                        </span>
                      )}

                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                        <p className="text-xs font-bold text-slate-700">
                          {isDiscountApplication
                            ? user.discount_type === "pwd"
                              ? "PWD ID"
                              : "Senior Citizen ID"
                            : clean(user.valid_id_type) || "ID type not specified"}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {clean(
                            isDiscountApplication ? user.discount_id_number : user.id_number,
                          ) || "No ID number"}
                        </p>
                      </div>
                    </div>

                    {/* 3 — Documents */}
                    <div className="flex flex-wrap items-start gap-3">
                      {images.map((image, imageIndex) => (
                        <Thumb
                          key={`${user.id}-${image.label}-${imageIndex}`}
                          image={image}
                          onOpen={() => {
                            const position = openableImages.findIndex(
                              (candidate) => candidate.rawPath === image.rawPath,
                            );
                            setLightbox({
                              images: openableImages,
                              index: position < 0 ? 0 : position,
                              applicantName:
                                displayName || fallbackLabel || "Applicant",
                            });
                          }}
                        />
                      ))}
                    </div>

                    {/* 4 — Actions */}
                    <div className="flex items-center justify-start lg:justify-end">
                      {isApproved ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700">
                          <CheckCircle2 size={16} />
                          Verified
                        </div>
                      ) : isRejected ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-bold text-rose-700">
                          <XCircle size={16} />
                          Rejected
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReject(user)}
                            disabled={isBusy}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <ShieldClose size={14} />
                            )}
                            Deny
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApprove(user)}
                            disabled={isBusy}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <UserCheck size={14} />
                            )}
                            Verify
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          applicantName={lightbox.applicantName}
          onClose={() => setLightbox(null)}
          onNavigate={(nextIndex) =>
            setLightbox((prev) => (prev ? { ...prev, index: nextIndex } : prev))
          }
        />
      )}
    </AdminLayout>
  );
}