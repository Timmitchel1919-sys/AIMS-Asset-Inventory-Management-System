import { getApp, getApps, initializeApp } from "firebase/app";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const environmentConfig = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const missingFirebaseEnvironmentVariables = Object.entries(
  environmentConfig,
)
  .filter(([, value]) => !value)
  .map(([key]) => key);
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured =
  missingFirebaseEnvironmentVariables.length === 0;
const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;
export const firebaseAuth = app ? getAuth(app) : null;

// Persistent local cache: the app opens cold offline for read/search, and
// non-transactional writes queue and replay on reconnect. Falls back to the
// default in-memory instance where IndexedDB is unavailable.
function initFirestore() {
  if (!app) return null;
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}
export const firestore = initFirestore();
export const firebaseStorage = app ? getStorage(app) : null;
export const firebaseFunctions = app ? getFunctions(app, "southamerica-east1") : null;
export const firebaseAi = app
  ? getAI(app, { backend: new GoogleAIBackend() })
  : null;

const useFirebaseEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (
  firebaseAuth &&
  useFirebaseEmulators &&
  firebaseAuth.emulatorConfig === null
) {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
}
if (firestore && useFirebaseEmulators) {
  try {
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  } catch (error) {
    if (import.meta.env.DEV)
      console.debug("Firestore emulator was already connected.", error);
  }
}
if (firebaseStorage && useFirebaseEmulators) {
  try {
    connectStorageEmulator(firebaseStorage, "127.0.0.1", 9199);
  } catch (error) {
    if (import.meta.env.DEV)
      console.debug("Storage emulator was already connected.", error);
  }
}
if (firebaseFunctions && useFirebaseEmulators) {
  try { connectFunctionsEmulator(firebaseFunctions, "127.0.0.1", 5001); }
  catch (error) { if (import.meta.env.DEV) console.debug("Functions emulator was already connected.", error); }
}

export function requireFirebase() {
  if (!firebaseAuth || !firestore || !firebaseStorage)
    throw new Error(
      `Firebase is not configured. Missing: ${missingFirebaseEnvironmentVariables.join(", ") || "Firebase initialization"}.`,
    );
  return { auth: firebaseAuth, db: firestore, storage: firebaseStorage };
}
