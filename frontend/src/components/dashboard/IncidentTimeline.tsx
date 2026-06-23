"use client"
import { CheckCircle, Clock, AlertTriangle, Zap, XCircle, MapPin } from 'lucide-react';

interface Incident {
  id: string;
  event_cause: string;
  zone: string;
  status: string;
  severity: string;
  created_at: string;
  priority?: string;
  event_type?: string;
}

function getSeverity(severity: string): { dot: string; pill: string; badgeBg: string } {
  switch (severity?.toLowerCase()) {
    case 'critical': return { dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-600 border-rose-200', badgeBg: 'bg-rose-50 text-rose-500' };
    case 'high': return { dot: 'bg-orange-500', pill: 'bg-orange-50 text-orange-600 border-orange-200', badgeBg: 'bg-orange-50 text-orange-500' };
    case 'medium': return { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-600 border-amber-200', badgeBg: 'bg-amber-50 text-amber-500' };
    default: return { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200', badgeBg: 'bg-emerald-50 text-emerald-500' };
  }
}

function getStatusConfig(status: string) {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return { label: 'Active', className: 'bg-rose-50 text-rose-600 border-rose-200', icon: <Zap className="w-3 h-3" /> };
    case 'MONITORING':
      return { label: 'Monitoring', className: 'bg-orange-50 text-orange-600 border-orange-200', icon: <AlertTriangle className="w-3 h-3" /> };
    case 'RESOLVED':
      return { label: 'Resolved', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle className="w-3 h-3" /> };
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 border-slate-200', icon: <XCircle className="w-3 h-3" /> };
    case 'PREDICTED':
      return { label: 'Simulated', className: 'bg-violet-50 text-violet-600 border-violet-200', icon: <Zap className="w-3 h-3" /> };
    default:
      return { label: status, className: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Clock className="w-3 h-3" /> };
  }
}

function formatRelativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return ts;
  }
}

export function IncidentTimeline({ incidents, simResult }: { incidents: Incident[], simResult?: any }) {
  const handleResolve = async (e: any, id: string) => {
    e.stopPropagation();
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${API_BASE}/incidents/${id}/resolve`, { method: 'PUT' });
      window.location.reload();
    } catch (err) {
      console.error("Failed to resolve", err);
    }
  };

  let displayIncidents = [...(incidents || [])];

  if (simResult) {
    displayIncidents.push({
      id: 'sim-' + Date.now(),
      event_cause: 'Simulated Scenario',
      zone: simResult.recommendations?.zone_archetype || 'Target Zone',
      status: 'PREDICTED',
      severity: simResult.severity || 'High',
      created_at: new Date(Date.now() + 10000).toISOString(), // slightly in the future so it sorts to top
      event_type: 'Simulation'
    });
  }

  const sorted = displayIncidents.sort((a, b) => {
    try {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } catch {
      return 0;
    }
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Incident Timeline</h3>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 border border-rose-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600">Live</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Network activity stream</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
          {sorted.length} active
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 light-scrollbar">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs text-slate-400">No incidents to display</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map((incident, i) => {
              const statusCfg = getStatusConfig(incident.status);
              const isActive = incident.status?.toUpperCase() === 'ACTIVE';
              const sev = getSeverity(incident.severity);

              return (
                <div
                  key={incident.id || i}
                  className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Icon badge */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${sev.badgeBg}`}>
                    {incident.status?.toUpperCase() === 'RESOLVED'
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <span className={`w-2.5 h-2.5 rounded-full ${sev.dot}`}></span>}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sev.pill}`}>
                          {incident.severity}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 capitalize truncate">
                          {incident.event_cause?.replace(/_/g, ' ')}
                        </span>
                        {incident.event_type && (
                          <span className="text-[10px] text-slate-400 uppercase">({incident.event_type})</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">{formatRelativeTime(incident.created_at)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          {incident.zone}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusCfg.className}`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isActive && !incident.id.toString().startsWith('sim-') && (
                          <button
                            onClick={(e) => handleResolve(e, incident.id)}
                            className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                        {incident.status?.toUpperCase() === 'RESOLVED' && !incident.id.toString().startsWith('sim-') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('view-report', { detail: { id: incident.id } })); }}
                            className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
                          >
                            View Report
                          </button>
                        )}
                      </div>
                    </div>
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
