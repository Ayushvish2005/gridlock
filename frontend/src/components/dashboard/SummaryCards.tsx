"use client"
import { AlertTriangle, ShieldAlert, Users, Construction, Route, Activity, MapPin, TrendingUp, TrendingDown } from "lucide-react";

interface SummaryData {
  active_incidents?: number;
  critical_incidents?: number;
  officers_required?: number;
  barricades_required?: number;
  road_closures?: number;
  avg_risk_score?: number;
  zone_alerts?: number;
  [key: string]: any;
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  valueCls?: string;
  trend?: { value: string; up: boolean } | null;
  subtitle?: string;
  pulse?: boolean;
}

function KPICard({ title, value, icon, iconBg, valueCls = 'text-slate-100', trend, subtitle, pulse }: KPICardProps) {
  return (
    <div className="glass rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/70 transition-all duration-200 hover:scale-[1.02] group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        {pulse && (
          <span className="relative flex h-2 w-2 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-medium ${trend.up ? 'text-red-400' : 'text-green-400'}`}>
            {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className={`text-2xl font-extrabold ${valueCls} tracking-tight mb-0.5`}>{value}</div>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</div>
      {subtitle && <div className="text-[10px] text-slate-600 mt-1">{subtitle}</div>}
    </div>
  );
}

export function SummaryCards({ data }: { data: SummaryData }) {
  if (!data) return null;

  const cards: KPICardProps[] = [
    {
      title: 'Active Incidents',
      value: data.active_incidents ?? 0,
      icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
      iconBg: 'bg-orange-500/10 border border-orange-500/20',
      valueCls: 'text-orange-400',
      pulse: (data.active_incidents ?? 0) > 0,
      trend: (data.active_incidents ?? 0) > 5 ? { value: 'High', up: true } : null,
    },
    {
      title: 'Critical Incidents',
      value: data.critical_incidents ?? 0,
      icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
      iconBg: 'bg-red-500/10 border border-red-500/20',
      valueCls: (data.critical_incidents ?? 0) > 0 ? 'text-red-400' : 'text-slate-100',
      pulse: (data.critical_incidents ?? 0) > 0,
    },
    {
      title: 'Officers Deployed',
      value: data.officers_required ?? 0,
      icon: <Users className="w-4 h-4 text-blue-400" />,
      iconBg: 'bg-blue-500/10 border border-blue-500/20',
      valueCls: 'text-blue-400',
      subtitle: 'Personnel on active duty',
    },
    {
      title: 'Barricades',
      value: data.barricades_required ?? 0,
      icon: <Construction className="w-4 h-4 text-yellow-400" />,
      iconBg: 'bg-yellow-500/10 border border-yellow-500/20',
      valueCls: 'text-yellow-400',
      subtitle: 'Units deployed',
    },
    {
      title: 'Road Closures',
      value: data.road_closures ?? 0,
      icon: <Route className="w-4 h-4 text-red-400" />,
      iconBg: 'bg-red-500/10 border border-red-500/20',
      valueCls: (data.road_closures ?? 0) > 0 ? 'text-red-400' : 'text-slate-100',
      subtitle: 'Active closures',
    },
    {
      title: 'Avg Risk Score',
      value: typeof data.avg_risk_score === 'number' ? `${data.avg_risk_score.toFixed(1)}` : '—',
      icon: <Activity className="w-4 h-4 text-purple-400" />,
      iconBg: 'bg-purple-500/10 border border-purple-500/20',
      valueCls: (() => {
        const score = data.avg_risk_score ?? 0;
        if (score >= 80) return 'text-red-400';
        if (score >= 60) return 'text-orange-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-green-400';
      })(),
      subtitle: '/100 composite score',
    },
    {
      title: 'Zone Alerts',
      value: data.zone_alerts ?? data.zones_at_risk ?? '—',
      icon: <MapPin className="w-4 h-4 text-pink-400" />,
      iconBg: 'bg-pink-500/10 border border-pink-500/20',
      valueCls: 'text-pink-400',
      subtitle: 'Zones flagged',
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card, i) => (
        <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
          <KPICard {...card} />
        </div>
      ))}
    </div>
  );
}
