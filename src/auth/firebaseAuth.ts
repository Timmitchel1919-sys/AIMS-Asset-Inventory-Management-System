import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { requireFirebase } from "../lib/firebase";
import {
  AIMS_ACCESS_MESSAGE,
  AIMS_ACCOUNT_TYPE,
  AIMS_LOGIN_DOMAIN_MESSAGE,
  AIMS_ORGANIZATION_DOMAIN,
  AIMS_REGISTRATION_DOMAIN_MESSAGE,
  DEMO_AUTH_MODE,
  SELF_REGISTRATION_ENABLED,
  isEmailAllowedForCurrentMode,
  isVerificationRequired,
  normalizeEmail,
} from "./aimsEmailPolicy";

const LANGUAGE_STORAGE_KEY = "kcs-language";
function currentLanguagePreference(): "en" | "nl" {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "nl" ? "nl" : "en";
  } catch {
    return "en";
  }
}

export type RegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  department?: string;
  jobTitle?: string;
};
export type UserPreferences = {
  theme?: string;
  language?: "en" | "nl";
  dateFormat?: "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";
  timeFormat?: "24-hour" | "12-hour";
  notifications?: Record<string, boolean>;
};
export type UserProfile = {
  uid: string;
  fullName: string;
  displayName?: string;
  email: string | null;
  emailNormalized?: string;
  photoURL?: string | null;
  department?: string;
  jobTitle?: string;
  emailVerified: boolean;
  accountType?: "school-user" | "demo-user";
  organizationDomain?: string | null;
  authProvider?: "password" | "google" | "anonymous";
  status?: "active";
  isDemoUser?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  firstLoginAt?: unknown;
  lastLoginAt?: unknown;
  role?: string;
  preferences?: UserPreferences;
};

export const allowedDomains = () => [AIMS_ORGANIZATION_DOMAIN];
export const registrationEnabled = () => SELF_REGISTRATION_ENABLED;
export class DemoProfileProvisioningError extends Error {
  constructor(public readonly cause: unknown) {
    super(
      "You are signed in, but AIMS could not initialize your demo profile.",
    );
    this.name = "DemoProfileProvisioningError";
  }
}
export function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}
function logDevelopmentError(stage: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  console.error(`AIMS ${stage} failed:`, error);
  const code = firebaseErrorCode(error);
  if (code) console.error("Firebase error code:", code);
  if (error instanceof Error)
    console.error("Firebase error message:", error.message);
}
export function validateRegistration(
  input: RegistrationInput,
  confirmPassword: string,
) {
  const errors: Record<string, string> = {};
  const name = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) errors.fullName = "Full name is required.";
  else if (name.length > 100)
    errors.fullName = "Full name must be 100 characters or fewer.";
  if (
    DEMO_AUTH_MODE
      ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      : !isEmailAllowedForCurrentMode(email)
  )
    errors.email = DEMO_AUTH_MODE
      ? "Enter a valid email address."
      : AIMS_REGISTRATION_DOMAIN_MESSAGE;
  if (!registrationEnabled())
    errors.email = "Self-registration is temporarily unavailable.";
  if (
    input.password.length < 8 ||
    !/[a-z]/.test(input.password) ||
    !/[A-Z]/.test(input.password) ||
    !/[0-9]/.test(input.password)
  )
    errors.password =
      "Use 8+ characters with uppercase, lowercase, and a number.";
  if (input.password !== confirmPassword)
    errors.confirmPassword = "Passwords do not match.";
  return errors;
}
export function authErrorMessage(error: unknown) {
  if (error instanceof DemoProfileProvisioningError) return error.message;
  const code = firebaseErrorCode(error);
  const messages: Record<string, string> = {
    "auth/invalid-credential":
      "Unable to sign in with the provided credentials.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/email-already-in-use":
      "An account already exists for this email address. Sign in instead.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/network-request-failed":
      "Unable to reach Firebase. Check your network connection.",
    "auth/requires-recent-login":
      "For security, sign in again before changing your password.",
    "auth/operation-not-allowed":
      "Anonymous Authentication is disabled in Firebase. Enable it under Authentication → Sign-in method → Anonymous.",
    "auth/admin-restricted-operation":
      "Anonymous Authentication is disabled in Firebase. Enable it under Authentication → Sign-in method → Anonymous.",
    "auth/unauthorized-domain":
      "localhost is not authorized in Firebase Authentication.",
    "auth/api-key-not-valid": "Firebase configuration is invalid.",
    "auth/invalid-api-key": "Firebase configuration is invalid.",
    "auth/configuration-not-found":
      "Firebase Authentication is not configured correctly.",
    "permission-denied": "Firebase blocked access to the requested data.",
  };
  if (
    error instanceof Error &&
    [
      AIMS_ACCESS_MESSAGE,
      AIMS_LOGIN_DOMAIN_MESSAGE,
      AIMS_REGISTRATION_DOMAIN_MESSAGE,
      "Verify your email address before accessing AIMS.",
    ].includes(error.message)
  )
    return error.message;
  return (
    messages[code] || "We could not complete that request. Please try again."
  );
}
const providerFor = (user: FirebaseUser): "password" | "google" =>
  user.providerData.some((item) => item.providerId === "google.com")
    ? "google"
    : "password";
const pendingKey = (uid: string) => `aims-pending-profile:${uid}`;
function readPending(uid: string) {
  try {
    const value = localStorage.getItem(pendingKey(uid));
    return value
      ? (JSON.parse(value) as Partial<RegistrationInput>)
      : undefined;
  } catch {
    return undefined;
  }
}
function clearPending(uid: string) {
  try {
    localStorage.removeItem(pendingKey(uid));
  } catch {
    /* Storage may be unavailable. */
  }
}
async function syncPublicDirectoryProfile(
  user: FirebaseUser,
  profile: {
    displayName: string;
    department?: string | null;
    jobTitle?: string | null;
    accountType: "school-user" | "demo-user";
    authProvider: "password" | "google" | "anonymous";
  },
) {
  const { db } = requireFirebase();
  await setDoc(doc(db, "userDirectory", user.uid), {
    uid: user.uid,
    displayName: profile.displayName,
    photoURL: user.photoURL || null,
    department: profile.department || null,
    jobTitle: profile.jobTitle || null,
    accountType: profile.accountType,
    authProvider: profile.authProvider,
    emailVerified: user.emailVerified,
    status: "active",
    updatedAt: serverTimestamp(),
  });
}
export async function loadProfile(user: FirebaseUser): Promise<UserProfile> {
  const { db } = requireFirebase();
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  const data = snapshot.data() as Partial<UserProfile> | undefined;
  return {
    uid: user.uid,
    fullName:
      data?.displayName ||
      data?.fullName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "AIMS user",
    email: user.email ?? data?.email ?? null,
    photoURL: data?.photoURL || user.photoURL,
    department: data?.department,
    jobTitle: data?.jobTitle,
    emailVerified: user.emailVerified,
    accountType: data?.accountType,
    organizationDomain: data?.organizationDomain,
    authProvider: data?.authProvider,
    isDemoUser: data?.isDemoUser,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
    firstLoginAt: data?.firstLoginAt,
    lastLoginAt: data?.lastLoginAt,
    role: data?.role,
    preferences: data?.preferences,
  };
}
const demoProfileRequests = new Map<string, Promise<UserProfile>>();
async function provisionDemoUserProfile(
  user: FirebaseUser,
): Promise<UserProfile> {
  if (!DEMO_AUTH_MODE || !user.isAnonymous)
    throw new Error(AIMS_ACCESS_MESSAGE);
  const { db } = requireFirebase(),
    ref = doc(db, "users", user.uid),
    snapshot = await getDoc(ref);
  if (!snapshot.exists())
    await setDoc(ref, {
      uid: user.uid,
      displayName: "Demo User",
      email: null,
      accountType: "demo-user",
      authProvider: "anonymous",
      status: "active",
      isDemoUser: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      firstLoginAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      preferences: {
        theme: "aimsAzureGlass",
        language: currentLanguagePreference(),
      },
    });
  else
    await updateDoc(ref, {
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  await syncPublicDirectoryProfile(user, {
    displayName: "Demo User",
    accountType: "demo-user",
    authProvider: "anonymous",
  });
  return loadProfile(user);
}
export function ensureDemoUserProfile(
  user: FirebaseUser,
): Promise<UserProfile> {
  const pending = demoProfileRequests.get(user.uid);
  if (pending) return pending;
  const request = provisionDemoUserProfile(user).finally(() =>
    demoProfileRequests.delete(user.uid),
  );
  demoProfileRequests.set(user.uid, request);
  return request;
}
export async function ensureAimsUserProfile(
  user: FirebaseUser,
  signupData?: Partial<RegistrationInput>,
): Promise<UserProfile> {
  if (!isEmailAllowedForCurrentMode(user.email))
    throw new Error(AIMS_ACCESS_MESSAGE);
  if (isVerificationRequired() && !user.emailVerified)
    throw new Error("Verify your email address before accessing AIMS.");
  const { db } = requireFirebase(),
    ref = doc(db, "users", user.uid),
    snapshot = await getDoc(ref),
    existing = snapshot.data() as Partial<UserProfile> | undefined,
    pending = signupData || readPending(user.uid),
    email = normalizeEmail(user.email || ""),
    displayName = (
      pending?.fullName ||
      user.displayName ||
      existing?.displayName ||
      existing?.fullName ||
      email.split("@")[0]
    ).trim(),
    provider = providerFor(user);
  if (!snapshot.exists())
    await setDoc(ref, {
      uid: user.uid,
      displayName,
      email,
      emailNormalized: email,
      photoURL: user.photoURL || null,
      department: pending?.department?.trim() || null,
      jobTitle: pending?.jobTitle?.trim() || null,
      accountType: DEMO_AUTH_MODE ? "demo-user" : AIMS_ACCOUNT_TYPE,
      organizationDomain: DEMO_AUTH_MODE ? null : AIMS_ORGANIZATION_DOMAIN,
      authProvider: provider,
      emailVerified: user.emailVerified,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      firstLoginAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      preferences: {
        theme: "aimsAzureGlass",
        language: currentLanguagePreference(),
      },
    });
  else
    await updateDoc(ref, {
      displayName,
      photoURL: user.photoURL || existing?.photoURL || null,
      authProvider: provider,
      emailVerified: user.emailVerified,
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  await syncPublicDirectoryProfile(user, {
    displayName,
    department: pending?.department?.trim() || existing?.department || null,
    jobTitle: pending?.jobTitle?.trim() || existing?.jobTitle || null,
    accountType: DEMO_AUTH_MODE ? "demo-user" : AIMS_ACCOUNT_TYPE,
    authProvider: provider,
  });
  clearPending(user.uid);
  return loadProfile(user);
}
export async function register(input: RegistrationInput) {
  const { auth } = requireFirebase();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  if (!SELF_REGISTRATION_ENABLED)
    throw new Error("Self-registration is temporarily unavailable.");
  if (!isEmailAllowedForCurrentMode(email))
    throw new Error(AIMS_REGISTRATION_DOMAIN_MESSAGE);
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    input.password,
  );
  try {
    await updateProfile(credential.user, { displayName: fullName });
    localStorage.setItem(
      pendingKey(credential.user.uid),
      JSON.stringify({
        fullName,
        department: input.department?.trim(),
        jobTitle: input.jobTitle?.trim(),
      }),
    );
    await sendEmailVerification(credential.user);
    if (!isVerificationRequired())
      await ensureAimsUserProfile(credential.user, input);
  } catch (error) {
    await signOut(auth);
    throw new Error(
      `Your sign-in was created, but profile setup did not finish. Sign in again or contact ICT support. ${authErrorMessage(error)}`,
    );
  }
  return credential;
}
export async function login(
  email: string,
  password: string,
  remember: boolean,
) {
  const { auth } = requireFirebase(),
    normalized = normalizeEmail(email);
  if (!isEmailAllowedForCurrentMode(normalized))
    throw new Error(AIMS_LOGIN_DOMAIN_MESSAGE);
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
  const credential = await signInWithEmailAndPassword(
    auth,
    normalized,
    password,
  );
  if (!isEmailAllowedForCurrentMode(credential.user.email)) {
    await signOut(auth);
    throw new Error(AIMS_ACCESS_MESSAGE);
  }
  if (!isVerificationRequired() || credential.user.emailVerified)
    await ensureAimsUserProfile(credential.user);
  return credential;
}
export async function demoLogin() {
  if (!DEMO_AUTH_MODE) throw new Error(AIMS_ACCESS_MESSAGE);
  const { auth } = requireFirebase();
  let credential;
  try {
    await setPersistence(auth, browserSessionPersistence);
    credential = await signInAnonymously(auth);
    if (!credential.user.isAnonymous)
      throw new Error("Firebase did not create an anonymous user.");
    if (import.meta.env.DEV) console.info("Anonymous authentication succeeded");
  } catch (error) {
    logDevelopmentError("demo sign-in", error);
    throw error;
  }
  try {
    await ensureDemoUserProfile(credential.user);
    if (import.meta.env.DEV)
      console.info("Demo profile provisioning succeeded");
  } catch (error) {
    logDevelopmentError("demo profile provisioning", error);
    throw new DemoProfileProvisioningError(error);
  }
  return credential;
}
export async function googleLogin(remember: boolean) {
  const { auth } = requireFirebase();
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
  const provider = new GoogleAuthProvider();
  if (!DEMO_AUTH_MODE)
    provider.setCustomParameters({ hd: AIMS_ORGANIZATION_DOMAIN });
  const result = await signInWithPopup(auth, provider);
  if (
    !isEmailAllowedForCurrentMode(result.user.email) ||
    (isVerificationRequired() && !result.user.emailVerified)
  ) {
    await signOut(auth);
    throw new Error(AIMS_ACCESS_MESSAGE);
  }
  await ensureAimsUserProfile(result.user);
  return result;
}
export async function logout() {
  return signOut(requireFirebase().auth);
}
export async function forgotPassword(email: string) {
  return sendPasswordResetEmail(
    requireFirebase().auth,
    email.trim().toLowerCase(),
  );
}
export async function resendVerification() {
  const user = requireFirebase().auth.currentUser;
  if (!user) throw new Error("Sign in to resend verification.");
  return sendEmailVerification(user);
}
export async function refreshVerification() {
  const { auth } = requireFirebase();
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
  if (auth.currentUser.emailVerified)
    await ensureAimsUserProfile(auth.currentUser);
  return auth.currentUser.emailVerified;
}
export async function updateSelfProfile(values: {
  fullName: string;
  department: string;
  jobTitle: string;
}) {
  const { auth, db } = requireFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to update your profile.");
  await updateProfile(user, { displayName: values.fullName.trim() });
  await updateDoc(doc(db, "users", user.uid), {
    displayName: values.fullName.trim(),
    department: values.department.trim() || null,
    jobTitle: values.jobTitle.trim() || null,
    updatedAt: serverTimestamp(),
  });
}
export async function savePreferences(preferences: UserPreferences) {
  const { auth, db } = requireFirebase();
  if (!auth.currentUser) throw new Error("Sign in to save preferences.");
  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    preferences,
    updatedAt: serverTimestamp(),
  });
}
export function currentSignInMethod() {
  const user = requireFirebase().auth.currentUser;
  if (user?.isAnonymous) return "anonymous";
  const providers = user?.providerData.map((item) => item.providerId) || [];
  return providers.includes("password")
    ? "password"
    : providers.includes("google.com")
      ? "google"
      : "unknown";
}
export async function changePassword(
  currentPassword: string,
  password: string,
) {
  const user = requireFirebase().auth.currentUser;
  if (!user || !user.email) throw new Error("Sign in to change your password.");
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  );
  return updatePassword(user, password);
}
