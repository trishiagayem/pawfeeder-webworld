import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MapPin, Navigation, Activity, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocationData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  timestamp: string;
}

const RealTimeLocations: React.FC = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Initializing real-time listener for 'locations' collection...");
    
    // Create a query to get the latest locations
    const q = query(
      collection(db, "locations"),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    // Set up the real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedLocations: LocationData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          updatedLocations.push({
            id: doc.id,
            lat,
            lng,
            name: data.name || "Unknown Station",
            timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
          });
        }
      });

      console.log("Real-time update received:", updatedLocations);
      setLocations(updatedLocations);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "locations");
    });

    // Cleanup listener on unmount
    return () => {
      console.log("Cleaning up real-time listener...");
      unsubscribe();
    };
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#6A59CC] rounded-2xl shadow-lg shadow-[#6A59CC]/20">
            <MapPin className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#2D3436]">Real-Time Locations</h2>
            <p className="text-sm text-[#7F8C8D] font-bold uppercase tracking-widest">Live Firestore Stream</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-[#EEEEEE] shadow-xl overflow-hidden">
        <div className="p-6 border-b border-[#EEEEEE] bg-[#F8F7FF]">
          <div className="flex items-center gap-2 text-[#6A59CC]">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">Latest Coordinates</span>
          </div>
        </div>

        <div className="divide-y divide-[#EEEEEE]">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <div className="w-8 h-8 border-4 border-[#6A59CC] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#7F8C8D] font-bold">Connecting to stream...</p>
              </motion.div>
            ) : locations.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <Navigation className="w-12 h-12 text-[#7F8C8D] opacity-20 mx-auto mb-4" />
                <p className="text-[#7F8C8D] font-bold">No location data found.</p>
                <p className="text-xs text-[#B0B0B0] mt-1">Waiting for data in 'locations' collection...</p>
              </motion.div>
            ) : (
              locations.map((loc) => (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-6 hover:bg-[#F8F7FF] transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-black text-[#2D3436] group-hover:text-[#6A59CC] transition-colors">
                        {loc.name}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-[#7F8C8D] uppercase">Lat:</span>
                          <span className="font-mono text-sm font-bold text-[#6A59CC]">{loc.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-[#7F8C8D] uppercase">Lng:</span>
                          <span className="font-mono text-sm font-bold text-[#6A59CC]">{loc.lng.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-[#7F8C8D] justify-end mb-1">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">Updated</span>
                      </div>
                      <p className="text-xs font-bold text-[#2D3436]">
                        {new Date(loc.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 bg-[#6A59CC]/5 border border-[#6A59CC]/10 rounded-2xl">
        <p className="text-[10px] font-bold text-[#6A59CC] uppercase tracking-[0.2em] mb-1">Developer Note</p>
        <p className="text-xs text-[#7F8C8D] leading-relaxed">
          This component uses the <span className="font-bold">onSnapshot</span> hook to maintain a persistent connection with Firestore. 
          Check the browser console to see the raw data updates as they arrive.
        </p>
      </div>
    </div>
  );
};

export default RealTimeLocations;
