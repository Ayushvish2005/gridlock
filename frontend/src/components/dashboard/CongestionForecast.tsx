"use client"
import { useState } from 'react';
import { Activity, Clock, AlertTriangle, ChevronRight, Gauge } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const EVENT_CAUSES = [
  { value: 'accident', label: 'Accident' },
  { value: 'concert', label: 'Concert' },
  { value: 'festival', label: 'Festival' },
  { value: 'sports', label: 'Sports Match' },
  { value: 'protest', label: 'Protest' },
  { value: 'construction', label: 'Construction' },
  { value: 'vip_movement', label: 'VIP Movement' },
  { value: 'congestion', label: 'Severe Congestion' },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
];

const ZONES = ['Central', 'North', 'South', 'East', 'West'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

interface ForecastResult {
  congestion_score?: number;
  severity?: string;
  peak_window?: string;
  clearance_time?: string;
  confidence?: number;
  recommended_actions?: string[];
  [key: string]: any;
}

function getSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical': return { text: 'text-red-400', glow: 'shadow-red-500/30', ring: 'border-red-500', score: 'text-red-400', bg: 'from-red-500/20' };
    case 'high': return { text: 'text-orange-400', glow: 'shadow-orange-500/30', ring: 'border-orange-500', score: 'text-orange-400', bg: 'from-orange-500/20' };
    case 'medium': return { text: 'text-yellow-400', glow: 'shadow-yellow-500/30', ring: 'border-yellow-400', score: 'text-yellow-400', bg: 'from-yellow-500/20' };
    default: return { text: 'text-green-400', glow: 'shadow-green-500/30', ring: 'border-green-500', score: 'text-green-400', bg: 'from-green-500/20' };
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 40) return '#eab308';
  return '#22c55e';
}

// SVG Arc Gauge
function GaugeDisplay({ score, severity }: { score: number; severity: string }) {
  const normalizedScore = Math.min(100, Math.max(0, score));
  const strokeColor = getScoreColor(normalizedScore);
  
  // Arc path calculation (180-degree arc)
  const radius = 54;
  const cx = 80;
  const cy = 80;
  const circumference = Math.PI * radius; // half circle
  const progress = (normalizedScore / 100) * circumference;
  
  // Convert to SVG arc
  const startAngle = -180;
  const endAngle = 0;
  const angle = startAngle + (normalizedScore / 100) * 180;
  
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleDeg: number) => {
    const angleRad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: centerX + r * Math.cos(angleRad),
      y: centerY + r * Math.sin(angleRad),
    };
  };

  const describeArc = (x: number, y: number, r: number, startAngleDeg: number, endAngleDeg: number) => {
    const start = polarToCartesian(x, y, r, endAngleDeg);
    const end = polarToCartesian(x, y, r, startAngleDeg);
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const bgArc = describeArc(cx, cy, radius, -180, 0);
  const fgArc = describeArc(cx, cy, radius, -180, -180 + (normalizedScore / 100) * 180);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="160" height="100" viewBox="0 0 160 100">
          {/* Background arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="rgba(51,65,85,0.8)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Glow effect */}
          <path
            d={fgArc}
            fill="none"
            stroke={strokeColor}
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.2"
            style={{ filter: `blur(4px)` }}
          />
          {/* Foreground arc */}
          <path
            d={fgArc}
            fill="none"
            stroke={strokeColor}
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Needle indicator */}
          {(() => {
            const needleAngle = -180 + (normalizedScore / 100) * 180;
            const needleTip = polarToCartesian(cx, cy, radius - 2, needleAngle);
            return (
              <circle cx={needleTip.x} cy={needleTip.y} r="5" fill={strokeColor} style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }} />
            );
          })()}
          {/* Center score */}
          <text x={cx} y={cy + 10} textAnchor="middle" fill={strokeColor} fontSize="22" fontWeight="800" fontFamily="Inter, sans-serif">
            {normalizedScore.toFixed(0)}
          </text>
          <text x={cx} y={cx - 10} textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="9" fontFamily="Inter, sans-serif">
            /100
          </text>
        </svg>
        {/* Labels */}
        <div className="flex justify-between text-[9px] text-slate-600 -mt-2 px-3">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
      <div className="mt-1 text-center">
        <span className={`text-lg font-bold ${getSeverityColor(severity).text}`}>{severity}</span>
        <p className="text-xs text-slate-500 mt-0.5">Congestion Severity</p>
      </div>
    </div>
  );
}

export function CongestionForecast() {
  const [form, setForm] = useState({
    event_cause: 'concert',
    zone: 'Central',
    start_datetime: new Date().toISOString().slice(0, 16),
    priority: 'High',
    expected_attendance: '',
    requires_road_closure: 'true',
  });
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        event_type: 'planned',
        event_cause: form.event_cause,
        zone: form.zone,
        start_datetime: form.start_datetime,
        priority: form.priority,
        requires_road_closure: form.requires_road_closure,
        ...(form.expected_attendance ? { expected_attendance: form.expected_attendance } : {}),
      });
      const res = await fetch(`${API_BASE}/analytics/forecast?${params}`);
      if (!res.ok) throw new Error('Forecast failed');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed to generate forecast. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder-slate-600";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="glass rounded-xl border border-slate-700/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Gauge className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Congestion Forecast</h3>
          <p className="text-xs text-slate-500">AI-powered traffic impact prediction</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Event Cause</label>
              <select className={inputCls} value={form.event_cause} onChange={e => setForm({ ...form, event_cause: e.target.value })}>
                {EVENT_CAUSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Zone</label>
              <select className={inputCls} value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Road Closure</label>
              <select className={inputCls} value={form.requires_road_closure} onChange={e => setForm({ ...form, requires_road_closure: e.target.value })}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Event Date & Time</label>
              <input type="datetime-local" className={inputCls} value={form.start_datetime} onChange={e => setForm({ ...form, start_datetime: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Expected Attendance</label>
              <input type="number" placeholder="e.g. 50000" className={inputCls} value={form.expected_attendance} onChange={e => setForm({ ...form, expected_attendance: e.target.value })} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {loading ? (
              <>
                <div className="flex gap-1">
                  {[0,1,2].map(i => <span key={i} className="loading-dot w-1.5 h-1.5 rounded-full bg-white"></span>)}
                </div>
                Forecasting...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Generate Forecast
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="mt-5 space-y-4 animate-fade-in-up">
            {/* Gauge */}
            <div className="flex justify-center p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
              <GaugeDisplay
                score={result.congestion_risk_score ?? result.congestion_score ?? result.impact_score ?? result.risk_score ?? 0}
                severity={result.severity_prediction ?? result.severity ?? 'Unknown'}
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              {(result.peak_congestion_window || result.peak_window) && (
                <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Peak Window</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-200">{result.peak_congestion_window || result.peak_window}</span>
                </div>
              )}
              {(result.expected_clearance_time || result.clearance_time) && (
                <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ChevronRight className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Clearance</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-200">{result.expected_clearance_time || result.clearance_time}</span>
                </div>
              )}
              {result.confidence !== undefined && (
                <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Confidence</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-200">{(result.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>

            {/* Recommended Actions */}
            {result.recommended_actions && result.recommended_actions.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</p>
                <ul className="space-y-1">
                  {result.recommended_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
