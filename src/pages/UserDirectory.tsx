import { useMemo } from "react";
import { Badge, Card } from "../components/ui";
import { DataTable, type DataColumn } from "../components/DataTable";
import { PageHeader } from "../components/WorkflowUi";
import { useMockSnapshot } from "../data/repositoryContext";

type DirectoryUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  accountType: "school-user" | "demo-user";
  authProvider: "password" | "google" | "anonymous";
  emailVerified: boolean;
  status: "active";
  createdAt?: string;
  lastLoginAt?: string;
};
const providerLabel = (value: DirectoryUser["authProvider"]) =>
  value === "anonymous"
    ? "Anonymous"
    : value === "google"
      ? "Google"
      : "Email & Password";
const dateLabel = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

export default function UserDirectory() {
  const snapshot = useMockSnapshot(),
    loading = false,
    error = "";
  const users = useMemo<DirectoryUser[]>(
    () =>
      snapshot.users.map((item) => ({
        uid: item.id,
        displayName: item.name,
        email: item.email,
        photoURL: item.photo,
        department: item.department,
        jobTitle: null,
        accountType: "school-user",
        authProvider: "password",
        emailVerified: true,
        status: "active",
        lastLoginAt: item.lastLogin,
      })),
    [snapshot.users],
  );
  const columns: DataColumn<DirectoryUser>[] = [
    {
      id: "user",
      label: "User",
      render: (item) => (
        <div className="directory-user">
          <span>
            {item.photoURL ? (
              <img src={item.photoURL} alt="" />
            ) : (
              initials(item.displayName)
            )}
          </span>
          <strong>{item.displayName}</strong>
        </div>
      ),
      text: (item) => item.displayName,
      sortable: true,
    },
    {
      id: "email",
      label: "Email",
      render: (item) => item.email || "—",
      text: (item) => item.email || "",
    },
    {
      id: "department",
      label: "Department",
      render: (item) => item.department || "—",
      text: (item) => item.department || "",
    },
    {
      id: "jobTitle",
      label: "Job title",
      render: (item) => item.jobTitle || "—",
      text: (item) => item.jobTitle || "",
    },
    {
      id: "accountType",
      label: "Account type",
      render: (item) =>
        item.accountType === "demo-user" ? "Demo User" : "School User",
      text: (item) => item.accountType,
    },
    {
      id: "provider",
      label: "Authentication",
      render: (item) => providerLabel(item.authProvider),
      text: (item) => providerLabel(item.authProvider),
    },
    {
      id: "verified",
      label: "Verification",
      render: (item) =>
        item.authProvider === "anonymous" ? (
          <Badge tone="success">Not required</Badge>
        ) : (
          <Badge tone={item.emailVerified ? "success" : "warning"}>
            {item.emailVerified ? "Verified" : "Unverified"}
          </Badge>
        ),
      text: (item) =>
        item.authProvider === "anonymous"
          ? "Not required"
          : String(item.emailVerified),
    },
    {
      id: "status",
      label: "Status",
      render: () => <Badge tone="success">Active</Badge>,
      text: (item) => item.status,
    },
    {
      id: "lastLogin",
      label: "Last login",
      render: (item) => dateLabel(item.lastLoginAt),
      text: (item) => dateLabel(item.lastLoginAt),
    },
  ];
  return (
    <div className="page user-directory-page">
      <PageHeader
        title="Users"
        description="Authorized Kangoeroe School accounts and active demo users."
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section className="card data-card directory-table">
        <DataTable
          id="users-directory"
          rows={users}
          columns={columns}
          rowKey={(item) => item.uid}
          loading={loading}
          searchPlaceholder="Search users…"
          emptyTitle="No registered users"
          emptyDescription="Authorized accounts appear here automatically after their first successful sign-in."
        />
      </section>
      <section className="directory-cards" aria-label="Users">
        {users.map((item) => (
          <Card key={item.uid}>
            <header>
              <span className="directory-avatar">
                {item.photoURL ? (
                  <img src={item.photoURL} alt="" />
                ) : (
                  initials(item.displayName)
                )}
              </span>
              <div>
                <strong>{item.displayName}</strong>
                <small>
                  {item.accountType === "demo-user"
                    ? "Demo User"
                    : item.department || "Department not provided"}
                </small>
              </div>
            </header>
            {item.email ? (
              <a href={`mailto:${item.email}`}>{item.email}</a>
            ) : (
              <p>Demo session</p>
            )}
            {item.jobTitle && <p>{item.jobTitle}</p>}
            <footer>
              <Badge tone="success">Active</Badge>
              <span>{providerLabel(item.authProvider)}</span>
            </footer>
          </Card>
        ))}
      </section>
    </div>
  );
}
