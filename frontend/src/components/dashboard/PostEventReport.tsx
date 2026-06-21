"use client"
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, FileText, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function PostEventReport({ prefilledId }: { prefilledId?: string }) {
  const [incidentId, setIncidentId] = useState(prefilledId || '');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debriefSuccess, setDebriefSuccess] = useState('');
  const [actualOfficers, setActualOfficers] = useState('');
  const [actualBarricades, setActualBarricades] = useState('');
  const [actualDuration, setActualDuration] = useState('');

  const fetchReport = async (e?: React.FormEvent, idToFetch?: string) => {
    if (e) e.preventDefault();
    const id = idToFetch || incidentId;
    if (!id.toString().trim()) return;

    setLoading(true);
    setError('');
    setDebriefSuccess('');
    setReport(null);

    try {
      const res = await axios.get(`${API_BASE}/analytics/post-event-report/${id.toString().trim()}`);
      setReport(res.data);
      setActualOfficers(res.data.officers_deployed?.toString() || '0');
      setActualBarricades(res.data.barricades_deployed?.toString() || '0');
      setActualDuration(res.data.predicted_delay_mins?.toString() || '0');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("Incident not found.");
      } else if (err.response?.status === 400) {
        setError(err.response.data.detail || "Incident must be RESOLVED to generate a report.");
      } else {
        setError("Failed to fetch report.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prefilledId) {
      setIncidentId(prefilledId);
      fetchReport(undefined, prefilledId);
    }
  }, [prefilledId]);

  const submitDebrief = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/analytics/debrief/${incidentId.trim()}`, {
        actual_officers: parseInt(actualOfficers),
        actual_barricades: parseInt(actualBarricades),
        actual_duration_mins: parseInt(actualDuration)
      });
      setDebriefSuccess(res.data.message);
    } catch (err) {
      setError("Failed to submit debrief.");
    }
  };

  const getEfficiencyIcon = (eff: string) => {
    switch (eff) {
      case 'Excellent': return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'Good': return <Activity className="w-6 h-6 text-blue-400" />;
      case 'Fair': return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      default: return <XCircle className="w-6 h-6 text-red-400" />;
    }
  };

  const getEfficiencyColor = (eff: string) => {
    switch (eff) {
      case 'Excellent': return 'text-green-400';
      case 'Good': return 'text-blue-400';
      case 'Fair': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  return (
    <Card className="glass border-slate-700/50 shadow-xl overflow-hidden min-h-[500px]">
      <CardHeader className="border-b border-slate-700/50 bg-slate-800/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-100">Post-Event Performance Report</CardTitle>
            <p className="text-sm text-slate-400 font-normal mt-1">Review AI accuracy and resolution efficiency for past incidents.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={fetchReport} className="flex gap-4 mb-8 max-w-lg">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              placeholder="Enter Incident ID (e.g. 1)"
              className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>
          <Button 
            type="submit" 
            disabled={loading || !incidentId}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 rounded-xl px-6"
          >
            {loading ? 'Searching...' : 'Generate Report'}
          </Button>
        </form>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 animate-fade-in-up">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        {report && (
        <>
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div>
                <h3 className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Event</h3>
                <p className="text-lg text-slate-100 font-bold capitalize">{report.event_cause}</p>
                <p className="text-sm text-slate-500">ID: #{report.incident_id}</p>
              </div>
              <div className="text-right">
                <h3 className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Efficiency Rating</h3>
                <div className="flex items-center gap-2 justify-end">
                  {getEfficiencyIcon(report.resolution_efficiency)}
                  <p className={`text-xl font-bold ${getEfficiencyColor(report.resolution_efficiency)}`}>
                    {report.resolution_efficiency}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Predictions vs Reality */}
              <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  AI Prediction vs Reality
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Duration (Predicted vs Actual)</span>
                      <span className="text-slate-200 font-medium">
                        {report.predicted_delay_mins}m / {report.actual_duration_mins}m
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                      <div className="bg-blue-500/50 h-full" style={{ width: `${Math.min(100, (report.predicted_delay_mins / Math.max(report.predicted_delay_mins, report.actual_duration_mins)) * 100)}%` }} />
                      <div className="bg-red-500/50 h-full" style={{ width: `${Math.min(100, (report.actual_duration_mins / Math.max(report.predicted_delay_mins, report.actual_duration_mins)) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-right">Error Margin: {typeof report.duration_error_pct === 'number' ? report.duration_error_pct.toFixed(1) : '0.0'}%</p>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-t border-slate-700/50">
                    <span className="text-sm text-slate-400">Predicted Severity</span>
                    <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">
                      {report.predicted_severity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resource Utilization */}
              <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Resource Utilization
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Officers Deployed</span>
                    <span className="text-lg font-bold text-slate-200">{report.officers_deployed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Barricades Deployed</span>
                    <span className="text-lg font-bold text-slate-200">{report.barricades_deployed}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-700/50 pt-6 animate-fade-in-up delay-200">
            <h4 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Post-Event Learning Loop
            </h4>
            <p className="text-sm text-slate-400 mb-4">Input actual ground-truth data to trigger background model recalibration.</p>
            
            {debriefSuccess ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-200">{debriefSuccess}</span>
              </div>
            ) : (
              <form onSubmit={submitDebrief} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Actual Officers</label>
                  <input type="number" value={actualOfficers} onChange={e=>setActualOfficers(e.target.value)} className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/70" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Actual Barricades</label>
                  <input type="number" value={actualBarricades} onChange={e=>setActualBarricades(e.target.value)} className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/70" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Actual Duration (m)</label>
                  <input type="number" value={actualDuration} onChange={e=>setActualDuration(e.target.value)} className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/70" />
                </div>
                <Button type="submit" className="bg-green-600 hover:bg-green-500 text-white rounded-xl h-[38px]">
                  Submit Debrief
                </Button>
              </form>
            )}
          </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
