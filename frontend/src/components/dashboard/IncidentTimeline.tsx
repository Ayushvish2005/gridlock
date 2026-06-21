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

function getSeverityDot(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'bg-red-500 shadow-red-500/50';
    case 'high': return 'bg-orange-500 shadow-orange-500/50';
    case 'medium': return 'bg-yellow-500 shadow-yellow-500/50';
    default: return 'bg-green-500 shadow-green-500/50';
  }
}

function getSeverityText(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-yellow-400';
    default: return 'text-green-400';
  }
}

function getStatusConfig(status: string) {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return {
        label: 'Active',
        className: 'bg-red-500/10 text-red-400 border-red-500/30',
        icon: <Zap className="w-3 h-3" />,
        pulse: true,
      };
    case 'MONITORING':
      return {
        label: 'Monitoring',
        className: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        icon: <AlertTriangle className="w-3 h-3" />,
        pulse: false,
      };
    case 'RESOLVED':
      return {
        label: 'Resolved',
        className: 'bg-green-500/10 text-green-400 border-green-500/30',
        icon: <CheckCircle className="w-3 h-3" />,
        pulse: false,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        icon: <XCircle className="w-3 h-3" />,
        pulse: false,
      };
    case 'PREDICTED':
      return {
        label: 'Simulated',
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        icon: <Zap className="w-3 h-3" />,
        pulse: true,
      };
    default:
      return {
        label: status,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        icon: <Clock className="w-3 h-3" />,
        pulse: false,
      };
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
    <div className="glass rounded-xl border border-slate-700/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Incident Timeline</h3>
            <p className="text-xs text-slate-500">Sorted by most recent</p>
          </div>
        </div>
        <span className="text-xs text-slate-500 bg-slate-800/60 border border-slate-700/40 px-2.5 py-1 rounded-full">
          {sorted.length} active
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-xs text-slate-500">No incidents to display</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/30 via-slate-600/20 to-transparent" />

            <div className="space-y-0">
              {sorted.map((incident, i) => {
                const statusCfg = getStatusConfig(incident.status);
                const isActive = incident.status?.toUpperCase() === 'ACTIVE';
                const dotColor = getSeverityDot(incident.severity);
                const textColor = getSeverityText(incident.severity);

                return (
                  <div
                    key={incident.id || i}
                    className="relative flex gap-4 pl-10 pb-4 animate-fade-in-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Dot */}
                    <div className="absolute left-0 top-1 flex items-center justify-center">
                      {isActive || incident.status === 'PREDICTED' ? (
                        <span className="relative flex h-[30px] w-[30px]">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor.split(' ')[0]} opacity-30`}></span>
                          <span className={`relative inline-flex rounded-full h-[30px] w-[30px] ${dotColor.split(' ')[0]}/20 border-2 border-${dotColor.split(' ')[0].replace('bg-', '')} items-center justify-center`}>
                            <span className={`w-2 h-2 rounded-full ${dotColor.split(' ')[0]} shadow-sm ${dotColor.split(' ')[1] || ''}`}></span>
                          </span>
                        </span>
                      ) : (
                        <div className={`w-[30px] h-[30px] rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center`}>
                          {incident.status?.toUpperCase() === 'RESOLVED'
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            : <span className={`w-2 h-2 rounded-full ${dotColor.split(' ')[0]}`}></span>
                          }
                        </div>
                      )}
                    </div>

                    {/* Content card */}
                    <div className="flex-1 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 transition-colors duration-200">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <span className="text-sm font-semibold text-slate-200 capitalize">
                            {incident.event_cause?.replace(/_/g, ' ')}
                          </span>
                          {incident.event_type && (
                            <span className="ml-2 text-[10px] text-slate-500 uppercase">
                              ({incident.event_type})
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusCfg.className}`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {incident.zone}
                          </div>
                          <span className={`text-xs font-semibold ${textColor}`}>
                            {incident.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && !incident.id.toString().startsWith('sim-') && (
                            <button 
                              onClick={(e) => handleResolve(e, incident.id)}
                              className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 hover:bg-green-500/30 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          <span className="text-[10px] text-slate-600">{formatRelativeTime(incident.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
