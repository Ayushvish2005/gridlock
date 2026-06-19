"use client"
import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from "recharts";
import { BarChart2, PieChart as PieChartIcon, TrendingUp, Map } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const VIBRANT_COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ef4444', '#eab308', '#06b6d4'];
const SEVERITY_COLORS: Record<string, string> = {
  Low: '#22c55e',
  Medium: '#eab308',
  High: '#f97316',
  Critical: '#ef4444',
};

const darkTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(51, 65, 85, 0.8)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

const axisStyle = { fill: '#64748b', fontSize: 11 };

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}

function ChartCard({ title, subtitle, icon, children, accent = 'blue' }: ChartCardProps) {
  const accentMap: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
  };
  return (
    <div className="glass rounded-xl border border-slate-700/50 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-lg ${accentMap[accent] || accentMap.blue} border flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function CustomPieLegend({ data, colors }: { data: { name: string }[]; colors: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {data.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
          <span className="text-[10px] text-slate-400">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsCharts({ data }: { data: any }) {
  const [zoneRisks, setZoneRisks] = useState<any[]>([]);

  const fetchZoneRisks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/zone-risk-ranking`);
      if (!res.ok) return;
      const result = await res.json();
      const list = Array.isArray(result) ? result : result.zones || result.data || [];
      setZoneRisks(list.map((z: any) => ({ name: z.zone, value: z.risk_score })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchZoneRisks();
  }, [fetchZoneRisks]);

  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Events By Type - Donut */}
      <ChartCard
        title="Events By Type"
        subtitle="Distribution of incident categories"
        icon={<PieChartIcon className="w-4 h-4 text-blue-400" />}
        accent="blue"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.events_by_type}
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.events_by_type?.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={darkTooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {data.events_by_type && (
          <CustomPieLegend data={data.events_by_type} colors={VIBRANT_COLORS} />
        )}
      </ChartCard>

      {/* Severity Distribution - Bar */}
      <ChartCard
        title="Severity Distribution"
        subtitle="Incidents per severity level"
        icon={<BarChart2 className="w-4 h-4 text-orange-400" />}
        accent="orange"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.severity_distribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
              <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(51,65,85,0.2)' }}
                contentStyle={darkTooltipStyle}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.severity_distribution?.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SEVERITY_COLORS[entry.name] || '#3b82f6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Incidents By Zone - Horizontal Bar */}
      <ChartCard
        title="Incidents By Zone"
        subtitle="Active incident load per zone"
        icon={<Map className="w-4 h-4 text-green-400" />}
        accent="green"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.incidents_by_zone}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" horizontal={false} />
              <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} width={65} />
              <Tooltip
                cursor={{ fill: 'rgba(51,65,85,0.2)' }}
                contentStyle={darkTooltipStyle}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {data.incidents_by_zone?.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Zone Risk Score - Bar from API */}
      <ChartCard
        title="Zone Risk Scores"
        subtitle="AI-computed risk per zone"
        icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
        accent="purple"
      >
        <div className="h-[280px]">
          {zoneRisks.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneRisks} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: 'rgba(51,65,85,0.2)' }}
                  contentStyle={darkTooltipStyle}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(v: any) => [`${parseFloat(v).toFixed(1)}/100`, 'Risk Score']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {zoneRisks.map((entry: any, index: number) => {
                    const score = entry.value;
                    const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 40 ? '#eab308' : '#22c55e';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="loading-dot w-2 h-2 rounded-full bg-purple-400"></span>
                ))}
              </div>
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
