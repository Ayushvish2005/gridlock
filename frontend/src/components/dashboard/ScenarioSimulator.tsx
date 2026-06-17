"use client"
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from 'axios';

export function ScenarioSimulator({ onSimulate }: { onSimulate: (result: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    event_type: 'unplanned',
    event_cause: 'accident',
    priority: 'High',
    zone: 'Central',
    requires_road_closure: true,
    start_datetime: new Date().toISOString(),
  });

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/predict', formData);
      onSimulate(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Scenario Simulator</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <form onSubmit={handleSimulate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Event Cause</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md h-9 px-3 text-sm"
                value={formData.event_cause}
                onChange={e => setFormData({...formData, event_cause: e.target.value})}
              >
                <option value="accident">Accident</option>
                <option value="protest">Protest</option>
                <option value="concert">Concert</option>
                <option value="festival">Festival</option>
                <option value="vip_movement">VIP Movement</option>
                <option value="construction">Construction</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Priority Level</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md h-9 px-3 text-sm"
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value})}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Road Closure</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md h-9 px-3 text-sm"
                value={formData.requires_road_closure.toString()}
                onChange={e => setFormData({...formData, requires_road_closure: e.target.value === 'true'})}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="space-y-2 flex items-end">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0" disabled={loading}>
                {loading ? 'Simulating...' : 'Run Simulation'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
