import { AlertTriangle, QrCode, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { useApp } from "../context/AppContext";
import { requireFirebase } from "../lib/firebase";
import { isValidQrToken } from "../domain/qrIdentity";
import { DEMO_AUTH_MODE } from "../auth/aimsEmailPolicy";
import { RouteLoader } from "../components/RouteBoundary";
import { useT } from "../i18n";

type ResolverState =
  | "resolving"
  | "not-found"
  | "revoked"
  | "unauthorized";

const isPermissionDenied = (error: unknown) =>
  ["permission-denied", "firestore/permission-denied"].includes(
    String((error as { code?: unknown })?.code || ""),
  );

export default function QrResolver() {
  const { token } = useParams();
  const { user, authLoading, emailVerified } = useApp();
  const location = useLocation();
  const t = useT();
  const [state, setState] = useState<ResolverState>("resolving");
  const [assetId, setAssetId] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    if (!token || !isValidQrToken(token)) {
      setState("not-found");
      return;
    }
    if (!user || (!emailVerified && !(DEMO_AUTH_MODE && user.isDemoUser)))
      return;
    setState("resolving");
    (async () => {
      try {
        const db = requireFirebase().db;
        const identitySnapshot = await getDoc(doc(db, "qrIdentities", token));
        if (!identitySnapshot.exists()) {
          if (active) setState("not-found");
          return;
        }
        const identity = identitySnapshot.data();
        if (identity?.status === "REVOKED") {
          if (active) setState("revoked");
          return;
        }
        if (identity?.status !== "ACTIVE") {
          if (active) setState("not-found");
          return;
        }
        const assetSnapshot = await getDoc(
          doc(db, "assets", String(identity.assetId)),
        );
        if (!assetSnapshot.exists()) {
          if (active) setState("not-found");
          return;
        }
        if (assetSnapshot.data().qrToken !== token) {
          if (active) setState("revoked");
          return;
        }
        if (active) setAssetId(String(identity.assetId));
      } catch (error) {
        if (active)
          setState(isPermissionDenied(error) ? "unauthorized" : "not-found");
      }
    })();
  }, [token, user, emailVerified]);

  if (authLoading) return <RouteLoader />;
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location, reason: undefined }}
        replace
      />
    );
  if (!emailVerified && !(DEMO_AUTH_MODE && user.isDemoUser))
    return (
      <Navigate
        to="/verify-email"
        state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }}
        replace
      />
    );
  if (assetId) return <Navigate to={`/assets/${assetId}`} replace />;

  const title =
    state === "not-found"
      ? t("qr.notFound")
      : state === "revoked"
        ? t("qr.revoked")
        : state === "unauthorized"
          ? t("qr.unauthorized")
          : t("qr.resolving");
  const Icon =
    state === "unauthorized"
      ? ShieldAlert
      : state === "resolving"
        ? QrCode
        : AlertTriangle;

  return (
    <main className="page qr-resolver-page">
      <div className="card qr-resolver-card">
        <div className="resolver-state">
          <Icon aria-hidden />
          <h2>{title}</h2>
          <p>
            <Link to="/dashboard">Dashboard</Link> ·{" "}
            <Link to="/assets">ICT Assets</Link>
          </p>
        </div>
      </div>
    </main>
  );
}