import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Save } from 'lucide-react';

export default function ApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otherDocsCount, setOtherDocsCount] = useState(1);
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
    // Validate email if on step 1
    if (currentStep === 1) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.rep_email || !emailRegex.test(formData.rep_email)) {
        toast.error("Please enter a valid Official Email Address.");
        return;
      }
    }
    
    // Validate ID if moving from step 1
    if (currentStep === 1 && !formData.documents?.valid_id) {
      toast.error("Valid ID 1 is required to proceed.");
      return;
    }

    saveDraft(formData);
    setCurrentStep((prev) => Math.min(prev + 1, 4));
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };
  
  const handleSubmitFinal = async () => {
    if (!applicationId || isSubmitting) return;
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUploadBox = (docKey: string, label: string, isOptional: boolean = false) => (
    <div key={docKey} className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors relative overflow-hidden h-32">
       <div className="text-center relative z-10 pointer-events-none">
         <div className="text-sm font-bold uppercase mb-1">{label} {isOptional && <span className="text-gray-400 font-normal lowercase">(optional)</span>}</div>
         <div className="text-xs text-gray-500">Click to upload or drag and drop</div>
       </div>
       
       <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0" onChange={async (e) => {
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
            
            // If this was an "other document" upload, increment the count to show another box
            if (docKey.startsWith('other_documents_')) {
              setOtherDocsCount(prev => prev + 1);
            }
         } catch (err) {
            console.error(err);
             toast.error(`Failed to upload ${label}`);
          }
       }} />

       {formData.documents?.[docKey] && (
         <div className="absolute bottom-2 left-0 w-full flex flex-col items-center justify-center z-20 pointer-events-auto">
           <div className="text-green-600 font-semibold text-sm pointer-events-none">✅ Uploaded</div>
           <a href={formData.documents[docKey]} target="_blank" rel="noreferrer" className="text-blue-500 text-xs hover:underline mt-0.5 bg-gray-50 px-2 rounded" onClick={(e) => e.stopPropagation()}>View File</a>
         </div>
       )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Contact Number *</label>
                  <input 
                    type="tel" 
                    value={formData.rep_contact_number || ''} 
                    onChange={(e) => setFormData({...formData, rep_contact_number: e.target.value.replace(/\D/g, '')})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="e.g. 09123456789"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Home Number (Landline) <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input 
                    type="tel" 
                    value={formData.rep_home_number || ''} 
                    onChange={(e) => setFormData({...formData, rep_home_number: e.target.value.replace(/\D/g, '')})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="e.g. 0281234567"
                  />
                </div>
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
                <label className="text-sm font-semibold">Full Address of the Parking Establishment *</label>
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
                    onChange={(e) => setFormData({...formData, establishment_zip: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="0000"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Total Capacity (Slots) *</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.total_capacity || ''} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val < 0) return;
                      setFormData({...formData, total_capacity: val || ''})
                    }}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Operating Hours *</label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-center gap-2 w-full">
                      <input 
                        type="time" 
                        value={formData.operating_hours === "24 Hours" ? "" : (formData.operating_hours ? (() => {
                          const timeStr = formData.operating_hours.split(" - ")[0] || "6:00 AM";
                          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                          if (!match) return timeStr;
                          let [_, h, m, mod] = match;
                          let hrs = parseInt(h, 10);
                          if (mod.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
                          if (mod.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
                          return `${hrs.toString().padStart(2, '0')}:${m}`;
                        })() : "06:00")}
                        disabled={formData.operating_hours === "24 Hours"}
                        onChange={(e) => {
                          const newOpen = e.target.value;
                          const currentCloseRaw = (formData.operating_hours && formData.operating_hours !== "24 Hours") ? (formData.operating_hours.split(" - ")[1] || "10:00 PM") : "10:00 PM";
                          
                          // Format newOpen
                          const [oh, om] = newOpen.split(':');
                          let ohrs = parseInt(oh, 10);
                          const oMod = ohrs >= 12 ? 'PM' : 'AM';
                          ohrs = ohrs % 12 || 12;
                          const openFormatted = `${ohrs}:${om} ${oMod}`;
                          
                          setFormData({...formData, operating_hours: `${openFormatted} - ${currentCloseRaw}`});
                        }}
                        className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                      />
                      <span className="text-gray-500 font-medium">to</span>
                      <input 
                        type="time" 
                        value={formData.operating_hours === "24 Hours" ? "" : (formData.operating_hours && formData.operating_hours !== "24 Hours" ? (() => {
                          const timeStr = formData.operating_hours.split(" - ")[1] || "10:00 PM";
                          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                          if (!match) return timeStr;
                          let [_, h, m, mod] = match;
                          let hrs = parseInt(h, 10);
                          if (mod.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
                          if (mod.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
                          return `${hrs.toString().padStart(2, '0')}:${m}`;
                        })() : "22:00")}
                        disabled={formData.operating_hours === "24 Hours"}
                        onChange={(e) => {
                          const newClose = e.target.value;
                          const currentOpenRaw = (formData.operating_hours && formData.operating_hours !== "24 Hours") ? (formData.operating_hours.split(" - ")[0] || "6:00 AM") : "6:00 AM";
                          
                          // Format newClose
                          const [ch, cm] = newClose.split(':');
                          let chrs = parseInt(ch, 10);
                          const cMod = chrs >= 12 ? 'PM' : 'AM';
                          chrs = chrs % 12 || 12;
                          const closeFormatted = `${chrs}:${cm} ${cMod}`;
                          
                          setFormData({...formData, operating_hours: `${currentOpenRaw} - ${closeFormatted}`});
                        }}
                        className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 whitespace-nowrap cursor-pointer ml-1">
                      <input 
                        type="checkbox" 
                        checked={formData.operating_hours === "24 Hours"}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, operating_hours: "24 Hours"});
                          } else {
                            setFormData({...formData, operating_hours: "6:00 AM - 10:00 PM"});
                          }
                        }}
                        className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                      />
                      <span className="text-sm font-semibold">24 Hours</span>
                    </label>
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
                    type="text" 
                    value={formData.year_established || ''} 
                    onChange={(e) => setFormData({...formData, year_established: e.target.value.replace(/\D/g, '').slice(0, 4)})}
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
                    onChange={(e) => setFormData({...formData, business_registration_number: e.target.value.replace(/\D/g, '')})}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Registration Number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tax Identification Number (TIN) *</label>
                  <input 
                    type="text" 
                    value={formData.tin || ''} 
                    onChange={(e) => setFormData({...formData, tin: e.target.value.replace(/[^0-9-]/g, '')})}
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
                  {Array.from({ length: otherDocsCount }).map((_, i) => 
                    renderUploadBox(`other_documents_${i + 1}`, `OTHER ATTACHMENT ${i + 1}`, true)
                  )}
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
                disabled={!formData.terms_accepted || isSubmitting}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'} <Save size={18} />
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
