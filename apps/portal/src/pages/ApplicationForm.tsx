import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Save } from 'lucide-react';

// Steps components will be imported or defined here

export default function ApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<any>({});
  const navigate = useNavigate();

  useEffect(() => {
    checkSessionAndFetchDraft();
  }, []);

  const checkSessionAndFetchDraft = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to apply.');
        navigate('/login');
        return;
      }

      // Fetch existing application
      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error; // PGRST116 is "no rows returned", which is fine for new users
      }

      if (data) {
        if (data.status !== 'draft' && data.status !== 'needs_revision') {
          // If already submitted and not in revision, redirect to dashboard
          toast.info('Your application is already submitted.');
          navigate('/dashboard');
          return;
        }
        setApplicationId(data.id);
        setFormData(data);
      } else {
        // Create a new draft
        const { data: newApp, error: createError } = await supabase
          .from('partner_applications')
          .insert({ user_id: session.user.id, status: 'draft' })
          .select()
          .single();
          
        if (createError) throw createError;
        setApplicationId(newApp.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load application data.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = async (dataToSave: any) => {
    if (!applicationId) return;
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update(dataToSave)
        .eq('id', applicationId);
        
      if (error) throw error;
      toast.success('Draft saved automatically');
    } catch (err) {
      console.error('Failed to save draft', err);
      toast.error('Failed to save draft');
    }
  };

  const handleNext = () => {
    // Save current step data
    saveDraft(formData);
    setCurrentStep((prev) => Math.min(prev + 1, 5));
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };
  
  const handleSubmitFinal = async () => {
    if (!applicationId) return;
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update({ ...formData, status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', applicationId);
        
      if (error) throw error;
      
      toast.success('Application submitted successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit application.');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Partner Application</h1>
          <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
            Step {currentStep} of 5
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
          
          {/* Step 1: Representative Info */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">1. Representative Information</h2>
              <p className="text-gray-500">Please provide the contact details of the primary person managing this application.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">First Name</label>
                  <input 
                    type="text" 
                    value={formData.rep_first_name || ''} 
                    onChange={(e) => setFormData({...formData, rep_first_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Last Name</label>
                  <input 
                    type="text" 
                    value={formData.rep_last_name || ''} 
                    onChange={(e) => setFormData({...formData, rep_last_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Contact Number</label>
                <input 
                  type="tel" 
                  value={formData.rep_contact_number || ''} 
                  onChange={(e) => setFormData({...formData, rep_contact_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="+63 912 345 6789"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Official Email Address</label>
                <input 
                  type="email" 
                  value={formData.rep_email || ''} 
                  onChange={(e) => setFormData({...formData, rep_email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Step 2: Establishment Details */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">2. Establishment Details</h2>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Parking Establishment Name</label>
                <input 
                  type="text" 
                  value={formData.establishment_name || ''} 
                  onChange={(e) => setFormData({...formData, establishment_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Address</label>
                <input 
                  type="text" 
                  value={formData.establishment_address || ''} 
                  onChange={(e) => setFormData({...formData, establishment_address: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">City / Municipality</label>
                  <input 
                    type="text" 
                    value={formData.establishment_city || ''} 
                    onChange={(e) => setFormData({...formData, establishment_city: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">ZIP Code</label>
                  <input 
                    type="text" 
                    value={formData.establishment_zip || ''} 
                    onChange={(e) => setFormData({...formData, establishment_zip: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Total Capacity (Slots)</label>
                  <input 
                    type="number" 
                    value={formData.total_capacity || ''} 
                    onChange={(e) => setFormData({...formData, total_capacity: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Operating Hours</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 6AM - 10PM or 24/7"
                    value={formData.operating_hours || ''} 
                    onChange={(e) => setFormData({...formData, operating_hours: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Business & Legal Info */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">3. Business & Legal Information</h2>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Business Type</label>
                <select 
                  value={formData.business_type || ''} 
                  onChange={(e) => setFormData({...formData, business_type: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                >
                  <option value="">Select Business Type</option>
                  <option value="sole_proprietor">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="corporation">Corporation</option>
                  <option value="cooperative">Cooperative</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Business Registration No. (DTI/SEC)</label>
                  <input 
                    type="text" 
                    value={formData.business_registration_number || ''} 
                    onChange={(e) => setFormData({...formData, business_registration_number: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tax Identification Number (TIN)</label>
                  <input 
                    type="text" 
                    value={formData.tin || ''} 
                    onChange={(e) => setFormData({...formData, tin: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Year Established</label>
                <input 
                  type="number" 
                  value={formData.year_established || ''} 
                  onChange={(e) => setFormData({...formData, year_established: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="YYYY"
                />
              </div>
            </div>
          )}

          {/* Step 4: Document Upload */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">4. Required Documents</h2>
              <p className="text-gray-500 mb-4">Please upload clear copies of the following documents. (PDF, JPG, PNG)</p>
              
              {/* Document upload placeholders - In a real app, use Supabase Storage */}
              {['valid_id', 'dti_or_sec', 'bir_cert', 'mayors_permit', 'barangay_clearance'].map((docKey) => (
                <div key={docKey} className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative overflow-hidden">
                   <div className="text-center">
                     <div className="text-sm font-bold uppercase mb-1">{docKey.replace(/_/g, ' ')}</div>
                     <div className="text-xs text-gray-500">Click to upload or drag and drop</div>
                     
                     {formData.documents?.[docKey] && (
                       <div className="mt-2 text-green-600 font-semibold text-sm">✅ Uploaded</div>
                     )}
                   </div>
                   
                   {/* Hidden file input */}
                   <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={async (e) => {
                     const file = e.target.files?.[0];
                     if (!file) return;
                     
                     // Simulated upload logic
                     toast.info(`Uploading ${docKey}...`);
                     
                     try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${docKey}_${new Date().getTime()}.${fileExt}`;
                        const filePath = `${session?.user.id}/${fileName}`;
                        
                        const { error: uploadError } = await supabase.storage
                          .from('partner-documents')
                          .upload(filePath, file);
                          
                        if (uploadError) throw uploadError;
                        
                        const { data: { publicUrl } } = supabase.storage
                          .from('partner-documents')
                          .getPublicUrl(filePath);
                          
                        const newDocs = { ...(formData.documents || {}), [docKey]: publicUrl };
                        setFormData({ ...formData, documents: newDocs });
                        toast.success(`${docKey} uploaded successfully!`);
                     } catch (err) {
                        console.error(err);
                        toast.error('Failed to upload document');
                     }
                   }} />
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Terms & Submit */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">5. Review & Submit</h2>
              
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6">
                <h3 className="font-bold text-blue-900 mb-2">Terms and Conditions</h3>
                <p className="text-sm text-blue-800 mb-4 h-32 overflow-y-auto pr-2">
                  By submitting this application, you agree to the ParKada Partner Terms of Service.
                  You certify that all information provided is accurate and true to the best of your knowledge.
                  Any false information may result in the rejection of your application or termination of partnership.
                  ...
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={formData.terms_accepted || false}
                    onChange={(e) => setFormData({ ...formData, terms_accepted: e.target.checked, terms_accepted_at: new Date().toISOString() })}
                  />
                  <span className="text-sm font-medium text-blue-900">
                    I have read and agree to the Terms and Conditions and certify that the provided information is correct.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-6 py-3 font-semibold rounded-xl text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <ChevronLeft size={18} /> Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Next <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmitFinal}
                disabled={!formData.terms_accepted}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                Submit Application <Save size={18} />
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
