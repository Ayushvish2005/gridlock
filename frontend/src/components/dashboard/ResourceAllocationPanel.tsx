"use client"
import { useEffect, useState, useCallback } from 'react';
import { Users, Server, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Incident {
  id: string;
  zone: string;
  event_cause: string;
  impact_score: number;
}

interface AllocationResult {
  [incidentId: string]: number;
}

export function ResourceAllocationPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [allocation, setAllocation] = useState<AllocationResult>({});
  const [loading, setLoading] = useState(true);
  const [maxOfficers, setMaxOfficers] = useState(150);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, allocRes] = await Promise.all([
        fetch(`${API_BASE}/incidents?status=ACTIVE`),
        fetch(`${API_BASE}/analytics/resource-allocation?max_officers=${maxOfficers}`)
      ]);
      if (incRes.ok && allocRes.ok) {
        const incData = await incRes.json();
        const allocData = await allocRes.json();
        setIncidents(incData);
        setAllocation(allocData.allocation || {});
      }
    } catch (err) {
      console.error('Resource allocation fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [maxOfficers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalAllocated = Object.values(allocation).reduce((a, b) => a + b, 0);

  return (
    <div className="glass rounded-xl border border-slate-700/50 flex flex-col h-full animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Global Resource Optimizer</h3>
            <p className="text-xs text-slate-500">PuLP-based LP Officer Allocation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total Pool:</span>
            <input 
              type="number" 
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 w-16 text-center focus:outline-none focus:border-blue-500"
              value={maxOfficers}
              onChange={(e) => setMaxOfficers(parseInt(e.target.value) || 0)}
              onBlur={fetchData}
            />
          </div>
          <button onClick={fetchData} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            ↻
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-slate-900/40 border border-slate-800">
           <div className="flex flex-col">
             <span className="text-xs text-slate-400 uppercase tracking-wider">Allocated</span>
             <span className="text-lg font-bold text-blue-400">{totalAllocated} / {maxOfficers}</span>
           </div>
           <div className="flex flex-col text-right">
             <span className="text-xs text-slate-400 uppercase tracking-wider">Incidents</span>
             <span className="text-lg font-bold text-slate-200">{incidents.length}</span>
           </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
             <span className="loading-dot w-2 h-2 rounded-full bg-blue-400"></span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <p className="text-xs text-slate-500">No active incidents to optimize</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0)).map((inc) => {
               const assigned = allocation[inc.id] || 0;
               const pct = maxOfficers > 0 ? (assigned / maxOfficers) * 100 : 0;
               return (
                 <div key={inc.id} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                   <div className="flex justify-between items-center mb-2">
                     <div>
                       <div className="text-sm font-semibold text-slate-200">{inc.event_cause || 'Incident'}</div>
                       <div className="text-[10px] text-slate-500">{inc.zone || 'Unknown Zone'} • Impact: {inc.impact_score}</div>
                     </div>
                     <div className="flex items-center gap-1">
                       <Users className="w-3 h-3 text-blue-400" />
                       <span className="font-bold text-blue-400 text-lg">{assigned}</span>
                     </div>
                   </div>
                   <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
                     <div
                       className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out"
                       style={{ width: `${pct}%` }}
                     />
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
