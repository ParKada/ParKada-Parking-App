import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { LogOut, FileText, CheckCircle, AlertCircle, Clock, ExternalLink, Eye, EyeOff, KeyRound, Save, X } from 'lucide-react';

export default function PartnerDashboard() {
  const [application, setApplication] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  
  // Password change state
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Staff state
  const [staffAccounts, setStaffAccounts] = useState<any[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [resettingStaffId, setResettingStaffId] = useState<string | null>(null);
  const [staffNewPassword, setStaffNewPassword] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffNewName, setStaffNewName] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (application?.status === 'account_activated' && application?.linked_lot_id) {
      fetchStaffAccounts();
    }
  }, [application]);

  const fetchStaffAccounts = async () => {
    setIsLoadingStaff(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-partner-staff", {
        body: { application_id: application.id }
      });
      if (error) throw error;
      setStaffAccounts(data.data || []);
    } catch (err: any) {
      console.error("Failed to load staff:", err);
      toast.error("Failed to load staff accounts");
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleResetStaffPassword = async (staffId: string) => {
    if (!staffNewPassword || staffNewPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    try {
      const { error } = await supabase.functions.invoke("reset-staff-password", {
        body: {
          application_id: application.id,
          staff_id: staffId,
          new_password: staffNewPassword
        }
      });
      
      if (error) throw error;
      
      toast.success("Staff password reset successfully!");
      setResettingStaffId(null);
      setStaffNewPassword('');
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    }
  };

  const handleUpdateStaffName = async (staffId: string) => {
    if (!staffNewName || staffNewName.trim().length < 3) {
      return toast.error("Name must be at least 3 characters");
    }
    try {
      const { error } = await supabase.functions.invoke("update-staff-name", {
        body: {
          application_id: application.id,
          staff_id: staffId,
          new_name: staffNewName.trim()
        }
      });
      if (error) throw error;
      toast.success("Staff name updated successfully!");
      setEditingStaffId(null);
      setStaffNewName('');
      fetchStaffAccounts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update name");
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      
      setUserEmail(session.user.email || '');

      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setApplication(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.functions.invoke("change-admin-password", {
        body: {
          application_id: application.id,
          new_password: newPassword
        }
      });
      
      if (error) throw error;
      
      toast.success("Admin password updated successfully!");
      setApplication({ ...application, current_password: newPassword });
      setIsChangingPassword(false);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const renderStatusBox = () => {
    if (!application) {
      return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-500 mb-4">
            <FileText size={24} />
          </div>
          <h2 className="text-xl font-bold mb-2">No Application Yet</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You haven't started an application to list your parking establishment on ParKada yet.
          </p>
          <Link 
            to="/apply"
            className="inline-flex px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            Start Application
          </Link>
        </div>
      );
    }

    const { status, review_notes, parkada_email } = application;

    if (status === 'draft') {
      return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">Draft Application</h2>
            <p className="text-gray-500">You have an incomplete application.</p>
          </div>
          <Link 
            to="/apply"
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            Continue Application
          </Link>
        </div>
      );
    }

    if (status === 'submitted' || status === 'documents_under_review' || status === 'verification') {
      return (
        <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100 flex items-start gap-4">
          <div className="text-blue-500 mt-1"><Clock size={24} /></div>
          <div>
            <h2 className="text-xl font-bold text-blue-900 mb-1">Application Under Review</h2>
            <p className="text-blue-800">
              Your application is currently being reviewed by our team. Current status: 
              <span className="font-semibold ml-1 px-2 py-0.5 bg-blue-200 rounded text-blue-900 text-sm">
                {status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </p>
            {status === 'submitted' && (
              <div className="mt-4">
                <Link to="/apply" className="text-sm font-semibold text-blue-700 hover:underline">
                  Edit Application Details
                </Link>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (status === 'needs_revision') {
      return (
        <div className="bg-orange-50 p-8 rounded-2xl border border-orange-200 flex items-start gap-4">
          <div className="text-orange-500 mt-1"><AlertCircle size={24} /></div>
          <div className="w-full">
            <h2 className="text-xl font-bold text-orange-900 mb-1">Action Required: Revision Needed</h2>
            <p className="text-orange-800 mb-4">
              Our team has reviewed your application and requested some changes before we can proceed.
            </p>
            <div className="bg-white p-4 rounded-lg border border-orange-100 mb-4 text-orange-900 text-sm">
              <span className="font-bold">Reviewer Notes:</span> {review_notes || 'Please review your uploaded documents.'}
            </div>
            <Link 
              to="/apply"
              className="inline-block px-6 py-2 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              Update Application
            </Link>
          </div>
        </div>
      );
    }

    if (status === 'account_activated') {
      return (
        <div className="bg-green-50 p-8 rounded-2xl border border-green-200 flex items-start gap-4">
          <div className="text-green-600 mt-1"><CheckCircle size={24} /></div>
          <div className="w-full">
            <h2 className="text-xl font-bold text-green-900 mb-1">Partnership Approved!</h2>
            <p className="text-green-800 mb-6">
              Congratulations! Your parking establishment has been approved and your official ParKada Admin account has been created.
            </p>
            
            <div className="bg-white p-6 rounded-xl border border-green-100 mb-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 tracking-wider">Your Admin Credentials</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1">ADMIN EMAIL</div>
                  <div className="font-mono text-lg font-bold text-gray-900">{parkada_email}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center justify-between">
                    <span>PASSWORD</span>
                    {!isChangingPassword && (
                      <button 
                        onClick={() => setIsChangingPassword(true)}
                        className="text-primary hover:underline flex items-center gap-1 text-xs"
                      >
                        <KeyRound size={12} /> Change
                      </button>
                    )}
                  </div>
                  
                  {isChangingPassword ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input 
                        type="text" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:border-primary"
                      />
                      <button 
                        onClick={handleChangePassword}
                        disabled={isUpdatingPassword}
                        className="px-3 py-1.5 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isUpdatingPassword ? 'Saving...' : <><Save size={14} /> Save</>}
                      </button>
                      <button 
                        onClick={() => setIsChangingPassword(false)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-lg font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-md tracking-wider">
                        {showPassword ? (application.current_password || 'Not set') : '••••••••'}
                      </div>
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  )}
                  <div className="text-gray-500 text-xs mt-2 italic">
                    You can use this password to log in to the Admin Portal. Do not share it with unauthorized personnel.
                  </div>
                </div>
              </div>
            </div>

            <a 
              href="https://admin.parkada.site"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
            >
              Go to Admin Portal <ExternalLink size={18} />
            </a>
            
            {/* Staff Accounts Section */}
            <div className="mt-8 pt-8 border-t border-green-200">
              <h3 className="text-lg font-bold text-green-900 flex items-center gap-2 mb-4">
                Staff Accounts
              </h3>
              <p className="text-sm text-green-800 mb-4">
                Here are the staff members (guards/attendants) registered to your establishment. For security, passwords are encrypted. If a staff member forgets their password, you can reset it here.
              </p>
              
              {isLoadingStaff ? (
                <div className="text-sm text-gray-500">Loading staff accounts...</div>
              ) : staffAccounts.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm text-center text-sm text-gray-500">
                  No staff accounts found. You can add them from the Admin Portal.
                </div>
              ) : (
                <div className="space-y-3">
                  {staffAccounts.map((staff: any) => (
                <div key={staff.id} className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    {editingStaffId === staff.id ? (
                      <div className="flex items-center gap-2 mb-1">
                        <input 
                          type="text" 
                          value={staffNewName}
                          onChange={(e) => setStaffNewName(e.target.value)}
                          className="px-2 py-1 text-sm border rounded focus:ring-1 outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleUpdateStaffName(staff.id)} className="text-green-600 font-semibold text-xs bg-green-50 px-2 py-1 rounded">Save</button>
                        <button onClick={() => setEditingStaffId(null)} className="text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">Cancel</button>
                      </div>
                    ) : (
                      <div className="font-bold text-gray-900 flex items-center gap-2 mb-1">
                        {staff.full_name} 
                        <button onClick={() => { setEditingStaffId(staff.id); setStaffNewName(staff.full_name); }} className="text-primary text-xs hover:underline flex items-center gap-1 opacity-70 hover:opacity-100">
                          Edit Name
                        </button>
                      </div>
                    )}
                    <div className="text-sm text-gray-500">{staff.email}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded uppercase">
                          {staff.role}
                        </span>
                      </div>
                      
                      {resettingStaffId === staff.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={staffNewPassword}
                            onChange={(e) => setStaffNewPassword(e.target.value)}
                            placeholder="New password"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:border-primary"
                          />
                          <button 
                            onClick={() => handleResetStaffPassword(staff.id)}
                            className="px-3 py-1.5 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 flex items-center gap-1"
                          >
                            <Save size={14} /> Save
                          </button>
                          <button 
                            onClick={() => setResettingStaffId(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResettingStaffId(staff.id);
                            setStaffNewPassword(Math.random().toString(36).slice(-8) + "Aa1@"); // Gen random temp password
                          }}
                          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 flex items-center gap-1"
                        >
                          <KeyRound size={14} /> Reset Password
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      );
    }
    
    if (status === 'rejected') {
        return (
          <div className="bg-red-50 p-8 rounded-2xl border border-red-200 flex items-start gap-4">
            <div className="text-red-500 mt-1"><AlertCircle size={24} /></div>
            <div className="w-full">
              <h2 className="text-xl font-bold text-red-900 mb-1">Application Rejected</h2>
              <p className="text-red-800 mb-4">
                Unfortunately, your application to join ParKada has been rejected.
              </p>
            </div>
          </div>
        );
      }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                 <div className="w-3 h-3 rounded-full border-2 border-white"></div>
             </div>
             <span className="font-bold text-xl tracking-tight">ParKada Portal</span>
          </div>
          
          <div className="flex items-center gap-6">
            <span className="text-sm text-gray-500 font-medium hidden md:block">{userEmail}</span>
            <button 
              onClick={handleLogout}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Partner Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your parking establishment application</p>
        </div>

        {renderStatusBox()}
      </main>
    </div>
  );
}
