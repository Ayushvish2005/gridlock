"use client"
import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, TrendingUp, Users, ShieldAlert, CheckCircle, Clock, Map as MapIcon, ChevronRight, Play, Activity, Target, Zap, LayoutDashboard, BarChart3, Presentation, Bot, Search, Radio } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [simResult, setSimResult] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [deploymentDetails, setDeploymentDetails] = useState<{posts: any[], barricadesPerPost: number} | null>(null);
  const [liveAlert, setLiveAlert] = useState<{message: string, severity: string} | null>(null);

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
    
    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);

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
    };
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, incidentsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/analytics`),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/incidents?status=ACTIVE`)
      ]);
      setAnalytics(analyticsRes.data);
      setIncidents(incidentsRes.data.slice(0, 30));
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050814] text-slate-200 font-sans">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0a0f1e]/90 border-r border-indigo-900/30 backdrop-blur-xl flex flex-col p-4 fixed h-full z-40 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 mb-8 px-2 mt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-tight">GRIDLOCK</h1>
            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Command Center</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Navigation</p>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold tracking-wide transition-all rounded-xl flex items-center gap-3 ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-indigo-400 border border-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="mt-auto border-t border-slate-800/50 pt-6 px-2 pb-4">
           <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
             <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
             </div>
             <div>
               <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">System Online</p>
               <p className="text-xs text-slate-400 font-mono mt-0.5">{currentTime || '00:00:00'}</p>
             </div>
           </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 ml-64 p-6 lg:p-8 space-y-8 animate-fade-in-up">
        
        {/* LIVE TELEMETRY BANNER */}
        {liveAlert && (
          <div className={`fixed top-4 left-[calc(50%+128px)] -translate-x-1/2 z-50 px-6 py-3 rounded-full border shadow-2xl flex items-center gap-3 animate-fade-in-up backdrop-blur-md ${
            liveAlert.severity === 'Critical' ? 'bg-red-950/90 border-red-500/50 text-red-200 shadow-red-900/20' :
            liveAlert.severity === 'High' ? 'bg-orange-950/90 border-orange-500/50 text-orange-200 shadow-orange-900/20' :
            'bg-blue-950/90 border-blue-500/50 text-blue-200 shadow-blue-900/20'
          }`}>
            <div className="w-2 h-2 rounded-full bg-current animate-ping"></div>
            <span className="font-bold text-sm tracking-wide">{liveAlert.message}</span>
          </div>
        )}

        {/* ALERTS PANEL */}
        <div className="mb-4">
          <AlertsPanel />
        </div>

        {/* KPI CARDS */}
        {analytics && (
          <div className="mb-8">
            <SummaryCards data={analytics.summary} />
          </div>
        )}

        {/* TAB CONTENT */}
        <div className="min-h-[600px]">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
            <div className="lg:col-span-8 h-[600px] glass rounded-xl border border-slate-700/50 overflow-hidden relative">
              {/* Overlay elements for map */}
              <div className="absolute top-4 left-4 z-[400] glass px-4 py-2 rounded-lg border border-slate-700/50 shadow-xl">
                <h3 className="font-bold text-sm text-white">Live Operations Map</h3>
              </div>
              <IncidentMap 
                incidents={incidents} 
                simResult={simResult}
                selectedLocation={selectedLocation}
                onMapClick={(lat, lng) => setSelectedLocation({lat, lng})} 
              />
            </div>
            <div className="lg:col-span-4 flex flex-col gap-6">
              <ZoneRiskRanking />
              <div className="flex-1">
                <IncidentTimeline incidents={incidents} />
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fade-in-up">
            {analytics && <AnalyticsCharts data={analytics.charts} />}
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
              <div className="lg:col-span-8">
                <CongestionForecast />
              </div>
              <div className="lg:col-span-4 h-[500px]">
                <ResourceAllocationPanel />
              </div>
            </div>
          </div>
        )}

        {/* SIMULATOR TAB */}
        {activeTab === 'simulator' && (
          <div className="space-y-6 animate-fade-in-up">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                


                {/* Left Column: Form */}
                <div className="lg:col-span-4 space-y-6">
                <div className="glass rounded-xl border border-slate-700/50 overflow-hidden p-6">
                <ScenarioSimulator 
                  onSimulate={setSimResult} 
                  selectedLocation={selectedLocation} 
                />
              </div>
              </div>
              <div className="lg:col-span-8 h-[500px] glass rounded-xl border border-slate-700/50 overflow-hidden relative">
                <div className="absolute top-4 left-4 z-[400] glass px-4 py-2 rounded-lg border border-slate-700/50 shadow-xl pointer-events-none">
                  <h3 className="font-bold text-sm text-white">Click map to select location</h3>
                </div>
                <IncidentMap 
                  incidents={incidents} 
                  simResult={simResult}
                  selectedLocation={selectedLocation}
                  onMapClick={(lat, lng) => {
                    setSelectedLocation({lat, lng});
                    setSimResult(null);
                  }} 
                />
              </div>
            </div>

            {simResult ? (
              <div className="space-y-6">
                
                {/* Traffic Impact Forecast Card */}
                <Card className="glass border-red-500/30 bg-red-900/10 shadow-xl">
                    <CardHeader className="pb-3 border-b border-red-500/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-red-400 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Traffic Impact Forecast
                        </CardTitle>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          simResult.severity === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                          simResult.severity === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
                          'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          Score: {simResult.impact_score}/100
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {/* Impact Score Breakdown */}
                      {simResult.impact_breakdown && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Impact Score Breakdown</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(simResult.impact_breakdown).map(([k, v]: any) => (
                              <span key={k} className="text-xs bg-slate-900/60 border border-slate-700/50 text-slate-300 px-2.5 py-1 rounded-md">
                                {k}: <strong className="text-white ml-1">{v}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Impact Radius</span>
                          <span className="text-lg font-bold text-red-400">{(simResult.impact_radius / 1000).toFixed(1)} km</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Affected Junctions</span>
                          <span className="text-lg font-bold text-orange-400">{simResult.affected_junctions || 0}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Expected Delay</span>
                          <span className="text-lg font-bold text-yellow-400">{simResult.estimated_delay} mins</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Peak Congestion</span>
                          <span className="text-lg font-bold text-slate-200">{simResult.peak_congestion_window || 'Unknown'}</span>
                        </div>
                      </div>
                    </CardContent>
                </Card>

                {/* Resource Planning Card */}
                <Card className="glass border-blue-500/30 bg-blue-900/10 shadow-xl">
                    <CardHeader className="pb-3 border-b border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-blue-400 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          Resource Planning
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div>
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Operational Plan</h4>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 text-sm text-slate-300 leading-relaxed italic">
                          {simResult.ai_explanation}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col justify-center relative">
                          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Officers Required</span>
                          <span className="text-xl font-bold text-blue-400">{simResult.recommendations.officers_required}</span>
                          {simResult.recommendations.resource_constrained && simResult.recommendations.original_request?.officers > simResult.recommendations.officers_required && (
                            <span className="absolute top-3 right-3 text-xs text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                              Constraint Clipped (was {simResult.recommendations.original_request.officers})
                            </span>
                          )}
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col justify-center relative">
                          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Barricades</span>
                          <span className="text-xl font-bold text-blue-400">{simResult.recommendations.barricades_required}</span>
                          {simResult.recommendations.resource_constrained && simResult.recommendations.original_request?.barricades > simResult.recommendations.barricades_required && (
                            <span className="absolute top-3 right-3 text-xs text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                              Constraint Clipped (was {simResult.recommendations.original_request.barricades})
                            </span>
                          )}
                        </div>
                      </div>

                      {simResult.recommendations.resource_constrained && (
                        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
                          <span className="text-yellow-400 text-lg">⚠</span>
                          <div>
                            <h5 className="text-sm font-bold text-yellow-400">Resource Optimization Active</h5>
                            <p className="text-xs text-yellow-200/80 mt-1">Due to concurrent city-wide incidents, maximum resource limits have been reached. The algorithm has dynamically clipped the requested deployment to fit within global constraints.</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col justify-center">
                          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Diversion Route</span>
                          <span className="text-sm font-bold text-slate-200">{simResult.recommendations.diversion_required ? 'Required' : 'None'}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col justify-center">
                          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tow Vehicle</span>
                          <span className="text-sm font-bold text-slate-200">{simResult.recommendations.tow_vehicle_required ? 'Required' : 'Not Required'}</span>
                        </div>
                      </div>
                    </CardContent>
                </Card>

                {/* --- GLOBAL STRATEGIES & PCU --- */}
                <Card className="glass border-teal-500/30 bg-teal-900/10 shadow-xl mt-6">
                    <CardHeader className="pb-3 border-b border-teal-500/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-teal-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          Urban Planning Strategies
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col justify-center">
                          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Zone Archetype</span>
                          <span className="text-sm font-bold text-teal-400">{simResult.recommendations.zone_archetype?.replace('_', ' ')}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex flex-col justify-center">
                          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Est. PCU Impact</span>
                          <span className="text-sm font-bold text-orange-400">{simResult.recommendations.pcu_impact_score} PCU</span>
                        </div>
                      </div>

                      {simResult.recommendations.spatial_spillover_warning && (
                        <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                          <span className="text-red-400 text-lg">🎈</span>
                          <div>
                            <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider">Spatial Spillover Risk (Balloon Effect)</h5>
                            <p className="text-[10px] text-red-200/80">Resolving this incident may displace traffic into neighboring zones.</p>
                          </div>
                        </div>
                      )}

                      {simResult.recommendations.nearest_poi_distance && (
                         <div className="mt-2 p-2 rounded bg-blue-500/10 border border-blue-500/30 flex items-center gap-2">
                           <span className="text-blue-400 text-lg">📍</span>
                           <div>
                             <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Haversine Proximity</h5>
                             <p className="text-[10px] text-blue-200/80">{simResult.recommendations.nearest_poi_distance}</p>
                           </div>
                         </div>
                      )}

                      {simResult.recommendations.global_strategies?.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Prescribed Global Strategies</h4>
                          <div className="flex flex-wrap gap-2">
                            {simResult.recommendations.global_strategies.map((strategy: string, idx: number) => (
                              <span key={idx} className="px-2.5 py-1 text-[11px] font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-md">
                                {strategy.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                </Card>

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

                {/* Historical Insights */}
                {simResult.similar_events?.length > 0 && (
                  <Card className="glass border-purple-500/30 bg-purple-900/10 shadow-xl">
                    <CardHeader className="pb-3 border-b border-purple-500/20">
                      <CardTitle className="text-purple-400 text-sm flex items-center gap-2 uppercase tracking-wider">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Historical Operational Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="p-3 rounded-lg bg-slate-900/50 border border-purple-500/20">
                        <p className="text-xs text-slate-300 mb-3">
                          Based on <strong>{simResult.similar_events.length} similar high-impact events</strong> in the historical dataset:
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Avg Resolution Time</span>
                            <span className="text-lg font-bold text-slate-200">{simResult.similar_events[0].avg_duration_hrs} hrs</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Avg Officers Deployed</span>
                            <span className="text-lg font-bold text-slate-200">{simResult.similar_events[0].avg_officers_deployed}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Avg Barricades</span>
                            <span className="text-lg font-bold text-slate-200">{simResult.similar_events[0].avg_barricades_used}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              ) : (
                <div className="glass rounded-xl border border-slate-700/50 flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                    <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-300 mb-1">Awaiting Parameters</h3>
                  <p className="text-sm text-slate-500 max-w-sm">Configure event parameters and select a map location to run the predictive simulation model.</p>
                </div>
              )}
            
            <div className="mt-8">
              <WhatIfSimulator />
            </div>
          </div>
        )}

        {/* COPILOT TAB */}
        {activeTab === 'copilot' && (
          <div className="max-w-4xl mx-auto h-[700px] animate-fade-in-up">
            <AICopilot />
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="max-w-3xl mx-auto animate-fade-in-up">
            <PostEventReport />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
