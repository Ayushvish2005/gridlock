"use client"
import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, ShieldAlert, Bell, CheckCircle, Zap, Clock } from 'lucide-react';

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

export function AlertsPanel() {
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
