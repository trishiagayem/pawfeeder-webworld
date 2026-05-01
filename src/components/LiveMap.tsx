import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Map as MapIcon, Navigation, RefreshCw } from 'lucide-react';

// Fix for Leaflet marker icons in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to update map view when coordinates change
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
};

  interface LocationData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  timestamp: string;
  type?: 'tracker' | 'station';
}

const LiveMap: React.FC = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [stations, setStations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Listening to live map updates and stations...");
    
    const qLocs = collection(db, "locations");
    const qStations = collection(db, "stations");

    const unsubLocs = onSnapshot(qLocs, (snapshot) => {
      const updatedLocs: LocationData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (!isNaN(lat) && !isNaN(lng) && typeof data.lat === 'number' && typeof data.lng === 'number') {
          updatedLocs.push({
            id: doc.id,
            lat,
            lng,
            name: data.name || doc.id,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
            type: 'tracker'
          });
        }
      });
      setLocations(updatedLocs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "locations");
    });

    const unsubStations = onSnapshot(qStations, (snapshot) => {
      const updatedStations: LocationData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (!isNaN(lat) && !isNaN(lng) && typeof data.lat === 'number' && typeof data.lng === 'number') {
          updatedStations.push({
            id: doc.id,
            lat,
            lng,
            name: data.name || doc.id,
            timestamp: data.lastSeen?.toDate?.()?.toISOString() || new Date().toISOString(),
            type: 'station'
          });
        }
      });
      setStations(updatedStations);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "stations");
    });

    return () => {
      unsubLocs();
      unsubStations();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <RefreshCw className="w-8 h-8 animate-spin text-[#6A59CC] mb-2" />
        <p className="text-sm font-bold text-gray-500">Initializing Live GPS Tracker...</p>
      </div>
    );
  }

  // Combined list for center calculation
  const allPoints = [...locations, ...stations];

  // Default center (e.g., Bacolod City) if no locations exist
  const defaultCenter: [number, number] = [10.6386, 122.9511];
  const mapCenter: [number, number] = allPoints.length > 0 
    ? [allPoints[0].lat, allPoints[0].lng] 
    : defaultCenter;

  const stationIcon = L.divIcon({
    html: `<div class="bg-[#6A59CC] p-2 rounded-full border-2 border-white shadow-lg"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const trackerIcon = L.divIcon({
    html: `<div class="bg-emerald-500 p-2 rounded-full border-2 border-white shadow-lg"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#6A59CC] rounded-2xl shadow-lg shadow-[#6A59CC]/20">
            <MapIcon className="text-white w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#2D3436]">Global Network Viewer</h3>
            <p className="text-[10px] font-black text-[#7F8C8D] uppercase tracking-widest">Real-time Station & Unit Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 w-fit">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {locations.length} Feeders
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#6A59CC]/10 text-[#6A59CC] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#6A59CC]/20 w-fit">
            <div className="w-2 h-2 rounded-full bg-[#6A59CC]" />
            {stations.length} Stations
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map View */}
        <div className="lg:col-span-3 h-[600px] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white relative z-0">
          <MapContainer 
            center={mapCenter} 
            zoom={13} 
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Render Trackers */}
            {locations.map((loc) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={trackerIcon}>
                <Popup>
                  <div className="text-center p-1">
                    <p className="font-black text-emerald-600 mb-1">Unit: {loc.name}</p>
                    <p className="text-[9px] font-mono text-gray-500">{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}</p>
                    <p className="text-[8px] text-gray-400 mt-1">Active Tracker</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Render Stations */}
            {stations.map((station) => (
              <Marker key={station.id} position={[station.lat, station.lng]} icon={stationIcon}>
                <Popup>
                  <div className="text-center p-1">
                    <p className="font-black text-[#6A59CC] mb-1">{station.name} Station</p>
                    <p className="text-[9px] font-mono text-gray-500">{station.lat.toFixed(6)}, {station.lng.toFixed(6)}</p>
                    <p className="text-[8px] text-gray-400 mt-1">Fixed Feeding Point</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            <RecenterMap lat={mapCenter[0]} lng={mapCenter[1]} />
          </MapContainer>
        </div>

        {/* Live List Panel */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
          <div className="sticky top-0 bg-[#F8F7FF] dark:bg-[#2D293D] p-2 z-10 flex flex-col gap-1">
            <p className="text-[10px] font-black text-[#7F8C8D] uppercase tracking-widest">Active Stations ({stations.length})</p>
          </div>
          
          {stations.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-xs font-bold text-gray-400">No stations registered</p>
            </div>
          ) : (
            stations.map((loc) => (
              <div key={loc.id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-[#6A59CC]/30 transition-all group">
                <p className="font-black text-sm group-hover:text-[#6A59CC] transition-colors">{loc.name}</p>
                <p className="text-[9px] text-[#7F8C8D] font-bold">STATION</p>
                <div className="mt-2 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#6A59CC] w-[100%]" />
                  </div>
                  <span className="text-[9px] font-black text-[#6A59CC]">ACTIVE</span>
                </div>
              </div>
            ))
          )}

          <div className="sticky top-0 bg-[#F8F7FF] dark:bg-[#2D293D] p-2 z-10 pt-4">
            <p className="text-[10px] font-black text-[#7F8C8D] uppercase tracking-widest">Live Units ({locations.length})</p>
          </div>

          {locations.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-xs font-bold text-gray-400">No active units</p>
            </div>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="p-4 bg-white rounded-2xl border border-emerald-50 shadow-sm hover:border-emerald-500/30 transition-all group">
                <p className="font-black text-sm group-hover:text-emerald-500 transition-colors uppercase">{loc.name}</p>
                <p className="text-[9px] text-[#7F8C8D] font-bold">MOBILE UNIT</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-emerald-600">
                  <Navigation className="w-2 h-2" />
                  <span>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
