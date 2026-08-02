export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      partner_applications: {
        Row: {
          id: string
          user_id: string
          status: string
          rep_first_name: string | null
          rep_last_name: string | null
          rep_contact_number: string | null
          rep_email: string | null
          establishment_name: string | null
          establishment_address: string | null
          establishment_city: string | null
          establishment_zip: string | null
          total_capacity: number | null
          operating_hours: string | null
          business_registration_number: string | null
          tin: string | null
          business_type: string | null
          year_established: number | null
          documents: Json | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          reviewed_by: string | null
          review_notes: string | null
          rejection_reason: string | null
          parkada_email: string | null
          linked_lot_id: string | null
          activated_at: string | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          rep_first_name?: string | null
          rep_last_name?: string | null
          rep_contact_number?: string | null
          rep_email?: string | null
          establishment_name?: string | null
          establishment_address?: string | null
          establishment_city?: string | null
          establishment_zip?: string | null
          total_capacity?: number | null
          operating_hours?: string | null
          business_registration_number?: string | null
          tin?: string | null
          business_type?: string | null
          year_established?: number | null
          documents?: Json | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          rejection_reason?: string | null
          parkada_email?: string | null
          linked_lot_id?: string | null
          activated_at?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          rep_first_name?: string | null
          rep_last_name?: string | null
          rep_contact_number?: string | null
          rep_email?: string | null
          establishment_name?: string | null
          establishment_address?: string | null
          establishment_city?: string | null
          establishment_zip?: string | null
          total_capacity?: number | null
          operating_hours?: string | null
          business_registration_number?: string | null
          tin?: string | null
          business_type?: string | null
          year_established?: number | null
          documents?: Json | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          rejection_reason?: string | null
          parkada_email?: string | null
          linked_lot_id?: string | null
          activated_at?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      partner_application_audit_log: {
        Row: {
          id: string
          application_id: string
          changed_by_role: string | null
          previous_status: string | null
          new_status: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          application_id: string
          changed_by_role?: string | null
          previous_status?: string | null
          new_status?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          changed_by_role?: string | null
          previous_status?: string | null
          new_status?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
          phone_number: string | null
          user_type: 'regular' | 'senior' | 'pwd' | 'driver'
          expo_push_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone_number?: string | null
          user_type?: 'regular' | 'senior' | 'pwd' | 'driver'
          expo_push_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone_number?: string | null
          user_type?: 'regular' | 'senior' | 'pwd' | 'driver'
          expo_push_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      admin_profiles: {
        Row: {
          id: string
          role: 'super_admin' | 'admin' | 'manager' | 'lot_owner' | 'staff' | 'guard'
          email: string | null
          full_name: string | null
          status: string
          assigned_lot_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role: 'super_admin' | 'admin' | 'manager' | 'lot_owner' | 'staff' | 'guard'
          email?: string | null
          full_name?: string | null
          status?: string
          assigned_lot_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'super_admin' | 'admin' | 'manager' | 'lot_owner' | 'staff' | 'guard'
          email?: string | null
          full_name?: string | null
          status?: string
          assigned_lot_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      identity_verifications: {
        Row: {
          id: string
          profile_id: string
          id_type: string | null
          id_number: string | null
          front_image_url: string | null
          back_image_url: string | null
          status: 'pending' | 'approved' | 'rejected'
          verified_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          id_type?: string | null
          id_number?: string | null
          front_image_url?: string | null
          back_image_url?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          verified_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          id_type?: string | null
          id_number?: string | null
          front_image_url?: string | null
          back_image_url?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          verified_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          profile_id: string
          plate_number: string | null
          vehicle_type: string | null
          brand: string | null
          color: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          plate_number?: string | null
          vehicle_type?: string | null
          brand?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          plate_number?: string | null
          vehicle_type?: string | null
          brand?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      lot_owners: {
        Row: {
          id: string
          business_name: string | null
          contact_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          business_name?: string | null
          contact_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_name?: string | null
          contact_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      parking_lots: {
        Row: {
          id: string
          owner_id: string
          name: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          capacity: number | null
          operating_hours: string | null
          base_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          capacity?: number | null
          operating_hours?: string | null
          base_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          capacity?: number | null
          operating_hours?: string | null
          base_rate?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      parking_slots: {
        Row: {
          id: string
          lot_id: string
          slot_number: string | null
          status: 'available' | 'occupied' | 'reserved' | 'maintenance'
          slot_type: 'regular' | 'pwd' | 'motorcycle'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lot_id: string
          slot_number?: string | null
          status?: 'available' | 'occupied' | 'reserved' | 'maintenance'
          slot_type?: 'regular' | 'pwd' | 'motorcycle'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lot_id?: string
          slot_number?: string | null
          status?: 'available' | 'occupied' | 'reserved' | 'maintenance'
          slot_type?: 'regular' | 'pwd' | 'motorcycle'
          created_at?: string
          updated_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          profile_id: string
          slot_id: string
          vehicle_id: string
          start_time: string | null
          end_time: string | null
          status: 'pending' | 'active' | 'completed' | 'cancelled'
          total_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          slot_id: string
          vehicle_id: string
          start_time?: string | null
          end_time?: string | null
          status?: 'pending' | 'active' | 'completed' | 'cancelled'
          total_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          slot_id?: string
          vehicle_id?: string
          start_time?: string | null
          end_time?: string | null
          status?: 'pending' | 'active' | 'completed' | 'cancelled'
          total_amount?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      receipts: {
        Row: {
          id: string
          reservation_id: string
          amount_paid: number | null
          payment_method: string | null
          receipt_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          amount_paid?: number | null
          payment_method?: string | null
          receipt_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          amount_paid?: number | null
          payment_method?: string | null
          receipt_url?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          title: string | null
          message: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title?: string | null
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string | null
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      parking_reviews: {
        Row: {
          id: string
          lot_id: string
          profile_id: string
          rating: number | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lot_id: string
          profile_id: string
          rating?: number | null
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lot_id?: string
          profile_id?: string
          rating?: number | null
          comment?: string | null
          created_at?: string
        }
      }
      walk_in_records: {
        Row: {
          id: string
          lot_id: string
          slot_id: string
          plate_number: string | null
          entry_time: string | null
          exit_time: string | null
          status: 'active' | 'completed' | null
          amount_due: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lot_id: string
          slot_id: string
          plate_number?: string | null
          entry_time?: string | null
          exit_time?: string | null
          status?: 'active' | 'completed' | null
          amount_due?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lot_id?: string
          slot_id?: string
          plate_number?: string | null
          entry_time?: string | null
          exit_time?: string | null
          status?: 'active' | 'completed' | null
          amount_due?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      plate_validation_logs: {
        Row: {
          id: string
          lot_id: string
          camera_id: string | null
          detected_plate: string | null
          confidence_score: number | null
          image_url: string | null
          validation_status: 'matched' | 'mismatched' | 'manual_review' | null
          linked_reservation_id: string | null
          linked_walk_in_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lot_id: string
          camera_id?: string | null
          detected_plate?: string | null
          confidence_score?: number | null
          image_url?: string | null
          validation_status?: 'matched' | 'mismatched' | 'manual_review' | null
          linked_reservation_id?: string | null
          linked_walk_in_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lot_id?: string
          camera_id?: string | null
          detected_plate?: string | null
          confidence_score?: number | null
          image_url?: string | null
          validation_status?: 'matched' | 'mismatched' | 'manual_review' | null
          linked_reservation_id?: string | null
          linked_walk_in_id?: string | null
          created_at?: string
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          subject: string | null
          description: string | null
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          subject?: string | null
          description?: string | null
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          subject?: string | null
          description?: string | null
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      system_settings: {
        Row: {
          id: number
          maintenance_mode: boolean
          grace_period_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          maintenance_mode?: boolean
          grace_period_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          maintenance_mode?: boolean
          grace_period_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
