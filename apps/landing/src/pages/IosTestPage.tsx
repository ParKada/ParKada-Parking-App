import { ArrowLeft, Download, QrCode, AlertCircle } from "lucide-react";

export default function IosTestPage() {
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
            Test on iOS
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto pb-20 text-slate-700 space-y-8">
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Step 1: Install Expo Go</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              To test the ParKada app on your iPhone, you need the <strong>Expo Go</strong> app. You can download it directly from the App Store.
            </p>
            <a 
              href="https://apps.apple.com/app/expo-go/id982107779"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 bg-slate-900 text-white font-medium px-6 py-2.5 rounded-full text-sm hover:bg-slate-800 transition-colors"
            >
              Download Expo Go
            </a>
          </div>

          <hr className="border-slate-100" />

          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Step 2: Scan the QR Code</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Open your iPhone's standard <strong>Camera app</strong> and scan the QR code provided by the ParKada developer team. A prompt will appear at the top of your screen to open the app in Expo Go.
            </p>
            
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex gap-3 items-start">
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">Important Note About QR Codes</p>
                <p>
                  Because we are currently running the app through a local tunnel, <strong>the QR code changes every time the development server is restarted</strong>. You cannot use an old QR code if the tunnel was closed. Please ask the developer for the latest active QR code.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 pb-4 text-center">
            <p className="text-xs text-slate-400">© 2026 ParKada. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
