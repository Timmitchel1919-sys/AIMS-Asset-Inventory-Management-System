import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AppProvider } from "./context/AppContext";
import { MockRepositoryProvider } from "./data/mockRepository";
import { FirebaseRepositoryProvider } from "./data/firebaseRepository";
import { useApp } from "./context/AppContext";
import { DEMO_AUTH_MODE } from "./auth/aimsEmailPolicy";
import { PwaInstallProvider } from "./components/PwaStatus";
import { initializeKcsTheme } from "./lib/kcs-theme";
import { initializeAutoHidingScrollbars } from "./lib/scrollbars";

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
import "./styles/scrollbars.css";

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
    return <MockRepositoryProvider>{children}</MockRepositoryProvider>;
  if (authLoading || !user || !emailVerified) return children;
  return <FirebaseRepositoryProvider>{children}</FirebaseRepositoryProvider>;
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
          <RepositoryProvider>
            <App />
          </RepositoryProvider>
        </PwaInstallProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
