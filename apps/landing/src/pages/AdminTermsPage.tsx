/*
 * ParKada — Admin Terms and Privacy Policy Page
 * Clean, GCash-like UI: Mobile-optimized, sticky header, readable typography.
 * For parking operators / admins.
 */
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function AdminTermsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="bg-slate-50 min-h-screen flex justify-center">
      {/* Mobile Container */}
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-xl">
        
        {/* Sticky Header - GCash Style */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3">
          <button 
            onClick={() => window.history.back()}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-800" />
          </button>
          <h1 
            className="text-lg font-bold text-slate-900" 
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Admin Terms & Privacy Policy
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto pb-20 text-slate-700 space-y-6">
          
          <div className="mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Last Updated</p>
            <p className="text-sm font-medium">August 2026</p>
          </div>

          <p className="text-sm leading-relaxed">
            Welcome to <strong>ParKada Admin Portal</strong>. These Terms and Conditions govern your use of the parking management system as an administrator, manager, or staff member. By logging in, you agree to comply with and be bound by the following terms.
          </p>

          <hr className="border-slate-100" />

          {/* ========== TERMS AND CONDITIONS ========== */}

          {/* Section 1: Admin Account Responsibilities */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              1. Admin Account Responsibilities
            </h2>
            <p className="text-sm leading-relaxed">
              You are responsible for maintaining the confidentiality of your admin credentials. Any activity performed under your account is your responsibility.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>Do not share your login details with unauthorized personnel.</li>
              <li>Immediately report any suspected security breach to the ParKada superadmin.</li>
              <li>You may only manage the parking lot assigned to your account.</li>
            </ul>
          </section>

          {/* Section 2: Parking Lot & Slot Management */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              2. Parking Lot & Slot Management
            </h2>
            <p className="text-sm leading-relaxed">
              As an admin, you are authorized to manage parking slots, reservations, and walk-in records for your assigned lot. You must ensure that all slot availability is accurate, and you must not manipulate reservation data for personal gain. You are also required to follow the strict <strong>no-refund policy</strong> for driver reservations.
            </p>
            <p className="text-sm leading-relaxed mt-2">
              <strong>All types of vehicles are allowed</strong> in the system, as long as they fit within the designated parking slot and comply with the parking operator's rules.
            </p>
          </section>

          {/* Section 3: Driver Data Privacy */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              3. Driver Data Privacy & Verification
            </h2>
            <p className="text-sm leading-relaxed">
              In compliance with the <strong>Data Privacy Act of 2012</strong>, you may access driver information (name, plate number, contact details, valid ID, and biometrics) strictly for verification and parking management purposes.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>Do not copy, share, or use driver data outside the ParKada system.</li>
              <li>Verify driver identities before allowing entry or processing reservations.</li>
              <li>Report any suspicious or fake identification to the superadmin.</li>
            </ul>
          </section>

          {/* Section 4: Reservation & Payment Handling */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              4. Reservation & Payment Handling
            </h2>
            <p className="text-sm leading-relaxed">
              All reservations made through the app are <strong>strictly non-refundable</strong>. Admins must enforce this policy consistently.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>If a driver arrives late, the slot is held only up to the grace period defined by the operator.</li>
              <li>No-shows forfeit their payment entirely.</li>
              <li>Extension payments must be processed through the app only.</li>
            </ul>
          </section>

          {/* Section 5: Liability */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              5. Vehicle & Property Liability
            </h2>
            <p className="text-sm leading-relaxed">
              ParKada and its developers are <strong>not liable for any theft, loss, or damage</strong> to vehicles or personal belongings inside the parking premises. Admins must ensure that proper parking rules are posted and followed.
            </p>
          </section>

          {/* Section 6: Parking Establishment Partnership Requirements */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              6. Parking Establishment Partnership Requirements
            </h2>
            <p className="text-sm leading-relaxed">
              To ensure a smooth and confusion-free experience for drivers, all parking establishments that wish to partner with ParKada must comply with the following requirements:
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>
                <strong>Parking Slot Labels and Signage</strong> — Every parking slot must have a clearly visible label or sign (e.g., Slot A1, Slot B2, etc.) that matches the slot ID shown in the ParKada app. This prevents confusion among drivers looking for their reserved slot.
              </li>
              <li>
                <strong>Accurate Slot Mapping</strong> — The parking layout and slot numbering in the ParKada system must match the actual physical layout of the parking area.
              </li>
              <li>
                <strong>Proper Lighting and Safety</strong> — The parking area must be well-lit and safe for drivers, especially during night-time parking.
              </li>
              <li>
                <strong>Designated Entrance and Exit</strong> — Clear entrance and exit points must be provided, with proper signage for drivers using the app.
              </li>
              <li>
                <strong>Trained Personnel</strong> — At least one trained admin or staff member must be present during operating hours to assist drivers and manage reservations.
              </li>
              <li>
                <strong>Compliance with Local Regulations</strong> — The parking establishment must have the necessary business permits and comply with local government regulations.
              </li>
              <li>
                <strong>Clean and Well-Maintained Facility</strong> — The parking area must be clean, well-maintained, and free from hazards.
              </li>
              <li>
                <strong>Signage for ParKada</strong> — The establishment must display a ParKada Partner signage or sticker at the entrance, indicating that the parking lot is ParKada-accredited.
              </li>
              <li>
                <strong>Emergency Contact</strong> — The parking operator must provide a contact number for emergency concerns, which will be displayed in the ParKada app.
              </li>
            </ul>
            <p className="text-sm leading-relaxed mt-2">
              Failure to comply with these requirements may result in suspension or termination of the partnership.
            </p>
          </section>

          {/* Section 7: Account Termination */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              7. Account Suspension & Termination
            </h2>
            <p className="text-sm leading-relaxed">
              We reserve the right to suspend or terminate admin accounts that:
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>Violate driver data privacy.</li>
              <li>Manipulate reservations, slots, or payments.</li>
              <li>Submit fake or unauthorized parking lot information.</li>
              <li>Repeatedly fail to follow ParKada policies.</li>
            </ul>
          </section>

          {/* Section 8: Modifications */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              8. Changes to These Terms
            </h2>
            <p className="text-sm leading-relaxed">
              ParKada may update these Admin Terms from time to time. Continued use of the admin portal after changes means you accept the updated terms.
            </p>
          </section>

          {/* ========== PRIVACY POLICY ========== */}

          <div className="pt-8 border-t-2 border-slate-200">
            <h1 className="text-lg font-bold text-slate-900 mb-4" style={{ color: "oklch(0.22 0.07 255)" }}>
              Privacy Policy
            </h1>
            <p className="text-sm leading-relaxed mb-4">
              ParKada is committed to protecting the privacy and personal information of all users, including drivers, parking operators, and admin personnel. This Privacy Policy explains how we collect, use, store, and protect your information when you use the ParKada Admin Portal, in compliance with the <strong>Data Privacy Act of 2012 (RA 10173)</strong>.
            </p>
          </div>

          {/* Privacy Section 1 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              1. Information We Collect
            </h2>
            <p className="text-sm leading-relaxed">
              When you register and use the ParKada Admin Portal, we may collect the following information: your full name, email address, contact number, role (admin, manager, or superadmin), assigned parking lot, login credentials, and activity logs such as reservation approvals, slot updates, and walk-in records.
            </p>
          </section>

          {/* Privacy Section 2 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              2. How We Use Your Information
            </h2>
            <p className="text-sm leading-relaxed">
              Your information is used strictly for the following purposes: to verify your identity as an authorized admin, to manage your assigned parking lot, to process reservations and payments, to monitor system activity for security and audit purposes, and to communicate important updates regarding your account or the ParKada system.
            </p>
          </section>

          {/* Privacy Section 3 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              3. Driver Data You May Access
            </h2>
            <p className="text-sm leading-relaxed">
              As an admin, you may access driver information such as name, plate number, contact details, valid ID, and biometrics (selfie) strictly for verification and parking management purposes. You must not copy, share, screenshot, or use this data outside the ParKada system. Any misuse of driver data is a violation of the Data Privacy Act and may result in account termination and legal action.
            </p>
          </section>

          {/* Privacy Section 4 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              4. Data Sharing and Disclosure
            </h2>
            <p className="text-sm leading-relaxed">
              ParKada does not sell, rent, or trade personal information to third parties. We may only share data with: (a) the ParKada superadmin for system management, (b) law enforcement or government agencies when required by law, and (c) service providers who help us operate the system, under strict confidentiality agreements.
            </p>
          </section>

          {/* Privacy Section 5 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              5. Data Storage and Security
            </h2>
            <p className="text-sm leading-relaxed">
              All data is stored securely in our Supabase database with encryption, role-based access controls, and regular backups. Only authorized personnel have access to sensitive information. We implement technical and organizational measures to protect against unauthorized access, alteration, or loss of data.
            </p>
          </section>

          {/* Privacy Section 6 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              6. Data Retention
            </h2>
            <p className="text-sm leading-relaxed">
              We retain admin account information for as long as the account is active or as needed to comply with legal obligations. Driver data accessed through the admin portal is retained only for the period necessary for parking management and is deleted or anonymized after the retention period.
            </p>
          </section>

          {/* Privacy Section 7 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              7. Your Rights as an Admin
            </h2>
            <p className="text-sm leading-relaxed">
              Under the Data Privacy Act of 2012, you have the right to: be informed about how your data is processed, access your personal information, correct any inaccurate data, object to processing, request erasure or blocking of your data, and file a complaint with the National Privacy Commission (NPC).
            </p>
          </section>

          {/* Privacy Section 8 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              8. Cookies and Log Data
            </h2>
            <p className="text-sm leading-relaxed">
              The ParKada Admin Portal may use cookies and log data to maintain your session, remember your preferences, and monitor system activity. You can disable cookies in your browser settings, but some features may not work properly.
            </p>
          </section>

          {/* Privacy Section 9 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              9. Updates to This Privacy Policy
            </h2>
            <p className="text-sm leading-relaxed">
              ParKada may update this Privacy Policy from time to time. Continued use of the Admin Portal after changes means you accept the updated policy. We will notify admins of significant changes through the app or email.
            </p>
          </section>

          {/* Privacy Section 10 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              10. Contact Us
            </h2>
            <p className="text-sm leading-relaxed">
              For questions, concerns, or requests regarding your personal data, you may contact the ParKada Data Protection Officer at <strong>yourparkada@gmail.com</strong> or through the in-app support feature.
            </p>
          </section>

          <p className="text-sm leading-relaxed pt-2">
            By using the ParKada Admin Portal, you acknowledge that you have read, understood, and agreed to this Privacy Policy.
          </p>

          <div className="pt-8 pb-4 text-center">
            <p className="text-xs text-slate-400">© 2026 ParKada. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
