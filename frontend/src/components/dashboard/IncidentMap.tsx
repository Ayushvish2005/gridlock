"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from 'next/dynamic';

const IncidentMapClient = dynamic(() => import('./IncidentMapClient'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center">Loading map tiles...</div>
});

export function IncidentMap({ incidents }: { incidents: any[] }) {
  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle>Live Traffic Incident Map</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden rounded-b-xl border-t border-zinc-800 relative z-0">
        <IncidentMapClient incidents={incidents} />
      </CardContent>
    </Card>
  );
}
export default IncidentMap;
