"use client"
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';

const IncidentMapClient = dynamic(() => import('./IncidentMapClient'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-slate-400">Loading map tiles...</div>
});

export function IncidentMap({ incidents, simResult, selectedLocation, onMapClick }: { incidents: any[], simResult?: any, selectedLocation?: {lat: number, lng: number} | null, onMapClick?: (lat: number, lng: number) => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIncidents, setShowIncidents] = useState(true);

  return (
    <div className={`transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[1000] bg-[#0a0f1e]/90 backdrop-blur-sm p-4 md:p-8' : 'w-full h-full relative z-0'}`}>
      <div className={`relative w-full h-full ${isFullscreen ? 'rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-slate-800' : ''}`}>
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className="bg-slate-900/80 backdrop-blur-md p-2.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors shadow-xl group cursor-pointer"
            title={showIncidents ? "Hide Active Incidents" : "Show Active Incidents"}
          >
            {showIncidents ? (
              <Eye className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
            ) : (
              <EyeOff className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
            )}
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-slate-900/80 backdrop-blur-md p-2.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors shadow-xl group cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-slate-300 group-hover:text-white" />
            ) : (
              <Maximize2 className="w-5 h-5 text-slate-300 group-hover:text-white" />
            )}
          </button>
        </div>
        <IncidentMapClient incidents={showIncidents ? incidents : []} simResult={simResult} selectedLocation={selectedLocation} onMapClick={onMapClick} />
      </div>
    </div>
  );
}
export default IncidentMap;
