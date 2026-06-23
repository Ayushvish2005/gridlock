"use client"
import { useState } from 'react';
import { GitCompare, AlertTriangle, Users, Shield, TrendingUp, TrendingDown } from 'lucide-react';

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
];

const ZONES = ['Central', 'North', 'South', 'East', 'West'];

interface WhatIfResult {
  scenario_a?: ScenarioData;
  scenario_b?: ScenarioData;
  [key: string]: any;
}

interface ScenarioData {
  risk_score?: number;
  impact_score?: number;
  severity?: string;
  officers_required?: number;
  barricades_required?: number;
  clearance_time?: string;
  [key: string]: any;
}

function getSeverityClass(sev: string) {
  switch (sev?.toLowerCase()) {
    case 'critical': return 'text-red-700 bg-red-50 border-red-200';
    case 'high': return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    default: return 'text-green-700 bg-green-50 border-green-200';
  }
}

function CompareValue({ a, b, label, icon: Icon, format }: {
  a: number | string | undefined;
  b: number | string | undefined;
  label: string;
  icon: any;
  format?: (v: number | string) => string;
}) {
  const aNum = typeof a === 'number' ? a : parseFloat(String(a || 0));
  const bNum = typeof b === 'number' ? b : parseFloat(String(b || 0));
  const aHigher = aNum > bNum;
  const diff = Math.abs(aNum - bNum);

  const fmt = format || ((v: number | string) => String(v));

  return (
    <div className="grid grid-cols-3 gap-2 items-center py-2.5 border-b border-slate-200 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <div className={`text-center text-sm font-bold ${aHigher && a !== b ? 'text-red-600' : 'text-slate-800'}`}>
        {a !== undefined ? fmt(a) : '—'}
        {aHigher && a !== b && diff > 0 && (
          <TrendingUp className="w-3 h-3 text-red-600 inline ml-1" />
        )}
        {!aHigher && a !== b && diff > 0 && (
          <TrendingDown className="w-3 h-3 text-green-600 inline ml-1" />
        )}
      </div>
      <div className={`text-center text-sm font-bold ${!aHigher && a !== b ? 'text-red-600' : 'text-slate-800'}`}>
        {b !== undefined ? fmt(b) : '—'}
        {!aHigher && a !== b && diff > 0 && (
          <TrendingUp className="w-3 h-3 text-red-600 inline ml-1" />
        )}
        {aHigher && a !== b && diff > 0 && (
          <TrendingDown className="w-3 h-3 text-green-600 inline ml-1" />
        )}
      </div>
    </div>
  );
}

export function WhatIfSimulator() {
  const [form, setForm] = useState({
    event_cause: 'concert',
    zone: 'Central',
    start_datetime: new Date().toISOString().slice(0, 16),
    attendance_a: '5000',
    attendance_b: '20000',
  });
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        event_cause: form.event_cause,
        zone: form.zone,
        attendance_a: form.attendance_a,
        attendance_b: form.attendance_b,
        start_datetime: form.start_datetime,
      });
      const res = await fetch(`${API_BASE}/analytics/what-if-compare?${params}`);
      if (!res.ok) throw new Error('Comparison failed');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed to run comparison. Please check inputs and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all placeholder-slate-400";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

  const scA: ScenarioData = result?.scenario_a || result?.a || {};
  const scB: ScenarioData = result?.scenario_b || result?.b || {};

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
          <GitCompare className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">What-If Comparator</h3>
          <p className="text-xs text-slate-500">Compare two attendance scenarios side-by-side</p>
        </div>
      </div>

      <div className="p-5">
        <form onSubmit={handleCompare}>
          {/* Shared params */}
          <div className="grid grid-cols-3 gap-3 mb-4">
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
              <label className={labelCls}>Event Date & Time</label>
              <input type="datetime-local" className={inputCls} value={form.start_datetime} onChange={e => setForm({ ...form, start_datetime: e.target.value })} />
            </div>
          </div>

          {/* Scenario attendance side by side */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-blue-700">A</span>
                </div>
                <span className="text-xs font-semibold text-blue-700">Scenario A</span>
              </div>
              <label className={labelCls}>Attendance</label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 5000"
                value={form.attendance_a}
                onChange={e => setForm({ ...form, attendance_a: e.target.value })}
              />
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-purple-700">B</span>
                </div>
                <span className="text-xs font-semibold text-purple-700">Scenario B</span>
              </div>
              <label className={labelCls}>Attendance</label>
              <input
                type="number"
                className={inputCls}
                placeholder="e.g. 20000"
                value={form.attendance_b}
                onChange={e => setForm({ ...form, attendance_b: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-sm font-semibold disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {loading ? (
              <>
                <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="loading-dot w-1.5 h-1.5 rounded-full bg-white"></span>)}</div>
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4" />
                Run Comparison
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="mt-5 animate-fade-in-up">
            {/* Column headers */}
            <div className="grid grid-cols-3 gap-2 mb-2 px-1">
              <div></div>
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-semibold text-blue-700">Scenario A</span>
                  <span className="text-[10px] text-slate-500">({parseInt(form.attendance_a).toLocaleString()})</span>
                </div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-xs font-semibold text-purple-700">Scenario B</span>
                  <span className="text-[10px] text-slate-500">({parseInt(form.attendance_b).toLocaleString()})</span>
                </div>
              </div>
            </div>

            {/* Comparison table */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <CompareValue
                a={scA.risk_score ?? scA.impact_score}
                b={scB.risk_score ?? scB.impact_score}
                label="Risk Score"
                icon={TrendingUp}
                format={v => `${parseFloat(String(v)).toFixed(1)}/100`}
              />
              <CompareValue
                a={scA.severity}
                b={scB.severity}
                label="Severity"
                icon={AlertTriangle}
                format={v => String(v)}
              />
              <CompareValue
                a={scA.officers_required ?? scA.officers}
                b={scB.officers_required ?? scB.officers}
                label="Officers"
                icon={Users}
                format={v => String(v)}
              />
              <CompareValue
                a={scA.barricades_required ?? scA.barricades}
                b={scB.barricades_required ?? scB.barricades}
                label="Barricades"
                icon={Shield}
                format={v => String(v)}
              />
            </div>

            {/* Severity badges */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getSeverityClass(scA.severity || '')}`}>
                  {scA.severity || 'N/A'}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getSeverityClass(scB.severity || '')}`}>
                  {scB.severity || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
