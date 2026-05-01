import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// ENV
// =========================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = Number(process.env.PORT) || 8080;

// =========================
// FIREBASE INIT
// =========================
let db: Firestore | null = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    const app = admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });

    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

    console.log("✅ Firebase Admin initialized");
  } else {
    console.warn("⚠ firebase-applet-config.json missing (Railway-safe mode)");
  }
} catch (error) {
  console.error("❌ Firebase init error:", error);
}

// =========================
// INIT STATIONS
// =========================
async function initStations() {
  if (!db) return;

  const ref = db.collection("stations").doc("Alijis");
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      name: "Alijis",
      lat: 10.6386,
      lng: 122.9511,
      hopperLevels: { cat: 85, dog: 92 },
      lastSeen: FieldValue.serverTimestamp(),
    });

    console.log("✅ Station created");
  }
}

// =========================
// SERVER
// =========================
async function startServer() {
  await initStations();

  const app = express();
  app.use(express.json());

  // =========================
  // 🔥 ROOT ROUTE (FIX 502)
  // =========================
  app.get("/", (_, res) => {
    res.send("Server is running 🚀");
  });

  // =========================
  // GEMINI API
  // =========================
  app.post("/api/gemini", async (req, res) => {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const { prompt } = req.body;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Gemini error:", error);
      res.status(500).json({ error: "Gemini failed" });
    }
  });

  // =========================
  // DISPENSE API
  // =========================
  app.post("/api/dispense", async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: "DB not ready" });
    }

    let { location, type, coins, catLevel, dogLevel, lat, lng } = req.body;

    if (!location || !type || typeof coins !== "number") {
      return res.status(400).json({ error: "Missing fields" });
    }

    location = String(location).trim();
    type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

    try {
      const id = Math.random().toString(36).substring(7);
      const timestamp = FieldValue.serverTimestamp();

      await db.collection("logs").doc(id).set({
        id,
        location,
        type,
        coins,
        grams: coins * 2,
        timestamp,
      });

      const ref = db.collection("stations").doc(location);
      const snap = await ref.get();

      let update: any = { lastSeen: timestamp };

      if (snap.exists) {
        const levels = snap.data()?.hopperLevels || { cat: 100, dog: 100 };

        let cat = typeof catLevel === "number" ? catLevel : levels.cat;
        let dog = typeof dogLevel === "number" ? dogLevel : levels.dog;

        if (type === "Cat") cat = Math.max(0, cat - coins);
        if (type === "Dog") dog = Math.max(0, dog - coins);

        update.hopperLevels = { cat, dog };
      } else {
        update.name = location;
        update.hopperLevels = { cat: 100, dog: 100 };
      }

      if (typeof lat === "number" && typeof lng === "number") {
        update.lat = lat;
        update.lng = lng;
      }

      await ref.set(update, { merge: true });

      res.json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // =========================
  // VITE (FRONTEND)
  // =========================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), "dist");

    app.use(express.static(dist));

    app.get("*", (_, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  // =========================
  // START
  // =========================
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();