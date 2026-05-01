import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: Firestore;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app = admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log(`Firebase Admin initialized successfully for database: ${firebaseConfig.firestoreDatabaseId}`);
  } else {
    console.error("firebase-applet-config.json not found");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

// Initialize Alijis station if it doesn't exist
async function initStations() {
  if (!db) return;
  try {
    const alijisRef = db.collection("stations").doc("Alijis");
    const doc = await alijisRef.get();
    if (!doc.exists) {
      await alijisRef.set({
        name: "Alijis",
        lat: 10.6386,
        lng: 122.9511,
        address: "Alijis Road, Bacolod City",
        plusCode: "8FVC+W2 Bacolod",
        hopperLevels: { cat: 85, dog: 92 },
        lastSeen: FieldValue.serverTimestamp()
      });
      console.log("Initialized Alijis station in Firestore");
    }

    // Initialize global assets if they don't exist
    const assetsRef = db.collection("assets").doc("global");
    const assetsDoc = await assetsRef.get();
    if (!assetsDoc.exists) {
      await assetsRef.set({
        mission: "Providing automated feeding solutions for strays and fostering a compassionate community.",
        vision: "A world where every stray has access to food and every community is empowered to care.",
        fundStrayMessage: "Every ₱1 funds 2 grams of food for our furry friends. Your contributions help us maintain the feeding stations and purchase high-quality food. Every peso counts!",
        welcomeSubtitle: "Monitor and manage your smart feeding stations in real-time.",
        welcomeHeader: "Welcome back,",
        viewerDisplayName: "Public",
        signupPrompt: "New Admin? Sign UP",
        bannerImage: "https://picsum.photos/seed/pawfeeds-banner/1200/400",
        logoImage: "https://picsum.photos/seed/pawfeeds-logo/200/200",
        loginBackgroundImage: "https://picsum.photos/seed/pawfeeds-login/1920/1080"
      });
      console.log("Initialized global assets in Firestore");
    }
  } catch (err: any) {
    if (err.code === 7 || err.message?.includes("PERMISSION_DENIED")) {
      console.warn("Firebase Admin: Missing or insufficient permissions. Skipping initStations. This is expected if using a custom project without a service account key.");
      return;
    }
    console.error("Error in initStations:", err);
  }
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
  username: string;
  name: string;
  bio: string;
  managingLocation: string;
  role: "admin" | "main";
  status: "pending" | "approved" | "declined";
  password?: string;
}

interface LoginRecord {
  username: string;
  timestamp: string;
}

async function startServer() {
  await initStations();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoint for Arduino/GSM
  app.post("/api/dispense", async (req, res) => {
    let { location, type, coins, catLevel, dogLevel, lat, lng } = req.body;
    if (!location || !type || typeof coins !== "number") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Standardize inputs
    location = String(location).trim();
    type = String(type).trim();
    // Capitalize first letter (e.g. dog -> Dog)
    type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

    try {
      const logId = Math.random().toString(36).substring(7);
      const timestamp = FieldValue.serverTimestamp();

      // 1. Create Log in Firestore
      await db.collection("logs").doc(logId).set({
        id: logId,
        location,
        type,
        coins,
        grams: coins * 2,
        timestamp,
      });

      // 2. Update Station in Firestore
      const stationRef = db.collection("stations").doc(location);
      const stationDoc = await stationRef.get();

      let updateData: any = {
        lastSeen: timestamp,
      };

      if (stationDoc.exists) {
        const currentLevels = stationDoc.data()?.hopperLevels || { cat: 100, dog: 100 };
        let newCat = currentLevels.cat;
        let newDog = currentLevels.dog;

        if (typeof catLevel === "number") {
          newCat = catLevel;
        } else if (type === "Cat") {
          newCat = Math.max(0, newCat - coins);
        }

        if (typeof dogLevel === "number") {
          newDog = dogLevel;
        } else if (type === "Dog") {
          newDog = Math.max(0, newDog - coins);
        }

        updateData.hopperLevels = { cat: newCat, dog: newDog };
      } else {
        // If station doesn't exist, create it
        updateData.name = location;
        updateData.hopperLevels = { cat: 100, dog: 100 };
      }

      if (typeof lat === "number" && typeof lng === "number") {
        updateData.lat = lat;
        updateData.lng = lng;
      }

      await stationRef.set(updateData, { merge: true });

      res.status(201).json({ success: true, id: logId });
    } catch (error) {
      console.error("Firestore Dispense Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware...
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
