import { supabase } from "./supabase";

/**
 * ============================================================================
 *  WHY THIS FILE EXISTS
 * ============================================================================
 *  The Alerts screen (app/(app)/notifications.tsx) only ever READS from the
 *  `notifications` table. Nothing in the app ever INSERTED into it — the admin
 *  panel called the `send-push` edge function, which delivers a push but does
 *  not persist a row, and the reservation / payment / profile flows wrote
 *  nothing at all.
 *
 *  That is why the Alerts tab was always empty: there were no notifications to
 *  show, not a bug in how they were displayed.
 *
 *  Every notification in the app should now go through `notify()` (or one of
 *  the typed helpers below) so there is exactly one place that knows the table
 *  shape, handles dedupe, and never throws into your UI code.
 * ============================================================================
 */

const TABLE = "notifications";

/** Keys already sent during this app session — prevents duplicate spam. */
const sentKeys = new Set<string>();

export type NotifyInput = {
  /** Defaults to the currently signed-in user. */
  userId?: string | null;
  title: string;
  message: string;
  /**
   * Stable key (e.g. `ending-soon:<reservationId>`). When provided the same
   * notification will not be inserted twice while the app is running.
   */
  dedupeKey?: string;
  /** Also fire the `send-push` edge function. Off by default. */
  push?: boolean;
};

async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The read-flag column is spelled `is_read` on the Alerts screen and `read` in
 * an older home-screen query. Rather than guessing, the insert omits the flag
 * entirely and lets the column default apply, only retrying with an explicit
 * value if the column turns out to be NOT NULL without a default.
 */
async function insertRow(row: Record<string, any>) {
  let { error } = await supabase.from(TABLE).insert(row);
  if (!error) return null;

  let retry = await supabase.from(TABLE).insert({ ...row, is_read: false });
  if (!retry.error) return null;

  retry = await supabase.from(TABLE).insert({ ...row, read: false });
  return retry.error ?? error;
}

/**
 * Insert a notification. Never throws — a failed notification must not break
 * the reservation or payment flow that triggered it.
 * Returns true when a row was written (or was already sent this session).
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  try {
    const userId = await resolveUserId(input.userId);
    if (!userId) return false;

    const key = input.dedupeKey ? `${userId}:${input.dedupeKey}` : null;
    if (key && sentKeys.has(key)) return true;

    const error = await insertRow({
      user_id: userId,
      title: input.title,
      message: input.message,
    });

    if (error) {
      console.warn("[notify] insert failed:", error.message);
      return false;
    }

    if (key) sentKeys.add(key);

    if (input.push) {
      supabase.functions
        .invoke("send-push", {
          body: { user_id: userId, title: input.title, message: input.message },
        })
        .catch(() => {
          /* push is best-effort */
        });
    }

    return true;
  } catch (error) {
    console.warn("[notify] unexpected error:", error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  TYPED HELPERS — call these from the matching screens                       */
/* -------------------------------------------------------------------------- */

const peso = (amount: number | string) => {
  const value = Number(amount);
  return Number.isFinite(value) ? `₱${value.toLocaleString()}` : `₱${amount}`;
};

/** Call right after the reservation row is inserted (payment screen). */
export function notifyReservationCreated(params: {
  reservationId?: string;
  lotName: string;
  slotLabel?: string;
  startTime?: string;
  endTime?: string;
  userId?: string;
}) {
  const slot = params.slotLabel ? ` Slot ${params.slotLabel}` : "";
  const window =
    params.startTime && params.endTime
      ? ` from ${params.startTime} to ${params.endTime}`
      : "";
  return notify({
    userId: params.userId,
    title: "Reservation confirmed",
    message: `Your slot at ${params.lotName}${slot} is booked${window}. Arrive before your start time to keep the slot.`,
    dedupeKey: params.reservationId ? `reserved:${params.reservationId}` : undefined,
  });
}

/** Call after a successful payment. */
export function notifyPaymentSuccess(params: {
  reservationId?: string;
  amount: number | string;
  method?: string;
  lotName?: string;
  referenceNumber?: string;
  userId?: string;
}) {
  const method = params.method ? ` via ${params.method.toUpperCase()}` : "";
  const lot = params.lotName ? ` for ${params.lotName}` : "";
  const reference = params.referenceNumber ? ` Reference ${params.referenceNumber}.` : "";
  return notify({
    userId: params.userId,
    title: "Payment successful",
    message: `${peso(params.amount)} paid${method}${lot}.${reference}`,
    dedupeKey: params.reservationId ? `paid:${params.reservationId}` : undefined,
  });
}

/** Fired automatically from the home screen when a session is nearly over. */
export function notifyReservationEndingSoon(params: {
  reservationId: string;
  lotName: string;
  slotLabel?: string;
  minutesLeft: number;
  userId?: string;
}) {
  const slot = params.slotLabel ? ` Slot ${params.slotLabel}` : "";
  return notify({
    userId: params.userId,
    title: "Parking session ending soon",
    message: `${params.minutesLeft} ${
      params.minutesLeft === 1 ? "minute" : "minutes"
    } left at ${params.lotName}${slot}. Extend it in the app or head back to your vehicle to avoid overtime charges.`,
    dedupeKey: `ending-soon:${params.reservationId}`,
    push: true,
  });
}

/** Fired automatically when the home screen auto-completes an expired booking. */
export function notifyReservationCompleted(params: {
  reservationId: string;
  lotName?: string;
  userId?: string;
}) {
  const lot = params.lotName ? ` at ${params.lotName}` : "";
  return notify({
    userId: params.userId,
    title: "Parking session ended",
    message: `Your session${lot} has ended. Thanks for parking with ParKada — you can view the receipt in Bookings.`,
    dedupeKey: `completed:${params.reservationId}`,
  });
}

export function notifyReservationCancelled(params: {
  reservationId: string;
  lotName?: string;
  userId?: string;
}) {
  const lot = params.lotName ? ` at ${params.lotName}` : "";
  return notify({
    userId: params.userId,
    title: "Reservation cancelled",
    message: `Your reservation${lot} was cancelled and the slot has been released.`,
    dedupeKey: `cancelled:${params.reservationId}`,
  });
}

export function notifyExtensionSuccess(params: {
  reservationId?: string;
  hours: number;
  amount?: number | string;
  newEndTime?: string;
  userId?: string;
}) {
  const cost = params.amount !== undefined ? ` ${peso(params.amount)} charged.` : "";
  const until = params.newEndTime ? ` Your session now ends at ${params.newEndTime}.` : "";
  return notify({
    userId: params.userId,
    title: "Parking extended",
    message: `Added ${params.hours} ${params.hours === 1 ? "hour" : "hours"} to your session.${until}${cost}`,
  });
}

export function notifyProfileUpdated(params?: { what?: string; userId?: string }) {
  const what = params?.what ?? "Your profile";
  return notify({
    userId: params?.userId,
    title: "Profile updated",
    message: `${what} was saved successfully.`,
  });
}

export function notifyVerificationSubmitted(params?: {
  kind?: "identity" | "discount";
  userId?: string;
}) {
  const isDiscount = params?.kind === "discount";
  return notify({
    userId: params?.userId,
    title: isDiscount ? "Discount application sent" : "Verification submitted",
    message: isDiscount
      ? "Your discount application is now under review. You'll get an alert here once an administrator decides."
      : "Your ID and selfie were submitted for review. You'll get an alert here once an administrator verifies your account.",
  });
}

export function notifyVehicleAdded(params: { plateNumber: string; userId?: string }) {
  return notify({
    userId: params.userId,
    title: "Vehicle added",
    message: `${params.plateNumber} is now registered and can be used for reservations.`,
  });
}

export function notifyVehicleRemoved(params: { plateNumber: string; userId?: string }) {
  return notify({
    userId: params.userId,
    title: "Vehicle removed",
    message: `${params.plateNumber} was removed from your account.`,
  });
}

export function notifyWalletLinked(params: {
  provider: "gcash" | "maya";
  maskedNumber: string;
  userId?: string;
}) {
  const provider = params.provider === "gcash" ? "GCash" : "Maya";
  return notify({
    userId: params.userId,
    title: `${provider} linked`,
    message: `${provider} ${params.maskedNumber} is now linked to your ParKada account.`,
  });
}

export function notifyWalletUnlinked(params: {
  provider: "gcash" | "maya";
  maskedNumber: string;
  userId?: string;
}) {
  const provider = params.provider === "gcash" ? "GCash" : "Maya";
  return notify({
    userId: params.userId,
    title: `${provider} unlinked`,
    message: `${provider} ${params.maskedNumber} was removed from your account.`,
  });
}