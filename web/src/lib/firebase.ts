// Firebase client-side init (Web SDK). Alleen gebruiken vanuit client components.
// Config komt uit NEXT_PUBLIC_* env-vars; zie .env.local.example.
// Zolang het echte Firebase-project nog niet bestaat, zijn de vars leeg en
// meldt isFirebaseConfigured() dat opslaan nog niet actief is.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True zodra de env-vars gevuld zijn en Firebase echt gebruikt kan worden. */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

/**
 * Zelfde config als de hoofd-app, voor een secundaire app-instantie
 * (bv. teamleden aanmaken zonder de ingelogde eigenaar uit te loggen).
 */
export function getFirebaseConfig() {
  return firebaseConfig;
}

// Singleton-patroon zodat Next.js hot-reload niet crasht op dubbele init.
function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

/** Firebase Auth instance (lazy, client-side). Gooit als config ontbreekt. */
export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(app());
  return _auth;
}

/** Firestore instance (lazy, client-side). Gooit als config ontbreekt. */
export function getDb(): Firestore {
  if (!_db) _db = getFirestore(app());
  return _db;
}

/**
 * True als Firebase Storage bruikbaar is (bucket in de config). De bucket moet
 * daarnaast in de Firebase Console geactiveerd zijn; een mislukte upload wordt
 * in de UI netjes afgevangen.
 */
export function isStorageConfigured(): boolean {
  return isFirebaseConfigured() && Boolean(firebaseConfig.storageBucket);
}

/** Firebase Storage instance (lazy, client-side). Voor foto-bewijs uploads. */
export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(app());
  return _storage;
}
