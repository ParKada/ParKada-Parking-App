import { useState, useEffect } from 'react';
import { supabase } from '@parkada/shared';
import { toast } from 'sonner';
import { FileText, Eye, CheckCircle, XCircle, AlertCircle, Clock, Building2, User as UserIcon, Calendar, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPartnerApplications() {
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Modals
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Approval Modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  // Revision Modal
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  
  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        if (filter === 'pending') {
          query = query.in('status', ['submitted', 'documents_under_review', 'verification']);
        } else {
          query = query.eq('status', filter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      toast.error('Failed to load applications: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string, extraData: Record<string, any> = {}) => {
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update({ status: newStatus, ...extraData })
        .eq('id', id);

      if (error) throw error;
      
      // Add audit log
      await supabase.from('partner_application_audit_log').insert({
        application_id: id,
        changed_by_role: 'super_admin',
        new_status: newStatus,
        notes: extraData.review_notes || extraData.rejection_reason || `Status updated to ${newStatus}`
      });

      toast.success(`Application status updated to ${newStatus}`);
      fetchApplications();
      setIsViewModalOpen(false);
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    }
  };

  const handleApprove = async () => {
    if (!adminEmail || !adminPassword) {
      return toast.error("Please provide an email and temporary password.");
    }
    
    setIsApproving(true);
    try {
      const { error } = await supabase.functions.invoke("create-partner-admin", {
        body: { 
          email: adminEmail, 
          password: adminPassword,
          full_name: selectedApp.rep_first_name + ' ' + selectedApp.rep_last_name,
          lot_id: '00000000-0000-0000-0000-000000000000', // Placeholder, ideally we create the lot here too
          role: "manager",
          application_id: selectedApp.id
        }
      });

      if (error) throw error;
      
      toast.success("Account created and application approved!");
      setIsApproveModalOpen(false);
      setIsViewModalOpen(false);
      fetchApplications();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve application");
    } finally {
      setIsApproving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      documents_under_review: 'bg-purple-100 text-purple-800',
      verification: 'bg-indigo-100 text-indigo-800',
      needs_revision: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      account_activated: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.draft}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Partner Applications</h1>
          <p className="text-muted-foreground mt-1">Review and manage parking establishment applications</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-max">
        {['all', 'pending', 'needs_revision', 'approved', 'account_activated', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${filter === f ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {f.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="px-6 py-4 font-semibold uppercase text-xs">Establishment</th>
              <th className="px-6 py-4 font-semibold uppercase text-xs">Applicant</th>
              <th className="px-6 py-4 font-semibold uppercase text-xs">Date Submitted</th>
              <th className="px-6 py-4 font-semibold uppercase text-xs">Status</th>
              <th className="px-6 py-4 font-semibold uppercase text-xs text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading applications...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No applications found.</td></tr>
            ) : (
              applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{app.establishment_name || 'N/A'}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{app.establishment_city}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{app.rep_first_name} {app.rep_last_name}</div>
                    <div className="text-gray-500 text-xs">{app.rep_email}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(app.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setSelectedApp(app); setIsViewModalOpen(true); }}
                    >
                      <Eye className="w-4 h-4 mr-2" /> View Details
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Detail Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Building2 className="text-primary" /> Application Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedApp && (
            <div className="space-y-8 py-4">
              {/* Header Status */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                <div>
                  <div className="text-sm text-gray-500 font-semibold mb-1">CURRENT STATUS</div>
                  <div>{getStatusBadge(selectedApp.status)}</div>
                </div>
                {['submitted'].includes(selectedApp.status) && (
                  <Button 
                    onClick={() => updateStatus(selectedApp.id, 'documents_under_review')}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Start Review Process
                  </Button>
                )}
                {['documents_under_review'].includes(selectedApp.status) && (
                  <Button 
                    onClick={() => updateStatus(selectedApp.id, 'verification')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Move to Verification
                  </Button>
                )}
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Col */}
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-bold border-b pb-2 mb-4 flex items-center gap-2"><UserIcon size={18}/> Representative Info</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 block">Name</span><span className="font-medium">{selectedApp.rep_first_name} {selectedApp.rep_last_name}</span></div>
                      <div><span className="text-gray-500 block">Email</span><span className="font-medium">{selectedApp.rep_email}</span></div>
                      <div><span className="text-gray-500 block">Contact</span><span className="font-medium">{selectedApp.rep_contact_number}</span></div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold border-b pb-2 mb-4 flex items-center gap-2"><Building2 size={18}/> Establishment</h3>
                    <div className="space-y-4 text-sm">
                      <div><span className="text-gray-500 block">Name</span><span className="font-medium">{selectedApp.establishment_name}</span></div>
                      <div><span className="text-gray-500 block">Address</span><span className="font-medium">{selectedApp.establishment_address}, {selectedApp.establishment_city}, {selectedApp.establishment_zip}</span></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-gray-500 block">Capacity</span><span className="font-medium">{selectedApp.total_capacity} slots</span></div>
                        <div><span className="text-gray-500 block">Hours</span><span className="font-medium">{selectedApp.operating_hours}</span></div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Col */}
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-bold border-b pb-2 mb-4 flex items-center gap-2"><FileText size={18}/> Legal Info</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 block">Business Type</span><span className="font-medium uppercase">{selectedApp.business_type?.replace('_', ' ')}</span></div>
                      <div><span className="text-gray-500 block">Est. Year</span><span className="font-medium">{selectedApp.year_established}</span></div>
                      <div><span className="text-gray-500 block">DTI/SEC No.</span><span className="font-medium">{selectedApp.business_registration_number}</span></div>
                      <div><span className="text-gray-500 block">TIN</span><span className="font-medium">{selectedApp.tin}</span></div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold border-b pb-2 mb-4">Documents</h3>
                    <div className="space-y-2">
                      {selectedApp.documents && Object.keys(selectedApp.documents).length > 0 ? (
                        Object.entries(selectedApp.documents).map(([key, url]: any) => (
                          <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <span className="text-sm font-medium uppercase">{key.replace(/_/g, ' ')}</span>
                            <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-semibold flex items-center gap-1">
                              View <ArrowRight size={14} />
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 italic">No documents uploaded</div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {/* Admin Actions */}
              {['documents_under_review', 'verification'].includes(selectedApp.status) && (
                <div className="border-t pt-6 flex justify-end gap-4">
                  <Button variant="destructive" onClick={() => setIsRejectModalOpen(true)}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50" onClick={() => setIsRevisionModalOpen(true)}>
                    <AlertCircle className="w-4 h-4 mr-2" /> Request Revision
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                    const suggestedEmail = selectedApp.establishment_name.toLowerCase().replace(/[^a-z0-9]/g, '') + '@parkada.com';
                    setAdminEmail(suggestedEmail);
                    setAdminPassword(Math.random().toString(36).slice(-8)); // Gen temp password
                    setIsApproveModalOpen(true);
                  }}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve & Create Account
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Create Account</DialogTitle>
            <DialogDescription>
              Create official ParKada credentials for this partner. These will be securely displayed on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assigned ParKada Email</Label>
              <Input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? "Creating..." : "Confirm & Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Modal */}
      <Dialog open={isRevisionModalOpen} onOpenChange={setIsRevisionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              Send this application back to the partner with notes on what needs to be fixed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Review Notes</Label>
            <Textarea 
              placeholder="e.g. Please re-upload a clearer copy of your DTI certificate."
              value={revisionNotes} 
              onChange={e => setRevisionNotes(e.target.value)} 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevisionModalOpen(false)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => {
              updateStatus(selectedApp.id, 'needs_revision', { review_notes: revisionNotes });
              setIsRevisionModalOpen(false);
            }}>
              Send Revision Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Reason for Rejection</Label>
            <Textarea 
              placeholder="Provide a reason..."
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)} 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              updateStatus(selectedApp.id, 'rejected', { rejection_reason: rejectReason });
              setIsRejectModalOpen(false);
            }}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
