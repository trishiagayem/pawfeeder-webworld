import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { MapPin, Search, Navigation, SearchX, RefreshCw, PawPrint, MoreVertical } from 'lucide-react';
import { cn } from '../lib/utils';

export function MenuButton({ 
  icon, 
  label, 
  onClick, 
  variant = "default",
  darkMode 
}: { 
  icon: React.ReactNode, 
  label: string, 
  onClick: () => void, 
  variant?: "default" | "danger",
  darkMode?: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold hover:scale-[1.02] active:scale-[0.98]",
        variant === "danger" 
          ? (darkMode 
              ? "text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20 border border-rose-400" 
              : "text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20 border border-rose-400") 
          : (darkMode ? "text-gray-300 hover:bg-white/5 hover:text-white" : "text-[#7F8C8D] hover:bg-black/5 hover:text-[#6A59CC]")
      )}
    >
      <div className={cn(
        "p-2 rounded-lg transition-colors",
        variant === "danger" 
          ? "bg-white/20 text-white" 
          : (darkMode ? "bg-white/5" : "bg-gray-100")
      )}>
        {icon}
      </div>
      <span className={cn(
        variant === "danger" && "tracking-wide"
      )}>
        {label}
      </span>
    </button>
  );
}

export function DropdownMenu({ 
  trigger, 
  children, 
  isOpen, 
  onClose, 
  darkMode,
  align = "right"
}: { 
  trigger: React.ReactNode; 
  children: React.ReactNode; 
  isOpen: boolean; 
  onClose: () => void;
  darkMode: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className="relative inline-block">
      <div onClick={(e) => { e.stopPropagation(); }}>
        {trigger}
      </div>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[150]" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "absolute z-[160] -mt-12 w-64 rounded-2xl border shadow-2xl overflow-y-auto max-h-[85vh] p-2 animate-in fade-in zoom-in duration-200",
              align === "right" ? "right-0" : "left-0",
              darkMode ? "bg-[#2D293D]/95 border-white/10 backdrop-blur-xl" : "bg-white/95 border-[#EEEEEE] backdrop-blur-xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      )}
    </div>
  );
}

export function PlacesAutocomplete({ 
  onSelect, 
  onError,
  darkMode, 
  defaultValue = "" 
}: { 
  onSelect: (address: string, lat: number, lng: number, plusCode?: string, mainText?: string) => void;
  onError?: (message: string) => void;
  darkMode: boolean;
  defaultValue?: string;
}) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [isLocating, setIsLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeout = useRef<any>(null);

  const searchLocations = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setStatus("");
      return;
    }

    setIsLoading(true);
    setStatus("SEARCHING");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=ph`);
      const data = await response.json();
      setSuggestions(data);
      setStatus(data.length > 0 ? "OK" : "ZERO_RESULTS");
    } catch (error) {
      console.error("Search error:", error);
      setStatus("ERROR");
      onError?.("Failed to search locations.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchLocations(value);
    }, 500);
  };

  const handleSelect = (suggestion: any) => () => {
    const address = suggestion.display_name;
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    const mainText = suggestion.address.road || suggestion.address.suburb || suggestion.address.city || address.split(',')[0];
    
    setInputValue(address);
    setSuggestions([]);
    setStatus("");
    onSelect(address, lat, lng, "", mainText);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      onError?.("Geolocation is not supported by your browser.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const address = data.display_name;
          const mainText = data.address.road || data.address.suburb || data.address.city || address.split(',')[0];
          setInputValue(address);
          onSelect(address, latitude, longitude, "", mainText);
        } catch (error) {
          console.error("Reverse geocode error:", error);
          onError?.("Failed to identify your location.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = "Failed to get your location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location access denied. Please enable location permissions.";
        }
        onError?.(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className="w-5 h-5 text-[#6A59CC]" />
        </div>
        <input
          value={inputValue}
          onChange={handleInput}
          autoFocus
          placeholder="Search for a location (e.g. Bacolod City)..."
          className={cn("w-full p-5 pl-12 pr-12 rounded-2xl border outline-none focus:ring-2 focus:ring-[#6A59CC] transition-all font-bold",
            darkMode ? "bg-white/5 border-white/10" : "bg-[#F8F7FF] border-[#EEEEEE]")}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-[#6A59CC] border-t-transparent rounded-full animate-spin" />
          )}
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              useCurrentLocation();
            }}
            disabled={isLocating}
            className={cn("p-2 text-[#6A59CC] hover:bg-[#6A59CC]/10 rounded-xl transition-all z-10", isLocating && "animate-pulse opacity-50")}
            title="Use Current Location"
          >
            {isLocating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {suggestions.length > 0 && (
        <div className={cn("absolute z-[300] w-full mt-2 rounded-2xl border shadow-2xl overflow-hidden",
          darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#EEEEEE]")}>
          
          {suggestions.map((suggestion, idx) => (
            <button
              key={`${suggestion.place_id}-${idx}`}
              type="button"
              onClick={handleSelect(suggestion)}
              className={cn("w-full p-4 text-left text-sm hover:bg-[#6A59CC]/10 transition-colors border-b last:border-0",
                darkMode ? "text-white border-white/5" : "text-[#2D3436] border-[#EEEEEE]")}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#6A59CC]" />
                <div className="flex flex-col">
                  <span className="font-bold">{suggestion.display_name.split(',')[0]}</span>
                  <span className="text-[10px] text-[#7F8C8D] truncate">{suggestion.display_name}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {status === "ZERO_RESULTS" && (
        <div className={cn("absolute z-[300] w-full mt-2 rounded-2xl border shadow-2xl overflow-hidden p-6 text-center space-y-2",
          darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#EEEEEE]")}>
          <SearchX className="w-8 h-8 text-[#7F8C8D] mx-auto opacity-20" />
          <p className="text-xs font-bold text-[#7F8C8D]">No locations found for "{inputValue}"</p>
          <p className="text-[10px] text-[#7F8C8D]/60">Try typing a more specific address or street name.</p>
        </div>
      )}
    </div>
  );
}

export function StatCard({ title, value, subValue, icon, color, darkMode }: { 
  title: string; 
  value: string; 
  subValue: string; 
  icon: React.ReactNode;
  color: "amber" | "indigo" | "teal" | "rose";
  darkMode?: boolean;
}) {
  const colorMap = {
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20",
    indigo: "bg-[#9D8DF1]/10 text-[#6A59CC] border-[#9D8DF1]/20 dark:bg-[#9D8DF1]/10 dark:text-[#9D8DF1] dark:border-[#9D8DF1]/20",
    teal: "bg-[#4ECDC4]/10 text-[#4ECDC4] border-[#4ECDC4]/20 dark:bg-[#4ECDC4]/10 dark:text-[#4ECDC4] dark:border-[#4ECDC4]/20",
    rose: "bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]/20 dark:bg-[#FF6B6B]/10 dark:text-[#FF6B6B] dark:border-[#FF6B6B]/20",
  };

  return (
    <div className={cn("p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all",
      darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#EEEEEE]")}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-2xl", colorMap[color])}>
          {icon}
        </div>
        <button className="p-2 text-[#7F8C8D] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <h4 className="text-[#7F8C8D] text-xs font-bold uppercase tracking-widest mb-1">{title}</h4>
      <div className="text-2xl font-black mb-1">{value}</div>
      <div className="text-[10px] font-bold text-[#7F8C8D]">{subValue}</div>
    </div>
  );
}

export function StatusItem({ label, value, percent, color, onRefill }: { 
  label: string; 
  value: string; 
  percent: number;
  color: "indigo" | "teal" | "rose" | "emerald";
  onRefill?: () => void;
}) {
  const colorMap = {
    indigo: "bg-[#6A59CC]",
    teal: "bg-[#4ECDC4]",
    rose: "bg-[#FF6B6B]",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#7F8C8D]">{label}</span>
          {onRefill && (
            <button 
              onClick={onRefill}
              className="p-1 rounded-md bg-[#6A59CC]/10 text-[#6A59CC] hover:bg-[#6A59CC] hover:text-white transition-all"
              title="Refill Hopper"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-xs font-black">{value}</span>
      </div>
      <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={cn("h-full rounded-full", colorMap[color])} 
        />
      </div>
    </div>
  );
}

export const darkMapStyles = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
  { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

export const mapStyles = [
  {
    "featureType": "all",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }]
  },
  {
    "featureType": "all",
    "elementType": "labels.text.stroke",
    "stylers": [{ "visibility": "on" }, { "color": "#ffffff" }, { "lightness": 16 }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#fefefe" }, { "lightness": 20 }]
  },
  {
    "featureType": "landscape",
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }, { "lightness": 21 }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }]
  }
];
