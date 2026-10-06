import { ShieldAlert } from "lucide-react";

export default function DeviceManagement() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-8 flex items-center gap-2 border border-red-200">
        <ShieldAlert className="w-4 h-4" />
        OWNER ONLY
      </div>
      
      <h1 className="text-3xl font-light text-slate-800 mb-4">DEVICE MANAGEMENT & MONITORING</h1>
      
      <p className="text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
        This is a privileged administrative control plane. You have successfully authenticated 
        as the AIMS Owner. From here, you will be able to manage devices, view telemetry, 
        execute remote actions, and configure compliance policies.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto w-full text-left">
        {['Device Overview', 'Device Health', 'Live Status', 'Network', 'Wi-Fi', 'Telemetry', 'Compliance', 'Policies', 'Remote Actions', 'Bulk Actions', 'Command History', 'Device Audit', 'AI Workforce Controls'].map((feature) => (
          <div key={feature} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
             <span className="text-slate-700 font-medium">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
