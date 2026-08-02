import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { LogOut, FileText, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';

export default function PartnerDashboard() {
  const [application, setApplication] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
                  <div className="text-xs text-gray-500 font-semibold mb-1">PASSWORD</div>
                  <div className="text-gray-700 text-sm italic">
                    The temporary password has been sent to your personal email by the Super Admin. Please change it upon first login.
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
