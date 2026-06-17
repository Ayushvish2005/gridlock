"use client"
import { useEffect, useState } from 'react';
import axios from 'axios';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { IncidentMap } from '@/components/dashboard/IncidentMap';
import { ScenarioSimulator } from '@/components/dashboard/ScenarioSimulator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    fetchData();
    // Poll every 30s
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, incidentsRes] = await Promise.all([
        axios.get('`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}`/analytics'),
        axios.get('`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}`/incidents?status=ACTIVE')
      ]);
      setAnalytics(analyticsRes.data);
      setIncidents(incidentsRes.data);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50 p-6 space-y-6">
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Traffic Command Center</h1>
          <p className="text-zinc-400 mt-1">AI-Assisted Traffic Operations Platform</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md px-4 py-2 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium">System Active</span>
          </div>
        </div>
      </div>

      {analytics && <SummaryCards data={analytics.summary} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <IncidentMap incidents={incidents} />
        </div>
        <div className="space-y-6">
          <ScenarioSimulator onSimulate={setSimResult} />

          {simResult && (
            <Card className="border-blue-900 bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-400">Simulation Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-sm text-zinc-400">Assessed Severity</span>
                    <span className={`font-bold ${simResult.severity === 'Critical' ? 'text-red-500' : simResult.severity === 'High' ? 'text-orange-500' : 'text-yellow-500'}`}>
                      {simResult.severity} (Score: {simResult.impact_score})
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2 text-zinc-300">AI Operational Plan:</h4>
                    <p className="text-sm text-zinc-400 italic bg-zinc-900 p-3 rounded border border-zinc-800">
                      {simResult.ai_explanation}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 text-xs mb-1">Officers</span>
                      <span className="font-medium">{simResult.recommendations.officers_required}</span>
                    </div>
                    <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 text-xs mb-1">Barricades</span>
                      <span className="font-medium">{simResult.recommendations.barricades_required}</span>
                    </div>
                    <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 text-xs mb-1">Diversion</span>
                      <span className="font-medium">{simResult.recommendations.diversion_required ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 text-xs mb-1">Tow Vehicle</span>
                      <span className="font-medium">{simResult.recommendations.tow_vehicle_required ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {analytics && (
        <div className="mt-8">
          <h2 className="text-xl font-bold tracking-tight mb-4">Historical Analytics</h2>
          <AnalyticsCharts data={analytics.charts} />
        </div>
      )}
    </div>
  );
}
