import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase configuration and Firestore client.
 *
 * Used as the cloud database for rank tracking data so the Vercel cron job
 * can read projects/keywords and write rankings even when the local dev
 * machine is off. The local SQLite database remains the primary store for
 * crawl data, audits, etc.
 */

const firebaseConfig = {
  apiKey: "AIzaSyBiCs4KOSVSKsZMHDNGm6pCqjgkwNDSevA",
  authDomain: "semrush-a0817.firebaseapp.com",
  projectId: "semrush-a0817",
  storageBucket: "semrush-a0817.firebasestorage.app",
  messagingSenderId: "1092604654621",
  appId: "1:1092604654621:web:5c56bb3f7cc7edd6bd02f4",
  measurementId: "G-RV0444PFJY",
};

// Singleton — Firebase warns if you initialize twice
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const firestore = getFirestore(app);
export { app as firebaseApp };

// Re-export Firestore utilities for convenience
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
};
