import { supabase } from './supabaseClient';
import { Database } from './database.types';

// ==========================================
// Future Feature: OCR Plate Recognition & Validation
// ==========================================
export const OCRService = {
  /**
   * TODO: Implement YOLO detection logging integration
   */
  logDetection: async (data: any) => {
    console.warn("TODO: Implement logDetection in OCRService");
    // Implementation will go here
  },

  /**
   * TODO: Implement OCR plate validation workflow
   * Connects detected plate with walk-in records or reservations.
   */
  validatePlate: async (plateNumber: string, lotId: string, cameraId: string) => {
    console.warn("TODO: Implement validatePlate in OCRService");
    // Implementation will involve inserting into 'plate_validation_logs'
    // and updating 'walk_in_records' or triggering alerts.
  }
};

// ==========================================
// Future Feature: Identity Verification
// ==========================================
export const IdentityVerificationService = {
  /**
   * TODO: Implement identity verification submission for Regular, Senior, PWD.
   */
  submitVerification: async (profileId: string, idType: string, idNumber: string, frontImage: File, backImage: File) => {
    console.warn("TODO: Implement submitVerification in IdentityVerificationService");
    // 1. Upload images to Supabase Storage
    // 2. Insert record into 'identity_verifications' table
  },

  /**
   * TODO: Implement Admin review workflow for identity verifications
   */
  reviewVerification: async (verificationId: string, status: 'approved' | 'rejected', adminId: string) => {
    console.warn("TODO: Implement reviewVerification in IdentityVerificationService");
  }
};

// ==========================================
// Future Feature: Support Tickets
// ==========================================
export const SupportTicketService = {
  /**
   * TODO: Implement Support ticket submission for users.
   */
  createTicket: async (userId: string, subject: string, description: string) => {
    console.warn("TODO: Implement createTicket in SupportTicketService");
    /*
    const { data, error } = await supabase.from('support_tickets').insert({
      user_id: userId,
      subject,
      description,
      status: 'open'
    });
    */
  },

  /**
   * TODO: Implement ticket management for Admins
   */
  updateTicketStatus: async (ticketId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', adminId: string) => {
    console.warn("TODO: Implement updateTicketStatus in SupportTicketService");
  }
};
