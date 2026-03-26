import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const EMAIL_KEY = "alignr-sync-email";

function getConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function isConfigured() {
  return !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
}

function getDb() {
  const config = getConfig();
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  return getFirestore(app);
}

async function emailToId(email) {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function getSyncEmail() {
  return localStorage.getItem(EMAIL_KEY) || "";
}

export function clearSyncEmail() {
  localStorage.removeItem(EMAIL_KEY);
}

export async function uploadData(state) {
  const email = getSyncEmail();
  if (!email || !isConfigured()) return false;
  try {
    const id = await emailToId(email);
    await setDoc(doc(getDb(), "users", id), { state, updatedAt: Date.now() });
    return true;
  } catch (e) {
    console.warn("Sync upload failed:", e);
    return false;
  }
}

export async function downloadData() {
  const email = getSyncEmail();
  if (!email || !isConfigured()) return null;
  try {
    const id = await emailToId(email);
    const snap = await getDoc(doc(getDb(), "users", id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Sync download failed:", e);
    return null;
  }
}

let syncTimer = null;
export function scheduleSync(state) {
  if (!getSyncEmail() || !isConfigured()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => uploadData(state), 5000);
}
