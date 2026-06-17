"use client"
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function IncidentMapClient({ incidents }: { incidents: any[] }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const L = require('leaflet');

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  if (!isMounted) return <div className="h-full w-full flex items-center justify-center">Loading map...</div>;

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'Critical': return '#ef4444'; // red
      case 'High': return '#f97316'; // orange
      case 'Medium': return '#eab308'; // yellow
      default: return '#22c55e'; // green
    }
  };

  const center: [number, number] = [12.9716, 77.5946];

  return (
    <MapContainer center={center} zoom={11} className="w-full h-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {incidents?.filter(i => i.latitude && i.longitude).map(incident => (
        <div key={incident.id}>
          <Marker position={[incident.latitude, incident.longitude]}>
            <Popup>
              <div className="p-2 w-48 text-zinc-900">
                <h3 className="font-bold text-sm mb-1">{incident.event_cause} ({incident.event_type})</h3>
                <p className="text-xs mb-2">Zone: {incident.zone}</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-1 rounded bg-zinc-100 border border-zinc-200">
                    {incident.severity}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-100 border border-zinc-200">
                    {incident.priority}
                  </span>
                </div>
                {incident.requires_road_closure && (
                  <p className="text-xs text-red-600 font-semibold">Road Closure Active</p>
                )}
              </div>
            </Popup>
          </Marker>
          <Circle
            center={[incident.latitude, incident.longitude]}
            pathOptions={{
              color: getSeverityColor(incident.severity),
              fillColor: getSeverityColor(incident.severity),
              fillOpacity: 0.2,
              weight: 1
            }}
            radius={incident.impact_radius || 500}
          />
        </div>
      ))}
    </MapContainer>
  );
}
