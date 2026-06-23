"use client"
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, LayoutDashboard, BarChart3, Presentation, Bot, Sparkles } from "lucide-react";
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { IncidentMap } from '@/components/dashboard/IncidentMap';
import { ZoneRiskRanking } from '@/components/dashboard/ZoneRiskRanking';
import { IncidentTimeline } from '@/components/dashboard/IncidentTimeline';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { CongestionForecast } from '@/components/dashboard/CongestionForecast';
import { ScenarioSimulator } from '@/components/dashboard/ScenarioSimulator';
import { WhatIfSimulator } from '@/components/dashboard/WhatIfSimulator';
import { AICopilot } from '@/components/dashboard/AICopilot';
import { PostEventReport } from '@/components/dashboard/PostEventReport';
import { ResourceAllocationPanel } from '@/components/dashboard/ResourceAllocationPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';



const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'simulator', label: 'Simulator', icon: <Activity className="w-4 h-4" /> },
  { id: 'copilot', label: 'Copilot', icon: <Bot className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <Presentation className="w-4 h-4" /> },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [simResult, setSimResult] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [deploymentDetails, setDeploymentDetails] = useState<{ posts: any[], barricadesPerPost: number } | null>(null);
  const [liveAlert, setLiveAlert] = useState<{ message: string, severity: string } | null>(null);
  const [reportIncidentId, setReportIncidentId] = useState<string>('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);

    const handleSimulate = (e: any) => {
      setActiveTab('simulator');
      setSelectedLocation({ lat: e.detail.lat, lng: e.detail.lng });
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('simulate-incident', handleSimulate);

    const handleDeploymentDetails = (e: any) => {
      setDeploymentDetails(e.detail);
    };
    window.addEventListener('deployment-details', handleDeploymentDetails);

    const handleViewReport = (e: any) => {
      setReportIncidentId(e.detail.id);
      setActiveTab('reports');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('view-report', handleViewReport);

    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase());
    };
    tick();
    const t = setInterval(tick, 1000);

    // WebSocket for True Real-Time Concurrency
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace('http', 'ws') + '/ws/stream';
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLiveAlert({ message: data.message, severity: data.severity });
        setIncidents(prev => [data, ...prev].slice(0, 30));
        setTimeout(() => setLiveAlert(null), 8000); // Hide after 8s
      } catch (e) { console.error(e); }
    };

    return () => {
      clearInterval(interval);
      clearInterval(t);
      ws.close();
      window.removeEventListener('simulate-incident', handleSimulate);
      window.removeEventListener('deployment-details', handleDeploymentDetails);
      window.removeEventListener('view-report', handleViewReport);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, incidentsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/analytics`),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/incidents`)
      ]);
      setAnalytics(analyticsRes.data);
      setIncidents(incidentsRes.data.slice(0, 30));
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  const isOverview = activeTab === 'overview';
  const isLightTab = activeTab === 'overview' || activeTab === 'analytics' || activeTab === 'simulator' || activeTab === 'copilot' || activeTab === 'reports';
  const activeCount = incidents.filter((inc: any) => inc.status === 'ACTIVE').length;

  // AI Traffic Intelligence — derived from live analytics (content, not invented)
  const summary = analytics?.summary;
  let insights: { dot: string; text: string }[] = [];
  if (summary) {
    if ((summary.critical_incidents ?? 0) > 0) insights.push({ dot: 'bg-rose-500', text: `${summary.critical_incidents} critical incident${summary.critical_incidents !== 1 ? 's' : ''} flagged — prioritise emergency response.` });
    if ((summary.active_incidents ?? 0) > 0) insights.push({ dot: 'bg-orange-500', text: `${summary.active_incidents} active incident${summary.active_incidents !== 1 ? 's' : ''} being monitored across the network.` });
    if ((summary.road_closures ?? 0) > 0) insights.push({ dot: 'bg-amber-500', text: `${summary.road_closures} road closure${summary.road_closures !== 1 ? 's' : ''} active — reroute advisories in effect.` });
    if (typeof summary.avg_risk_score === 'number') insights.push({ dot: 'bg-emerald-500', text: `City-wide risk index holding at ${summary.avg_risk_score.toFixed(0)}/100.` });
  }
  insights = insights.slice(0, 3);
  if (insights.length === 0) insights = [{ dot: 'bg-emerald-500', text: 'All systems nominal — no high-priority incidents detected.' }];

  return (
    <div className={`min-h-screen font-sans ${isLightTab ? 'bg-slate-50 text-slate-900' : 'bg-[#050814] text-slate-200'}`}>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-slate-900 leading-tight">Traffic Operations Command Center</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Smart City Network · Bengaluru Metropolitan Region</p>
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-3">

            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">OC</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* LIVE TELEMETRY BANNER */}
      {liveAlert && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full border shadow-2xl flex items-center gap-3 animate-fade-in-up backdrop-blur-md ${liveAlert.severity === 'Critical' ? 'bg-red-950/90 border-red-500/50 text-red-200 shadow-red-900/20' :
          liveAlert.severity === 'High' ? 'bg-orange-950/90 border-orange-500/50 text-orange-200 shadow-orange-900/20' :
            'bg-blue-950/90 border-blue-500/50 text-blue-200 shadow-blue-900/20'
          }`}>
          <div className="w-2 h-2 rounded-full bg-current animate-ping"></div>
          <span className="font-bold text-sm tracking-wide">{liveAlert.message}</span>
        </div>
      )}

      {/* MAIN */}
      <main className="px-4 lg:px-8 py-6">

        {isOverview ? (
          /* ====================== OVERVIEW (LIGHT) ====================== */
          <div className="space-y-6 animate-fade-in-up">

            {/* ACTIVE ALERTS BAR */}
            <AlertsPanel light />

            {/* KPI STRIP */}
            {analytics && <SummaryCards data={analytics.summary} light />}

            {/* OVERVIEW GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Incident Timeline — left */}
              <div className="lg:col-span-3 h-[700px]">
                <IncidentTimeline incidents={incidents} simResult={simResult} />
              </div>

              {/* Live Operations Map — center */}
              <div className="lg:col-span-6 h-[700px] rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden relative">
                <IncidentMap
                  light
                  incidents={incidents.filter((inc: any) => inc.status === 'ACTIVE')}
                  simResult={simResult}
                  selectedLocation={selectedLocation}
                  onMapClick={(lat, lng) => setSelectedLocation({ lat, lng })}
                />

                {/* Label — top left */}
                <div className="absolute top-4 left-4 z-[460] rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-2.5 shadow-sm pointer-events-none">
                  <h3 className="text-sm font-bold text-slate-800">Live Operations Map</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Live Monitoring
                    </span>
                    <span className="text-[11px] font-semibold text-rose-500">{activeCount} Active Incidents</span>
                  </div>
                </div>

                {/* AI Traffic Intelligence — bottom left */}
                <div className="absolute bottom-4 left-4 z-[460] w-[300px] max-w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 leading-tight">AI Traffic Intelligence</div>
                      <div className="text-[10px] text-slate-400">Predictive analysis · live</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {insights.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.dot}`}></span>
                        <p className="text-[11px] leading-snug text-slate-600">{b.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend — bottom right */}
                <div className="absolute bottom-4 right-4 z-[460] flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-1.5 shadow-sm">
                  {[
                    { label: 'Critical', dot: 'bg-rose-500' },
                    { label: 'High', dot: 'bg-orange-500' },
                    { label: 'Medium', dot: 'bg-amber-400' },
                    { label: 'Low', dot: 'bg-emerald-500' },
                  ].map(l => (
                    <span key={l.label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${l.dot}`}></span>
                      <span className="text-[11px] font-medium text-slate-500">{l.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Zone Risk Ranking — right */}
              <div className="lg:col-span-3 h-[700px]">
                <ZoneRiskRanking />
              </div>
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          /* ====================== ANALYTICS (LIGHT) ====================== */
          <div className="space-y-6 animate-fade-in-up">

            {/* ACTIVE ALERTS BAR */}
            <AlertsPanel light />

            {/* KPI STRIP */}
            {analytics && <SummaryCards data={analytics.summary} light />}

            {/* Charts */}
            {analytics && <AnalyticsCharts data={analytics.charts} />}

            {/* Forecast + Resource Optimizer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <CongestionForecast />
              </div>
              <div className="lg:col-span-4 h-[500px]">
                <ResourceAllocationPanel />
              </div>
            </div>
          </div>
        ) : (
          /* ====================== OTHER TABS (DARK) ====================== */
          <div className="space-y-8">

            {/* ALERTS PANEL */}
            <AlertsPanel light={isLightTab} />

            {/* KPI CARDS */}
            {analytics && <SummaryCards data={analytics.summary} light={isLightTab} />}

            <div className="min-h-[600px]">

              {/* SIMULATOR TAB */}
              {activeTab === 'simulator' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">



                    {/* Left Column: Form */}
                    <div className="lg:col-span-4 flex flex-col h-full">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 flex-1">
                        <ScenarioSimulator
                          onSimulate={setSimResult}
                          selectedLocation={selectedLocation}
                        />
                      </div>
                    </div>
                    <div className="lg:col-span-8 h-full min-h-[500px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                      <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur px-4 py-2 rounded-lg border border-slate-200 shadow-sm pointer-events-none">
                        <h3 className="font-bold text-sm text-slate-800">Click map to select location</h3>
                      </div>
                      <IncidentMap light
                        incidents={incidents.filter((inc: any) => inc.status === 'ACTIVE')}
                        simResult={simResult}
                        selectedLocation={selectedLocation}
                        onMapClick={(lat, lng) => {
                          setSelectedLocation({ lat, lng });
                          setSimResult(null);
                        }}
                      />
                    </div>
                  </div>

                  {simResult ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Traffic Impact Forecast Card */}
                        <Card className="bg-white border-red-200 shadow-sm flex flex-col h-full">
                          <CardHeader className="pb-3 border-b border-red-100">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-red-600 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Traffic Impact Forecast
                              </CardTitle>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${simResult.severity === 'Critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                                simResult.severity === 'High' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                  'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                }`}>
                                Score: {simResult.impact_score}/100
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4 flex-1 flex flex-col">
                            {/* Impact Score Breakdown */}
                            {simResult.impact_breakdown && (
                              <div>
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Impact Score Breakdown</h4>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(simResult.impact_breakdown).map(([k, v]: any) => (
                                    <span key={k} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md">
                                      {k}: <strong className="text-slate-900 ml-1">{v}</strong>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Impact Radius</span>
                                <span className="text-lg font-bold text-red-600">{(simResult.impact_radius / 1000).toFixed(1)} km</span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Affected Junctions</span>
                                <span className="text-lg font-bold text-orange-600">{simResult.affected_junctions || 0}</span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expected Delay</span>
                                <span className="text-lg font-bold text-yellow-600">{simResult.estimated_delay} mins</span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Peak Congestion</span>
                                <span className="text-lg font-bold text-slate-800">{simResult.peak_congestion_window || 'Unknown'}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Resource Planning Card */}
                        <Card className="bg-white border-blue-200 shadow-sm flex flex-col h-full">
                          <CardHeader className="pb-3 border-b border-blue-100">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-blue-600 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                Resource Planning
                              </CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4 flex-1 flex flex-col">
                            <div>
                              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Operational Plan</h4>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 leading-relaxed italic">
                                {simResult.ai_explanation}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 text-sm">
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center relative">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Officers Required</span>
                                <span className="text-xl font-bold text-blue-600">{simResult.recommendations.officers_required}</span>
                                {simResult.recommendations.resource_constrained && simResult.recommendations.original_request?.officers > simResult.recommendations.officers_required && (
                                  <span className="absolute top-3 right-3 text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                    Constraint Clipped (was {simResult.recommendations.original_request.officers})
                                  </span>
                                )}
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center relative">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Barricades</span>
                                <span className="text-xl font-bold text-blue-600">{simResult.recommendations.barricades_required}</span>
                                {simResult.recommendations.resource_constrained && simResult.recommendations.original_request?.barricades > simResult.recommendations.barricades_required && (
                                  <span className="absolute top-3 right-3 text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                    Constraint Clipped (was {simResult.recommendations.original_request.barricades})
                                  </span>
                                )}
                              </div>
                            </div>

                            {simResult.recommendations.resource_constrained && (
                              <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-3">
                                <span className="text-yellow-600 text-lg">⚠</span>
                                <div>
                                  <h5 className="text-sm font-bold text-yellow-700">Resource Optimization Active</h5>
                                  <p className="text-xs text-yellow-600 mt-1">Due to concurrent city-wide incidents, maximum resource limits have been reached. The algorithm has dynamically clipped the requested deployment to fit within global constraints.</p>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 text-sm mt-2 mt-auto">
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Diversion Route</span>
                                <span className="text-sm font-bold text-slate-800">{simResult.recommendations.diversion_required ? 'Required' : 'None'}</span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tow Vehicle</span>
                                <span className="text-sm font-bold text-slate-800">{simResult.recommendations.tow_vehicle_required ? 'Required' : 'Not Required'}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* --- GLOBAL STRATEGIES & PCU --- */}
                        <Card className="bg-white border-teal-200 shadow-sm flex flex-col h-full">
                          <CardHeader className="pb-3 border-b border-teal-100">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-teal-600 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                Urban Planning Strategies
                              </CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4 flex-1 flex flex-col">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Zone Archetype</span>
                                <span className="text-sm font-bold text-teal-600">{simResult.recommendations.zone_archetype?.replace('_', ' ')}</span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Est. PCU Impact</span>
                                <span className="text-sm font-bold text-orange-600">{simResult.recommendations.pcu_impact_score} PCU</span>
                              </div>
                            </div>

                            {simResult.recommendations.spatial_spillover_warning && (
                              <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 flex items-center gap-2">
                                <span className="text-red-600 text-lg">🎈</span>
                                <div>
                                  <h5 className="text-xs font-bold text-red-700 uppercase tracking-wider">Spatial Spillover Risk (Balloon Effect)</h5>
                                  <p className="text-[10px] text-red-600">Resolving this incident may displace traffic into neighboring zones.</p>
                                </div>
                              </div>
                            )}

                            {simResult.recommendations.nearest_poi_distance && (
                              <div className="mt-2 p-2 rounded bg-blue-50 border border-blue-200 flex items-center gap-2">
                                <span className="text-blue-600 text-lg">📍</span>
                                <div>
                                  <h5 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Haversine Proximity</h5>
                                  <p className="text-[10px] text-blue-600">{simResult.recommendations.nearest_poi_distance}</p>
                                </div>
                              </div>
                            )}

                            {simResult.recommendations.global_strategies?.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Prescribed Global Strategies</h4>
                                <div className="flex flex-wrap gap-2">
                                  {simResult.recommendations.global_strategies.map((strategy: string, idx: number) => (
                                    <span key={idx} className="px-2.5 py-1 text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-md">
                                      {strategy.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <div className="mt-6">
                        {deploymentDetails && deploymentDetails.posts.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Geocoded Deployment Locations</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {deploymentDetails.posts.map((post: any, i: number) => (
                                <div key={i} className="glass p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                                  <div>
                                    <div className="font-bold text-[10px] text-orange-400 uppercase">🚧 Post {i + 1}</div>
                                    <div className="text-sm font-bold text-slate-200 mt-1">{post.name || 'Unnamed Junction'}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[10px] text-slate-400 uppercase">Barricades</div>
                                    <div className="font-mono font-bold text-slate-200">{deploymentDetails.barricadesPerPost}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-200">
                          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Awaiting Parameters</h3>
                        <p className="text-sm text-slate-500 max-w-sm">Configure event parameters and select a map location to run the predictive simulation model.</p>
                      </div>
                      <div className="h-full">
                        <WhatIfSimulator />
                      </div>
                    </div>
                  )}

                  {simResult && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 items-stretch">
                      {simResult.similar_events?.length > 0 ? (
                        <Card className="bg-white border-purple-200 shadow-sm flex flex-col h-full">
                          <CardHeader className="pb-3 border-b border-purple-100">
                            <CardTitle className="text-purple-600 text-sm flex items-center gap-2 uppercase tracking-wider">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              Historical Operational Insights
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-3 flex-1 flex flex-col">
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 h-full flex flex-col justify-center">
                              <p className="text-xs text-slate-600 mb-3">
                                Based on <strong>{simResult.similar_events.length} similar high-impact events</strong> in the historical dataset:
                              </p>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Resolution Time</span>
                                  <span className="text-lg font-bold text-slate-800">{simResult.similar_events[0].avg_duration_hrs} hrs</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Officers Deployed</span>
                                  <span className="text-lg font-bold text-slate-800">{simResult.similar_events[0].avg_officers_deployed}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Barricades</span>
                                  <span className="text-lg font-bold text-slate-800">{simResult.similar_events[0].avg_barricades_used}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-6 text-center shadow-sm h-full">
                          <p className="text-sm text-slate-500">No historical insights available for this event.</p>
                        </div>
                      )}
                      <div className="h-full">
                        <WhatIfSimulator />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* COPILOT TAB */}
              {activeTab === 'copilot' && (
                <div className="max-w-7xl mx-auto h-[700px] animate-fade-in-up">
                  <AICopilot context={simResult} />
                </div>
              )}

              {/* REPORTS TAB */}
              {activeTab === 'reports' && (
                <div className="max-w-7xl mx-auto animate-fade-in-up">
                  <PostEventReport prefilledId={reportIncidentId} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
