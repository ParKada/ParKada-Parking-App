import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Save } from 'lucide-react';

export default function ApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<any>({ operating_hours: "6:00 AM - 10:00 PM", business_type: "private", registration_type: "DTI" });
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

      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        if (data.status !== 'draft' && data.status !== 'needs_revision') {
          toast.info('Your application is already submitted.');
          navigate('/dashboard');
          return;
        }
        setApplicationId(data.id);
        setFormData({ 
          ...data, 
          operating_hours: data.operating_hours || "6:00 AM - 10:00 PM",
          business_type: data.business_type || "private",
          registration_type: data.registration_type || "DTI"
        });
      } else {
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
    saveDraft(formData);
    setCurrentStep((prev) => Math.min(prev + 1, 4));
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

  const renderUploadBox = (docKey: string, label: string, isOptional: boolean = false) => (
    <div key={docKey} className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative overflow-hidden h-32">
       <div className="text-center">
         <div className="text-sm font-bold uppercase mb-1">{label} {isOptional && <span className="text-gray-400 font-normal lowercase">(optional)</span>}</div>
         <div className="text-xs text-gray-500">Click to upload or drag and drop</div>
         
         {formData.documents?.[docKey] && (
           <div className="mt-2 text-green-600 font-semibold text-sm">✅ Uploaded</div>
         )}
       </div>
       
       <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={async (e) => {
         const file = e.target.files?.[0];
         if (!file) return;
         
         toast.info(`Uploading ${label}...`);
         
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
            toast.success(`${label} uploaded successfully!`);
         } catch (err) {
            console.error(err);
            toast.error(`Failed to upload ${label}`);
         }
       }} />
    </div>
  );

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Partner Application</h1>
          <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
            Step {currentStep} of 4
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
          
          {/* Step 1: Representative Info */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">1. Representative Information</h2>
              <p className="text-gray-500">Please provide the contact details of the primary person managing this application.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">First Name *</label>
                  <input 
                    type="text" 
                    value={formData.rep_first_name || ''} 
                    onChange={(e) => setFormData({...formData, rep_first_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Last Name *</label>
                  <input 
                    type="text" 
                    value={formData.rep_last_name || ''} 
                    onChange={(e) => setFormData({...formData, rep_last_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Contact Number *</label>
                <input 
                  type="tel" 
                  value={formData.rep_contact_number || ''} 
                  onChange={(e) => setFormData({...formData, rep_contact_number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="+63 912 345 6789"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Official Email Address *</label>
                <input 
                  type="email" 
                  value={formData.rep_email || ''} 
                  onChange={(e) => setFormData({...formData, rep_email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-semibold">Identification Documents</h3>
                <p className="text-sm text-gray-500">Upload copies of valid government-issued IDs for the representative.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderUploadBox('valid_id', 'VALID ID 1', false)}
                  {renderUploadBox('valid_id_2', 'VALID ID 2', true)}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Establishment Details */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">2. Establishment Details</h2>
              <p className="text-gray-500">Details regarding the physical parking establishment.</p>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Parking Establishment Name *</label>
                <input 
                  type="text" 
                  value={formData.establishment_name || ''} 
                  onChange={(e) => setFormData({...formData, establishment_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Address *</label>
                <input 
                  type="text" 
                  value={formData.establishment_address || ''} 
                  onChange={(e) => setFormData({...formData, establishment_address: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">City / Municipality *</label>
                  <input 
                    type="text" 
                    value={formData.establishment_city || ''} 
                    onChange={(e) => setFormData({...formData, establishment_city: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">ZIP Code *</label>
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
                  <label className="text-sm font-semibold">Total Capacity (Slots) *</label>
                  <input 
                    type="number" 
                    value={formData.total_capacity || ''} 
                    onChange={(e) => setFormData({...formData, total_capacity: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Operating Hours *</label>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <select
                      value={formData.operating_hours === "24 Hours" ? "24 Hours" : (formData.operating_hours ? formData.operating_hours.split(" - ")[0] : "6:00 AM")}
                      onChange={(e) => {
                        const newOpen = e.target.value;
                        if (newOpen === "24 Hours") {
                          setFormData({...formData, operating_hours: "24 Hours"});
                        } else {
                          const currentClose = (formData.operating_hours && formData.operating_hours !== "24 Hours") ? (formData.operating_hours.split(" - ")[1] || "10:00 PM") : "10:00 PM";
                          setFormData({...formData, operating_hours: `${newOpen} - ${currentClose}`});
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                    >
                      {[
                        "12:00 AM", "1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM",
                        "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
                        "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
                        "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM",
                        "24 Hours"
                      ].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    
                    {formData.operating_hours !== "24 Hours" && (
                      <>
                        <span className="text-gray-500 font-medium hidden sm:inline">to</span>
                        <select
                          value={(formData.operating_hours && formData.operating_hours !== "24 Hours") ? (formData.operating_hours.split(" - ")[1] || "10:00 PM") : "10:00 PM"}
                          onChange={(e) => {
                            const newClose = e.target.value;
                            const currentOpen = (formData.operating_hours && formData.operating_hours !== "24 Hours") ? (formData.operating_hours.split(" - ")[0] || "6:00 AM") : "6:00 AM";
                            setFormData({...formData, operating_hours: `${currentOpen} - ${newClose}`});
                          }}
                          className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                        >
                          {[
                            "12:00 AM", "1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM",
                            "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
                            "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
                            "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"
                          ].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Business & Legal Info */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">3. Business & Legal Information</h2>
              <p className="text-gray-500">Legal classification and documentation for verification.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Parking Establishment Type *</label>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setFormData({...formData, business_type: 'public'})}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${formData.business_type === 'public' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                    >
                      Public / Government
                    </button>
                    <button 
                      onClick={() => setFormData({...formData, business_type: 'private'})}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${formData.business_type === 'private' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                    >
                      Private
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Year Established *</label>
                  <input 
                    type="number" 
                    value={formData.year_established || ''} 
                    onChange={(e) => setFormData({...formData, year_established: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="YYYY"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <label className="text-sm font-semibold">Type of Business Registration *</label>
                <div className="flex bg-gray-100 p-1 rounded-xl max-w-sm">
                  <button 
                    onClick={() => setFormData({...formData, registration_type: 'DTI'})}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${formData.registration_type === 'DTI' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                  >
                    DTI
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, registration_type: 'SEC'})}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${formData.registration_type === 'SEC' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                  >
                    SEC
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Business Registration No. *</label>
                  <input 
                    type="text" 
                    value={formData.business_registration_number || ''} 
                    onChange={(e) => setFormData({...formData, business_registration_number: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Registration Number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tax Identification Number (TIN) *</label>
                  <input 
                    type="text" 
                    value={formData.tin || ''} 
                    onChange={(e) => setFormData({...formData, tin: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="000-000-000-000"
                  />
                </div>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-semibold">Business Documents</h3>
                <p className="text-sm text-gray-500">Please upload clear copies of the following documents. (PDF, JPG, PNG)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderUploadBox('dti_sec_registration', 'DTI/SEC REGISTRATION', false)}
                  {renderUploadBox('mayors_permit', "MAYOR'S PERMIT", false)}
                  {renderUploadBox('other_documents', 'OTHER SUPPORTING ATTACHMENTS', true)}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">4. Review & Submit</h2>
              <p className="text-gray-500">Review your application details before submitting.</p>
              
              <div className="bg-gray-50 rounded-xl p-5 border text-sm space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-gray-500 font-medium">Representative:</span>
                  <span className="font-semibold">{formData.rep_first_name} {formData.rep_last_name}</span>
                  
                  <span className="text-gray-500 font-medium">Contact:</span>
                  <span className="font-semibold">{formData.rep_contact_number}</span>
                  
                  <span className="text-gray-500 font-medium">Email:</span>
                  <span className="font-semibold">{formData.rep_email}</span>
                </div>
                <hr className="border-gray-200" />
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-gray-500 font-medium">Establishment:</span>
                  <span className="font-semibold">{formData.establishment_name}</span>
                  
                  <span className="text-gray-500 font-medium">Address:</span>
                  <span className="font-semibold">{formData.establishment_address}, {formData.establishment_city} {formData.establishment_zip}</span>
                  
                  <span className="text-gray-500 font-medium">Capacity / Hours:</span>
                  <span className="font-semibold">{formData.total_capacity} Slots / {formData.operating_hours}</span>
                </div>
                <hr className="border-gray-200" />
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-gray-500 font-medium">Type:</span>
                  <span className="font-semibold capitalize">{formData.business_type}</span>
                  
                  <span className="text-gray-500 font-medium">Registration:</span>
                  <span className="font-semibold">{formData.registration_type} ({formData.business_registration_number})</span>
                  
                  <span className="text-gray-500 font-medium">TIN:</span>
                  <span className="font-semibold">{formData.tin}</span>
                </div>
                <hr className="border-gray-200" />
                <div>
                  <span className="text-gray-500 font-medium block mb-2">Uploaded Documents:</span>
                  <ul className="list-disc list-inside text-gray-700">
                    {formData.documents?.valid_id ? <li className="text-green-600">Valid ID 1 ✓</li> : <li className="text-red-500">Valid ID 1 (Missing)</li>}
                    {formData.documents?.valid_id_2 && <li className="text-green-600">Valid ID 2 ✓</li>}
                    {formData.documents?.dti_sec_registration ? <li className="text-green-600">DTI/SEC Registration ✓</li> : <li className="text-red-500">DTI/SEC Registration (Missing)</li>}
                    {formData.documents?.mayors_permit ? <li className="text-green-600">Mayor's Permit ✓</li> : <li className="text-red-500">Mayor's Permit (Missing)</li>}
                    {formData.documents?.other_documents && <li className="text-green-600">Other Attachments ✓</li>}
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mt-6">
                <h3 className="font-bold text-blue-900 mb-2">Terms and Conditions</h3>
                <p className="text-sm text-blue-800 mb-4 h-32 overflow-y-auto pr-2 bg-white/50 p-3 rounded-lg border border-blue-100">
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
                  <span className="text-sm font-medium text-blue-900 leading-snug">
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

            {currentStep < 4 ? (
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
