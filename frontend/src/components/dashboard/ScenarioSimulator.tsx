"use client"
import { useState } from 'react';
import { Play, Cpu } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SimulatorProps {
  onSimulate: (result: any) => void;
  selectedLocation?: { lat: number; lng: number } | null;
}

export function ScenarioSimulator({ onSimulate, selectedLocation }: SimulatorProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    event_type: 'unplanned',
    event_cause: 'accident',
    priority: 'High',
    zone: 'Central',
    requires_road_closure: true,
    expected_attendance: '',
    start_datetime: new Date().toISOString().slice(0, 16),
  });

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        start_datetime: formData.start_datetime,
        expected_attendance: formData.expected_attendance ? parseInt(formData.expected_attendance as string) : undefined,
        ...(selectedLocation ? { latitude: selectedLocation.lat, longitude: selectedLocation.lng } : {}),
      };
      const res = await axios.post(`${API_BASE}/predict`, payload);
      onSimulate(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder-slate-600";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="glass rounded-xl border border-slate-700/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Scenario Simulator</h3>
          <p className="text-xs text-slate-500">Model traffic impact before deployment</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {!selectedLocation && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
            <span className="text-yellow-400 text-sm mt-0.5">⚠</span>
            <p className="text-xs text-yellow-400/80">Click on the map to select a simulation target location</p>
          </div>
        )}

        {selectedLocation && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/5 border border-green-500/20 flex items-center gap-2">
            <span className="text-green-400 text-sm">📍</span>
            <p className="text-xs text-green-400/80">
              Location: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
            </p>
          </div>
        )}

        <form onSubmit={handleSimulate} className="space-y-4">
          {/* Event Type Toggle */}
          <div>
            <label className={labelCls}>Event Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, event_type: 'planned', event_cause: 'concert' })}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                  formData.event_type === 'planned'
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-800/60 border-slate-600/50 text-slate-400 hover:border-slate-500/70'
                }`}
              >
                📅 Planned Event
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, event_type: 'unplanned', event_cause: 'accident' })}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                  formData.event_type === 'unplanned'
                    ? 'bg-red-600/20 border-red-500/40 text-red-300 shadow-lg shadow-red-500/10'
                    : 'bg-slate-800/60 border-slate-600/50 text-slate-400 hover:border-slate-500/70'
                }`}
              >
                🚨 Unplanned
              </button>
            </div>
          </div>

          {formData.event_type === 'planned' && (
            <div>
              <label className={labelCls}>Expected Attendance</label>
              <input
                type="number"
                placeholder="e.g. 50000"
                className={inputCls}
                value={formData.expected_attendance}
                onChange={e => setFormData({ ...formData, expected_attendance: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Event Cause</label>
              <select
                className={inputCls}
                value={formData.event_cause}
                onChange={e => setFormData({ ...formData, event_cause: e.target.value })}
              >
                {formData.event_type === 'unplanned' ? (
                  <>
                    <option value="accident">Accident</option>
                    <option value="protest">Protest</option>
                    <option value="congestion">Severe Congestion</option>
                    <option value="vehicle_breakdown">Vehicle Breakdown</option>
                  </>
                ) : (
                  <>
                    <option value="concert">Concert</option>
                    <option value="festival">Festival</option>
                    <option value="sports">Sports Match</option>
                    <option value="vip_movement">VIP Movement</option>
                    <option value="construction">Construction</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className={labelCls}>Priority Level</label>
              <select
                className={inputCls}
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Zone</label>
              <select
                className={inputCls}
                value={formData.zone}
                onChange={e => setFormData({ ...formData, zone: e.target.value })}
              >
                <option value="Central">Central</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="East">East</option>
                <option value="West">West</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Road Closure</label>
              <select
                className={inputCls}
                value={formData.requires_road_closure.toString()}
                onChange={e => setFormData({ ...formData, requires_road_closure: e.target.value === 'true' })}
              >
                <option value="true">Required</option>
                <option value="false">Not Required</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Event Date & Time</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={formData.start_datetime}
              onChange={e => setFormData({ ...formData, start_datetime: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {loading ? (
              <>
                <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="loading-dot w-1.5 h-1.5 rounded-full bg-white"></span>)}</div>
                Running Simulation...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Simulation
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
