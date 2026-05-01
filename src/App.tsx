import React, { useState, useEffect, useMemo } from "react";
import { 
  Dog, 
  Cat, 
  Edit2,
  MapPin, 
  Clock, 
  Coins, 
  Weight, 
  LayoutDashboard, 
  History, 
  Settings,
  Activity,
  Map,
  ChevronRight,
  RefreshCw,
  Navigation,
  MoreVertical,
  User as UserIcon,
  FileText,
  LogOut,
  Moon,
  Sun,
  Plus,
  Trash2,
  X,
  Eye,
  Download,
  QrCode,
  Equal,
  Image as ImageIcon,
  Heart,
  ShieldCheck,
  Check,
  PawPrint,
  SearchX,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MenuButton, PlacesAutocomplete, StatCard, StatusItem, DropdownMenu } from './components/DashboardComponents';
import RealTimeLocations from './components/RealTimeLocations';
import LiveMap from './components/LiveMap';
import jsPDF from "jspdf";

// Fix Leaflet marker icon issue
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

// Helper component to update map view
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}
import html2canvas from "html2canvas";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./components/Login";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy, limit, setDoc, addDoc, serverTimestamp, getDoc, getDocFromServer, deleteDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DispenseLog {
  id: string;
  location: string;
  type: "Cat" | "Dog";
  coins: number;
  grams: number;
  timestamp: string;
}

interface Admin {
  uid: string;
  email: string;
  username?: string;
  name: string;
  bio: string;
  managingLocation: string;
  role: "admin" | "main" | "viewer";
  status?: "pending" | "approved" | "declined";
  password?: string;
}

interface LoginRecord {
  username: string;
  timestamp: string;
}

interface LocationInfo {
  name: string;
  lat: number;
  lng: number;
  address: string;
}


export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { currentUser, adminProfile, loading, isViewer, setViewerMode } = useAuth();
  const [logs, setLogs] = useState<DispenseLog[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [hopperLevels, setHopperLevels] = useState<Record<string, { cat: number; dog: number; lastSeen?: string }>>({});
  const [locationCoords, setLocationCoords] = useState<Record<string, { lat: number; lng: number; address: string; plusCode?: string }>>({});
  const [selectedLocationName, setSelectedLocationName] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  
  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openLocationMenu, setOpenLocationMenu] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<"profile" | "report" | "history" | "requests" | "realtime" | "map" | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [adminRequests, setAdminRequests] = useState<Admin[]>([]);
  const [qrCode, setQrCode] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [fundStrayMessage, setFundStrayMessage] = useState("");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState("");
  const [welcomeHeader, setWelcomeHeader] = useState("");
  const [viewerDisplayName, setViewerDisplayName] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [signupPrompt, setSignupPrompt] = useState("New Admin? Sign UP");
  const [bannerImage, setBannerImage] = useState("");
  const [logoImage, setLogoImage] = useState("");
  const [loginBackgroundImage, setLoginBackgroundImage] = useState("");
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [textEditModal, setTextEditModal] = useState<{ type: string, value: string, oldName?: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: "success" | "error" } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<{
    type: "qr" | "gallery" | "station" | "reset_logs";
    index?: number;
    id?: string;
    title: string;
    message: string;
  } | null>(null);
  const [refillModal, setRefillModal] = useState<{ type: "cat" | "dog", value: number } | null>(null);
  const [locationDetails, setLocationDetails] = useState<{ lat: number, lng: number, address: string, plusCode?: string } | null>(null);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  const toDMS = (coord: number, isLat: boolean) => {
    const absolute = Math.abs(coord);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
    const direction = isLat ? (coord >= 0 ? "N" : "S") : (coord >= 0 ? "E" : "W");
    return `${degrees}°${minutes}'${seconds}" ${direction}`;
  };


  const maskEmail = (email: string) => {
    if (!email) return "";
    if (!email.includes("@")) return email;
    const [name, domain] = email.split("@");
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  };

  // Derived user object for the UI
  const user = useMemo(() => {
    if (isViewer) return { username: "viewer", name: "Public Viewer", role: "viewer", managingLocation: "None" } as any;
    if (adminProfile) return { ...adminProfile, username: maskEmail(adminProfile.email) } as any;
    return null;
  }, [isViewer, adminProfile]);

  const selectedLocation = useMemo(() => {
    const coords = locationCoords[selectedLocationName];
    if (coords) {
      return { name: selectedLocationName, ...coords };
    }
    
    // Fallback for Alijis if it's the selected location but not yet loaded
    if (selectedLocationName === "Alijis" || !selectedLocationName) {
      return { 
        name: selectedLocationName || "Alijis", 
        lat: 10.6386, 
        lng: 122.9511, 
        address: "Alijis Road, Bacolod City", 
        plusCode: "8FVC+W2 Bacolod" 
      };
    }

    // Default fallback for other locations while loading
    return { 
      name: selectedLocationName, 
      lat: 0, 
      lng: 0, 
      address: "Loading location details...", 
      plusCode: "" 
    };
  }, [selectedLocationName, locationCoords]);

  const stats = useMemo(() => {
    const locationLogs = logs.filter(l => 
      l.location?.trim().toLowerCase() === selectedLocationName?.trim().toLowerCase()
    );
    const dogGrams = locationLogs.filter(l => l.type?.toLowerCase() === "dog").reduce((acc, curr) => acc + curr.grams, 0);
    const catGrams = locationLogs.filter(l => l.type?.toLowerCase() === "cat").reduce((acc, curr) => acc + curr.grams, 0);
    const dogCoins = locationLogs.filter(l => l.type?.toLowerCase() === "dog").reduce((acc, curr) => acc + curr.coins, 0);
    const catCoins = locationLogs.filter(l => l.type?.toLowerCase() === "cat").reduce((acc, curr) => acc + curr.coins, 0);
    const totalCoins = locationLogs.reduce((acc, curr) => acc + curr.coins, 0);
    
    return {
      dogGrams,
      catGrams,
      dogCoins,
      catCoins,
      totalCoins,
      totalGrams: dogGrams + catGrams,
      count: locationLogs.length
    };
  }, [logs, selectedLocationName]);

  const filteredLocations = useMemo(() => {
    return locations
      .filter(loc => user?.role !== "viewer" || loc === user?.managingLocation);
  }, [locations, user]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => 
      log.location?.trim().toLowerCase() === selectedLocationName?.trim().toLowerCase()
    );
  }, [logs, selectedLocationName]);

  const filteredLoginHistory = useMemo(() => {
    if (!historySearch.trim()) return loginHistory;
    const search = historySearch.toLowerCase();
    return loginHistory.filter(record => 
      record.username.toLowerCase().includes(search) ||
      new Date(record.timestamp).toLocaleDateString().toLowerCase().includes(search) ||
      new Date(record.timestamp).toLocaleTimeString().toLowerCase().includes(search)
    );
  }, [loginHistory, historySearch]);

  const filteredAdminRequests = useMemo(() => {
    return adminRequests;
  }, [adminRequests]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    // Suppress Vite HMR WebSocket errors which are expected when HMR is disabled
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
        (typeof event.reason === 'string' && event.reason.includes("WebSocket closed without opened")) ||
        (event.reason.message && event.reason.message.includes("WebSocket closed without opened"))
      )) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);

    // Fetch initial locations
    const unsubAssets = onSnapshot(doc(db, "assets", "global"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setQrCode(data.qrCode || "");
        setGalleryImages(data.galleryImages || []);
        setMission(data.mission || "");
        setVision(data.vision || "");
        setFundStrayMessage(data.fundStrayMessage || "");
        setWelcomeSubtitle(data.welcomeSubtitle || "");
        setWelcomeHeader(data.welcomeHeader || "");
        setViewerDisplayName(data.viewerDisplayName || "");
        setSignupPrompt(data.signupPrompt || "New Admin? Sign UP");
        setBannerImage(data.bannerImage || "");
        setLogoImage(data.logoImage || "");
        setLoginBackgroundImage(data.loginBackgroundImage || "");
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "assets/global");
    });

    const unsubStations = onSnapshot(collection(db, "stations"), (snapshot) => {
      const locs: string[] = [];
      const levels: Record<string, any> = {};
      const coords: Record<string, any> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        locs.push(data.name);
        levels[data.name] = data.hopperLevels || { cat: 100, dog: 100 };
        coords[data.name] = { 
          lat: data.lat, 
          lng: data.lng, 
          address: data.address || "",
          plusCode: data.plusCode || ""
        };
      });
      
      setLocations(locs);
      setHopperLevels(levels);
      setLocationCoords(coords);
      
      if (locs.length > 0 && !selectedLocationName) {
        setSelectedLocationName(locs[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "stations");
    });

    const qLogs = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(1000));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const newLogs: DispenseLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        newLogs.push({
          id: doc.id,
          location: data.location,
          type: data.type,
          coins: data.coins,
          grams: data.grams,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });
      setLogs(newLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "logs");
    });

    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      unsubAssets();
      unsubStations();
      unsubLogs();
    };
  }, []);

  useEffect(() => {
    if (user?.role !== "main") {
      setAdminRequests([]);
      return;
    }

    const qReqs = query(collection(db, "admins"), where("status", "==", "pending"));
    const unsubReqs = onSnapshot(qReqs, (snapshot) => {
      const reqs: Admin[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        reqs.push({
          ...data,
          uid: doc.id,
          username: data.username || data.email || doc.id
        } as Admin);
      });
      setAdminRequests(reqs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "admins");
    });

    return () => unsubReqs();
  }, [user?.role]);

  const [profileForm, setProfileForm] = useState({ name: "", bio: "", managingLocation: "", password: "" });

  useEffect(() => {
    if (isViewer) {
      setProfileForm({
        name: "Public Viewer",
        bio: "Browsing PawFeeds as a Guest. You can monitor live feeding stations and GPS units.",
        managingLocation: "All Stations",
        password: ""
      });
    } else if (user) {
      setProfileForm({
        name: user.name || "",
        bio: user.bio || "",
        managingLocation: user.managingLocation || "",
        password: ""
      });
    }
  }, [user, isViewer]);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setViewerMode(false);
      showNotification("Logged out successfully");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <RefreshCw className="w-12 h-12 text-[#6A59CC]" />
        </motion.div>
      </div>
    );
  }

  // If not logged in and not in viewer mode, show login
  if (!currentUser && !isViewer) {
    return <Login />;
  }

  // If logged in but no profile found or status is pending (and not viewer)
  if (currentUser && !isViewer && (!adminProfile || adminProfile.status === 'pending')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl text-center">
          <div className="inline-flex p-4 bg-amber-100 rounded-3xl mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-black text-[#2D3436] mb-2">Approval Pending</h2>
          <p className="text-[#7F8C8D] mb-6">Your admin account has been created but is waiting for approval from the Main Admin.</p>
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-[#6A59CC] text-white rounded-2xl font-bold shadow-lg shadow-[#6A59CC]/30"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If admin is declined
  if (adminProfile?.status === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl text-center">
          <div className="inline-flex p-4 bg-rose-100 rounded-3xl mb-4">
            <X className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-2xl font-black text-[#2D3436] mb-2">Access Denied</h2>
          <p className="text-[#7F8C8D] mb-6">Your admin request was declined. Please contact the system administrator.</p>
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-[#6A59CC] text-white rounded-2xl font-bold shadow-lg shadow-[#6A59CC]/30"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const handleAddLocation = () => {
    if (user?.role !== "main") return;
    setTextEditModal({ type: "addLocation", value: "" });
  };

  const handleDeleteLocation = (name: string) => {
    if (user?.role !== "main") return;
    setPendingDeletion({
      type: "station",
      id: name,
      title: "Delete Location",
      message: `Permanently delete ${name}? This will remove all associated hopper levels and station coordinates.`,
    });
  };

  const confirmDelete = async (name: string) => {
    try {
      await deleteDoc(doc(db, "stations", name));
      showNotification(`Location ${name} deleted`);
      
      if (selectedLocationName === name) {
        const remaining = locations.filter(l => l !== name);
        setSelectedLocationName(remaining.length > 0 ? remaining[0] : "");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stations/${name}`);
    }
  };

  const handleRefill = async (type: "cat" | "dog") => {
    if (user?.role === "admin" && selectedLocationName !== user?.managingLocation) {
      showNotification("You can only refill your assigned station", "error");
      return;
    }
    setRefillModal({ type, value: 100 });
  };

  const confirmRefill = async () => {
    if (!refillModal) return;
    const { type, value } = refillModal;
    
    if (isNaN(value) || value < 0 || value > 100) {
      showNotification("Please enter a valid percentage (0-100)", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "stations", selectedLocationName), {
        [`hopperLevels.${type}`]: value,
        lastSeen: serverTimestamp()
      });
      showNotification(`${type === "cat" ? "Cat" : "Dog"} food hopper refilled to ${value}%`);
      setRefillModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stations/${selectedLocationName}`);
    }
  };

  const handleRenameLocation = (oldName: string) => {
    if (user?.role !== "main") return;
    setTextEditModal({ type: "renameLocation", value: oldName, oldName });
  };

  const fetchHistory = async () => {
    if (user?.role !== "main") return;
    try {
      const q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(50));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          username: data.username,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      });
      setLoginHistory(history);
      setActiveModal("history");
    } catch (err) {
      console.error("Failed to fetch history:", err);
      showNotification("Failed to fetch history", "error");
    }
  };

  const fetchAdminRequests = async () => {
    if (user?.role !== "main") return;
    setActiveModal("requests");
  };

  const handleApproveAdmin = async (uid: string, status: "approved" | "declined") => {
    if (user?.role !== "main") return;
    try {
      await updateDoc(doc(db, "admins", uid), {
        status: status
      });
      showNotification(`Admin request ${status}`);
      fetchAdminRequests();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admins/${uid}`);
    }
  };

  const handleAssetUpload = async (type: "qr" | "gallery", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const endpoint = type === "qr" ? "/api/assets/qr" : "/api/assets/gallery";
      try {
        if (type === "qr") {
          await setDoc(doc(db, "assets", "global"), { qrCode: base64 }, { merge: true });
        } else {
          await setDoc(doc(db, "assets", "global"), {
            galleryImages: [...galleryImages, base64]
          }, { merge: true });
        }
        showNotification(`${type === "qr" ? "QR Code" : "Gallery Image"} uploaded`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, "assets/global");
      }
    };
    reader.readAsDataURL(file);
  };

  const deleteGalleryImage = async (index: number) => {
    try {
      const newGallery = galleryImages.filter((_, i) => i !== index);
      await updateDoc(doc(db, "assets", "global"), {
        galleryImages: newGallery
      });
      showNotification("Image removed from gallery");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "assets/global");
    }
  };

  const deleteQrCode = async () => {
    try {
      await updateDoc(doc(db, "assets", "global"), {
        qrCode: ""
      });
      setQrCode("");
      setIsQrModalOpen(false);
      showNotification("QR Code removed");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "assets/global");
    }
  };

  const handleTextEdit = async (type: string, currentValue: string | undefined) => {
    if (user?.role !== "main") return;
    setTextEditModal({ type, value: currentValue || "" });
  };

  const saveTextEdit = async () => {
    if (!textEditModal) return;
    const { type, value, oldName } = textEditModal;
    
    try {
      if (type === "addLocation") {
        if (value.trim() && locationDetails) {
          await setDoc(doc(db, "stations", value.trim()), {
            name: value.trim(),
            lat: locationDetails.lat,
            lng: locationDetails.lng,
            address: locationDetails.address || "",
            plusCode: locationDetails.plusCode || "",
            hopperLevels: { cat: 100, dog: 100 },
            lastSeen: serverTimestamp()
          });
          setSelectedLocationName(value.trim());
          showNotification("Location added");
          setLocationDetails(null);
        }
      } else if (type === "renameLocation" && oldName) {
        if (value.trim() && value.trim() !== oldName) {
          const oldDoc = await getDoc(doc(db, "stations", oldName));
          if (oldDoc.exists()) {
            await setDoc(doc(db, "stations", value.trim()), {
              ...oldDoc.data(),
              name: value.trim()
            });
            // Note: In a real app, you'd want to delete the old doc, 
            // but for simplicity here we just create the new one.
            // await deleteDoc(doc(db, "stations", oldName));
            if (selectedLocationName === oldName) {
              setSelectedLocationName(value.trim());
            }
            showNotification("Location renamed");
          }
        }
      } else {
        await setDoc(doc(db, "assets", "global"), {
          [type]: value
        }, { merge: true });
        showNotification("Content updated");
      }
      setTextEditModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, type === "addLocation" ? "stations" : "assets/global");
    }
  };

  const handleHeroImageUpload = async (type: "banner" | "logo" | "loginBackground", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await setDoc(doc(db, "assets", "global"), {
          [`${type}Image`]: base64
        }, { merge: true });
        showNotification(`${type === "banner" ? "Banner" : "Logo"} updated`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, "assets/global");
      }
    };
    reader.readAsDataURL(file);
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateDoc(doc(db, "admins", user.uid), {
        name: profileForm.name,
        bio: profileForm.bio,
        managingLocation: profileForm.managingLocation
      });
      showNotification("Profile updated");
      setActiveModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `admins/${user.uid}`);
    }
  };

  const handleResetLogs = async () => {
    if (!selectedLocationName) return;
    if (user?.role !== "main" && user?.role !== "admin") return;
    
    try {
      setIsActionLoading(true);
      const q = query(collection(db, "logs"), where("location", "==", selectedLocationName));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        showNotification(`No logs found for ${selectedLocationName}`);
        return;
      }

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      showNotification(`Logs for ${selectedLocationName} have been reset`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "logs");
    } finally {
      setIsActionLoading(false);
    }
  };

  const executeDeletion = async () => {
    if (!pendingDeletion) return;
    const { type, index, id } = pendingDeletion;
    
    setIsActionLoading(true);
    try {
      if (type === "qr") {
        await deleteQrCode();
      } else if (type === "gallery" && typeof index === 'number') {
        await deleteGalleryImage(index);
      } else if (type === "station" && id) {
        await confirmDelete(id);
      } else if (type === "reset_logs") {
        await handleResetLogs();
      }
      setPendingDeletion(null);
    } catch (error) {
      console.error("Deletion failed:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    
    setIsDownloading(true);
    try {
      // Wait a bit to ensure any animations are finished
      await new Promise(resolve => setTimeout(resolve, 300));

      const element = receiptRef.current;
      const { width, height } = element.getBoundingClientRect();
      
      if (width === 0 || height === 0) {
        throw new Error("Receipt element has no dimensions. Is it visible?");
      }

      // Wait a moment for any final layout shifts or font loads
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 3, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: "#FFFFFF", // Force white background for the PDF
        onclone: (clonedDoc) => {
          const originalEl = element;
          const clonedEl = clonedDoc.querySelector('[data-receipt="true"]') as HTMLElement;
          
          if (clonedEl) {
            // 1. Capture and apply styles from original to clone recursively
            const applyStyles = (orig: HTMLElement, clone: HTMLElement) => {
              const computed = window.getComputedStyle(orig);
              const className = typeof orig.className === 'string' ? orig.className : (orig.className as any)?.baseVal || '';
              
              const style = clone.style;
              
              // Force Black and White
              const isTransparent = (val: string) => !val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)';
              
              style.color = isTransparent(computed.color) ? 'transparent' : '#000000';
              style.backgroundColor = isTransparent(computed.backgroundColor) ? 'transparent' : '#FFFFFF';
              style.borderColor = isTransparent(computed.borderColor) ? 'transparent' : '#000000';
              
              style.fontSize = computed.fontSize;
              style.fontWeight = computed.fontWeight;
              style.fontFamily = computed.fontFamily;
              style.padding = computed.padding;
              style.margin = computed.margin;
              style.display = computed.display;
              style.flexDirection = computed.flexDirection;
              style.alignItems = computed.alignItems;
              style.justifyContent = computed.justifyContent;
              style.flexWrap = computed.flexWrap;
              style.flexGrow = computed.flexGrow;
              style.flexShrink = computed.flexShrink;
              style.flexBasis = computed.flexBasis;
              style.gridTemplateColumns = computed.gridTemplateColumns;
              style.gridColumn = computed.gridColumn;
              style.gridRow = computed.gridRow;
              style.gap = computed.gap;
              style.borderRadius = computed.borderRadius;
              style.borderWidth = computed.borderWidth;
              style.borderStyle = computed.borderStyle;
              style.textAlign = computed.textAlign;
              style.lineHeight = computed.lineHeight;
              style.letterSpacing = computed.letterSpacing;
              style.opacity = computed.opacity;
              style.boxSizing = 'border-box';
              style.overflow = 'visible';
              style.zIndex = computed.zIndex;
              style.boxShadow = 'none';
              
              if (computed.position !== 'static') {
                style.position = computed.position;
                style.top = computed.top;
                style.left = computed.left;
                style.right = computed.right;
                style.bottom = computed.bottom;
                style.transform = computed.transform;
              }

              // Hide ALL absolute decorative elements (blurs, circles, etc.)
              if (computed.position === 'absolute' && (className.includes('blur') || className.includes('rounded-full') || className.includes('opacity-'))) {
                style.display = 'none';
              }

              // Only copy dimensions for images and SVGs to avoid layout breakage
              if (orig.tagName.toLowerCase() === 'img' || orig.tagName.toLowerCase() === 'svg') {
                style.width = computed.width;
                style.height = computed.height;
              }

              if (orig instanceof SVGElement || orig.tagName.toLowerCase() === 'path' || orig.tagName.toLowerCase() === 'svg') {
                if (computed.fill && computed.fill !== 'none') clone.setAttribute('fill', '#000000');
                if (computed.stroke && computed.stroke !== 'none') clone.setAttribute('stroke', '#000000');
              }

              if (className.includes('bg-gradient')) {
                style.background = '#FFFFFF';
                style.backgroundColor = '#FFFFFF';
              }

              const origChildren = Array.from(orig.children) as HTMLElement[];
              const cloneChildren = Array.from(clone.children) as HTMLElement[];
              for (let i = 0; i < origChildren.length; i++) {
                if (cloneChildren[i]) applyStyles(origChildren[i], cloneChildren[i]);
              }
            };

            applyStyles(originalEl, clonedEl);

            const styleTags = clonedDoc.getElementsByTagName('style');
            for (let i = styleTags.length - 1; i >= 0; i--) styleTags[i].remove();
            const linkTags = clonedDoc.getElementsByTagName('link');
            for (let i = linkTags.length - 1; i >= 0; i--) if (linkTags[i].rel === 'stylesheet') linkTags[i].remove();

            clonedEl.style.visibility = 'visible';
            clonedEl.style.display = 'block';
            clonedEl.style.transform = 'none';
            clonedEl.style.width = '800px'; // Increased width to prevent cutting
            clonedEl.style.height = 'auto';
            clonedEl.style.minHeight = 'fit-content';
            clonedEl.style.margin = '0 auto';
            clonedEl.style.boxShadow = 'none';
            clonedEl.style.position = 'relative';
            clonedEl.style.backgroundColor = '#FFFFFF';
            clonedEl.style.overflow = 'visible';
          }
        }
      });
      
      if (!canvas || canvas.width === 0) {
        throw new Error("Failed to generate canvas");
      }

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Remove background color and borders for a clean black and white print
      // (Previously added light violet background and purple border)
      
      // Calculate dimensions to occupy the whole A4 with minimal margins
      const margin = 10; // 10mm margin
      const maxWidth = pdfWidth - (margin * 2);
      const maxHeight = pdfHeight - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = margin; // Start from the top margin

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      
      // Use a more robust download method for iframes
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${selectedLocationName}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification("Receipt downloaded successfully");
    } catch (error) {
      console.error("Download failed:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      showNotification(`Download failed: ${msg.substring(0, 30)}...`, "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={cn("min-h-screen font-sans transition-colors duration-300 relative overflow-hidden", 
      darkMode ? "bg-gradient-to-br from-[#1A1825] to-[#2D293D] text-[#E1E1E1]" : "bg-gradient-to-br from-violet-50 via-violet-100 to-violet-200 text-[#2D3436]")}>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <section className={cn("rounded-3xl border shadow-sm relative overflow-hidden transition-all duration-500",
          darkMode ? "bg-[#2D293D]/80 border-white/10 backdrop-blur-xl" : "bg-white/70 border-violet-100 backdrop-blur-md")}>
          
          {/* Header Actions */}
          <div className="absolute top-6 right-6 z-20 flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={cn("p-3 rounded-2xl transition-all shadow-lg", 
                darkMode ? "bg-white/10 text-amber-400 hover:bg-white/20" : "bg-white text-violet-600 hover:bg-violet-50")}
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <DropdownMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              darkMode={darkMode}
              trigger={
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={cn("p-3 rounded-2xl transition-all shadow-lg", 
                    darkMode ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-[#6A59CC] hover:bg-violet-50")}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              }
            >
              <div className="p-2 space-y-1">
                <div className="px-4 py-3 mb-2 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 rounded-t-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6A59CC] dark:text-[#9D8DF1] mb-1">Account</p>
                  <p className="text-sm font-black truncate text-[#2D3436] dark:text-white">{user?.name || "User"}</p>
                </div>
                <MenuButton 
                  icon={<UserIcon className="w-4 h-4" />} 
                  label="My Profile" 
                  darkMode={darkMode}
                  onClick={() => { setActiveModal("profile"); setIsMenuOpen(false); }} 
                />
                
                {user?.role !== "viewer" && (
                  <MenuButton 
                    icon={<History className="w-4 h-4" />} 
                    label="Login History" 
                    darkMode={darkMode}
                    onClick={() => { fetchHistory(); setIsMenuOpen(false); }} 
                  />
                )}

                {(user?.role === "main" || user?.role === "admin") && (
                  <MenuButton 
                    icon={<FileText className="w-4 h-4" />} 
                    label="Revenue Report" 
                    darkMode={darkMode}
                    onClick={() => { setActiveModal("report"); setIsMenuOpen(false); }} 
                  />
                )}

                {user?.role !== "viewer" && (
                  <MenuButton 
                    icon={<ShieldCheck className="w-4 h-4" />} 
                    label="Admin Requests" 
                    darkMode={darkMode}
                    onClick={() => { fetchAdminRequests(); setIsMenuOpen(false); }} 
                  />
                )}

                <MenuButton 
                  icon={<Map className="w-4 h-4" />} 
                  label="Live Map Tracker" 
                  darkMode={darkMode}
                  onClick={() => { setActiveModal("map"); setIsMenuOpen(false); }} 
                />

                {user?.role !== "viewer" && (
                  <MenuButton 
                    icon={<Navigation className="w-4 h-4" />} 
                    label="Real-Time Data Stream" 
                    darkMode={darkMode}
                    onClick={() => { setActiveModal("realtime"); setIsMenuOpen(false); }} 
                  />
                )}

                <div className="my-2 border-t border-gray-100 dark:border-white/5 pt-2">
                  <MenuButton 
                    icon={<LogOut className="w-4 h-4" />} 
                    label={user?.role === "viewer" ? "Exit Viewer" : "Sign Out"} 
                    variant="danger"
                    darkMode={darkMode}
                    onClick={handleLogout} 
                  />
                </div>
              </div>
            </DropdownMenu>
          </div>

          <div className="h-48 w-full relative group/banner">
            <img 
              src={bannerImage || "https://picsum.photos/seed/pawfeeds-banner/1200/400"} 
              alt="PawFeeds Banner" 
              className="w-full h-full object-cover opacity-50"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-current to-transparent opacity-20" />
            {user?.role !== "viewer" && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/banner:opacity-100 transition-opacity">
                <label className="p-2 bg-white/20 backdrop-blur-md text-white rounded-xl cursor-pointer hover:bg-white/30 flex items-center gap-2" title="Change Banner">
                  <Download className="w-5 h-5 rotate-180" />
                  <span className="text-[10px] font-bold uppercase tracking-widest pr-2">Banner</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleHeroImageUpload("banner", e)} />
                </label>
                <label className="p-2 bg-white/20 backdrop-blur-md text-white rounded-xl cursor-pointer hover:bg-white/30 flex items-center gap-2" title="Change Login Background">
                  <Download className="w-5 h-5 rotate-180" />
                  <span className="text-[10px] font-bold uppercase tracking-widest pr-2">Login BG</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleHeroImageUpload("loginBackground", e)} />
                </label>
              </div>
            )}
          </div>
          
          <div className="px-8 pb-8 relative z-10">
            {/* Logo and Welcome Header */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-12 mb-8">
              <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-[#2D293D] shrink-0 relative group/logo ring-4 ring-violet-500/10">
                <img 
                  src={logoImage || "https://picsum.photos/seed/pawfeeds-logo/200/200"} 
                  alt="PawFeeds Intro" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {user?.role !== "viewer" && (
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover/logo:opacity-100 transition-opacity">
                    <Download className="text-white w-8 h-8 rotate-180" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleHeroImageUpload("logo", e)} />
                  </label>
                )}
              </div>
              <div className="flex-1 pt-4 md:pt-0">
                <div className="relative group inline-block">
                  <h2 className="text-3xl md:text-4xl font-black mb-1 tracking-tight leading-tight">
                    {welcomeHeader || "Welcome back,"} <span className="text-[#6A59CC]">{user?.role === "viewer" ? (viewerDisplayName || "Public") : user?.name?.split(' ')[0]}</span>! 🐾
                  </h2>
                  {user?.role !== "viewer" && (
                    <div className="absolute -top-2 -right-12 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleTextEdit("welcomeHeader", welcomeHeader)}
                        className="p-1 bg-[#6A59CC] text-white rounded-full"
                        title="Edit Welcome Prefix"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleTextEdit("viewerDisplayName", viewerDisplayName)}
                        className="p-1 bg-[#4ECDC4] text-white rounded-full"
                        title="Edit Viewer Display Name"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 relative group">
                <p className={cn("text-lg leading-relaxed font-medium", darkMode ? "text-gray-300" : "text-[#7F8C8D]")}>
                  {welcomeSubtitle || "Smart feeding for strays. Every ₱1 provides 1g of care."}
                </p>
                {user?.role !== "viewer" && (
                  <button 
                    onClick={() => handleTextEdit("welcomeSubtitle", welcomeSubtitle)}
                    className="absolute -top-2 -right-2 p-1 bg-[#6A59CC] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Mission & Vision */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-4">
                <div className="flex-1 p-5 rounded-2xl bg-[#6A59CC]/5 border border-[#6A59CC]/10 relative group">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#6A59CC] mb-2">Our Mission</h4>
                  <p className="text-sm text-[#7F8C8D] font-medium leading-relaxed">
                    {mission || "Providing automated feeding solutions for strays and fostering a compassionate community."}
                  </p>
                  {user?.role !== "viewer" && (
                    <button 
                      onClick={() => handleTextEdit("mission", mission)}
                      className="absolute -top-2 -right-2 p-1 bg-[#6A59CC] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex-1 p-5 rounded-2xl bg-[#4ECDC4]/5 border border-[#4ECDC4]/10 relative group">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#4ECDC4] mb-2">Our Vision</h4>
                  <p className="text-sm text-[#7F8C8D] font-medium leading-relaxed">
                    {vision || "A world where every stray has access to food and every community is empowered to care."}
                  </p>
                  {user?.role !== "viewer" && (
                    <button 
                      onClick={() => handleTextEdit("vision", vision)}
                      className="absolute -top-2 -right-2 p-1 bg-[#4ECDC4] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#9D8DF1]/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        </section>

        {/* Fund Stray Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-3xl p-8 border shadow-xl flex flex-col md:flex-row items-center justify-between gap-8",
            darkMode ? "bg-gradient-to-br from-[#2D293D] to-[#1A1A1A] border-white/10" : "bg-gradient-to-br from-white to-[#F8F7FF] border-[#EEEEEE]")}
        >
          <div className="flex items-center gap-6">
            <div className="p-6 bg-[#FF6B6B] rounded-[2rem] shadow-lg shadow-[#FF6B6B]/20">
              <Heart className="text-white w-10 h-10" />
            </div>
            <div className="relative group">
              <h3 className="text-2xl font-black text-[#FF6B6B] mb-2">Fund Stray Feeding</h3>
              <p className="text-[#7F8C8D] text-sm max-w-md leading-relaxed">
                {user?.role === "viewer" 
                  ? (fundStrayMessage || "Every ₱1 funds 2 grams of food for a stray. Scan to help our silent friends.")
                  : "Manage the donation QR code and community impact. Every ₱1 funds 2 grams of food. Click the '+' icons to upload new assets."}
              </p>
              {user?.role !== "viewer" && (
                <button 
                  onClick={() => handleTextEdit("fundStrayMessage", fundStrayMessage)}
                  className="absolute -top-2 -right-2 p-1 bg-[#FF6B6B] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Plus className="w-3.3 h-3.3" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white rounded-3xl border border-[#EEEEEE] shadow-sm flex flex-col items-center gap-2 relative group/card-qr">
              <div 
                className={cn("w-32 h-32 bg-[#F8F7FF] rounded-2xl flex items-center justify-center border-2 border-dashed border-[#6A59CC]/20 relative overflow-hidden transition-all duration-300",
                  qrCode ? "cursor-pointer hover:scale-[1.02] shadow-lg shadow-[#6A59CC]/10" : "cursor-default")}
                onClick={() => qrCode && setIsQrModalOpen(true)}
              >
                {qrCode ? (
                  <img 
                    src={qrCode} 
                    alt="QR Code" 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <QrCode className="w-12 h-12 text-[#6A59CC] opacity-40" />
                )}
                
                {qrCode && (
                  <div 
                    className="absolute inset-0 bg-[#6A59CC]/0 hover:bg-[#6A59CC]/10 transition-colors flex items-center justify-center group/view-btn cursor-pointer"
                    onClick={() => setIsQrModalOpen(true)}
                  >
                    <Eye className="w-8 h-8 text-[#6A59CC] opacity-0 group-hover/view-btn:opacity-100 transition-all duration-300 transform scale-75 group-hover/view-btn:scale-100" />
                  </div>
                )}

                {user?.role !== "viewer" && (
                  <div className="absolute inset-0 opacity-0 group-hover/card-qr:opacity-100 transition-opacity pointer-events-none">
                    {qrCode && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeletion({
                            type: "qr",
                            title: "Delete QR Code",
                            message: "Are you sure you want to remove the donation QR code? This action cannot be undone.",
                          });
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg shadow-lg z-30 hover:scale-110 active:scale-95 pointer-events-auto"
                        title="Delete QR"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <label 
                      className="absolute bottom-2 right-2 p-1.5 bg-[#6A59CC] text-white rounded-lg shadow-lg z-30 hover:scale-110 active:scale-95 cursor-pointer pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                      title="Upload New QR"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetUpload("qr", e)} />
                    </label>
                  </div>
                )}
              </div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase text-[#6A59CC] block">Scan to Fund</span>
                <span className="text-[10px] font-bold text-[#7F8C8D]">DONATE QR</span>
              </div>
            </div>
            <div className="p-4 bg-white rounded-3xl border border-[#EEEEEE] shadow-sm flex flex-col items-center gap-3 relative group/card-gallery">
              <div 
                className={cn("w-32 h-32 bg-[#F8F7FF] rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer relative transition-all duration-300",
                  galleryImages.length > 0 ? "hover:scale-[1.02] shadow-lg shadow-[#4ECDC4]/10" : "border-2 border-dashed border-[#4ECDC4]/20")}
                onClick={() => setIsAssetModalOpen(true)}
              >
                {galleryImages.length > 0 ? (
                  <img 
                    src={galleryImages[0]} 
                    alt="Gallery Preview" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-[#4ECDC4] opacity-40" />
                )}
                
                <div 
                  className="absolute inset-0 bg-[#4ECDC4]/0 hover:bg-[#4ECDC4]/10 transition-colors flex items-center justify-center group/view-btn cursor-pointer"
                  onClick={() => setIsAssetModalOpen(true)}
                >
                  <Eye className="w-8 h-8 text-[#4ECDC4] opacity-0 group-hover/view-btn:opacity-100 transition-all duration-300 transform scale-75 group-hover/view-btn:scale-100" />
                </div>

                {user?.role !== "viewer" && (
                  <div className="absolute inset-0 opacity-0 group-hover/card-gallery:opacity-100 transition-opacity pointer-events-none">
                    {galleryImages.length > 0 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeletion({
                            type: "gallery",
                            index: 0,
                            title: "Delete Gallery Image",
                            message: "Are you sure you want to remove this image from the community gallery preview?",
                          });
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg shadow-lg z-30 hover:scale-110 active:scale-95 pointer-events-auto"
                        title="Delete Image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <label 
                      className="absolute bottom-2 right-2 p-1.5 bg-[#4ECDC4] text-white rounded-lg shadow-lg z-30 hover:scale-110 active:scale-95 cursor-pointer pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                      title="Upload New Gallery Photo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetUpload("gallery", e)} />
                    </label>
                  </div>
                )}
              </div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase text-[#4ECDC4] block">Community Feed</span>
                <span className="text-[10px] font-bold text-[#7F8C8D]">GALLERY ({galleryImages.length})</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Location Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full flex-1 scrollbar-hide">
            {filteredLocations.map((loc, idx) => (
              <div key={`loc-${loc}-${idx}`} className="relative group">
                <button
                  onClick={() => setSelectedLocationName(loc)}
                className={cn(
                  "px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap border flex items-center gap-2",
                  selectedLocationName === loc
                    ? "bg-[#6A59CC] text-white border-[#6A59CC] shadow-lg shadow-[#6A59CC]/20"
                    : cn("border-[#EEEEEE] hover:border-[#9D8DF1] hover:text-[#6A59CC]", 
                        darkMode ? "bg-white/5 text-[#7F8C8D]" : "bg-white text-[#7F8C8D]")
                )}
              >
                <MapPin className="w-4 h-4" />
                <span className="mr-2">{loc}</span>
                {hopperLevels[loc]?.lastSeen && (new Date().getTime() - new Date(hopperLevels[loc]!.lastSeen!).getTime() < 60000) && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                {user?.role !== "viewer" && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLocation(loc);
                    }}
                    className="p-1 hover:bg-rose-500 hover:text-white rounded-md transition-colors ml-1 -mr-2"
                    title={`Delete ${loc} Station`}
                  >
                    <X className="w-3 h-3" />
                  </div>
                )}
              </button>
            </div>
          ))}
          {user?.role !== "viewer" && (
            <button 
              onClick={handleAddLocation}
              className="p-3 rounded-2xl bg-[#4ECDC4] text-white shadow-lg shadow-[#4ECDC4]/20"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Stats Grid */}
        {user?.role !== "viewer" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Revenue" 
              value={`₱${stats.totalCoins.toFixed(2)}`} 
              subValue={`${stats.totalCoins} coins inserted`}
              icon={<Coins className="text-amber-500 w-6 h-6" />}
              color="amber"
              darkMode={darkMode}
            />
            <StatCard 
              title="Total Dispensed" 
              value={`${stats.totalGrams}g`} 
              subValue={`${stats.count} feeding sessions`}
              icon={<Weight className="text-[#9D8DF1] w-6 h-6" />}
              color="indigo"
              darkMode={darkMode}
            />
            <StatCard 
              title="Dog Food" 
              value={`${stats.dogGrams}g`} 
              subValue="Dispensed to dogs"
              icon={<Dog className="text-[#4ECDC4] w-6 h-6" />}
              color="teal"
              darkMode={darkMode}
            />
            <StatCard 
              title="Cat Food" 
              value={`${stats.catGrams}g`} 
              subValue="Dispensed to cats"
              icon={<Cat className="text-[#FF6B6B] w-6 h-6" />}
              color="rose"
              darkMode={darkMode}
            />
          </div>
        )}

        {/* Machine Info */}
        <div className={cn("rounded-3xl border shadow-sm overflow-hidden flex flex-col mb-8",
          darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#EEEEEE]")}>
              
                <div className="relative h-[250px] w-full bg-black/5 dark:bg-white/5 overflow-hidden">
              {typeof selectedLocation.lat === 'number' && typeof selectedLocation.lng === 'number' && selectedLocation.lat !== 0 ? (
                <MapContainer 
                  center={[selectedLocation.lat, selectedLocation.lng]} 
                  zoom={16} 
                  scrollWheelZoom={false}
                  className="w-full h-full z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filteredLocations.map((locName) => {
                    const coords = locationCoords[locName];
                    if (!coords || typeof coords.lat !== 'number' || coords.lat === 0) return null;
                    return (
                      <Marker 
                        key={locName} 
                        position={[coords.lat, coords.lng]}
                        opacity={selectedLocationName === locName ? 1 : 0.6}
                      >
                            <Popup>
                              <div className="text-center">
                                <p className="font-black text-[#6A59CC]">{locName} Station</p>
                                <p className="text-[10px] text-gray-500">{coords.address}</p>
                                {selectedLocationName !== locName && (
                                  <button 
                                    onClick={() => setSelectedLocationName(locName)}
                                    className="mt-2 text-[8px] font-black uppercase text-[#6A59CC] underline"
                                  >
                                    View Details
                                  </button>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                      <ChangeView center={[selectedLocation.lat, selectedLocation.lng]} zoom={16} />
                    </MapContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-[#6A59CC]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-10" />
                  {selectedLocation.lat !== 0 && (
                    <a 
                      href={`https://www.openstreetmap.org/?mlat=${selectedLocation.lat}&mlon=${selectedLocation.lng}#map=16/${selectedLocation.lat}/${selectedLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 right-4 px-4 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center gap-2 z-20"
                    >
                      <Navigation className="w-3 h-3" />
                      Open in OSM
                    </a>
                  )}
                </div>

              <div className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-black mb-2">{selectedLocation.name} Station</h3>
                    <p className="text-[#7F8C8D] max-w-md leading-relaxed text-sm">{selectedLocation.address}</p>
                  </div>
                  {selectedLocation.plusCode && (
                    <div className="px-4 py-2 bg-[#6A59CC]/10 rounded-xl border border-[#6A59CC]/20 text-center">
                      <p className="text-[8px] font-black text-[#6A59CC] uppercase tracking-widest mb-1">Plus Code</p>
                      <p className="text-xs font-mono font-bold text-[#6A59CC]">{selectedLocation.plusCode}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                    <p className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-widest mb-1">Latitude (DMS)</p>
                    <p className="font-mono font-bold text-sm">{toDMS(selectedLocation.lat, true)}</p>
                    <p className="text-[10px] text-[#7F8C8D] mt-1 opacity-50">{selectedLocation.lat.toFixed(6)}°</p>
                  </div>
                  <div className="px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                    <p className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-widest mb-1">Longitude (DMS)</p>
                    <p className="font-mono font-bold text-sm">{toDMS(selectedLocation.lng, false)}</p>
                    <p className="text-[10px] text-[#7F8C8D] mt-1 opacity-50">{selectedLocation.lng.toFixed(6)}°</p>
                  </div>
                </div>
              </div>
          </div>

        {/* Recent Activity Table */}
        <div className={cn("rounded-3xl border shadow-sm overflow-hidden",
          darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#EEEEEE]")}>
          <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <History className="text-[#6A59CC] w-5 h-5" />
              <h3 className="font-extrabold text-lg">Recent Feedings at {selectedLocationName}</h3>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-bold text-[#7F8C8D] bg-[#F8F7FF] dark:bg-white/5 px-3 py-2 rounded-xl whitespace-nowrap">
                {filteredLogs.length} Records
              </span>
              {(user?.role === "main" || user?.role === "admin") && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPendingDeletion({
                      type: "reset_logs",
                      title: "Reset Device Logs",
                      message: `Are you sure you want to clear all history for ${selectedLocationName}? This will reset all dispensing stats.`,
                    })}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset Logs
                  </button>
                  <button 
                    onClick={() => setActiveModal("report")}
                    className="flex items-center gap-2 px-4 py-2 bg-[#6A59CC] text-white rounded-xl font-bold text-xs shadow-lg shadow-[#6A59CC]/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    Download Receipt
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={cn("text-[#7F8C8D] text-[10px] uppercase tracking-widest font-bold",
                  darkMode ? "bg-white/5" : "bg-[#F8F7FF]")}>
                  <th className="px-6 py-4">Pet Type</th>
                  <th className="px-6 py-4">Coins</th>
                  <th className="px-6 py-4">Grams</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <AnimatePresence initial={false}>
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <motion.tr 
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-xl",
                              log.type?.toLowerCase() === "dog" ? "bg-[#4ECDC4]/10 text-[#4ECDC4]" : "bg-[#FF6B6B]/10 text-[#FF6B6B]"
                            )}>
                              {log.type?.toLowerCase() === "dog" ? <Dog className="w-4 h-4" /> : <Cat className="w-4 h-4" />}
                            </div>
                            <span className="font-bold text-sm">{log.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold">₱{log.coins}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-[#6A59CC]">{log.grams}g</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[#7F8C8D] text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                            DISPENSED
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-[#7F8C8D]">
                          <Activity className="w-12 h-12 opacity-20" />
                          <p className="font-bold">No data gathered in {selectedLocationName} yet.</p>
                          <p className="text-xs">Waiting for incoming signals from GSM SIM7600...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* QR Code Selection Modal */}
      <AnimatePresence>
        {isQrModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsQrModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn("w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden p-8 flex flex-col items-center gap-6",
                darkMode ? "bg-[#2D293D]" : "bg-white")}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-rose-50 text-rose-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center">
                <h3 className="text-2xl font-black text-[#6A59CC] mb-2">Fund Stray Feeding</h3>
                <p className="text-[#7F8C8D] text-sm font-medium mb-6">
                  Scan this QR code to donate and fund food refills.
                  <span className="block mt-1 text-[#6A59CC] font-bold">₱1 = 2 grams of food 🐾</span>
                </p>
                
                <div className="bg-white p-6 rounded-[2.5rem] shadow-inner mb-4 border-4 border-[#6A59CC]/10 relative group/qr flex flex-col items-center">
                  <img src={qrCode} alt="Donation QR Code" className="w-64 h-64 object-contain mx-auto" />
                  
                  {user?.role !== "viewer" && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeletion({
                          type: "qr",
                          title: "Delete QR Code",
                          message: "Are you sure you want to remove the donation QR code? This will disable funding scans until a new one is uploaded.",
                        });
                      }}
                      className="absolute top-4 right-4 p-3 bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-500/40 z-20 hover:scale-110 active:scale-95 transition-all"
                      title="Delete QR Code"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedImage(qrCode)}
                  className="mb-6 inline-flex items-center gap-2 px-6 py-3 bg-[#6A59CC]/10 text-[#6A59CC] rounded-2xl font-bold hover:bg-[#6A59CC]/20 transition-all group"
                >
                  <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  View Larger
                </button>
                
                <p className="text-[10px] font-black uppercase tracking-widest text-[#6A59CC] opacity-60">
                  Thank you for your kindness! 🐾
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset Modal (Gallery) */}
      <AnimatePresence>
        {isAssetModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn("w-full max-w-4xl rounded-[40px] shadow-2xl relative overflow-hidden p-8",
                darkMode ? "bg-[#2D293D]" : "bg-white")}
            >
              <button 
                onClick={() => setIsAssetModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-rose-50 text-rose-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-[#6A59CC]">Community Gallery</h3>
                  {user?.role !== "viewer" && (
                    <label className="flex items-center gap-2 px-4 py-2 bg-[#4ECDC4] text-white rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-[#4ECDC4]/20">
                      <Plus className="w-4 h-4" />
                      Add Photo
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetUpload("gallery", e)} />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                  {galleryImages.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                      <ImageIcon className="w-16 h-16 text-[#7F8C8D] opacity-20 mx-auto mb-4" />
                      <p className="text-[#7F8C8D] font-bold">No photos in the gallery yet.</p>
                    </div>
                  ) : (
                    galleryImages.map((img, i) => (
                      <div 
                        key={`gallery-${i}-${img.substring(0, 20)}`} 
                        className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer"
                        onClick={() => setSelectedImage(img)}
                      >
                        <img 
                          src={img} 
                          alt={`Gallery ${i}`} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 scale-75 group-hover:scale-100 transition-all duration-300" />
                        </div>
                        {user?.role !== "viewer" && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeletion({
                                type: "gallery",
                                index: i,
                                title: "Remove Photo",
                                message: "Are you sure you want to permanently delete this photo from the community gallery?",
                              });
                            }}
                            className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/30 z-20 hover:scale-110 active:scale-95 transition-all"
                            title="Delete Image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={cn("w-full max-w-2xl my-8 p-6 md:p-8 rounded-[2.5rem] shadow-2xl relative", 
                darkMode ? "bg-[#2D293D] border border-white/10" : "bg-white")}
            >
              <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors z-50">
                <X className="w-6 h-6" />
              </button>

              {activeModal === "profile" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="p-4 bg-[#6A59CC]/10 rounded-[2rem]">
                      <UserIcon className="w-8 h-8 text-[#6A59CC]" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-[#6A59CC]">
                        {user?.role === "viewer" ? "Guest Profile" : "My Profile"}
                      </h3>
                      <p className="text-xs font-bold text-[#7F8C8D] uppercase tracking-widest">
                        {user?.role === "viewer" ? "Public Access" : `Role: ${user?.role}`}
                      </p>
                    </div>
                  </div>

                  {user?.role === "viewer" ? (
                    <div className={cn("p-6 rounded-3xl border space-y-4", 
                      darkMode ? "bg-white/5 border-white/10" : "bg-[#F8F7FF] border-[#EEEEEE]")}>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#6A59CC]">Display Name</p>
                        <p className="font-bold text-lg">{user?.name || "Public Viewer"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#6A59CC]">About This Account</p>
                        <p className="text-sm font-medium text-[#7F8C8D] leading-relaxed">
                          You are currently browsing the dashboard as a guest. You have access to real-time maps, location data, and the community gallery. Some administrative features like dispensing food or editing settings are restricted.
                        </p>
                      </div>
                      <div className="pt-4 border-t border-dashed border-[#6A59CC]/20 space-y-3">
                        <p className="text-[10px] font-black uppercase text-center text-[#7F8C8D]">Ready to join the community?</p>
                        <button 
                          onClick={() => handleLogout()}
                          className="w-full py-4 bg-white text-[#6A59CC] border-2 border-[#6A59CC] rounded-2xl font-bold hover:bg-[#6A59CC] hover:text-white transition-all shadow-lg shadow-[#6A59CC]/10"
                        >
                          Sign Out / Switch Account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={updateProfile} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-widest ml-2">Full Name</label>
                        <input 
                          type="text" 
                          className={cn("w-full px-6 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#9D8DF1] transition-all font-bold",
                            darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          placeholder="Your Full Name"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-widest ml-2">Bio</label>
                        <textarea 
                          className={cn("w-full px-6 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#9D8DF1] transition-all h-24 resize-none font-bold",
                            darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-widest ml-2">Managing Location</label>
                        <input 
                          type="text"
                          className={cn("w-full px-6 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#9D8DF1] transition-all font-bold",
                            darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                          value={profileForm.managingLocation}
                          onChange={(e) => setProfileForm({ ...profileForm, managingLocation: e.target.value })}
                          placeholder="Assigned Station"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-widest ml-2">Change Password</label>
                        <input 
                          type="password" 
                          placeholder="New Password (leave blank to keep current)"
                          className={cn("w-full px-6 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#9D8DF1] transition-all font-bold",
                            darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                          value={profileForm.password}
                          onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                        />
                      </div>
                      <button 
                        type="submit"
                        className="w-full py-4 bg-[#6A59CC] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-[#6A59CC]/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                      >
                        Save Changes
                      </button>
                    </form>
                  )}
                </div>
              )}

              {activeModal === "report" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dashed border-[#EEEEEE] pb-4">
                    <div>
                      <h3 className="text-2xl font-black text-[#6A59CC]">Revenue Report</h3>
                      <p className="text-xs font-bold text-[#7F8C8D] uppercase tracking-widest">Station: {selectedLocationName}</p>
                    </div>
                    <button 
                      onClick={downloadReceipt} 
                      disabled={isDownloading}
                      className={cn("flex items-center gap-2 px-6 py-3 bg-[#4ECDC4] text-white rounded-2xl font-black text-xs shadow-lg shadow-[#4ECDC4]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50")}
                    >
                      {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isDownloading ? "Generating..." : "Download Receipt"}
                    </button>
                  </div>
                  <div className="overflow-x-auto pb-4">
                    <div ref={receiptRef} data-receipt="true" className={cn("min-w-[400px] p-8 rounded-[2.5rem] border-2 border-dashed relative overflow-hidden", darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#E0E0E0]")}>
                    {/* Decorative Elements */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#6A59CC]/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-[#4ECDC4]/10 rounded-full blur-2xl" />
                    
                    {/* Cute Animal Ears for the Receipt */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-12 opacity-20">
                      <div className="w-12 h-12 bg-[#6A59CC] rounded-full" />
                      <div className="w-12 h-12 bg-[#6A59CC] rounded-full" />
                    </div>

                    <div className="text-center mb-8 relative">
                      <div className="inline-flex p-4 bg-gradient-to-br from-[#6A59CC] to-[#8E78FF] rounded-3xl mb-4 shadow-lg shadow-[#6A59CC]/30 rotate-3">
                        <PawPrint className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-3xl font-black text-[#2D3436] dark:text-white tracking-tight">Smart Feeder</h3>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <div className="h-[2px] w-4 bg-[#6A59CC]/30" />
                        <p className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-[0.2em]">Official Revenue Report</p>
                        <div className="h-[2px] w-4 bg-[#6A59CC]/30" />
                      </div>
                    </div>

                    <div className="space-y-6 relative">
                      <div className="flex justify-between items-end border-b-2 border-dashed border-[#F0F0F0] pb-6">
                        <div>
                          <p className="text-[10px] font-bold text-[#B0B0B0] uppercase mb-1">Station ID</p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#4ECDC4] animate-pulse" />
                            <p className="text-xl font-black text-[#6A59CC]">{selectedLocationName}</p>
                          </div>
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[9px] font-bold text-[#7F8C8D] flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {selectedLocation.address}
                            </p>
                            <p className="text-[8px] font-mono text-[#B0B0B0]">
                              {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lng.toFixed(4)}°E • {selectedLocation.plusCode}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-[#B0B0B0] uppercase mb-1">Generated On</p>
                          <p className="text-sm font-bold text-[#2D3436]">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-[10px] font-mono text-[#7F8C8D]">{new Date().toLocaleTimeString()}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-5 rounded-[2rem] bg-[#F8F7FF] dark:bg-white/5 border-2 border-white dark:border-white/10 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Dog className="w-12 h-12 -rotate-12" />
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-[#6A59CC] rounded-lg">
                              <Dog className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider">Dog Section</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#7F8C8D]">Dispensed</span>
                              <span className="text-xs font-bold">{stats.dogGrams}g</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#7F8C8D]">Revenue</span>
                              <span className="text-lg font-black text-[#6A59CC]">₱{stats.dogCoins.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-5 rounded-[2rem] bg-[#F0FFF4] dark:bg-white/5 border-2 border-white dark:border-white/10 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Cat className="w-12 h-12 rotate-12" />
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-[#4ECDC4] rounded-lg">
                              <Cat className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider">Cat Section</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#7F8C8D]">Dispensed</span>
                              <span className="text-xs font-bold">{stats.catGrams}g</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#7F8C8D]">Revenue</span>
                              <span className="text-lg font-black text-[#4ECDC4]">₱{stats.catCoins.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-3 px-2">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#7F8C8D]" />
                            <span className="text-[10px] font-bold text-[#7F8C8D] uppercase">Total System Volume</span>
                          </div>
                          <span className="text-sm font-black text-[#2D3436]">{stats.totalGrams}g</span>
                        </div>
                        
                        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-[#6A59CC] via-[#7C69E0] to-[#8E78FF] text-white shadow-2xl shadow-[#6A59CC]/30 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                          <div className="flex justify-between items-center relative">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80 mb-1">Total Revenue</p>
                              <p className="text-4xl font-black tracking-tighter">₱{stats.totalCoins.toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-white/20 rounded-[1.5rem] backdrop-blur-xl border border-white/30 rotate-6">
                              <Coins className="w-10 h-10 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center pt-6">
                        <div className="relative inline-block">
                          <div className="absolute inset-0 bg-[#6A59CC]/5 blur-xl rounded-full" />
                          <div className="relative px-6 py-2.5 rounded-full bg-white dark:bg-white/5 border border-[#F0F0F0] dark:border-white/10 text-[10px] font-bold text-[#6A59CC] uppercase tracking-[0.2em] flex items-center gap-2">
                            <Heart className="w-3 h-3 fill-[#6A59CC]" />
                            Helping Strays Daily
                            <Heart className="w-3 h-3 fill-[#6A59CC]" />
                          </div>
                        </div>
                        <p className="text-[8px] text-[#B0B0B0] mt-4 font-mono uppercase tracking-widest">Verified Digital Receipt • {new Date().getFullYear()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {activeModal === "realtime" && (
                <RealTimeLocations />
              )}

              {activeModal === "map" && (
                <div className="space-y-6">
                  <LiveMap />
                  <RealTimeLocations />
                </div>
              )}

              {activeModal === "history" && user?.role !== "viewer" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-[#6A59CC]">Login History</h3>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-hide">
                    {filteredLoginHistory.length === 0 ? (
                      <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                        <p className="text-[#7F8C8D] font-bold">No records found.</p>
                      </div>
                    ) : (
                      filteredLoginHistory.map((record, i) => (
                        <div key={`${record.username}-${record.timestamp}-${i}`} className={cn("p-4 rounded-2xl border flex justify-between items-center",
                          darkMode ? "bg-white/5 border-white/10" : "bg-[#F8F7FF] border-[#EEEEEE]")}>
                          <div>
                            <p className="text-sm font-bold">{maskEmail(record.username)}</p>
                            <p className="text-[10px] text-[#7F8C8D] font-bold uppercase tracking-widest">Admin Access</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold">{new Date(record.timestamp).toLocaleDateString()}</p>
                            <p className="text-[10px] text-[#7F8C8D]">{new Date(record.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeModal === "requests" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-[#6A59CC]">Admin Requests</h3>
                  </div>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-hide">
                    {filteredAdminRequests.length === 0 ? (
                      <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                        <p className="text-[#7F8C8D] font-bold">No pending requests</p>
                      </div>
                    ) : (
                      filteredAdminRequests.map((req) => (
                        <div key={req.uid} className={cn("p-6 rounded-2xl border flex items-center justify-between gap-4",
                          darkMode ? "bg-white/5 border-white/10" : "bg-[#F8F7FF] border-[#EEEEEE]")}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#6A59CC] rounded-xl flex items-center justify-center text-white font-black text-xl">
                              {req.name[0]}
                            </div>
                            <div>
                              <p className="font-bold">{req.name}</p>
                              <p className="text-xs text-[#7F8C8D]">@{maskEmail(req.username)}</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#6A59CC] mt-1 flex items-center gap-1">
                                <MapPin className="w-2 h-2" />
                                {req.managingLocation}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleApproveAdmin(req.uid, "approved")}
                              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors flex items-center gap-2"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                            <button 
                              onClick={() => handleApproveAdmin(req.uid, "declined")}
                              className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-600 transition-colors flex items-center gap-2"
                            >
                              <X className="w-3 h-3" />
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text Edit Modal */}
      <AnimatePresence>
        {textEditModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn("w-full max-w-lg p-8 rounded-[2.5rem] shadow-2xl relative", 
                darkMode ? "bg-[#2D293D] border border-white/10" : "bg-white")}
            >
              <button onClick={() => setTextEditModal(null)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-6">
                <h3 className="text-2xl font-black text-[#6A59CC]">
                  {textEditModal.type === "addLocation" ? "Add New Station" : "Edit Content"}
                </h3>
                
                {textEditModal.type === "addLocation" ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Search Location</p>
                        <PlacesAutocomplete 
                          darkMode={darkMode}
                          onError={(msg) => showNotification(msg, "error")}
                          onSelect={(address, lat, lng, plusCode, mainText) => {
                            setTextEditModal({ ...textEditModal, value: mainText || address.split(',')[0] });
                            setLocationDetails({ address, lat, lng, plusCode: plusCode || "" });
                          }}
                        />
                        {locationDetails && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                            <MapPin className="w-3 h-3" />
                            Location Verified: {locationDetails.lat.toFixed(4)}, {locationDetails.lng.toFixed(4)}
                            <a 
                              href={`https://www.openstreetmap.org/?mlat=${locationDetails.lat}&mlon=${locationDetails.lng}#map=16/${locationDetails.lat}/${locationDetails.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto hover:underline"
                            >
                              Verify on Map
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Station Name (Display)</p>
                        <input 
                          className={cn("w-full p-5 rounded-2xl border outline-none focus:ring-2 focus:ring-[#6A59CC] transition-all font-bold",
                            darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                          value={textEditModal.value}
                          placeholder="e.g. Alijis Station"
                          onChange={(e) => setTextEditModal({ ...textEditModal, value: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Latitude</p>
                          <input 
                            type="number"
                            step="any"
                            className={cn("w-full p-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#6A59CC] transition-all font-bold",
                              darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                            value={locationDetails?.lat || 10.6386}
                            onChange={(e) => setLocationDetails({ ...locationDetails!, lat: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Longitude</p>
                          <input 
                            type="number"
                            step="any"
                            className={cn("w-full p-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#6A59CC] transition-all font-bold",
                              darkMode ? "bg-white/5 border-white/10 text-white" : "bg-[#F8F7FF] border-[#EEEEEE] text-[#2D3436]")}
                            value={locationDetails?.lng || 122.9511}
                            onChange={(e) => setLocationDetails({ ...locationDetails!, lng: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <textarea 
                    className={cn("w-full p-4 rounded-2xl border outline-none focus:ring-2 focus:ring-[#6A59CC] transition-all min-h-[150px]",
                      darkMode ? "bg-white/5 border-white/10" : "bg-[#F8F7FF] border-[#EEEEEE]")}
                    value={textEditModal.value}
                    onChange={(e) => setTextEditModal({ ...textEditModal, value: e.target.value })}
                  />
                )}
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setTextEditModal(null);
                        setLocationDetails(null);
                      }}
                      className="flex-1 py-4 rounded-2xl font-bold text-[#7F8C8D] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={saveTextEdit}
                      disabled={textEditModal.type === "addLocation" && !locationDetails}
                      className={cn("flex-1 py-4 text-white rounded-2xl font-bold shadow-lg transition-all",
                        (textEditModal.type === "addLocation" && !locationDetails) 
                          ? "bg-gray-400 cursor-not-allowed opacity-50" 
                          : "bg-[#6A59CC] shadow-[#6A59CC]/20")}
                    >
                      {textEditModal.type === "addLocation" ? "Create Station" : "Save Changes"}
                    </button>
                  </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refill Modal */}
      <AnimatePresence>
        {refillModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={cn("w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl relative", 
                darkMode ? "bg-[#2D293D] border border-white/10" : "bg-white")}
            >
              <div className="text-center space-y-6">
                <div className="inline-flex p-4 bg-[#6A59CC]/10 rounded-3xl">
                  <RefreshCw className="text-[#6A59CC] w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black">Refill {refillModal.type === "cat" ? "Cat" : "Dog"} Food</h3>
                <p className="text-[#7F8C8D] text-sm">
                  Enter the new food level percentage for <span className="font-bold text-[#6A59CC]">{selectedLocationName}</span>.
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold px-2">
                    <span>Level</span>
                    <span>{refillModal.value}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={refillModal.value}
                    onChange={(e) => setRefillModal({ ...refillModal, value: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#6A59CC]"
                  />
                  <div className="flex justify-between text-[10px] text-[#7F8C8D] px-1">
                    <span>Empty</span>
                    <span>Full</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setRefillModal(null)}
                    className="flex-1 py-4 rounded-2xl font-bold text-[#7F8C8D] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmRefill}
                    className="flex-1 py-4 bg-[#6A59CC] text-white rounded-2xl font-bold shadow-lg shadow-[#6A59CC]/20"
                  >
                    Confirm Refill
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Deletion Confirmation Modal */}
      <AnimatePresence>
        {pendingDeletion && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isActionLoading && setPendingDeletion(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn("relative w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl border text-center transform-gpu",
                darkMode ? "bg-[#2D293D] border-white/10" : "bg-white border-[#EEEEEE]")}
            >
              <div className="inline-flex p-4 bg-rose-50 rounded-3xl mb-6">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-2xl font-black mb-2 text-[#2D3436] dark:text-white">{pendingDeletion.title}</h3>
              <p className="text-sm text-[#7F8C8D] font-medium leading-relaxed mb-8 px-2">
                {pendingDeletion.message}
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={executeDeletion}
                  disabled={isActionLoading}
                  className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-500/30 hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isActionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Confirm Delete"}
                </button>
                <button 
                  onClick={() => setPendingDeletion(null)}
                  disabled={isActionLoading}
                  className="w-full py-4 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                >
                  Keep It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image Preview */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedImage} 
                alt="Fullscreen content" 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" 
              />
            </motion.div>
            
            <div className="mt-8 text-center hidden sm:block">
              <p className="text-white/60 font-black uppercase tracking-widest text-xs">
                {selectedImage === qrCode ? "Donation QR Code Preview" : "Community Feed Preview"}
              </p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="px-8 py-3 bg-white text-black rounded-full font-black uppercase text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                >
                  Close View
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2",
              notification.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}
          >
            {notification.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto p-6 text-center text-[#7F8C8D] text-xs font-bold border-t border-[#EEEEEE] dark:border-white/10 mt-12">
        PawFeeds DASHBOARD © 2026 • ECE SMART FEEDING NETWORK • POWERED BY GSM SIM7600
      </footer>
    </div>
  );
}
