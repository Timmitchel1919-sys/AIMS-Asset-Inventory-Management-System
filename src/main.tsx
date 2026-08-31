import { StrictMode, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AppProvider } from "./context/AppContext";
import { useApp } from "./context/AppContext";
import { DEMO_AUTH_MODE } from "./auth/aimsEmailPolicy";
import { PwaInstallProvider } from "./components/PwaStatus";
import { RouteLoader } from "./components/RouteBoundary";
import { AppStartupGate } from "./components/startup/AppStartupGate";
import { initializeKcsTheme } from "./lib/kcs-theme";
import { initializeAutoHidingScrollbars } from "./lib/scrollbars";

// Loaded on demand instead of statically so the (large) Firestore/Auth SDK and
// the mock-data repository don't ship in the app's initial bundle for every visitor.
const MockRepositoryProvider = lazy(() =>
  import("./data/mockRepository").then((m) => ({
    default: m.MockRepositoryProvider,
  })),
);
const FirebaseRepositoryProvider = lazy(() =>
  import("./data/firebaseRepository").then((m) => ({
    default: m.FirebaseRepositoryProvider,
  })),
);

import "./styles/kcs-themes.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/auth.css";
import "./styles/list.css";
import "./styles/assets.css";
import "./styles/asset-status.css";
import "./components/download/AnimatedDownloadButton.css";
import "./styles/emerald-gloss.css";
import "./styles/aims-midnight.css";
import "./styles/aims-light.css";
import "./styles/scrollbars.css";
import "./styles/big-screen.css";

/*
 * Apply the saved KCS theme before React renders.
 * This prevents the page from first loading with the wrong theme.
 */
initializeKcsTheme();
initializeAutoHidingScrollbars();

function RepositoryProvider({ children }: { children: ReactNode }) {
  const { user, authLoading, emailVerified } = useApp();
  const presentation = import.meta.env.VITE_APP_MODE === "presentation";
  const localMock = import.meta.env.DEV && DEMO_AUTH_MODE;
  if (presentation || localMock)
    return (
      <Suspense fallback={<RouteLoader />}>
        <MockRepositoryProvider>{children}</MockRepositoryProvider>
      </Suspense>
    );
  if (authLoading || !user || !emailVerified) return children;
  return (
    <Suspense fallback={<RouteLoader />}>
      <FirebaseRepositoryProvider>{children}</FirebaseRepositoryProvider>
    </Suspense>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'React root element was not found. Ensure index.html contains <div id="root"></div>.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <PwaInstallProvider>
          <AppStartupGate><RepositoryProvider><App /></RepositoryProvider></AppStartupGate>
        </PwaInstallProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
