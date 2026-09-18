/**
 * An active parking booking as rendered on the driver home screen.
 *
 * A raw `reservations` row joined with its slot, lot and vehicle data, so the
 * home booking card can render everything it needs without further queries.
 */
export interface ActiveBooking {
  id: string;
  user_id: string;
  lot_id: string;
  start_time: string;
  end_time: string;
  status?: string;
  pricing_scheme?: string;
  plate_number?: string;
  duration: number;
  extension_count: number;
  extension_fee: number;
  fine_amount: number;
  fine_paid: boolean;
  total_amount: number;

  /** Derived from the joined parking lot. */
  lotName: string;
  hourly_rate: number;
  extension_fee_setting: number;
  fine_penalty: number;
  overtime_rate: number;
  grace_period_minutes: number;
  allow_extensions: boolean;
  extension_rate_per_hour: number;

  /** Derived from the joined slot and vehicle. */
  slotLabel: string;
  vehiclePlate: string;
  vehicleModel: string;
}
