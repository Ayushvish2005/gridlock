"use client"
import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, ShieldAlert, Bell, CheckCircle, Zap, Clock, MapPin } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Alert {
  id: string;
  severity: string;
  message: string;
  zone: string;
  timestamp: string;
  type?: string;
}

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; pulse: string }> = {
  Critical: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
    pulse: 'bg-red-500',
  },
  High: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    pulse: 'bg-orange-500',
  },
  Medium: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: <Zap className="w-4 h-4 text-yellow-400" />,
    pulse: 'bg-yellow-500',
  },
  Low: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: <Bell className="w-4 h-4 text-blue-400" />,
    pulse: 'bg-blue-500',
  },
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return ts;
  }
}

function formatRelative(ts: string) {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  } catch {
    return '';
  }
}

const severityConfigLight: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; pulse: string }> = {
  Critical: {
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
    pulse: 'bg-rose-500',
  },
  High: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
    pulse: 'bg-orange-500',
  },
  Medium: {
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <Zap className="w-4 h-4 text-amber-500" />,
    pulse: 'bg-amber-500',
  },
  Low: {
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Bell className="w-4 h-4 text-blue-500" />,
    pulse: 'bg-blue-500',
  },
};

export function AlertsPanel({ light = false }: { light?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsRes, surgesRes] = await Promise.all([
         fetch(`${API_BASE}/analytics/alerts`).catch(() => null),
         fetch(`${API_BASE}/analytics/surges`).catch(() => null)
      ]);
      
      let resData: Alert[] = [];
      if (alertsRes && alertsRes.ok) {
         const data = await alertsRes.json();
         resData = Array.isArray(data) ? data : data.alerts || [];
      }

      if (surgesRes && surgesRes.ok) {
         const surgeData = await surgesRes.json();
         if (Array.isArray(surgeData)) {
            surgeData.forEach((s: any) => {
               if (s.is_surge) {
                  resData.push({
                     id: `surge-${s.zone}`,
                     severity: 'Critical',
                     message: `SURGE DETECTED: Sudden spike in incident volume (${s.recent_count} recent incidents). Threshold breached.`,
                     zone: s.zone,
                     timestamp: new Date().toISOString(),
                     type: 'SURGE_ALERT'
                  });
               }
            });
         }
      }
      
      // Sort by severity (Critical first) then timestamp
      resData.sort((a, b) => {
        if (a.severity === 'Critical' && b.severity !== 'Critical') return -1;
        if (b.severity === 'Critical' && a.severity !== 'Critical') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setAlerts(resData.slice(0, 12));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Alerts fetch error:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const criticalCount = alerts.filter(a => a.severity === 'Critical').length;
  const highCount = alerts.filter(a => a.severity === 'High').length;

  // ---- LIGHT VARIANT (overview) ----
  if (light) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden transition-all duration-300">
        {/* Bar */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-rose-500" />
              {alerts.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-sm">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-800">Active Alerts</h2>
                {criticalCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-semibold">
                    {criticalCount} Critical
                  </span>
                )}
                {highCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-[11px] font-semibold">
                    {highCount} High
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {alerts.length > 0
                  ? `Critical active zones · click to ${collapsed ? 'view' : 'hide'}`
                  : 'No active high-priority alerts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {lastUpdated && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                {formatTime(lastUpdated.toISOString())}
              </span>
            )}
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">Live</span>
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded content */}
        {!collapsed && (
          <div className="px-5 pb-5 pt-1 border-t border-slate-100">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="loading-dot w-2 h-2 rounded-full bg-indigo-400"></span>
                  ))}
                </div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-emerald-600 font-semibold text-sm">All Clear</p>
                  <p className="text-slate-400 text-xs mt-1">No active high-priority alerts</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
                {alerts.map((alert, i) => {
                  const cfg = severityConfigLight[alert.severity] || severityConfigLight.Low;
                  return (
                    <div
                      key={alert.id || i}
                      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 animate-fade-in-up transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`relative w-7 h-7 rounded-lg bg-white border ${cfg.border} flex items-center justify-center`}>
                            {cfg.icon}
                            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${cfg.pulse}`}>
                              <span className={`absolute inset-0 rounded-full ${cfg.pulse} animate-ping opacity-75`}></span>
                            </span>
                          </div>
                          <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>{alert.severity}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{formatRelative(alert.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{alert.message}</p>
                      {alert.zone && (
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-500 border border-slate-200">
                          <MapPin className="w-3 h-3" /> {alert.zone}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- DARK VARIANT (original) ----
  return (
    <div className="glass rounded-xl border border-slate-700/50 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-300" />
            {alerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </div>
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Active Alerts
          </h2>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium">
                {criticalCount} Critical
              </span>
            )}
            {highCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium">
                {highCount} High
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(lastUpdated.toISOString())}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400">Live</span>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="loading-dot w-2 h-2 rounded-full bg-blue-400"></span>
                ))}
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-green-400 font-semibold text-sm">All Clear</p>
                <p className="text-slate-500 text-xs mt-1">No active high-priority alerts</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {alerts.map((alert, i) => {
                const cfg = severityConfig[alert.severity] || severityConfig.Low;
                return (
                  <div
                    key={alert.id || i}
                    className={`flex items-start gap-3 p-3 rounded-lg ${cfg.bg} border ${cfg.border} animate-fade-in-up transition-all duration-200 hover:scale-[1.01]`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="relative">
                        <div className={`w-2 h-2 rounded-full ${cfg.pulse} absolute -top-0.5 -right-0.5`}>
                          <span className={`absolute inset-0 rounded-full ${cfg.pulse} animate-ping opacity-75`}></span>
                        </div>
                        {cfg.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
                          {alert.severity}
                        </span>
                        <span className="text-[10px] text-slate-500">{formatRelative(alert.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{alert.message}</p>
                      {alert.zone && (
                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40">
                          📍 {alert.zone}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
