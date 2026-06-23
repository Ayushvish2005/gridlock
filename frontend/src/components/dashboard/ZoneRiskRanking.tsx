"use client"
import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, SlidersHorizontal, ArrowUpDown, Download, TrendingDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ZoneRisk {
  zone: string;
  risk_score: number;
  active_incidents: number;
  rank: number;
  trend?: string;
  avg_impact_score?: number;
  avg_resolution_time_hrs?: number;
  road_closures?: number;
}

function getRiskColor(score: number): { text: string; stroke: string; bg: string; border: string; pill: string } {
  if (score >= 80) return { text: 'text-rose-600', stroke: '#e11d48', bg: 'bg-rose-50', border: 'border-rose-100', pill: 'bg-rose-50 text-rose-600 border-rose-200' };
  if (score >= 60) return { text: 'text-orange-600', stroke: '#f97316', bg: 'bg-orange-50', border: 'border-orange-100', pill: 'bg-orange-50 text-orange-600 border-orange-200' };
  if (score >= 40) return { text: 'text-amber-600', stroke: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-100', pill: 'bg-amber-50 text-amber-600 border-amber-200' };
  return { text: 'text-emerald-600', stroke: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-100', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
}

function getRiskLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function RiskRing({ score, stroke, text }: { score: number; stroke: string; text: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const off = c * (1 - pct / 100);
  return (
    <div className="relative w-[56px] h-[56px] flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#eef2f7" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-bold ${text} leading-none`}>{Math.round(score)}</span>
        <span className="text-[7px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">Risk</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-sm font-bold text-slate-800 leading-none">{value}</span>
      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 mt-1">{label}</span>
    </div>
  );
}

export function ZoneRiskRanking() {
  const [zones, setZones] = useState<ZoneRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/zone-risk-ranking`);
      if (!res.ok) throw new Error('Failed to fetch zone risk data');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.zones || data.data || [];
      setZones(list);
      setError(null);
    } catch (err) {
      console.error('Zone risk fetch error:', err);
      setError('Unable to load zone risk data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 30000);
    return () => clearInterval(interval);
  }, [fetchZones]);

  const exportCsv = () => {
    if (zones.length === 0) return;
    const headers = ['rank', 'zone', 'risk_score', 'active_incidents', 'avg_resolution_time_hrs', 'avg_impact_score', 'road_closures'];
    const rows = zones.map((z, i) => [i + 1, z.zone, z.risk_score, z.active_incidents, z.avg_resolution_time_hrs ?? 0, z.avg_impact_score ?? 0, z.road_closures ?? 0]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zone-risk-ranking.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sorted = [...zones].sort((a, b) => sortAsc ? a.risk_score - b.risk_score : b.risk_score - a.risk_score);

  // City-wide aggregate (matches reference summary block)
  const agg = zones.length > 0 ? {
    avgRes: (zones.reduce((s, z) => s + (z.avg_resolution_time_hrs ?? 0), 0) / zones.length).toFixed(1),
    impact: (zones.reduce((s, z) => s + (z.avg_impact_score ?? 0), 0) / zones.length).toFixed(1),
    closures: zones.reduce((s, z) => s + (z.road_closures ?? 0), 0),
    incidents: zones.reduce((s, z) => s + (z.active_incidents ?? 0), 0),
  } : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Zone Risk Ranking</h3>
          <p className="text-xs text-slate-400 mt-0.5">Real-time city risk assessment</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button title="Filter" className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button title="Sort by risk" onClick={() => setSortAsc(s => !s)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 light-scrollbar">
        {/* Aggregate summary */}
        {agg && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Avg Res" value={`${agg.avgRes}h`} />
              <Stat label="Impact" value={agg.impact} />
              <Stat label="Closures" value={agg.closures} />
              <Stat label="Incidents" value={agg.incidents} />
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-200/70">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-400">City-wide assessment · live</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="loading-dot w-2 h-2 rounded-full bg-indigo-400"></span>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-xs text-slate-400">No zone data available</p>
          </div>
        ) : (
          sorted.map((zone, i) => {
            const colors = getRiskColor(zone.risk_score);
            const label = getRiskLabel(zone.risk_score);
            return (
              <div
                key={zone.zone || i}
                className="rounded-xl border border-slate-200 bg-white p-3.5 animate-fade-in-up transition-all duration-200 hover:shadow-md hover:border-slate-300"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{zone.zone}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors.pill}`}>
                          {label}
                        </span>
                        {zone.active_incidents > 0 && (
                          <span className="text-[10px] font-medium text-slate-400">
                            {zone.active_incidents} incident{zone.active_incidents !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <RiskRing score={zone.risk_score} stroke={colors.stroke} text={colors.text} />
                </div>

                <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                  <Stat label="Avg Res" value={`${zone.avg_resolution_time_hrs || 0}h`} />
                  <Stat label="Impact" value={zone.avg_impact_score || 0} />
                  <Stat label="Closures" value={zone.road_closures || 0} />
                  <Stat label="Incidents" value={zone.active_incidents || 0} />
                </div>

                {zone.trend && (
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] font-medium text-slate-400">{zone.trend}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
