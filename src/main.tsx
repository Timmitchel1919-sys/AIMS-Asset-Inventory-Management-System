import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AppProvider } from "./context/AppContext";
import { MockRepositoryProvider } from "./data/mockRepository";
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
          <MockRepositoryProvider>
            <App />
          </MockRepositoryProvider>
        </PwaInstallProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
