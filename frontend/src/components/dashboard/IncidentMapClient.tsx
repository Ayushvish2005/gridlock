"use client"
import { useEffect, useState, useRef } from 'react';

declare global {
  interface Window {
    mappls: any;
  }
}

export default function IncidentMapClient({ incidents, simResult, selectedLocation, onMapClick }: { incidents: any[], simResult?: any, selectedLocation?: {lat: number, lng: number} | null, onMapClick?: (lat: number, lng: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  
  const [snappedBarricades, setSnappedBarricades] = useState<{lat: number, lng: number, name?: string, direction?: string}[]>([]);
  const [diversionRoute, setDiversionRoute] = useState<{lat: number, lng: number}[] | null>(null);

  const overlaysRef = useRef<any[]>([]);

  useEffect(() => {
    if (window.mappls) {
       setIsScriptLoaded(true);
       return;
    }
    // Load Mappls Script
    const token = process.env.NEXT_PUBLIC_MAPPLS_API_KEY || "YOUR_MAPPLS_ACCESS_TOKEN";
    const script = document.createElement('script');
    script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${token}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Dispatch deployment details
  useEffect(() => {
    if (snappedBarricades.length > 0 && simResult?.recommendations) {
       const barricadesPerPost = Math.ceil(simResult.recommendations.barricades_required / Math.max(snappedBarricades.length, 1));
       const event = new CustomEvent('deployment-details', {
          detail: { posts: snappedBarricades, barricadesPerPost }
       });
       window.dispatchEvent(event);
    } else {
       window.dispatchEvent(new CustomEvent('deployment-details', { detail: null }));
    }
  }, [snappedBarricades, simResult]);

  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || mapInstance) return;
    
    try {
      const map = new window.mappls.Map("mmi-map-container", {
        center: { lat: 12.9716, lng: 77.5946 }, // Bangalore
        zoom: 11
      });
      
      if (map.addListener) {
        map.addListener('click', (e: any) => {
          if (onMapClick && e.lngLat) {
            onMapClick(e.lngLat.lat, e.lngLat.lng);
          }
        });
      } else if (map.on) {
        map.on('click', (e: any) => {
          if (onMapClick && e.lngLat) {
            onMapClick(e.lngLat.lat, e.lngLat.lng);
          }
        });
      }
      
      setMapInstance(map);
    } catch(e) {
      console.error("Mappls Init Error", e);
    }
  }, [isScriptLoaded, mapInstance, onMapClick]);

  // Handle Simulation OSRM Routing & Snapping
  useEffect(() => {
    if (!simResult || !selectedLocation) {
      setSnappedBarricades([]);
      setDiversionRoute(null);
      return;
    }

    const radiusInMeters = simResult.impact_radius || 500;
    const radiusInDegrees = radiusInMeters / 111000;
    
    const bOffset = radiusInDegrees * 0.5;

    const getIdealBarricades = async () => {
      // To prevent barricades from clumping on one side of the city, 
      // we mathematically distribute 4 ideal points (North, South, East, West) exactly on the perimeter.
      // OSRM will later "snap" these ideal points to the absolute nearest real-world drivable road.
      const perimeterOffset = radiusInDegrees * 1.0; 
      
      return [
        { lat: selectedLocation.lat + perimeterOffset, lng: selectedLocation.lng }, // North
        { lat: selectedLocation.lat - perimeterOffset, lng: selectedLocation.lng }, // South
        { lat: selectedLocation.lat, lng: selectedLocation.lng + perimeterOffset }, // East
        { lat: selectedLocation.lat, lng: selectedLocation.lng - perimeterOffset }, // West
      ];
    };

    const snapToRoad = async (points: {lat: number, lng: number}[], maxDistance: number) => {
      const snapped = [];
      let successCount = 0;
      for (const p of points) {
        try {
          const res = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${p.lng},${p.lat}`);
          if (res.ok) {
            successCount++;
            const data = await res.json();
            if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
              if (data.waypoints[0].distance < maxDistance) {
                 const newLat = data.waypoints[0].location[1];
                 const newLng = data.waypoints[0].location[0];
                 
                 let locationName = "Unnamed Junction";
                 try {
                   await new Promise(r => setTimeout(r, 100)); // Rate limit
                   const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&zoom=16`);
                   if (geoRes.ok) {
                     const geoData = await geoRes.json();
                     locationName = geoData.name || geoData.address?.road || geoData.address?.suburb || "Unnamed Junction";
                   }
                 } catch(err) {}

                 // Calculate flow direction based on relative position to the incident center
                 const dLat = selectedLocation.lat - newLat;
                 const dLng = selectedLocation.lng - newLng;
                 const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
                 let direction = "Unknown";
                 if (angle > -45 && angle <= 45) direction = "Northbound Flow";
                 else if (angle > 45 && angle <= 135) direction = "Eastbound Flow";
                 else if (angle > -135 && angle <= -45) direction = "Westbound Flow";
                 else direction = "Southbound Flow";

                 snapped.push({ lat: newLat, lng: newLng, name: locationName, direction });
              }
            }
          }
        } catch (e) {
          console.error('Failed to snap to road', e);
        }
      }
      if (successCount === 0) return points; // Fallback
      return snapped;
    };

    const getDiversionRoute = async (centerLat: number, centerLng: number, radiusMeters: number) => {
      const R_deg = radiusMeters / 111000;
      const start = { lat: centerLat + R_deg * 1.2, lng: centerLng };
      const end = { lat: centerLat - R_deg * 1.2, lng: centerLng };

      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/analytics/routing?start_lat=${start.lat}&start_lng=${start.lng}&end_lat=${end.lat}&end_lng=${end.lng}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.route && data.route.length > 0) {
            return data.route.map((c: number[]) => ({lat: c[0], lng: c[1]}));
          }
        }
      } catch (e) {
        console.error("Routing failed", e);
      }
      return null;
    };

    getIdealBarricades().then(points => {
      snapToRoad(points, Math.max(300, radiusInMeters * 0.5)).then(b => {
        setSnappedBarricades(b);
      });
    });

    if (simResult.recommendations?.diversion_required) {
      getDiversionRoute(selectedLocation.lat, selectedLocation.lng, radiusInMeters).then(route => {
        if (route) setDiversionRoute(route);
      });
    } else {
      setDiversionRoute(null);
    }

  }, [simResult, selectedLocation]);

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'Critical': return '#ef4444'; // red
      case 'High': return '#f97316'; // orange
      case 'Medium': return '#eab308'; // yellow
      default: return '#22c55e'; // green
    }
  };

  // Render Overlays onto Mappls Map
  useEffect(() => {
    if (!mapInstance || !window.mappls) return;

    // Clear previous overlays
    overlaysRef.current.forEach(overlay => {
      try {
        window.mappls.remove({ map: mapInstance, layer: overlay });
      } catch(e) {}
    });
    overlaysRef.current = [];

    // Render Incidents
    incidents?.filter(i => i.latitude && i.longitude).forEach(incident => {
      // Custom Marker Popup HTML
      const popupHtml = `
        <div class="p-4 w-64 text-zinc-900 flex flex-col gap-3 font-sans">
          <div class="border-b border-slate-200 pb-2">
            <h3 class="font-bold text-base text-slate-800">${incident.event_cause}</h3>
            <p class="text-xs text-slate-500 uppercase font-semibold">${incident.event_type}</p>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="flex flex-col">
              <span class="text-slate-500">Severity</span>
              <span class="font-bold ${incident.severity === 'Critical' ? 'text-red-600' : 'text-orange-500'}">${incident.severity || 'Unknown'}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-slate-500">Est. Duration</span>
              <span class="font-bold text-slate-700">${incident.estimated_delay ? (Math.round(incident.estimated_delay / 60 * 10) / 10) + ' hrs' : 'N/A'}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-slate-500">Similar Past</span>
              <span class="font-bold text-slate-700">5+ incidents</span>
            </div>
            <div class="flex flex-col">
              <span class="text-slate-500">Zone</span>
              <span class="font-bold text-slate-700 truncate" title="${incident.zone}">${incident.zone || 'Unknown'}</span>
            </div>
          </div>
          <div class="bg-blue-50 p-2 rounded-md border border-blue-100">
            <span class="text-[10px] font-bold text-blue-600 uppercase mb-1 block">Recommended Response</span>
            <p class="text-xs text-blue-900 font-medium">
              Deploy ${incident.officers_required || Math.floor((incident.impact_score || 50) / 10) + 2} Officers<br/>
              Place ${incident.barricades_required || Math.floor((incident.impact_score || 50) / 20) + 1} Barricades
            </p>
          </div>
          <button 
            onclick="window.dispatchEvent(new CustomEvent('simulate-incident', { detail: { lat: ${incident.latitude}, lng: ${incident.longitude} } }))"
            class="w-full mt-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded shadow transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            Simulate Future Pattern
          </button>
        </div>
      `;

      // Marker
      const marker = new window.mappls.Marker({
        map: mapInstance,
        position: { lat: incident.latitude, lng: incident.longitude }
      });

      // InfoWindow (Popup)
      const infoWindow = new window.mappls.InfoWindow({
        content: popupHtml,
        position: { lat: incident.latitude, lng: incident.longitude }
      });

      marker.addListener ? marker.addListener('click', () => {
        infoWindow.open(mapInstance, marker);
      }) : marker.on && marker.on('click', () => {
        infoWindow.open(mapInstance, marker);
      });

      // Circle
      const circle = new window.mappls.Circle({
        map: mapInstance,
        center: { lat: incident.latitude, lng: incident.longitude },
        radius: incident.impact_radius || 500,
        fillColor: getSeverityColor(incident.severity),
        fillOpacity: 0.2,
        strokeColor: getSeverityColor(incident.severity),
        strokeWeight: 1
      });

      overlaysRef.current.push(marker, infoWindow, circle);
    });

    // Render Selected Location
    if (selectedLocation) {
      const selMarker = new window.mappls.Marker({
        map: mapInstance,
        position: { lat: selectedLocation.lat, lng: selectedLocation.lng }
      });
      const selInfo = new window.mappls.InfoWindow({
        content: `<div style="padding: 10px; font-family: sans-serif; font-weight: bold;">Selected Location for Simulation</div>`,
        position: { lat: selectedLocation.lat, lng: selectedLocation.lng }
      });
      selMarker.addListener ? selMarker.addListener('click', () => selInfo.open(mapInstance, selMarker)) : selMarker.on && selMarker.on('click', () => selInfo.open(mapInstance, selMarker));
      overlaysRef.current.push(selMarker, selInfo);
      
      // Pan to the selected location
      try {
        mapInstance.setCenter({ lat: selectedLocation.lat, lng: selectedLocation.lng });
      } catch(e) {}
    }

    // Render Simulation Results (Radius, Barricades, Diversion)
    if (simResult && selectedLocation) {
      const simCircle = new window.mappls.Circle({
        map: mapInstance,
        center: { lat: selectedLocation.lat, lng: selectedLocation.lng },
        radius: simResult.impact_radius || 500,
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        strokeColor: '#3b82f6',
        strokeWeight: 2,
        strokeLinecap: 'dashed' // approx dashed
      });
      overlaysRef.current.push(simCircle);

      if (simResult.recommendations?.barricades_required > 0 && snappedBarricades.length > 0) {
        snappedBarricades.forEach((b, i) => {
          const desc = document.createElement('div');
          desc.innerHTML = `
            <div style="background:#0a0f1e; padding:10px; border-radius:8px; border:1px solid #334155; color:white; font-family:Inter,sans-serif;">
              <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">Deployment Post ${i+1}</div>
              <div style="font-size:12px; color:#94a3b8; margin-bottom:2px;">${b.name || 'Unnamed Junction'}</div>
              <div style="font-size:12px; color:#60a5fa; font-weight:600;">Intercepts: ${b.direction || 'Unknown Flow'}</div>
              <div style="font-size:12px; color:#f87171; margin-top:4px;">Requires ${Math.ceil(simResult.recommendations.barricades_required / Math.max(snappedBarricades.length, 1))} Barricades</div>
            </div>
          `;
          const barricadeMarker = new window.mappls.Marker({
            map: mapInstance,
            position: { lat: b.lat, lng: b.lng },
            html: `<div style="background-color: #ea580c; color: white; font-weight: bold; font-size: 11px; padding: 3px 8px; border-radius: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap; transform: translate(-50%, -50%);">
              🚧 Post ${i + 1}
            </div>`
          });
          overlaysRef.current.push(barricadeMarker);
        });
      }

      if (diversionRoute && diversionRoute.length > 0) {
        const polyline = new window.mappls.Polyline({
          map: mapInstance,
          paths: diversionRoute,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.9,
          strokeWeight: 5
        });
        overlaysRef.current.push(polyline);

        // Add Midpoint Diversion Info
        const midIdx = Math.floor(diversionRoute.length / 2);
        const midPoint = diversionRoute[midIdx];
        if (midPoint) {
            const divMarker = new window.mappls.Marker({
                map: mapInstance,
                position: { lat: midPoint.lat, lng: midPoint.lng },
                html: `<div style="background-color: #2563eb; color: white; font-weight: bold; font-size: 11px; padding: 3px 8px; border-radius: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap; transform: translate(-50%, -50%);">
                  ↪️ Diversion
                </div>`
            });
            overlaysRef.current.push(divMarker);
        }
      }
    }

  }, [incidents, mapInstance, selectedLocation, simResult, snappedBarricades, diversionRoute]);

  if (!isScriptLoaded) {
    return <div className="h-full w-full flex items-center justify-center text-slate-400">Loading Mappls API...</div>;
  }

  return (
    <div id="mmi-map-container" ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" style={{ minHeight: '400px' }} />
  );
}
