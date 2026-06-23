"use client"
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Maximize2, Minimize2, Eye, EyeOff, Search, MapPin } from 'lucide-react';

const IncidentMapClient = dynamic(() => import('./IncidentMapClient'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-slate-400">Loading map tiles...</div>
});

export function IncidentMap({ incidents, simResult, selectedLocation, onMapClick, light = false }: { incidents: any[], simResult?: any, selectedLocation?: {lat: number, lng: number} | null, onMapClick?: (lat: number, lng: number) => void, light?: boolean }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIncidents, setShowIncidents] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Bangalore')}&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Search failed", err);
    }
    setIsSearching(false);
  };

  useEffect(() => {
    // When entering/exiting fullscreen, the container size changes.
    // We need to trigger a window resize event so the Mappls map recalculates its tiles.
    // Wait for the CSS transition (300ms) to finish first.
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 350);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // ---- LIGHT VARIANT (reference command-center design) ----
  if (light) {
    return (
      <div className={`transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[1000] bg-white p-4 md:p-8' : 'relative w-full h-full'}`}>
        <div className={`relative w-full h-full overflow-hidden ${isFullscreen ? 'rounded-2xl border border-slate-200 shadow-2xl' : 'rounded-2xl'}`}>
          <IncidentMapClient incidents={showIncidents ? incidents : []} simResult={simResult} selectedLocation={selectedLocation} onMapClick={onMapClick} />

          {/* Floating controls — top right */}
          <div className="absolute top-4 right-4 z-[450] flex items-start gap-2">
            <form onSubmit={handleSearch} className="relative hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search location…"
                  className="w-56 bg-white/95 backdrop-blur border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden">
                  {searchResults.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (onMapClick) onMapClick(parseFloat(res.lat), parseFloat(res.lon));
                        setSearchResults([]);
                        setSearchQuery(res.display_name.split(',')[0]);
                      }}
                      className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex items-start gap-2.5"
                    >
                      <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate">{res.display_name.split(',')[0]}</span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{res.display_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowIncidents(!showIncidents)}
                title={showIncidents ? "Hide Active Incidents" : "Show Active Incidents"}
                className="w-9 h-9 flex items-center justify-center bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
              >
                {showIncidents ? <Eye className="w-4 h-4 text-indigo-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                className="w-9 h-9 flex items-center justify-center bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-slate-600" /> : <Maximize2 className="w-4 h-4 text-slate-600" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- DARK VARIANT (original) ----
  return (
    <div className={`transition-all duration-300 flex flex-col gap-3 ${isFullscreen ? 'fixed inset-0 z-[1000] bg-[#050814]/95 backdrop-blur-md p-4 md:p-8' : 'w-full h-full relative z-0'}`}>
      <div className={`relative w-full flex-1 ${isFullscreen ? 'rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-slate-800' : 'rounded-xl overflow-hidden'}`}>
        <IncidentMapClient incidents={showIncidents ? incidents : []} simResult={simResult} selectedLocation={selectedLocation} onMapClick={onMapClick} />
      </div>

      {/* Controls Below Map */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">

        {/* Search Bar */}
        <div className="relative w-full md:w-96 z-[400]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search location in Bangalore..."
                className="w-full bg-slate-900/90 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-xl"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg shadow-xl transition-colors disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="absolute bottom-full mb-2 w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-lg shadow-2xl max-h-60 overflow-y-auto overflow-hidden">
              {searchResults.map((res: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (onMapClick) onMapClick(parseFloat(res.lat), parseFloat(res.lon));
                    setSearchResults([]);
                    setSearchQuery(res.display_name.split(',')[0]);
                  }}
                  className="px-4 py-3 hover:bg-slate-800/80 cursor-pointer border-b border-slate-800/50 last:border-0 transition-colors flex items-start gap-3"
                >
                  <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-200">{res.display_name.split(',')[0]}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{res.display_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors shadow-xl group cursor-pointer flex items-center gap-2 text-sm text-slate-300"
            title={showIncidents ? "Hide Active Incidents" : "Show Active Incidents"}
          >
            {showIncidents ? (
              <><Eye className="w-4 h-4 text-blue-400" /> <span className="hidden sm:inline">Hide Incidents</span></>
            ) : (
              <><EyeOff className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Show Incidents</span></>
            )}
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors shadow-xl group cursor-pointer flex items-center gap-2 text-sm text-slate-300"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <><Minimize2 className="w-4 h-4 text-slate-300" /> <span className="hidden sm:inline">Exit Fullscreen</span></>
            ) : (
              <><Maximize2 className="w-4 h-4 text-slate-300" /> <span className="hidden sm:inline">Fullscreen</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
export default IncidentMap;
