import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { DEMO_AUTH_MODE } from "../auth/aimsEmailPolicy";
import { DataTable, type DataColumn } from "../components/DataTable";
import { PageHeader } from "../components/WorkflowUi";
import { Badge, Card } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useMockSnapshot } from "../data/repositoryContext";
import { requireFirebase } from "../lib/firebase";

type DirectoryUser = {
  uid: string; displayName: string; photoURL?: string | null;
  department?: string | null; jobTitle?: string | null;
  accountType: "school-user" | "demo-user";
  authProvider: "password" | "google" | "anonymous";
  emailVerified: boolean; status: "active"; lastLoginAt?: string;
};

const asDate = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value)
    return (value as { toDate: () => Date }).toDate().toISOString();
  return undefined;
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

export default function UserDirectory() {
  const { language } = useApp(), snapshot = useMockSnapshot(), nl = language === "nl";
  const firebaseMode = import.meta.env.VITE_APP_MODE !== "presentation" && !DEMO_AUTH_MODE;
  const [registeredUsers, setRegisteredUsers] = useState<DirectoryUser[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseMode) return;
    const { db } = requireFirebase();
    return onSnapshot(collection(db, "userDirectory"), (result) => {
      setRegisteredUsers(result.docs.map((document) => {
        const item = document.data();
        return {
          uid: document.id,
          displayName: String(item.displayName || (nl ? "Onbekende gebruiker" : "Unknown user")),
          photoURL: typeof item.photoURL === "string" ? item.photoURL : null,
          department: typeof item.department === "string" ? item.department : null,
          jobTitle: typeof item.jobTitle === "string" ? item.jobTitle : null,
          accountType: item.accountType === "demo-user" ? "demo-user" : "school-user",
          authProvider: item.authProvider === "google" || item.authProvider === "anonymous" ? item.authProvider : "password",
          emailVerified: item.emailVerified === true,
          status: "active",
          lastLoginAt: asDate(item.lastLoginAt),
        };
      }));
      setError("");
    }, () => {
      setRegisteredUsers([]);
      setError(nl ? "De geregistreerde gebruikers konden niet worden geladen." : "Registered users could not be loaded.");
    });
  }, [firebaseMode, nl]);

  const demoUsers = useMemo<DirectoryUser[]>(() => snapshot.users.map((item) => ({
    uid: item.id, displayName: item.name, photoURL: item.photo,
    department: item.department, jobTitle: null, accountType: "school-user",
    authProvider: "password", emailVerified: true, status: "active", lastLoginAt: item.lastLogin,
  })), [snapshot.users]);
  const users = firebaseMode ? registeredUsers ?? [] : demoUsers;
  const providerLabel = (value: DirectoryUser["authProvider"]) => value === "anonymous"
    ? (nl ? "Anoniem" : "Anonymous")
    : value === "google" ? "Google" : (nl ? "E-mail en wachtwoord" : "Email & Password");
  const dateLabel = (value?: string) => value ? new Date(value).toLocaleString(language) : "—";
  const columns: DataColumn<DirectoryUser>[] = [
    { id: "user", label: nl ? "Gebruiker" : "User", render: (item) => <div className="directory-user"><span>{item.photoURL ? <img src={item.photoURL} alt="" /> : initials(item.displayName)}</span><strong>{item.displayName}</strong></div>, text: (item) => item.displayName, sortable: true },
    { id: "department", label: nl ? "Afdeling" : "Department", render: (item) => item.department || "—", text: (item) => item.department || "" },
    { id: "jobTitle", label: nl ? "Functietitel" : "Job title", render: (item) => item.jobTitle || "—", text: (item) => item.jobTitle || "" },
    { id: "accountType", label: nl ? "Accounttype" : "Account type", render: (item) => item.accountType === "demo-user" ? (nl ? "Demogebruiker" : "Demo User") : (nl ? "Schoolgebruiker" : "School User"), text: (item) => item.accountType },
    { id: "provider", label: nl ? "Authenticatie" : "Authentication", render: (item) => providerLabel(item.authProvider), text: (item) => providerLabel(item.authProvider) },
    { id: "verified", label: nl ? "Verificatie" : "Verification", render: (item) => item.authProvider === "anonymous" ? <Badge tone="success">{nl ? "Niet vereist" : "Not required"}</Badge> : <Badge tone={item.emailVerified ? "success" : "warning"}>{item.emailVerified ? (nl ? "Geverifieerd" : "Verified") : (nl ? "Niet geverifieerd" : "Unverified")}</Badge>, text: (item) => String(item.emailVerified) },
    { id: "status", label: "Status", render: () => <Badge tone="success">{nl ? "Actief" : "Active"}</Badge>, text: (item) => item.status },
    { id: "lastLogin", label: nl ? "Laatste aanmelding" : "Last login", render: (item) => dateLabel(item.lastLoginAt), text: (item) => dateLabel(item.lastLoginAt) },
  ];

  return <div className="page user-directory-page">
    <PageHeader title={nl ? "Gebruikers" : "Users"} description={nl ? "Geautoriseerde accounts van de Kangoeroe School en actieve demogebruikers." : "Authorized Kangoeroe School accounts and active demo users."} />
    {error && <p className="notice error" role="alert">{error}</p>}
    <section className="card data-card directory-table"><DataTable id="users-directory" rows={users} columns={columns} rowKey={(item) => item.uid} loading={firebaseMode && registeredUsers === null} searchPlaceholder={nl ? "Gebruikers zoeken…" : "Search users…"} emptyTitle={nl ? "Geen geregistreerde gebruikers" : "No registered users"} emptyDescription={nl ? "Geautoriseerde accounts verschijnen hier automatisch na hun eerste geverifieerde aanmelding." : "Authorized accounts appear here automatically after their first verified sign-in."} /></section>
    <section className="directory-cards" aria-label={nl ? "Gebruikers" : "Users"}>{users.map((item) => <Card key={item.uid}><header><span className="directory-avatar">{item.photoURL ? <img src={item.photoURL} alt="" /> : initials(item.displayName)}</span><div><strong>{item.displayName}</strong><small>{item.accountType === "demo-user" ? (nl ? "Demogebruiker" : "Demo User") : item.department || (nl ? "Afdeling niet opgegeven" : "Department not provided")}</small></div></header>{item.jobTitle && <p>{item.jobTitle}</p>}<footer><Badge tone="success">{nl ? "Actief" : "Active"}</Badge><span>{providerLabel(item.authProvider)}</span></footer></Card>)}</section>
  </div>;
}
