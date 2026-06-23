"use client"
import { useEffect, useState, useCallback } from 'react';
import { Users, Server, AlertCircle, RotateCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

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
    <Card className="flex flex-col h-full animate-fade-in-up shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Global Resource Optimizer</h3>
            <p className="text-xs text-slate-400">PuLP-based LP Officer Allocation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total Pool:</span>
            <input
              type="number"
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 w-16 text-center focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              value={maxOfficers}
              onChange={(e) => setMaxOfficers(parseInt(e.target.value) || 0)}
              onBlur={fetchData}
            />
          </div>
          <button onClick={fetchData} className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 light-scrollbar">
        <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
           <div className="flex flex-col">
             <span className="text-xs text-slate-500 uppercase tracking-wider">Allocated</span>
             <span className="text-lg font-bold text-blue-600">{totalAllocated} / {maxOfficers}</span>
           </div>
           <div className="flex flex-col text-right">
             <span className="text-xs text-slate-500 uppercase tracking-wider">Incidents</span>
             <span className="text-lg font-bold text-slate-800">{incidents.length}</span>
           </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
             <div className="flex gap-1.5">
               {[0, 1, 2].map(i => (
                 <span key={i} className="loading-dot w-2 h-2 rounded-full bg-indigo-400"></span>
               ))}
             </div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <p className="text-xs text-slate-400">No active incidents to optimize</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0)).map((inc) => {
               const assigned = allocation[inc.id] || 0;
               const pct = maxOfficers > 0 ? (assigned / maxOfficers) * 100 : 0;
               return (
                 <div key={inc.id} className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                   <div className="flex justify-between items-center mb-2">
                     <div>
                       <div className="text-sm font-semibold text-slate-800">{inc.event_cause || 'Incident'}</div>
                       <div className="text-[10px] text-slate-400">{inc.zone || 'Unknown Zone'} • Impact: {inc.impact_score}</div>
                     </div>
                     <div className="flex items-center gap-1">
                       <Users className="w-3 h-3 text-blue-500" />
                       <span className="font-bold text-blue-600 text-lg">{assigned}</span>
                     </div>
                   </div>
                   <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
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
    </Card>
  );
}
