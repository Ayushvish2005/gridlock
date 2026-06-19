"use client"
import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, AlertCircle, Trophy, Flame } from 'lucide-react';

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

function getRiskColor(score: number): { bar: string; text: string; bg: string; border: string } {
  if (score >= 80) return { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  if (score >= 60) return { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  if (score >= 40) return { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  return { bar: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
}

function getRiskLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function ZoneRiskRanking() {
  const [zones, setZones] = useState<ZoneRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="glass rounded-xl border border-slate-700/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Zone Risk Ranking</h3>
            <p className="text-xs text-slate-500">Sorted by risk score</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-xs text-slate-400">{zones.length} zones</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="loading-dot w-2 h-2 rounded-full bg-blue-400"></span>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-xs text-slate-500">No zone data available</p>
          </div>
        ) : (
          zones.map((zone, i) => {
            const colors = getRiskColor(zone.risk_score);
            const label = getRiskLabel(zone.risk_score);
            const pct = Math.min(100, Math.max(0, zone.risk_score));
            return (
              <div
                key={zone.zone || i}
                className={`p-3 rounded-lg ${colors.bg} border ${colors.border} animate-fade-in-up transition-all duration-200 hover:scale-[1.01]`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{i < 3 ? MEDALS[i] : `#${i + 1}`}</span>
                    <span className="text-sm font-semibold text-slate-200">{zone.zone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {zone.active_incidents > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 text-[10px] font-medium border border-slate-600/40">
                        {zone.active_incidents} incident{zone.active_incidents !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {label}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative">
                  <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-slate-500">Risk</span>
                    <span className={`text-xs font-bold ${colors.text}`}>{zone.risk_score.toFixed(0)}/100</span>
                  </div>
                </div>

                {/* Extra Stats */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700/30">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Avg Res</span>
                    <span className="text-xs font-semibold text-slate-300">{zone.avg_resolution_time_hrs || 0} hrs</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Avg Impact</span>
                    <span className="text-xs font-semibold text-slate-300">{zone.avg_impact_score || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Closures</span>
                    <span className="text-xs font-semibold text-slate-300">{zone.road_closures || 0}</span>
                  </div>
                </div>

                {zone.trend && (
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] text-slate-500">{zone.trend}</span>
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
