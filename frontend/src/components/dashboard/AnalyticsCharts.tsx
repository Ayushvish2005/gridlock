"use client"
import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import { BarChart2, PieChart as PieChartIcon, TrendingUp, Map } from 'lucide-react';
import { Card } from '@/components/ui/card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const VIBRANT_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#6366F1'  // Indigo
];

const SEVERITY_COLORS: Record<string, string> = {
  Low: '#10B981',
  Medium: '#F59E0B',
  High: '#F97316',
  Critical: '#EF4444',
};

const lightTooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  border: '1px solid rgb(226, 232, 240)',
  borderRadius: '10px',
  color: '#0f172a',
  fontSize: '12px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
};

const axisStyle = { fill: '#94a3b8', fontSize: 11 };

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}

function ChartCard({ title, subtitle, icon, children, accent = 'blue' }: ChartCardProps) {
  const accentMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    purple: 'bg-violet-50 border-violet-100',
    green: 'bg-emerald-50 border-emerald-100',
    orange: 'bg-orange-50 border-orange-100',
  };
  return (
    <Card className="p-5 flex flex-col shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-lg ${accentMap[accent] || accentMap.blue} border flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </Card>
  );
}

function CustomPieLegend({ data, colors }: { data: { name: string }[]; colors: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {data.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
          <span className="text-[10px] text-slate-500">{entry.name}</span>
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
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      {/* Events By Type - Donut */}
      <ChartCard
        title="Events By Type"
        subtitle="Distribution of incident categories"
        icon={<PieChartIcon className="w-4 h-4 text-blue-500" />}
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
              <Tooltip contentStyle={lightTooltipStyle} itemStyle={{ color: '#334155' }} />
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
        icon={<BarChart2 className="w-4 h-4 text-orange-500" />}
        accent="orange"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.severity_distribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                contentStyle={lightTooltipStyle}
                itemStyle={{ color: '#334155' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.severity_distribution?.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SEVERITY_COLORS[entry.name] || '#6366f1'}
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
        icon={<Map className="w-4 h-4 text-emerald-500" />}
        accent="green"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.incidents_by_zone}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" horizontal={false} />
              <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} width={65} />
              <Tooltip
                cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                contentStyle={lightTooltipStyle}
                itemStyle={{ color: '#334155' }}
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
        icon={<TrendingUp className="w-4 h-4 text-violet-500" />}
        accent="purple"
      >
        <div className="h-[280px]">
          {zoneRisks.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneRisks} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                  contentStyle={lightTooltipStyle}
                  itemStyle={{ color: '#334155' }}
                  formatter={(v: any) => [`${parseFloat(v).toFixed(1)}/100`, 'Risk Score']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {zoneRisks.map((entry: any, index: number) => {
                    const score = entry.value;
                    const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 40 ? '#eab308' : '#10b981';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="loading-dot w-2 h-2 rounded-full bg-violet-400"></span>
                ))}
              </div>
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
