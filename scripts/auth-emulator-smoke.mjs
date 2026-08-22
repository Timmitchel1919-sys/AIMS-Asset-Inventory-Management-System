import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const app = initializeApp({
  apiKey: "demo-key",
  authDomain: "aims-auth-emulator-test.firebaseapp.com",
  projectId: "aims-auth-emulator-test",
});
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", {
  disableWarnings: true,
});

const email = `auth-smoke-${Date.now()}@kangoeroeschool.com`;
const password = "AimsSmoke123!";
const created = await createUserWithEmailAndPassword(auth, email, password);

if (created.user.email !== email) {
  throw new Error("Auth emulator returned an unexpected user email.");
}

await signOut(auth);
const signedIn = await signInWithEmailAndPassword(auth, email, password);

if (signedIn.user.uid !== created.user.uid) {
  throw new Error("Auth emulator sign-in returned a different user.");
}

await deleteUser(signedIn.user);
console.log("Firebase Auth emulator sign-up, sign-in, and cleanup passed.");
